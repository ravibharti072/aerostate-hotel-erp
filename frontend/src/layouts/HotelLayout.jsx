import { useEffect, useState, useMemo } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import ReusableSidebar from "../components/navigation/ReusableSidebar";
import { hotelNavSections } from "../config/hotelNavConfig";
import {
  filterNavSectionsForUser,
  canAccessRoute,
  getUserRoleLevel,
  isHotelAdmin,
} from "../config/rbacConfig";
import AccessDeniedView from "../components/common/AccessDeniedView";
import "./hotelLayout.css";

export default function HotelLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [assignedModules, setAssignedModules] = useState([]);
  const [unreadAlertId, setUnreadAlertId] = useState(null);

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  };

  useEffect(() => {
    const fetchHotelModules = async () => {
      const hotelId = getLoggedInHotelId();
      if (!hotelId) return;
      try {
        const res = await api.get(`/hotels/${hotelId}/modules`);
        const mods = res.data?.modules;
        if (Array.isArray(mods)) {
          setAssignedModules(mods);
        }
      } catch (err) {
        console.error("Failed to load sidebar module permissions:", err);
      }
    };
    fetchHotelModules();
  }, [user]);

  useEffect(() => {
    const checkUnreadAlerts = async () => {
      try {
        const res = await api.get("/announcements/active");
        if (res.data && res.data.length > 0) {
          const latestAlert = res.data[0];
          const storedReadId = localStorage.getItem(`read_alert_${user?.username}`);
          if (String(latestAlert.id) !== storedReadId) {
            setUnreadAlertId(latestAlert.id);
          }
        }
      } catch (err) {
        console.error("Failed to check alerts:", err);
      }
    };
    if (user) checkUnreadAlerts();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // Dynamic role-based & department-aware navigation menu
  const dynamicMenuSections = useMemo(() => {
    return filterNavSectionsForUser(hotelNavSections, user, assignedModules);
  }, [assignedModules, user]);

  // Route-level permission verification
  const isRoutePermitted = useMemo(() => {
    return canAccessRoute(location.pathname, user);
  }, [location.pathname, user]);

  const roleLevel = getUserRoleLevel(user);
  const isAdmin = isHotelAdmin(user);

  const userDisplayName = user?.full_name || user?.username || "Hotel Admin";
  const userSubtitle = isAdmin
    ? "Hotel Administrator"
    : `${user?.designation || "Staff"}${
        roleLevel === "department_head" ? " (HOD)" : ""
      }`.trim();

  return (
    <div className="lrs-layout">
      <ReusableSidebar
        appTitle="AeroState PMS"
        appVersion="v1.0"
        appSubtitle="Property Management System"
        logoImg="/logo.png"
        menuSections={dynamicMenuSections}
        userName={userDisplayName}
        userSubtitle={userSubtitle}
        userInitials={(userDisplayName || "H")[0].toUpperCase()}
        onLogout={handleLogout}
      />

      <main className="lrs-main-content">
        {isRoutePermitted ? (
          <Outlet />
        ) : (
          <AccessDeniedView attemptedPath={location.pathname} />
        )}
      </main>
    </div>
  );
}