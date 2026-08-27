import { useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Hotel,
  Key,
  UserCog,
  Settings,
  LogOut,
  Calendar,
  ListOrdered
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import styles from "./superAdminSidebar.module.css"; // Corrected import

const mainNavItems = [
  { label: "Dashboard", icon: ShieldCheck, path: "/super-admin/dashboard" },
];

const managementNavItems = [
  { label: "Hotel Onboard", icon: Hotel, path: "/super-admin/hotel-onboard" },
  { label: "Create Credential", icon: Key, path: "/super-admin/create-credential" },
  { label: "Subscriptions", icon: Calendar, path: "/super-admin/subscriptions" },
  { label: "Assign Module", icon: UserCog, path: "/super-admin/assign-module" },
  { label: "Hotels Directory", icon: ListOrdered, path: "/super-admin/hotels" },
];

const systemNavItems = [
  { label: "Settings", icon: Settings, path: "/super-admin/settings" },
];

export default function SuperAdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/super-admin-login");
  }

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.brand}>
        <div className={styles.logoBox}>
          <img src="/logo.png" alt="Aerostate" />
        </div>
        <div className={styles.brandText}>
          <h2>Aerostate</h2>
          <span className={styles.versionBadge}>v1.0</span>
        </div>
      </div>

      {/* Navigation Container */}
      <div className={styles.menuContainer}>
        {/* Main Section */}
        <div className={styles.menuSection}>
          <span className={styles.sectionTitle}>Main</span>
          {mainNavItems.map((item) => (
            <button
              key={item.path}
              className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} />
              <span className={styles.navText}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Management Section */}
        <div className={styles.menuSection}>
          <span className={styles.sectionTitle}>Management</span>
          {managementNavItems.map((item) => (
            <button
              key={item.path}
              className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} />
              <span className={styles.navText}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* System Section */}
        <div className={styles.menuSection}>
          <span className={styles.sectionTitle}>System</span>
          {systemNavItems.map((item) => (
            <button
              key={item.path}
              className={`${styles.navLink} ${location.pathname === item.path ? styles.active : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} />
              <span className={styles.navText}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer User & Logout Box */}
      <div className={styles.sidebarFooter}>
        <div className={styles.userBox}>
          <div className={styles.userAvatar}>
            {(user?.username || "S")[0].toUpperCase()}
          </div>
          <div className={styles.userInfo}>
            <strong>{user?.username || "superadmin"}</strong>
            <span>{user?.role || "super-admin"}</span>
          </div>
        </div>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}