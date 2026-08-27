import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function SuperAdminRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/super-admin-login" replace />;
  }

  if (user?.role !== "super-admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}