import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PublicRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated && user?.role === "super-admin") {
    return <Navigate to="/super-admin/dashboard" replace />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}