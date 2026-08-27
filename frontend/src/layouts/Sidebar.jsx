import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Hotel,
  BedDouble,
  Users,
  CalendarCheck,
  ConciergeBell,
  FileText,
  CreditCard,
  Utensils,
  Package,
  Wrench,
  LogOut,
  Settings,
  Bell,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import "./sidebar.css";

export default function Sidebar() {
  const navigate = useNavigate();
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

  const menuSections = [
    {
      section: "MAIN",
      items: [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, alwaysShow: true }
      ]
    },
    {
      section: "OPERATIONS",
      items: [
        { label: "Front Desk", path: "/front-desk", icon: Hotel, moduleKey: "front-desk" },
        { label: "Rooms", path: "/rooms", icon: BedDouble, moduleKey: "rooms" },
        { label: "Room Status", path: "/room-status", icon: BedDouble, moduleKey: "rooms" },
        { label: "Guests", path: "/guests", icon: Users, moduleKey: "front-desk" },
        { label: "Bookings", path: "/bookings", icon: CalendarCheck, moduleKey: "front-desk" },
        { label: "Guest Services", path: "/guest-services", icon: ConciergeBell, moduleKey: "housekeeping" },
      ]
    },
    {
      section: "FINANCE & MANAGEMENT",
      items: [
        { label: "Accounts", path: "/accounts", icon: FileText, moduleKey: "accounts" },
        { label: "Invoices", path: "/invoices", icon: FileText, moduleKey: "accounts" },
        { label: "Payments", path: "/payments", icon: CreditCard, moduleKey: "accounts" },
        { label: "Restaurant", path: "/restaurant", icon: Utensils, moduleKey: "restaurant" },
        { label: "Inventory", path: "/inventory", icon: Package, moduleKey: "inventory" },
        { label: "Maintenance", path: "/maintenance", icon: Wrench, moduleKey: "housekeeping" },
      ]
    },
    {
      section: "SYSTEM",
      items: [
        { label: "Staff / HR", path: "/staff", icon: Users, moduleKey: "staff" },
        { label: "Reports", path: "/reports", icon: FileText, moduleKey: "reports" },
        { label: "Settings & Profile", path: "/settings", icon: Settings, alwaysShow: true },
        { label: "Updates & Alerts", path: "/alerts", icon: Bell, alwaysShow: true, moduleKey: "alerts" },
      ]
    }
  ];

  return (
    <div className="lrs-layout">
      <aside className="lrs-sidebar is-open">
        {/* HEADER BRANDING */}
        <div className="lrs-sidebar-header">
          <div className="lrs-sidebar-brand-row">
            
            {/* The white outer box with shadows for the logo */}
            <div className="lrs-sidebar-logo-mark">
               <div className="css-logo-grid">
                  <span className="sq blue"></span>
                  <span className="sq gray"></span>
                  <span className="sq teal"></span>
               </div>
            </div>

            <div className="lrs-sidebar-brand-text">
              <h2 className="lrs-sidebar-logo-title">
                <span className="lrs-sidebar-app-name">AeroState PMS</span>
                <span className="app-version-badge">v1.0</span>
              </h2>
              <p className="lrs-sidebar-subtitle">Property Management System</p>
            </div>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="lrs-sidebar-nav">
          {menuSections.map((sec, idx) => {
            const visibleItems = sec.items.filter((item) => {
              if (item.alwaysShow || user?.role === "super-admin") return true;
              return assignedModules.includes(item.moduleKey);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="lrs-sidebar-section">
                <h3 className="lrs-sidebar-section-title">{sec.section}</h3>

                {visibleItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (item.moduleKey === "alerts" && unreadAlertId) {
                        localStorage.setItem(`read_alert_${user?.username}`, String(unreadAlertId));
                        setUnreadAlertId(null);
                      }
                    }}
                    className={({ isActive }) =>
                      `lrs-sidebar-item ${isActive ? "is-active" : ""}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="lrs-sidebar-icon">
                          <item.icon size={16} />
                        </span>
                        
                        <span className="lrs-sidebar-label">{item.label}</span>
                        
                        {item.moduleKey === "alerts" && unreadAlertId && (
                          <span className="nav-badge">New</span>
                        )}

                        <ChevronRight className="lrs-sidebar-arrow" />
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* FOOTER */}
        <div className="lrs-sidebar-footer">
          <div className="lrs-sidebar-user">
            <span className="lrs-sidebar-user-icon">
              {(user?.username || user?.name || "H")[0].toUpperCase()}
            </span>
            <span className="lrs-sidebar-user-name">
              {user?.username || "Hotel Admin"}
            </span>
          </div>

          <button
            type="button"
            className="lrs-sidebar-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="lrs-main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}