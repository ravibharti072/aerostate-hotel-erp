import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Enforce account status and subscription expiry for hotel-admin users
  if (user && user.role === "hotel-admin") {
    // Check active status
    if (user.is_active === false) {
      return <Navigate to="/login?error=account_inactive" replace />;
    }

    // Check subscription validity date from localStorage
    const savedSubs = JSON.parse(localStorage.getItem("hotel_subscriptions") || "{}");
    const hotelSub = savedSubs[user.hotel_id];

    if (hotelSub && hotelSub.valid_upto) {
      const expiryDate = new Date(hotelSub.valid_upto);
      const today = new Date();

      // Reset time to compare dates accurately
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);

      if (today > expiryDate) {
        return <Navigate to="/login?error=subscription_expired" replace />;
      }
    }
  }

  return children;
}