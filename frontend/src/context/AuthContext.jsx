import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("hotel_erp_token"));
  const [loading, setLoading] = useState(true);
  
  // --- NEW: Global state for the Go-Live Date ---
  const [goLiveDate, setGoLiveDate] = useState(null);

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

    // --- NEW: Fetch and set Go-Live Date on login ---
    if (data.hotel_id) {
      const glDate = await fetchGoLiveDate(data.hotel_id);
      setGoLiveDate(glDate);
    }

    return data;
  };

  const logout = () => {
    localStorage.removeItem("hotel_erp_token");
    localStorage.removeItem("hotel_erp_user");

    setToken(null);
    setUser(null);
    setGoLiveDate(null); // Clear on logout
  };

  const loadUser = async () => {
    try {
      const savedToken = localStorage.getItem("hotel_erp_token");
      const savedUser = localStorage.getItem("hotel_erp_user");

      if (!savedToken) {
        setUser(null);
        setGoLiveDate(null);
        setLoading(false);
        return;
      }

      let activeUser = null;
      if (savedUser) {
        activeUser = JSON.parse(savedUser);
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

      // --- NEW: Fetch and set Go-Live Date on page reload ---
      if (activeUser.hotel_id) {
        const glDate = await fetchGoLiveDate(activeUser.hotel_id);
        setGoLiveDate(glDate);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        goLiveDate, // Expose to the rest of the app!
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