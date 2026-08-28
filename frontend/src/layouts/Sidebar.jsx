import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Hotel, BedDouble, Users, CalendarCheck, ConciergeBell,
  FileText, CreditCard, Utensils, Package, Wrench, Settings, Bell
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import ReusableSidebar from "../components/ReusableSidebar";
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

  const handleAlertClick = () => {
    if (unreadAlertId) {
      localStorage.setItem(`read_alert_${user?.username}`, String(unreadAlertId));
      setUnreadAlertId(null);
    }
  };

  const rawSections = [
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
        { 
          label: "Updates & Alerts", 
          path: "/alerts", 
          icon: Bell, 
          alwaysShow: true, 
          moduleKey: "alerts",
          badge: unreadAlertId ? "New" : null,
          onClick: handleAlertClick
        },
      ]
    }
  ];

  // Process visibility dynamically based on user/modules
  const dynamicMenuSections = rawSections.map(sec => ({
    ...sec,
    items: sec.items.filter(item => {
      if (item.alwaysShow || user?.role === "super-admin") return true;
      return assignedModules.includes(item.moduleKey);
    })
  })).filter(sec => sec.items.length > 0);

  return (
    <div className="lrs-layout">
      <ReusableSidebar 
        appTitle="AeroState PMS"
        appVersion="v1.0"
        appSubtitle="Property Management System"
        menuSections={dynamicMenuSections}
        userName={user?.username || "Hotel Admin"}
        userInitials={(user?.username || user?.name || "H")[0].toUpperCase()}
        onLogout={handleLogout}
      />

      {/* MAIN CONTENT AREA */}
      <main className="lrs-main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}