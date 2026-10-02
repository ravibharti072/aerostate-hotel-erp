import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("hotel_erp_token"));
  const [loading, setLoading] = useState(true);
  
  // --- NEW: Global state for the Go-Live Date and Hotel Info ---
  const [goLiveDate, setGoLiveDate] = useState(null);
  const [hotelInfo, setHotelInfo] = useState(null);

  // Helper function to check if a hotel admin account is expired or inactive
  const validateSubscriptionOrStatus = (userData) => {
    if (userData && userData.role === "hotel-admin") {
      // Check active status
      if (userData.is_active === false) {
        return false;
      }

      // Check subscription expiry date
      const savedSubs = JSON.parse(localStorage.getItem("hotel_subscriptions") || "{}");
      const hotelSub = savedSubs[userData.hotel_id];

      if (hotelSub && hotelSub.valid_upto) {
        const expiryDate = new Date(hotelSub.valid_upto);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);

        if (today > expiryDate) {
          return false;
        }
      }
    }
    return true;
  };

  // Helper to fetch hotel details from backend
  const fetchHotelInfo = async (hotelId) => {
    if (!hotelId) return null;
    try {
      const res = await api.get(`/hotels/${hotelId}`);
      return res.data;
    } catch (error) {
      console.warn("Failed to fetch hotel details", error);
      return null;
    }
  };

  // --- NEW: Helper to fetch the Go-Live Date for the user's hotel ---
  const fetchGoLiveDate = async (hotelId) => {
    if (!hotelId) return null;
    try {
      // Temporarily attach the token to the api instance manually if it's not set yet
      const currentToken = localStorage.getItem("hotel_erp_token");
      const config = currentToken ? { headers: { Authorization: `Bearer ${currentToken}` } } : {};
      
      const res = await api.get(`/system/hotels/${hotelId}/go-live`, config);
      return res.data.go_live_date;
    } catch (error) {
      console.error("Failed to fetch go-live date", error);
      return null;
    }
  };

  const updateHotelInfo = (newHotelData) => {
    if (!newHotelData) return;
    setHotelInfo((prev) => ({ ...(prev || {}), ...newHotelData }));
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        hotel_name: newHotelData.name || prev.hotel_name,
        hotel: { ...(prev.hotel || {}), ...newHotelData },
      };
      localStorage.setItem("hotel_erp_user", JSON.stringify(updated));
      return updated;
    });
  };

  const login = async (username, password) => {
    const response = await api.post("/auth/login", {
      username,
      password,
    });

    const data = response.data;

    // Validate before saving login session
    if (!validateSubscriptionOrStatus(data)) {
      throw new Error("Your subscription has expired or your account is inactive.");
    }

    localStorage.setItem("hotel_erp_token", data.access_token);
    localStorage.setItem("hotel_erp_user", JSON.stringify(data));

    setToken(data.access_token);
    setUser(data);
    if (data.hotel) {
      setHotelInfo(data.hotel);
    }

    // Fetch and set Go-Live Date & Hotel Info on login
    if (data.hotel_id) {
      const [glDate, hData] = await Promise.all([
        fetchGoLiveDate(data.hotel_id),
        data.hotel ? Promise.resolve(data.hotel) : fetchHotelInfo(data.hotel_id),
      ]);
      setGoLiveDate(glDate);
      if (hData) setHotelInfo(hData);
    }

    return data;
  };

  const logout = () => {
    localStorage.removeItem("hotel_erp_token");
    localStorage.removeItem("hotel_erp_user");

    setToken(null);
    setUser(null);
    setGoLiveDate(null);
    setHotelInfo(null);
  };

  const loadUser = async () => {
    try {
      const savedToken = localStorage.getItem("hotel_erp_token");
      const savedUser = localStorage.getItem("hotel_erp_user");

      if (!savedToken) {
        setUser(null);
        setGoLiveDate(null);
        setHotelInfo(null);
        setLoading(false);
        return;
      }

      let activeUser = null;
      if (savedUser) {
        try {
          activeUser = JSON.parse(savedUser);
          setUser(activeUser);
          if (activeUser.hotel) setHotelInfo(activeUser.hotel);
        } catch (e) {
          console.error("Failed to parse saved user", e);
        }
      }

      const response = await api.get("/auth/me");
      activeUser = response.data;

      // Validate status and expiry
      if (!validateSubscriptionOrStatus(activeUser)) {
        logout();
        setLoading(false);
        return;
      }

      setUser(activeUser);
      if (activeUser.hotel) setHotelInfo(activeUser.hotel);
      localStorage.setItem("hotel_erp_user", JSON.stringify(activeUser));

      // Fetch and set Go-Live Date & Hotel Info on page reload
      if (activeUser.hotel_id) {
        const [glDate, hData] = await Promise.all([
          fetchGoLiveDate(activeUser.hotel_id),
          fetchHotelInfo(activeUser.hotel_id),
        ]);
        setGoLiveDate(glDate);
        if (hData) setHotelInfo(hData);
      }

    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const effectiveHotel = hotelInfo || user?.hotel || (user?.hotel_name ? { name: user.hotel_name } : null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        goLiveDate,
        hotelInfo: effectiveHotel,
        updateHotelInfo,
        login,
        logout,
        isAuthenticated: Boolean(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );

}

export function useAuth() {
  return useContext(AuthContext);
}