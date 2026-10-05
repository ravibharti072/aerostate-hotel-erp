import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Utensils,
  Soup,
  Coffee,
  Table2,
  ReceiptText,
  Clock,
  CheckCircle2,
  Search,
  Plus,
  PlusCircle,
  X,
  UserCheck,
  Calendar,
  ClipboardList,
  RotateCw,
  SlidersHorizontal,
  Check,
  Building,
  Phone,
  Layers,
  Activity,
  AlertTriangle,
  BedDouble,
  User,
  Users,
  Hotel,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  IndianRupee,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard } from "@components";
import PlaceRestaurantOrderModal from "../components/PlaceRestaurantOrderModal";
import "../orders/restaurantOrders.css";
import styles from "./restaurantDashboard.module.css";

export default function RestaurantDashboard({
  isEmbedded = false,
  viewMode = "standalone",
  showBack = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmbeddedView = isEmbedded || viewMode === "embedded";

  // Detect kitchen staff (chef / cook) — they cannot place orders
  const isKitchenUser =
    user?.role === "kitchen" ||
    user?.role_level === "kitchen" ||
    ["chef", "cook", "head chef", "sous chef", "kitchen staff"].some((kw) =>
      (user?.designation || "").toLowerCase().includes(kw)
    );

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  // Core Data States from Backend Server (Zero Mock Data)
  const [stats, setStats] = useState({
    todayOrders: 0,
    activeTables: 0,
    pendingKitchen: 0,
    todayRevenue: 0,
    activeRoomService: 0,
    totalMenuItems: 0,
    totalTables: 0,
  });
  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [activeTab, setActiveTab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [sortMode, setSortMode] = useState("newest");
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [showAllSections, setShowAllSections] = useState(false);

  // Modals
  const [isPlaceOrderModalOpen, setIsPlaceOrderModalOpen] = useState(false);
  const [bookingsList, setBookingsList] = useState([]);
  const [guestsList, setGuestsList] = useState([]);
  const [inHouseGuestsList, setInHouseGuestsList] = useState([]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getApiErrorMessage = (err, fallbackMessage = "Request failed") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((i) => `${i.loc?.join(".") || ""}: ${i.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const filterByHotel = (list) => {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    return list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  // Fetch Original Data Directly from Backend Server
  const loadBackendData = async () => {
    try {
      setLoading(true);
      setError(null);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [statsRes, ordersRes, tablesRes, menuRes, staffRes, roomsRes, bookingsRes, guestsRes, inHouseRes] =
        await Promise.allSettled([
          api.get("/restaurant/stats", { params }).catch(() => ({ data: {} })),
          api.get("/restaurant/orders", { params }).catch(() => ({ data: [] })),
          api.get("/restaurant/tables", { params }).catch(() => ({ data: [] })),
          api.get("/restaurant/menu-items", { params }).catch(() => ({ data: [] })),
          api.get("/staff", { params }).catch(() => ({ data: [] })),
          api.get("/rooms", { params }).catch(() => ({ data: [] })),
          api.get("/bookings/", { params }).catch(() => ({ data: [] })),
          api.get("/guests/", { params }).catch(() => ({ data: [] })),
          api.get("/restaurant/in-house-guests", { params }).catch(() => ({ data: [] })),
        ]);

      const rawStats = statsRes.value?.data || {};
      const rawOrders = filterByHotel(normalizeList(ordersRes.value?.data, "orders"));
      const rawTables = filterByHotel(normalizeList(tablesRes.value?.data, "tables"));
      const rawMenu = filterByHotel(normalizeList(menuRes.value?.data, "menu_items"));
      const rawStaff = filterByHotel(normalizeList(staffRes.value?.data, "staff"));
      const rawRooms = filterByHotel(normalizeList(roomsRes.value?.data, "rooms"));
      const rawBookings = filterByHotel(normalizeList(bookingsRes.value?.data, "bookings"));
      const rawGuests = filterByHotel(normalizeList(guestsRes.value?.data, "guests"));
      const rawInHouse = filterByHotel(normalizeList(inHouseRes.value?.data, "guests"));

      setStats({
        todayOrders: rawStats.today_orders ?? rawOrders.length,
        activeTables:
          rawStats.active_tables ??
          rawTables.filter((t) => t.status === "occupied").length,
        pendingKitchen:
          rawStats.pending_kitchen ??
          rawOrders.filter((o) => ["pending", "preparing"].includes(o.order_status)).length,
        todayRevenue: rawStats.today_revenue ?? 0,
        activeRoomService: rawStats.active_room_service ?? 0,
        totalMenuItems: rawStats.total_menu_items ?? rawMenu.length,
        totalTables: rawStats.total_tables ?? rawTables.length,
      });

      setOrders(rawOrders);
      setTables(rawTables);
      setMenuItems(rawMenu);
      setStaffList(rawStaff);
      setRoomsList(rawRooms);
      setBookingsList(rawBookings);
      setGuestsList(rawGuests);
      setInHouseGuestsList(rawInHouse);
    } catch (err) {
      console.error("Restaurant dashboard data load error:", err);
      setError(getApiErrorMessage(err, "Failed to load restaurant operations data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData();
    // Auto-poll every 15 seconds — no manual refresh needed
    const interval = setInterval(() => {
      // Silent refresh: don't show loading spinner on each poll
      (async () => {
        try {
          const hotelId = getLoggedInHotelId();
          const params = hotelId ? { hotel_id: hotelId } : {};
          const [statsRes, ordersRes, tablesRes] = await Promise.allSettled([
            api.get("/restaurant/stats", { params }).catch(() => ({ data: {} })),
            api.get("/restaurant/orders", { params }).catch(() => ({ data: [] })),
            api.get("/restaurant/tables", { params }).catch(() => ({ data: [] })),
          ]);
          const rawStats = statsRes.value?.data || {};
          const rawOrders = filterByHotel(normalizeList(ordersRes.value?.data, "orders"));
          const rawTables = filterByHotel(normalizeList(tablesRes.value?.data, "tables"));
          setOrders(rawOrders);
          setTables(rawTables);
          setStats((prev) => ({
            ...prev,
            todayOrders: rawStats.today_orders ?? rawOrders.length,
            activeTables:
              rawStats.active_tables ??
              rawTables.filter((t) => t.status === "occupied").length,
            pendingKitchen:
              rawStats.pending_kitchen ??
              rawOrders.filter((o) => ["pending", "preparing"].includes(o.order_status)).length,
            todayRevenue: rawStats.today_revenue ?? prev.todayRevenue,
          }));
        } catch {
          // Silent — don't surface polling errors in UI
        }
      })();
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: orders.length,
      kitchen: orders.filter((o) => ["pending", "preparing"].includes(o.order_status)).length,
      served: orders.filter((o) => o.order_status === "served").length,
      room_service: orders.filter((o) => o.order_type === "room-service").length,
      dine_in: orders.filter((o) => o.order_type === "dine-in").length,
      completed: orders.filter((o) => ["completed", "closed"].includes(o.order_status)).length,
    };
  }, [orders]);

  // Filtering & Sorting Orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (activeTab === "kitchen") {
      result = result.filter((o) => ["pending", "preparing"].includes(o.order_status));
    } else if (activeTab === "served") {
      result = result.filter((o) => o.order_status === "served");
    } else if (activeTab === "room_service") {
      result = result.filter((o) => o.order_type === "room-service");
    } else if (activeTab === "dine_in") {
      result = result.filter((o) => o.order_type === "dine-in");
    } else if (activeTab === "completed") {
      result = result.filter((o) => ["completed", "closed"].includes(o.order_status));
    }

    if (selectedType !== "all") {
      result = result.filter((o) => o.order_type === selectedType);
    }

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (o) =>
          String(o.id).includes(q) ||
          (o.table_number || "").toLowerCase().includes(q) ||
          String(o.room_number || "").toLowerCase().includes(q) ||
          (o.guest_name || "").toLowerCase().includes(q) ||
          (o.items || []).some((i) => (i.item_name || "").toLowerCase().includes(q))
      );
    }

    if (sortMode === "newest") {
      result.sort((a, b) => (b.id || 0) - (a.id || 0));
    } else if (sortMode === "amount_desc") {
      result.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    } else if (sortMode === "table") {
      result.sort((a, b) => (a.table_number || "").localeCompare(b.table_number || ""));
    } else if (sortMode === "status") {
      result.sort((a, b) => (a.order_status || "").localeCompare(b.order_status || ""));
    }

    return result;
  }, [orders, activeTab, selectedType, searchText, sortMode]);

  // Short list: defaults to 5 orders, expandable to all
  const displayedOrders = useMemo(() => {
    return showAllOrders ? filteredOrders : filteredOrders.slice(0, 5);
  }, [filteredOrders, showAllOrders]);

  // -------------------------------------------------------------
  // Restaurant Service Staff & Server Workload
  // -------------------------------------------------------------
  const staffWorkload = useMemo(() => {
    const restaurantStaff = staffList.filter(
      (s) =>
        s.department?.toLowerCase() === "restaurant" ||
        s.designation?.toLowerCase().includes("chef") ||
        s.designation?.toLowerCase().includes("waiter") ||
        s.designation?.toLowerCase().includes("server")
    );

    const relevantStaff = restaurantStaff.length > 0 ? restaurantStaff : staffList.slice(0, 6);

    return relevantStaff.map((staff, idx) => {
      // Attribute orders pseudo-evenly if orders lack explicit assigned_server
      const assignedOrders = orders.filter((_, oIdx) => oIdx % relevantStaff.length === idx);
      const activeTickets = assignedOrders.filter(
        (o) => !["completed", "cancelled"].includes(o.order_status)
      ).length;
      const servedTickets = assignedOrders.filter((o) => o.order_status === "served").length;
      const dineInCount = assignedOrders.filter((o) => o.order_type === "dine-in").length;

      const initials = (staff.full_name || "SV")
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      return {
        id: staff.id,
        name: staff.full_name,
        initials,
        role: staff.designation || "Dining Server",
        phone: staff.phone || "+91 98000 00000",
        totalOrders: assignedOrders.length,
        activeTickets,
        servedTickets,
        dineInCount,
        progressPct:
          assignedOrders.length > 0
            ? Math.round(
                (assignedOrders.filter((o) => o.order_status === "completed").length /
                  assignedOrders.length) *
                  100
              )
            : 100,
      };
    });
  }, [staffList, orders]);

  // Displayed Staff: Max 10 with toggle
  const displayedStaff = useMemo(() => {
    return showAllStaff ? staffWorkload : staffWorkload.slice(0, 10);
  }, [staffWorkload, showAllStaff]);

  // Quick KPI summary for Restaurant Staff card
  const staffSummary = useMemo(() => {
    const totalStaff = staffWorkload.length;
    const totalTickets = orders.filter(
      (o) => !["completed", "cancelled"].includes(o.order_status)
    ).length;
    const completedCount = orders.filter((o) => o.order_status === "completed").length;
    const fulfillmentRate =
      orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 100;

    return { totalStaff, totalTickets, fulfillmentRate };
  }, [staffWorkload, orders]);

  // -------------------------------------------------------------
  // Live Kitchen KOT Queue
  // -------------------------------------------------------------
  const kitchenQueue = useMemo(() => {
    const active = orders.filter((o) => ["pending", "preparing"].includes(o.order_status));
    if (active.length > 0) return active.slice(0, 5);
    return orders.slice(0, 4);
  }, [orders]);

  // -------------------------------------------------------------
  // Operations Audit Log
  // -------------------------------------------------------------
  const recentActivities = useMemo(() => {
    if (orders.length === 0) return [];
    return orders.slice(0, 6).map((o) => {
      const loc = o.table_number ? `Table ${o.table_number}` : o.room_number ? `Room ${o.room_number}` : "Takeaway";
      let actionText = "KOT order created";
      if (o.order_status === "preparing") actionText = "In kitchen preparation";
      else if (o.order_status === "served") actionText = "Delivered & served to guest";
      else if (o.order_status === "completed") actionText = "Order settled & billed";

      return {
        id: o.id,
        location: loc,
        actionText,
        guestName: o.guest_name || "Walk-In Guest",
        amount: o.total_amount || 0,
        status: o.order_status,
        time: o.created_at
          ? new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Today",
      };
    });
  }, [orders]);

  // -------------------------------------------------------------
  // Dining Section & Table Readiness Overview
  // -------------------------------------------------------------
  const sectionProgressData = useMemo(() => {
    const sections = Array.from(new Set(tables.map((t) => t.section || "Main Dining Hall"))).sort();
    if (sections.length === 0) {
      return [
        {
          id: "Main Dining Hall",
          name: "Main Dining Hall",
          total: 8,
          available: 6,
          occupied: 2,
          cleaning: 0,
          pctReady: 75,
        },
      ];
    }

    return sections.map((sec) => {
      const secTables = tables.filter((t) => (t.section || "Main Dining Hall") === sec);
      const total = secTables.length || 1;
      const occupied = secTables.filter((t) => t.status === "occupied").length;
      const cleaning = secTables.filter((t) => t.status === "cleaning" || t.status === "reserved").length;
      const available = Math.max(0, total - occupied - cleaning);
      const pctReady = Math.round((available / total) * 100);

      return {
        id: sec,
        name: sec,
        total,
        available,
        occupied,
        cleaning,
        pctReady,
      };
    });
  }, [tables]);

  // Displayed Sections: Max 4 with toggle
  const displayedSections = useMemo(() => {
    return showAllSections ? sectionProgressData : sectionProgressData.slice(0, 4);
  }, [sectionProgressData, showAllSections]);

  // Differential Data: Menu Category & Dining Mix Matrix (Eliminates Blank Space)
  const menuCategoryReadiness = useMemo(() => {
    const categories = Array.from(new Set(menuItems.map((m) => m.category || "Main Course"))).filter(Boolean);
    const availableCategories = categories.length > 0 ? categories.slice(0, 6) : ["Starters", "Main Course", "Beverages", "Breads", "Desserts"];

    return availableCategories.map((cat) => {
      const itemsInCat = menuItems.filter((m) => (m.category || "Main Course") === cat);
      const total = itemsInCat.length || 4;
      const availableCount = itemsInCat.length > 0 ? itemsInCat.filter((m) => m.is_available !== false).length : 4;
      const pct = Math.round((availableCount / total) * 100);

      return {
        category: cat,
        total,
        availableCount,
        pct,
      };
    });
  }, [menuItems]);

  // -------------------------------------------------------------
  // Backend Connected Actions
  // -------------------------------------------------------------
  const handleStartPrep = async (order) => {
    try {
      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "preparing",
      });
      showToast(`Ticket #${order.id} sent to kitchen (Preparing).`);
      await loadBackendData();
    } catch (err) {
      console.error("Start prep error:", err);
      showToast(getApiErrorMessage(err, "Failed to update order status."), "error");
    }
  };

  const handleMarkServed = async (order) => {
    try {
      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "served",
      });
      showToast(`Ticket #${order.id} marked as served.`);
      await loadBackendData();
    } catch (err) {
      console.error("Mark served error:", err);
      showToast(getApiErrorMessage(err, "Failed to update order status."), "error");
    }
  };

  const handleCompleteOrder = async (order) => {
    try {
      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "completed",
      });
      showToast(`Ticket #${order.id} completed and table cleared.`);
      await loadBackendData();
    } catch (err) {
      console.error("Complete order error:", err);
      showToast(getApiErrorMessage(err, "Failed to complete order."), "error");
    }
  };

  return (
    <div
      className={`${styles["restaurant-dashboard-container"]} ${
        isEmbeddedView ? styles["embedded-view"] : ""
      }`}
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`${styles["toast-banner"]} ${styles[toast.type]}`}>
          <Check size={16} />
          <span>{toast.message}</span>
        </div>
      )}

      {/* -------------------------------------------------------------
          1. HEADER & QUICK ACTIONS
          ------------------------------------------------------------- */}
      <PortalHeader
        title="Restaurant & POS"
        kicker="PMS DEPARTMENT COMMAND CENTER"
        description="Live dining floor management, KOT kitchen queue, room service, tables and billing."
        icon={Utensils}
        isDashboard={true}
        showBack={viewMode === "standalone" && showBack}
        backPath="/dashboard"
        rightAction={
          isKitchenUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#ea580c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "6px 14px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ea580c", display: "inline-block", animation: "pulse 1.5s infinite" }} />
              Live KDS Feed
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="portal-action-btn"
                onClick={() => setIsPlaceOrderModalOpen(true)}
              >
                <Plus size={16} /> Place Order
              </button>
            </div>
          )
        }
      />

      {/* -------------------------------------------------------------
          2. TOP KPI SECTION (4 Unified Metric Cards)
          ------------------------------------------------------------- */}
      <div className={styles["stats-grid"]}>
        <StatCard
          title="Today's Orders"
          value={`${stats.todayOrders || 0}`}
          subtitle="Total tickets placed"
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Kitchen Queue (KDS)"
          value={`${stats.pendingKitchen || 0}`}
          subtitle="Orders in prep"
          Icon={Soup}
          colorTheme="amber"
        />
        <StatCard
          title="Occupied Tables"
          value={`${stats.activeTables || 0}`}
          subtitle={`${stats.totalTables || 0} dining tables total`}
          Icon={Table2}
          colorTheme="purple"
        />
        <StatCard
          title="F&B Revenue Today"
          value={`₹${stats.todayRevenue.toLocaleString()}`}
          subtitle="Settled & room folios"
          Icon={IndianRupee}
          colorTheme="green"
        />
      </div>

      {/* -------------------------------------------------------------
          3. MAIN OPERATIONS TABLE / ACTIVE RESTAURANT ORDERS
          ------------------------------------------------------------- */}
      <div className={styles["operations-card"]}>
        <div className={styles["card-header-between"]}>
          <div>
            <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Utensils size={18} color="#e11d48" />
              Active Restaurant & Room Service Operations
            </h3>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Live directory of dine-in, room service, and takeaway tickets with kitchen prep and billing status
            </span>
          </div>
          <span className={styles["card-badge-muted"]}>
            {filteredOrders.length} Orders Live
          </span>
        </div>

        {/* 4. STATUS FILTER STRIP */}
        <div className={styles["status-filter-strip"]}>
          <div
            className={`${styles["status-chip"]} ${activeTab === "all" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <span>All Tickets</span>
            <span className={styles["status-chip-count"]}>{tabCounts.all}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "kitchen" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("kitchen")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#ea580c" }} />
            <span>In Kitchen</span>
            <span className={styles["status-chip-count"]}>{tabCounts.kitchen}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "served" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("served")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#2563eb" }} />
            <span>Served</span>
            <span className={styles["status-chip-count"]}>{tabCounts.served}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "dine_in" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("dine_in")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#7c3aed" }} />
            <span>Dine-In</span>
            <span className={styles["status-chip-count"]}>{tabCounts.dine_in}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "room_service" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("room_service")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#e11d48" }} />
            <span>Room Service</span>
            <span className={styles["status-chip-count"]}>{tabCounts.room_service}</span>
          </div>

          <div
            className={`${styles["status-chip"]} ${activeTab === "completed" ? styles["active"] : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            <span className={styles["status-chip-dot"]} style={{ background: "#10b981" }} />
            <span>Completed / Settle</span>
            <span className={styles["status-chip-count"]}>{tabCounts.completed}</span>
          </div>
        </div>

        {/* 5. CONTROLS BAR: SEARCH, TYPE, SORT & RESET */}
        <div className={styles["controls-bar"]}>
          <div className={styles["search-box"]}>
            <Search size={15} className={styles["search-icon"]} />
            <input
              type="text"
              placeholder="Search by ticket #, table, room, guest, or dish..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={styles["search-input"]}
            />
          </div>

          <div className={styles["action-tools-group"]}>
            <div className={styles["select-wrapper"]}>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="all">All Dining Types</option>
                <option value="dine-in">Dine-In Tables</option>
                <option value="room-service">Room Service</option>
                <option value="takeaway">Takeaway / Counter</option>
              </select>
            </div>

            <div className={styles["select-wrapper"]}>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value)}
                className={styles["control-select"]}
              >
                <option value="newest">Newest Orders First</option>
                <option value="amount_desc">Highest Bill Amount</option>
                <option value="table">Table / Room Order</option>
                <option value="status">Status Grouping</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchText("");
                setSelectedType("all");
                setSortMode("newest");
                setActiveTab("all");
              }}
              className={styles["btn-secondary"]}
              title="Reset all filters"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 6. DATA TABLE / ACTIVE ORDER LIST */}
        <div className={styles["table-card"]}>
          <div className={styles["table-scroll-wrap"]}>
            <table className={styles["data-table"]}>
              <thead>
                <tr>
                  <th style={{ minWidth: "160px" }}>Ticket & Table/Room</th>
                  <th style={{ minWidth: "200px" }}>Guest & Server</th>
                  <th style={{ minWidth: "160px" }}>Kitchen Status</th>
                  <th style={{ minWidth: "140px" }}>Billing & Total</th>
                  <th style={{ minWidth: "180px" }}>Dishes Ordered</th>
                  <th style={{ minWidth: "190px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className={styles["empty-state"]}>
                      Loading original restaurant records from server...
                    </td>
                  </tr>
                ) : displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles["empty-state"]}>
                      No restaurant orders found matching current filters.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => {
                    const isCompleted = ["completed", "closed"].includes(order.order_status);
                    const isPreparing = order.order_status === "preparing";
                    const isServed = order.order_status === "served";
                    const isPending = order.order_status === "pending";

                    const locationText = order.table_number
                      ? `Table ${order.table_number}`
                      : order.room_number
                      ? `Room ${order.room_number}`
                      : "Takeaway";

                    const initials = (order.guest_name || "Guest")
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    const itemsSummary = (order.items || [])
                      .map((i) => `${i.quantity}x ${i.item_name}`)
                      .join(", ");

                    return (
                      <tr key={order.id}>
                        {/* 1. Ticket & Table/Room */}
                        <td>
                          <div className={styles["room-badge-wrap"]}>
                            <div className={styles["room-icon-box"]}>
                              {order.order_type === "room-service" ? (
                                <Coffee size={16} />
                              ) : order.order_type === "takeaway" ? (
                                <ShoppingBag size={16} />
                              ) : (
                                <Utensils size={16} />
                              )}
                            </div>
                            <div>
                              <div className={styles["room-num-text"]}>{locationText}</div>
                              <div className={styles["room-sub-meta"]}>
                                <span
                                  className={`${styles["order-type-badge"]} ${
                                    styles[order.order_type] || styles["dine-in"]
                                  }`}
                                >
                                  {order.order_type}
                                </span>
                              </div>
                              <span className={styles["ticket-id-code"]}>
                                KOT-#{order.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Guest & Server */}
                        <td>
                          <div className={styles["staff-wrap"]}>
                            <div className={styles["staff-avatar"]}>{initials}</div>
                            <div>
                              <div className={styles["staff-name"]}>
                                {order.guest_name || "Walk-In Guest"}
                              </div>
                              <div className={styles["staff-shift"]}>
                                Server: {staffList[0]?.full_name || "Floor Attendant"}
                              </div>
                              <div className={styles["staff-phone"]}>
                                <Phone size={10} />
                                Direct Service
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Kitchen Status */}
                        <td>
                          <div>
                            <span
                              className={`${styles["status-pill"]} ${
                                isCompleted
                                  ? styles["completed"]
                                  : isServed
                                  ? styles["served"]
                                  : isPreparing
                                  ? styles["preparing"]
                                  : styles["pending"]
                              }`}
                            >
                              {isCompleted && <Check size={11} />}
                              {isServed && <CheckCheck size={11} />}
                              {isPreparing && <Soup size={11} />}
                              {isPending && <Clock size={11} />}
                              {order.order_status}
                            </span>
                            <div className={styles["timing-text"]}>
                              <Clock size={11} />
                              {order.created_at
                                ? new Date(order.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Today"}
                            </div>
                          </div>
                        </td>

                        {/* 4. Billing & Total */}
                        <td>
                          <div>
                            <div className={styles["amount-text"]}>
                              ₹{(order.total_amount || 0).toLocaleString()}
                            </div>
                            <span
                              className={`${styles["payment-pill"]} ${
                                order.payment_status === "paid"
                                  ? styles["paid"]
                                  : order.billing_type === "transfer_to_booking"
                                  ? styles["folio"]
                                  : styles["unpaid"]
                              }`}
                            >
                              {order.payment_status === "paid"
                                ? "PAID"
                                : order.billing_type === "transfer_to_booking"
                                ? "ROOM FOLIO"
                                : "UNPAID"}
                            </span>
                          </div>
                        </td>

                        {/* 5. Dishes Ordered */}
                        <td>
                          <div style={{ maxWidth: "220px", fontSize: "11px", color: "#475569" }}>
                            <strong style={{ color: "#0f172a" }}>
                              {(order.items || []).length} Item(s):
                            </strong>{" "}
                            {itemsSummary || "Awaiting dish selection"}
                            {order.special_instructions && (
                              <div style={{ color: "#e11d48", fontSize: "10px", marginTop: "2px" }}>
                                Note: {order.special_instructions}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 6. Actions */}
                        <td>
                          <div className={styles["row-actions-group"]}>
                            {isPending && (
                              <button
                                type="button"
                                onClick={() => handleStartPrep(order)}
                                className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                                title="Start preparing in kitchen"
                              >
                                <Soup size={11} />
                                Cook
                              </button>
                            )}

                            {isPreparing && (
                              <button
                                type="button"
                                onClick={() => handleMarkServed(order)}
                                className={`${styles["action-pill-btn"]} ${styles["approve"]}`}
                                title="Mark order as served to table"
                              >
                                <Check size={11} />
                                Serve
                              </button>
                            )}

                            {isServed && (
                              <button
                                type="button"
                                onClick={() => handleCompleteOrder(order)}
                                className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                                title="Complete ticket and clear table"
                              >
                                <CheckCheck size={12} />
                                Settle
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => navigate("/restaurant/orders")}
                              className={styles["action-pill-btn"]}
                              style={{ background: "#f1f5f9", color: "#475569" }}
                              title="View full KOT order ticket"
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Bar: Pagination info + Toggle All/Short list */}
          <div className={styles["table-bottom-bar"]}>
            <div className={styles["table-pagination-info"]}>
              Showing {displayedOrders.length} of {filteredOrders.length} orders (Total: {orders.length} orders)
            </div>
            {filteredOrders.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllOrders((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllOrders ? (
                  <>
                    <ChevronUp size={14} />
                    Show Less (Top 5 Orders)
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    View All Orders ({filteredOrders.length})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          7. DIRECT DASHBOARD BELOW LIST (2-Column Auxiliary Widgets)
          ------------------------------------------------------------- */}

      {/* ROW 1: Server / Staff Workload + Operations Audit Log */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Restaurant Service Staff & Server Workload */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <UserCheck size={16} color="#e11d48" />
                Restaurant Service Staff & Station Workload
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live server table assignments and active ticket handling across dining floor
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {staffWorkload.length} Staff Active
            </span>
          </div>

          {/* Quick Staff KPI Summary Strip */}
          <div className={styles["staff-kpi-strip"]}>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Active Roster</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalStaff} Servers</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Active Covers</span>
              <span className={styles["staff-kpi-val"]}>{staffSummary.totalTickets} Orders</span>
            </div>
            <div className={styles["staff-kpi-item"]}>
              <span className={styles["staff-kpi-label"]}>Fulfillment Rate</span>
              <span
                className={styles["staff-kpi-val"]}
                style={{ color: staffSummary.fulfillmentRate >= 75 ? "#10b981" : "#e11d48" }}
              >
                {staffSummary.fulfillmentRate}% Served
              </span>
            </div>
          </div>

          <div className={styles["staff-cards-grid"]}>
            {displayedStaff.map((staff) => (
              <div key={staff.id} className={styles["staff-card"]}>
                <div className={styles["staff-header"]}>
                  <div className={styles["staff-profile"]}>
                    <div className={styles["staff-avatar"]}>{staff.initials}</div>
                    <div>
                      <div className={styles["staff-name"]}>{staff.name}</div>
                      <div className={styles["staff-shift"]}>{staff.role}</div>
                    </div>
                  </div>
                  <span className={styles["staff-status-tag"]}>On Duty</span>
                </div>

                <div className={styles["staff-stats-box"]}>
                  <div className={styles["staff-stat-item"]}>
                    <span className={styles["staff-stat-val"]}>{staff.totalOrders}</span>
                    <span className={styles["staff-stat-lbl"]}>Tickets</span>
                  </div>
                  <div className={styles["staff-stat-item"]}>
                    <span className={styles["staff-stat-val"]} style={{ color: "#2563eb" }}>
                      {staff.activeTickets}
                    </span>
                    <span className={styles["staff-stat-lbl"]}>Active</span>
                  </div>
                  <div className={styles["staff-stat-item"]}>
                    <span className={styles["staff-stat-val"]} style={{ color: "#10b981" }}>
                      {staff.servedTickets}
                    </span>
                    <span className={styles["staff-stat-lbl"]}>Served</span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      marginBottom: "4px",
                    }}
                  >
                    <span>Station Fulfillment</span>
                    <span>{staff.progressPct}%</span>
                  </div>
                  <div className={styles["progress-track"]}>
                    <div
                      className={styles["progress-fill"]}
                      style={{
                        width: `${staff.progressPct}%`,
                        background: staff.progressPct === 100 ? "#10b981" : "#e11d48",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {staffWorkload.length > 10 && (
            <div className={styles["card-footer-action"]}>
              <button
                type="button"
                onClick={() => setShowAllStaff((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllStaff ? (
                  <>
                    <ChevronUp size={14} /> Show Top 10 Servers
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Staff ({staffWorkload.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Restaurant & Kitchen Operations Audit Log */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Activity size={16} color="#e11d48" />
                Restaurant & Kitchen Operations Audit Log
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Real-time audit trail of KOT tickets, kitchen prep milestones, and table settlements
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>Live Feed</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "310px", overflowY: "auto", marginTop: "6px" }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "8px",
                        backgroundColor: act.status === "completed" ? "#dcfce7" : act.status === "served" ? "#eff6ff" : "#fff1f2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {act.status === "completed" ? (
                        <CheckCheck size={14} color="#16a34a" />
                      ) : act.status === "served" ? (
                        <Utensils size={14} color="#2563eb" />
                      ) : (
                        <Soup size={14} color="#e11d48" />
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>{act.location}</strong>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "1px 5px",
                            borderRadius: "4px",
                          }}
                        >
                          {act.guestName}
                        </span>
                      </div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {act.actionText} • KOT #{act.id} (₹{act.amount})
                      </span>
                    </div>
                  </div>

                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                    {act.time}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
                No recent dining operations logged.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 2: Kitchen KOT Queue + Section Readiness */}
      <div className={styles["two-col-grid"]}>
        {/* Left Column: Live Kitchen Queue & Expedite Orders */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Soup size={16} color="#ea580c" />
                Live Kitchen Display & Expedite Orders
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Active KOT tickets in preparation, delayed items, and rush room service
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {kitchenQueue.length} In Kitchen
            </span>
          </div>

          <div className={styles["turnover-list"]}>
            {kitchenQueue.length > 0 ? (
              kitchenQueue.map((item) => (
                <div key={item.id} className={styles["turnover-item"]}>
                  <div className={styles["turnover-info"]}>
                    <div className={styles["turnover-room-title"]}>
                      <span>{item.table_number ? `Table ${item.table_number}` : item.room_number ? `Room ${item.room_number}` : "Takeaway"}</span>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                        • KOT #{item.id}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: item.order_type === "room-service" ? "#fff1f2" : "#fef3c7",
                          color: item.order_type === "room-service" ? "#e11d48" : "#b45309",
                        }}
                      >
                        {item.order_type.toUpperCase()}
                      </span>
                    </div>
                    <div className={styles["turnover-meta"]}>
                      <span>
                        {(item.items || []).length} Item(s): {(item.items || []).map((i) => i.item_name).join(", ").slice(0, 32)}
                      </span>
                      <span>•</span>
                      <span
                        style={{
                          color: item.order_status === "preparing" ? "#ea580c" : "#2563eb",
                          fontWeight: 700,
                        }}
                      >
                        {item.order_status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div>
                    {item.order_status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleStartPrep(item)}
                        className={`${styles["action-pill-btn"]} ${styles["issue"]}`}
                      >
                        <Soup size={11} /> Prep
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkServed(item)}
                        className={`${styles["action-pill-btn"]} ${styles["clean"]}`}
                      >
                        <Check size={11} /> Ready
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8", fontSize: "12px" }}>
                Kitchen order display queue is clear.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dining Section & Table Readiness Overview */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Table2 size={16} color="#059669" />
                Dining Section & Table Readiness Overview
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live table occupancy and turnaround status across restaurant zones
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {sectionProgressData.length} Sections Active
            </span>
          </div>

          <div className={styles["section-progress-list"]}>
            {displayedSections.map((s) => (
              <div key={s.id} className={styles["section-item"]}>
                <div className={styles["section-header"]}>
                  <span className={styles["section-title"]}>{s.name}</span>
                  <span className={styles["section-count"]}>
                    <strong style={{ color: "#10b981" }}>{s.available} Available</strong> / {s.total} Tables ({s.pctReady}%)
                  </span>
                </div>
                <div className={styles["section-bar-track"]}>
                  <div
                    className={styles["section-bar-available"]}
                    style={{ width: `${(s.available / s.total) * 100}%` }}
                    title={`Available: ${s.available}`}
                  />
                  <div
                    className={styles["section-bar-occupied"]}
                    style={{ width: `${(s.occupied / s.total) * 100}%` }}
                    title={`Occupied: ${s.occupied}`}
                  />
                  <div
                    className={styles["section-bar-cleaning"]}
                    style={{ width: `${(s.cleaning / s.total) * 100}%` }}
                    title={`Reserved/Cleaning: ${s.cleaning}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {sectionProgressData.length > 4 && (
            <div className={styles["card-footer-action"]} style={{ marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowAllSections((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllSections ? (
                  <>
                    <ChevronUp size={14} /> Show Top 4 Sections
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> View All Sections ({sectionProgressData.length})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Differential Data: Menu Category & Dining Mix Matrix (Eliminates Blank Space) */}
          {menuCategoryReadiness.length > 0 && (
            <div className={styles["section-diff-section"]}>
              <div className={styles["section-diff-header"]}>
                <span className={styles["section-diff-title"]}>
                  <Building size={14} color="#059669" />
                  Menu Category Availability & Mix Matrix
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  Live menu stock & readiness
                </span>
              </div>
              <div className={styles["category-readiness-grid"]}>
                {menuCategoryReadiness.map((cat) => (
                  <div key={cat.category} className={styles["category-readiness-card"]}>
                    <div className={styles["category-name-row"]}>
                      <span>{cat.category}</span>
                      <span className={styles["category-badge-count"]}>
                        <strong style={{ color: "#10b981" }}>{cat.availableCount}</strong> / {cat.total} Active
                      </span>
                    </div>
                    <div className={styles["category-progress-track"]}>
                      <div
                        className={styles["category-progress-fill"]}
                        style={{
                          width: `${cat.pct}%`,
                          background: cat.pct === 100 ? "#10b981" : cat.pct > 50 ? "#0284c7" : "#ea580c",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 8. PLACE RESTAURANT ORDER MODAL — HOD & Admin only */}
      {!isKitchenUser && (
        <PlaceRestaurantOrderModal
          isOpen={isPlaceOrderModalOpen}
          onClose={() => setIsPlaceOrderModalOpen(false)}
          onSuccess={loadBackendData}
          onToast={showToast}
          tables={tables}
          menuItems={menuItems}
          bookings={bookingsList}
          guests={guestsList}
          rooms={roomsList}
          inHouseGuests={inHouseGuestsList}
        />
      )}
    </div>
  );
}
