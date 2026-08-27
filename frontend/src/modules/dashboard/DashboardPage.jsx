import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  Building2,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Hotel,
  Package,
  ShieldCheck,
  Users,
  Utensils,
  Wrench,
  Clock,
  Settings,
  Bell
} from "lucide-react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import PortalHeader from "../../components/PortalHeader";
import StatCard from "../../components/StatCard";
import ModuleCard from "../../components/ModuleCard";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);
  const [assignedModules, setAssignedModules] = useState([]);
  
  // Track unread alerts for the highlight
  const [unreadAlertId, setUnreadAlertId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  const filterByHotel = (list) => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    return list.filter((item) => Number(item.hotel_id) === Number(hotelId));
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      const hotelId = getLoggedInHotelId();

      const promises = [
        api.get("/rooms"),
        api.get("/bookings"),
        api.get("/payments"),
        api.get("/restaurant/orders"),
        api.get("/maintenance/requests"),
      ];

      if (hotelId) {
        promises.push(api.get(`/hotels/${hotelId}/modules`).catch(() => ({ data: { modules: [] } })));
      }

      const results = await Promise.allSettled(promises);

      if (results[0].status === "fulfilled") setRooms(filterByHotel(normalizeList(results[0].value.data, "rooms")));
      if (results[1].status === "fulfilled") setBookings(filterByHotel(normalizeList(results[1].value.data, "bookings")));
      if (results[2].status === "fulfilled") setPayments(filterByHotel(normalizeList(results[2].value.data, "payments")));
      if (results[3].status === "fulfilled") setRestaurantOrders(filterByHotel(normalizeList(results[3].value.data, "orders")));
      if (results[4].status === "fulfilled") setMaintenanceRequests(filterByHotel(normalizeList(results[4].value.data, "maintenance_requests")));
      
      if (results[5] && results[5].status === "fulfilled") {
        const mods = results[5].value.data?.modules;
        setAssignedModules(Array.isArray(mods) ? mods : []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch active announcements to see if there is a new unread alert
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

  const todayDate = new Date().toDateString();
  const formattedTime = currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const formattedDate = currentTime.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  const stats = useMemo(() => {
    const availableRooms = rooms.filter((room) => String(room.status || "").toLowerCase() === "available").length;
    const occupiedRooms = rooms.filter((room) => {
      const status = String(room.status || "").toLowerCase();
      return status === "occupied" || status === "checked-in";
    }).length;
    const todayBookings = bookings.filter((booking) => {
      if (!booking.checkin_date) return false;
      return new Date(booking.checkin_date).toDateString() === todayDate;
    }).length;
    return { totalRooms: rooms.length, availableRooms, occupiedRooms, todayBookings };
  }, [rooms, bookings]);

  // Using color strings to map to the new ModuleCard properties
  const allPortals = [
    { title: "Front Desk", icon: Hotel, path: "/front-desk", color: "blue", moduleKey: "front-desk" },
    { title: "Rooms", icon: BedDouble, path: "/rooms", color: "teal", moduleKey: "rooms" },
    { title: "Housekeeping", icon: ClipboardList, path: "/housekeeping", color: "green", moduleKey: "housekeeping" },
    { title: "Restaurant", icon: Utensils, path: "/restaurant", color: "orange", moduleKey: "restaurant" },
    { title: "Inventory", icon: Package, path: "/inventory", color: "orange", moduleKey: "inventory" },
    { title: "Maintenance", icon: Wrench, path: "/maintenance", color: "red", moduleKey: "housekeeping" },
    { title: "Accounts", icon: CreditCard, path: "/accounts", color: "green", moduleKey: "accounts" },
    { title: "Staff / HR", icon: Users, path: "/staff", color: "purple", moduleKey: "staff" },
    { title: "Reports", icon: FileText, path: "/reports", color: "gray", moduleKey: "reports" },
    { title: "Settings & Profile", icon: Settings, path: "/settings", color: "gray", moduleKey: "settings", alwaysShow: true },
    { 
      title: "Updates & Alerts", 
      icon: Bell, 
      path: "/alerts", 
      color: "red", 
      moduleKey: "alerts", 
      alwaysShow: true,
      isAlertTile: true 
    },
  ];

  const operationPortals = useMemo(() => {
    if (user?.role === "super-admin") return allPortals;
    return allPortals.filter((portal) => portal.alwaysShow || assignedModules.includes(portal.moduleKey));
  }, [assignedModules, user]);

  return (
    <div className={styles["dashboard-page"]}>
      {/* HEADER WITHOUT BACK BUTTON */}
      <PortalHeader 
        title="Hotel Dashboard"
        kicker="PLATFORM OVERVIEW"
        icon={Building2}
        showBack={false}
        rightAction={
          <div className={styles["time-widget"]}>
            <Clock size={18} className={styles["time-icon"]} />
            <div className={styles["time-text"]}>
              <span className={styles["date"]}>{formattedDate}</span>
              <span className={styles["time"]}>{formattedTime}</span>
            </div>
          </div>
        }
      />

      {error && <div className={styles["alert-error"]}>{error}</div>}

      <section className={styles["welcome-banner"]}>
        <div className={styles["welcome-content"]}>
          <span className={styles["welcome-label"]}>WELCOME BACK</span>
          <h2>{user?.username || user?.name || "Hotel Admin"}</h2>
          <p>Your hotel control center is ready. Select a department module below to manage operations.</p>
        </div>
        <div className={styles["welcome-profile"]}>
          <div className={styles["profile-avatar"]}>{(user?.username || user?.name || "H")[0].toUpperCase()}</div>
          <div className={styles["profile-info"]}><span>Logged in as</span><strong>{user?.username || user?.name || "admin"}</strong></div>
        </div>
      </section>

      {/* --- REUSABLE STATS GRID --- */}
      <section className={styles["stats-grid"]}>
        <StatCard title="Total Rooms" value={stats.totalRooms} Icon={BedDouble} colorTheme="blue" />
        <StatCard title="Available Rooms" value={stats.availableRooms} Icon={ShieldCheck} colorTheme="green" />
        <StatCard title="Occupied Rooms" value={stats.occupiedRooms} Icon={Users} colorTheme="orange" />
        <StatCard title="Today's Bookings" value={stats.todayBookings} Icon={CalendarCheck} colorTheme="purple" />
      </section>
      {/* --------------------------- */}

      <section className={styles["modules-section"]}>
        <div className={styles["section-header"]}>
          <div><h3>Department Portals</h3><p>Open any module to manage related operations.</p></div>
          <div className={styles["module-badge"]}>{operationPortals.length} modules</div>
        </div>

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className={styles["modules-grid"]}>
          {operationPortals.map((portal) => (
            <div 
              key={portal.path} 
              className={styles["module-wrapper"]}
              onClick={() => {
                if (portal.isAlertTile && unreadAlertId) {
                  localStorage.setItem(`read_alert_${user?.username}`, String(unreadAlertId));
                  setUnreadAlertId(null);
                }
                navigate(portal.path);
              }}
            >
              {/* Dynamic Notification Pulse Dot */}
              {portal.isAlertTile && unreadAlertId && (
                <span className={styles["pulse-dot"]}></span>
              )}
              
              <ModuleCard
                title={portal.title}
                Icon={portal.icon}
                colorTheme={portal.color}
                onClick={() => {}} /* Click handled by wrapper to include alerts logic */
              />
            </div>
          ))}
        </div>
        {/* ---------------------------------- */}
      </section>
    </div>
  );
}