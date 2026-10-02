import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  BedDouble,
  CheckCircle2,
  DoorOpen,
  Building2,
  Sparkles,
  Wrench,
  XCircle,
  CalendarDays,
  Percent,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  AlertTriangle,
  RotateCcw,
  LayoutGrid,
  List,
  Users,
  Check,
  ExternalLink,
  Shield,
  Filter,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./roomStatus.css";

const roomStatuses = [
  "available",
  "occupied",
  "reserved",
  "dirty",
  "cleaning",
  "maintenance",
  "out-of-service",
];

const statusConfig = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    badgeClass: "badge-available",
    cardClass: "border-available",
  },
  occupied: {
    label: "Occupied",
    icon: DoorOpen,
    badgeClass: "badge-occupied",
    cardClass: "border-occupied",
  },
  reserved: {
    label: "Reserved",
    icon: Building2,
    badgeClass: "badge-reserved",
    cardClass: "border-reserved",
  },
  dirty: {
    label: "Dirty / Turnover",
    icon: AlertTriangle,
    badgeClass: "badge-dirty",
    cardClass: "border-dirty",
  },
  cleaning: {
    label: "Cleaning",
    icon: Sparkles,
    badgeClass: "badge-cleaning",
    cardClass: "border-cleaning",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    badgeClass: "badge-maintenance",
    cardClass: "border-maintenance",
  },
  "out-of-service": {
    label: "Out of Service",
    icon: XCircle,
    badgeClass: "badge-outofservice",
    cardClass: "border-outofservice",
  },
};

const LEGENDS = [
  { label: "Occupied Stay", color: "#ea580c" },
  { label: "Reserved / Advance", color: "#9333ea" },
  { label: "Dirty / Turnover Queue", color: "#b45309" },
  { label: "Cleaning In-Progress", color: "#2563eb" },
  { label: "Available & Ready", color: "#16a34a" },
  { label: "Maintenance / Blocked", color: "#64748b" },
];

function inferFloorFromRoomNumber(roomNum) {
  if (!roomNum) return "";
  const clean = String(roomNum).trim();
  const match = clean.match(/^(\d+)/);
  if (match) {
    const num = match[1];
    if (num.length >= 3) {
      return num.slice(0, num.length - 2);
    } else if (num.length === 2) {
      return num.charAt(0);
    }
  }
  return "";
}

function calculateRoomGst(price) {
  const p = Number(price) || 0;
  if (p <= 0) return { rate: 0, taxAmount: 0, total: 0 };
  if (p < 1000) return { rate: 0, taxAmount: 0, total: p };
  if (p < 7500) {
    const tax = Math.round(p * 0.12 * 100) / 100;
    return { rate: 12, taxAmount: tax, total: Math.round((p + tax) * 100) / 100 };
  }
  const tax = Math.round(p * 0.18 * 100) / 100;
  return { rate: 18, taxAmount: tax, total: Math.round((p + tax) * 100) / 100 };
}

export default function RoomStatusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // View & Queue Modes
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "rack"
  const [activeTab, setActiveTab] = useState("all"); // "all" | "available" | "occupied" | "housekeeping" | "maintenance" | "reserved"
  const [statusFilter, setStatusFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // Updating Indicator
  const [updatingRoomId, setUpdatingRoomId] = useState(null);

  // Calendar Modal State
  const [activeRoom, setActiveRoom] = useState(null);
  const [calDate, setCalDate] = useState(new Date());
  const [roomBookings, setRoomBookings] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || null;
  };

  const normalizeList = (data, key) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = { date: selectedDate };
      if (hotelId) params.hotel_id = hotelId;

      const res = await api.get("/rooms", { params });
      setRooms(normalizeList(res.data, "rooms"));
    } catch (err) {
      console.error("Fetch room status error:", err);
      showToast("Failed to load room status from server.", "error");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [selectedDate]);

  // Date Navigation Helpers
  const handleDateOffset = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const isSelectedDateToday = useMemo(() => {
    return selectedDate === new Date().toISOString().split("T")[0];
  }, [selectedDate]);

  // Quick In-Card Status Changer
  const handleQuickStatusChange = async (roomId, newStatus, e) => {
    if (e) e.stopPropagation();
    if (!roomId || !newStatus) return;
    try {
      setUpdatingRoomId(roomId);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r))
      );
      if (activeRoom && activeRoom.id === roomId) {
        setActiveRoom((prev) => ({ ...prev, status: newStatus }));
      }
      try {
        await api.patch(`/rooms/${roomId}/status`, { status: newStatus });
      } catch {
        await api.put(`/rooms/${roomId}`, { status: newStatus });
      }
      showToast(`Room status updated to ${newStatus.replace("-", " ").toUpperCase()}`, "success");
    } catch (err) {
      console.error("Status update error:", err);
      showToast("Failed to update room status on server.", "error");
      fetchRooms();
    } finally {
      setUpdatingRoomId(null);
    }
  };

  // Fetch room reservation events on demand for modal
  const handleRoomClick = async (room) => {
    setActiveRoom(room);
    setSelectedBooking(null);
    try {
      setCalLoading(true);
      const res = await api.get("/bookings", { params: { room_id: room.id } });
      const bList = normalizeList(res.data, "bookings");

      const mapped = bList.map((b) => ({
        id: b.id,
        guest_name: b.guest?.full_name || b.guest_name || `Guest #${b.guest_id || b.id}`,
        phone: b.guest?.phone || b.phone || "Not specified",
        status: b.status || "confirmed",
        check_in: b.checkin_date ? String(b.checkin_date).split("T")[0] : "",
        check_out: b.checkout_date ? String(b.checkout_date).split("T")[0] : "",
        total_amount: b.total_amount || 0,
        payment_status: b.payment_status || "pending",
        room_rate: b.room_rate || 0,
      }));

      setRoomBookings(mapped);
    } catch (err) {
      console.error("Failed to fetch room bookings:", err);
      setRoomBookings([]);
    } finally {
      setCalLoading(false);
    }
  };

  const closeCalendarModal = () => {
    setActiveRoom(null);
    setSelectedBooking(null);
    setRoomBookings([]);
  };

  // Distinct Floors & Types for Filter Toolbar
  const availableFloors = useMemo(() => {
    const set = new Set();
    rooms.forEach((r) => {
      const fl = String(r.floor ?? inferFloorFromRoomNumber(r.room_number) ?? "").trim();
      if (fl) set.add(fl);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);

  const availableRoomTypes = useMemo(() => {
    const set = new Set();
    rooms.forEach((r) => {
      if (r.room_type) set.add(String(r.room_type).trim());
    });
    return Array.from(set);
  }, [rooms]);

  // Aggregation of server-provided room statuses
  const roomStats = useMemo(() => {
    const stats = {
      total: rooms.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      dirty: 0,
      cleaning: 0,
      maintenance: 0,
      "out-of-service": 0,
      housekeeping: 0,
      blocked: 0,
      occupancyRate: 0,
    };

    rooms.forEach((room) => {
      const status = String(room?.status || "available").toLowerCase();
      if (stats[status] !== undefined) {
        stats[status] += 1;
      }
      if (status === "dirty" || status === "cleaning") {
        stats.housekeeping += 1;
      }
      if (status === "maintenance" || status === "out-of-service") {
        stats.blocked += 1;
      }
    });

    if (stats.total > 0) {
      stats.occupancyRate = Math.round((stats.occupied / stats.total) * 100);
    }

    return stats;
  }, [rooms]);

  // Filter records by search input, queue tab, status filter, and floor filter
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const status = String(room?.status || "available").toLowerCase();
      const roomNumber = String(room?.room_number || "").toLowerCase();
      const roomType = String(room?.room_type || "").toLowerCase();
      const floor = String(room?.floor ?? inferFloorFromRoomNumber(room?.room_number) ?? "").toLowerCase();
      const search = searchText.toLowerCase().trim();

      // Queue Tab Filter
      if (activeTab === "available" && status !== "available") return false;
      if (activeTab === "occupied" && status !== "occupied") return false;
      if (activeTab === "housekeeping" && status !== "cleaning" && status !== "dirty") return false;
      if (activeTab === "maintenance" && status !== "maintenance" && status !== "out-of-service") return false;
      if (activeTab === "reserved" && status !== "reserved") return false;

      // Dropdown Status Filter
      if (statusFilter !== "all" && status !== statusFilter) return false;

      // Dropdown Floor Filter
      if (floorFilter !== "all") {
        const roomFloor = String(room?.floor ?? inferFloorFromRoomNumber(room?.room_number) ?? "").trim().toLowerCase();
        if (roomFloor !== floorFilter.toLowerCase()) return false;
      }

      // Dropdown Room Type Filter
      if (roomTypeFilter !== "all") {
        if (String(room?.room_type || "").toLowerCase() !== roomTypeFilter.toLowerCase()) return false;
      }

      // Search Query
      if (search) {
        const matches =
          roomNumber.includes(search) ||
          roomType.includes(search) ||
          floor.includes(search) ||
          status.includes(search);
        if (!matches) return false;
      }

      return true;
    });
  }, [rooms, activeTab, statusFilter, floorFilter, roomTypeFilter, searchText]);

  // Group rooms strictly by floor for Floor Grid view
  const roomsByFloor = useMemo(() => {
    const grouped = {};
    filteredRooms.forEach((room) => {
      const floorVal = room?.floor ?? inferFloorFromRoomNumber(room?.room_number);
      const floorKey =
        floorVal !== null && floorVal !== undefined && String(floorVal).trim() !== ""
          ? `Floor ${floorVal}`
          : "Ground / General Floor";
      if (!grouped[floorKey]) {
        grouped[floorKey] = [];
      }
      grouped[floorKey].push(room);
    });

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((floor) => ({
        floor,
        rooms: grouped[floor].sort((a, b) =>
          String(a.room_number || "").localeCompare(String(b.room_number || ""), undefined, { numeric: true })
        ),
      }));
  }, [filteredRooms]);

  const hasActiveFilters =
    Boolean(searchText) ||
    statusFilter !== "all" ||
    floorFilter !== "all" ||
    roomTypeFilter !== "all" ||
    activeTab !== "all";

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("all");
    setStatusFilter("all");
    setFloorFilter("all");
    setRoomTypeFilter("all");
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // Calendar Helpers
  const currentMonthName = calDate.toLocaleString("default", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1));
  };

  const gotoToday = () => {
    setCalDate(new Date());
  };

  const calendarDays = useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthTotalDays - i,
        isCurrentMonth: false,
        dateStr: null,
      });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        dateStr,
      });
    }

    const remainingDays = (7 - (days.length % 7)) % 7;
    for (let r = 1; r <= remainingDays; r++) {
      days.push({
        dayNumber: r,
        isCurrentMonth: false,
        dateStr: null,
      });
    }

    return days;
  }, [calDate]);

  const getBookingsForDate = (dateStr) => {
    if (!dateStr) return [];
    return roomBookings.filter((b) => {
      if (!b.check_in || !b.check_out) return false;
      return dateStr >= b.check_in && dateStr < b.check_out;
    });
  };

  return (
    <div className="directory-page room-status-directory">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Room Status & Live Rack"
        kicker="ROOMS MANAGEMENT"
        description="Real-time graphical floor grid, readiness status, operational turnovers, and occupancy calendar."
        icon={BedDouble}
        backPath="/rooms"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="portal-header-badge">
              {roomStats.available} of {roomStats.total} rooms ready
            </span>

            {!String(user?.department || "").toLowerCase().includes("housekeeping") && (
              <button
                type="button"
                className="portal-action-btn"
                onClick={() => navigate("/rooms/add")}
              >
                <Plus size={16} /> Register Room
              </button>
            )}
          </div>
        }
      />

      {/* 6-CARD OPERATIONAL LIFECYCLE KPI STRIP */}
      <div className="dir-stats-grid rs-stats-six-grid">
        <StatCard
          title="Total Rooms"
          value={roomStats.total}
          Icon={BedDouble}
          colorTheme="purple"
          onClick={() => setActiveTab("all")}
          isActive={activeTab === "all"}
        />
        <StatCard
          title="Available & Ready"
          value={roomStats.available}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("available")}
          isActive={activeTab === "available"}
        />
        <StatCard
          title="Occupied Stays"
          value={roomStats.occupied}
          Icon={DoorOpen}
          colorTheme="orange"
          onClick={() => setActiveTab("occupied")}
          isActive={activeTab === "occupied"}
        />
        <StatCard
          title="Housekeeping Queue"
          value={roomStats.housekeeping}
          Icon={Sparkles}
          colorTheme="amber"
          onClick={() => setActiveTab("housekeeping")}
          isActive={activeTab === "housekeeping"}
        />
        <StatCard
          title="Maintenance / Blocked"
          value={roomStats.blocked}
          Icon={Wrench}
          colorTheme="red"
          onClick={() => setActiveTab("maintenance")}
          isActive={activeTab === "maintenance"}
        />
        <StatCard
          title="Occupancy Rate"
          value={`${roomStats.occupancyRate}%`}
          Icon={Percent}
          colorTheme="blue"
        />
      </div>

      {/* STANDARDIZED SEGMENTED STATUS QUEUE TABS */}
      <div className="cio-queue-controls">
        <div className="cio-queue-tabs">
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <BedDouble size={14} /> All Rooms
            <span className="cio-tab-count">{roomStats.total}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "available" ? "active" : ""}`}
            onClick={() => setActiveTab("available")}
          >
            <CheckCircle2 size={14} /> Available & Ready
            <span className="cio-tab-count">{roomStats.available}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "occupied" ? "active" : ""}`}
            onClick={() => setActiveTab("occupied")}
          >
            <DoorOpen size={14} /> Occupied Stays
            <span className="cio-tab-count">{roomStats.occupied}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "housekeeping" ? "active" : ""}`}
            onClick={() => setActiveTab("housekeeping")}
          >
            <Sparkles size={14} /> Housekeeping Queue
            <span className="cio-tab-count">{roomStats.housekeeping}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "maintenance" ? "active" : ""}`}
            onClick={() => setActiveTab("maintenance")}
          >
            <Wrench size={14} /> Maintenance & Blocked
            <span className="cio-tab-count">{roomStats.blocked}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "reserved" ? "active" : ""}`}
            onClick={() => setActiveTab("reserved")}
          >
            <Building2 size={14} /> Reserved Stays
            <span className="cio-tab-count">{roomStats.reserved}</span>
          </button>
        </div>
      </div>

      {/* DATE NAVIGATOR BAR & VIEW TOGGLE */}
      <div className="rs-date-navigator-bar">
        <div className="rs-date-nav-left">
          <span className="rs-date-nav-label">Status Date:</span>
          <button
            type="button"
            className="rs-date-arrow-btn"
            onClick={() => handleDateOffset(-1)}
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="rs-date-picker-wrap">
            <CalendarDays size={15} color="#2563eb" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rs-date-input"
            />
          </div>
          <button
            type="button"
            className="rs-date-arrow-btn"
            onClick={() => handleDateOffset(1)}
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className={`rs-today-pill-btn ${isSelectedDateToday ? "active" : ""}`}
            onClick={handleSetToday}
          >
            Today
          </button>
          <span className="rs-formatted-date-badge">
            {formattedSelectedDate}
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="rs-view-mode-toggle">
          <button
            type="button"
            className={`rs-view-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Floor Grid View (6 rooms per row)"
          >
            <LayoutGrid size={14} /> Floor Grid
          </button>
          <button
            type="button"
            className={`rs-view-btn ${viewMode === "rack" ? "active" : ""}`}
            onClick={() => setViewMode("rack")}
            title="Compact Front-Desk Matrix Rack View"
          >
            <List size={14} /> Compact Rack
          </button>
        </div>
      </div>

      {/* MODULE SECTION & FILTERS */}
      <section className="dir-modules-section">
        <ModuleWriternHeader
          title={
            activeTab === "all"
              ? "Floor Readiness & Room Status"
              : activeTab === "available"
                ? "Available & Ready Rooms"
                : activeTab === "occupied"
                  ? "Occupied Rooms"
                  : activeTab === "housekeeping"
                    ? "Housekeeping Turnover Queue"
                    : activeTab === "maintenance"
                      ? "Maintenance & Blocked Rooms"
                      : "Reserved Stays"
          }
          description="Click any room card to open its live occupancy calendar and reservation history."
          badgeCount={filteredRooms.length}
          badgeLabel="rooms"
        />

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search room number, type, or floor..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Floor Filter */}
            <select
              className="dir-filter-select"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              title="Filter by Floor"
            >
              <option value="all">All Floors</option>
              {availableFloors.map((fl) => (
                <option key={fl} value={fl}>
                  Floor {fl}
                </option>
              ))}
            </select>

            {/* Room Type Filter */}
            <select
              className="dir-filter-select"
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              title="Filter by Room Type"
            >
              <option value="all">All Room Types</option>
              {availableRoomTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status Dropdown Filter */}
            <select
              className="dir-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {roomStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusConfig[status]?.label || status}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-cancel"
                style={{ height: "40px", padding: "0 16px" }}
                onClick={clearFilters}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* VIEW MODE 1: FLOOR GRID VIEW (6 ROOMS PER ROW) */}
        {viewMode === "grid" && (
          loading ? (
            <div className="empty-state-card">Loading live room statuses...</div>
          ) : roomsByFloor.length === 0 ? (
            <div className="empty-state-card">
              <h4>No rooms found matching your filters</h4>
              <p>Try clearing your search query or selecting a different status queue.</p>
            </div>
          ) : (
            <div className="rs-floors-list">
              {roomsByFloor.map(({ floor, rooms: floorRooms }) => (
                <div key={floor} className="rs-floor-group">
                  <div className="rs-floor-heading">
                    <h3>{floor}</h3>
                    <span className="mono-pill">{floorRooms.length} Rooms</span>
                  </div>

                  <div className="rs-rooms-grid-6">
                    {floorRooms.map((room) => {
                      const statusKey = String(room?.status || "available").toLowerCase();
                      const config = statusConfig[statusKey] || statusConfig["available"];
                      const Icon = config.icon;
                      const price = Number(room?.base_price || room?.price_per_night || 0);

                      return (
                        <div
                          key={room.id}
                          className={`rs-room-card ${config.cardClass}`}
                          onClick={() => handleRoomClick(room)}
                          title="Click to view Room Booking Calendar & Details"
                        >
                          <div className="rs-card-top">
                            <span className="rs-room-number">Room {room?.room_number || "-"}</span>
                            <span className={`rs-status-badge ${config.badgeClass}`}>
                              <Icon size={11} style={{ marginRight: "3px" }} />
                              {config.label}
                            </span>
                          </div>

                          <div className="rs-card-mid">
                            <span className="rs-room-type">{room?.room_type || "Deluxe Room"}</span>
                            <span className="rs-room-price">₹{price.toFixed(0)}/n</span>
                          </div>

                          <div className="rs-subinfo-row">
                            <span className="rs-subinfo-pill">
                              <BedDouble size={10} /> {room?.bed_type || "King Bed"}
                            </span>
                            <span className="rs-subinfo-pill">
                              <Users size={10} /> {room?.max_occupancy || 2} Max
                            </span>
                          </div>

                          {/* Quick In-Card Status Selector */}
                          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: "4px" }}>
                            <select
                              className="rs-card-quick-status"
                              value={statusKey}
                              disabled={updatingRoomId === room.id}
                              onChange={(e) => handleQuickStatusChange(room.id, e.target.value, e)}
                              title="Quick update room readiness"
                            >
                              {roomStatuses.map((st) => (
                                <option key={st} value={st}>
                                  Change: {statusConfig[st]?.label || st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* VIEW MODE 2: COMPACT RACK VIEW (MATRIX MODE) */}
        {viewMode === "rack" && (
          loading ? (
            <div className="empty-state-card">Loading live room rack...</div>
          ) : filteredRooms.length === 0 ? (
            <div className="empty-state-card">
              <h4>No rooms found matching your filters</h4>
              <p>Try clearing your search query or selecting a different status queue.</p>
            </div>
          ) : (
            <div className="rs-rack-table-container">
              <table className="rs-rack-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Classification & Bedding</th>
                    <th>Tariff / Night</th>
                    <th>Operational Status</th>
                    <th>Quick Turnover</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRooms.map((room) => {
                    const statusKey = String(room?.status || "available").toLowerCase();
                    const config = statusConfig[statusKey] || statusConfig["available"];
                    const Icon = config.icon;
                    const price = Number(room?.base_price || room?.price_per_night || 0);

                    return (
                      <tr
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        title="Click to view Room Booking Calendar & Details"
                      >
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div className="staff-avatar" style={{ width: "32px", height: "32px", fontSize: "12px" }}>
                              {String(room.room_number || "R").slice(0, 3)}
                            </div>
                            <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                              Room {room.room_number}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <span className="mono-pill">
                            Floor {room.floor || inferFloorFromRoomNumber(room.room_number) || "1"}
                          </span>
                        </td>

                        <td>
                          <div>
                            <span style={{ fontWeight: "600", color: "#334155" }}>
                              {room.room_type || "Deluxe Room"}
                            </span>
                            <div className="rs-subinfo-row" style={{ marginTop: "2px" }}>
                              <span>{room.bed_type || "King Bed"}</span> &bull;
                              <span><Users size={10} style={{ verticalAlign: "-1px" }} /> {room.max_occupancy || 2} Max</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong style={{ color: "#0f172a" }}>₹{price.toFixed(2)}</strong>
                        </td>

                        <td>
                          <span className={`rs-status-badge ${config.badgeClass}`}>
                            <Icon size={11} style={{ marginRight: "3px" }} />
                            {config.label}
                          </span>
                        </td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <select
                            className="rs-card-quick-status"
                            style={{ width: "160px" }}
                            value={statusKey}
                            disabled={updatingRoomId === room.id}
                            onChange={(e) => handleQuickStatusChange(room.id, e.target.value, e)}
                          >
                            {roomStatuses.map((st) => (
                              <option key={st} value={st}>
                                {statusConfig[st]?.label || st}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-preview-outline"
                            style={{ padding: "4px 10px", fontSize: "11.5px" }}
                            onClick={() => handleRoomClick(room)}
                          >
                            <CalendarDays size={13} /> Calendar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

      {/* CALENDAR & ROOM INSPECTOR MODAL */}
      {activeRoom && (
        <div className="modal-overlay" onClick={closeCalendarModal}>
          <div
            className="modal-content rs-calendar-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="rs-room-avatar">
                  {activeRoom?.room_number || "R"}
                </div>
                <div>
                  <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                    Room {activeRoom?.room_number} &bull; Occupancy & Booking Calendar
                  </h2>
                  <p className="modal-kicker">
                    {activeRoom?.room_type || "Deluxe Room"} &bull; Floor {activeRoom?.floor || inferFloorFromRoomNumber(activeRoom?.room_number) || "1"} &bull; {activeRoom?.bed_type || "King Bed"} &bull; ₹{Number(activeRoom?.base_price || activeRoom?.price_per_night || 0).toFixed(2)} / night
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  className="portal-action-btn"
                  style={{ padding: "7px 14px", fontSize: "12.5px" }}
                  onClick={() => navigate("/front-desk/check-in-out")}
                >
                  <Plus size={14} /> New Walk-In
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={closeCalendarModal}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="rs-cal-modal-body">
              <div className="rs-cal-main">
                {/* Immediate Status Override Strip */}
                <div className="rs-modal-status-strip">
                  <span className="rs-modal-status-label">Operational Status:</span>
                  <div className="rs-modal-status-btns">
                    {roomStatuses.map((st) => {
                      const cfg = statusConfig[st] || statusConfig["available"];
                      const isCurrent = String(activeRoom.status || "").toLowerCase() === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          className={`rs-modal-st-btn ${cfg.badgeClass} ${isCurrent ? "current" : ""}`}
                          onClick={() => handleQuickStatusChange(activeRoom.id, st)}
                          disabled={updatingRoomId === activeRoom.id}
                        >
                          <cfg.icon size={12} /> {cfg.label}
                          {isCurrent && " (Active)"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rs-cal-toolbar">
                  <div className="rs-cal-nav-group">
                    <button type="button" className="rs-cal-btn" onClick={prevMonth} title="Previous Month">
                      <ChevronLeft size={16} />
                    </button>
                    <button type="button" className="rs-cal-btn" onClick={nextMonth} title="Next Month">
                      <ChevronRight size={16} />
                    </button>
                    <button type="button" className="rs-cal-btn today-btn" onClick={gotoToday}>
                      Today
                    </button>
                    <h3 className="rs-cal-month-title">{currentMonthName}</h3>
                  </div>

                  <span className={`rs-status-badge ${(statusConfig[activeRoom.status] || statusConfig["available"]).badgeClass}`}>
                    Current: {(activeRoom.status || "available").toUpperCase()}
                  </span>
                </div>

                <div className="rs-cal-weekdays">
                  <div>SUN</div>
                  <div>MON</div>
                  <div>TUE</div>
                  <div>WED</div>
                  <div>THU</div>
                  <div>FRI</div>
                  <div>SAT</div>
                </div>

                <div className="rs-cal-grid-wrapper">
                  {calLoading ? (
                    <div className="rs-cal-loading">Fetching live room reservations...</div>
                  ) : (
                    <div className="rs-cal-grid">
                      {calendarDays.map((cell, idx) => {
                        const dayBookings = cell.isCurrentMonth ? getBookingsForDate(cell.dateStr) : [];
                        const isToday = cell.dateStr === new Date().toISOString().split("T")[0];

                        return (
                          <div
                            key={idx}
                            className={`rs-cal-cell ${!cell.isCurrentMonth ? "cell-faded" : ""} ${isToday ? "cell-today" : ""
                              }`}
                          >
                            <div className="rs-cal-date-top">
                              <span className={isToday ? "today-badge" : "day-num"}>
                                {cell.dayNumber}
                              </span>
                            </div>

                            <div className="rs-cal-events-list">
                              {dayBookings.map((b) => {
                                const st = String(b?.status || "").toLowerCase();
                                const isCheckedIn = st === "checked-in" || st === "occupied";
                                const isConfirmed = st === "confirmed";
                                const isReserved = st === "reserved";

                                const pillClass = isCheckedIn
                                  ? "pill-occupied"
                                  : isConfirmed
                                    ? "pill-confirmed"
                                    : isReserved
                                      ? "pill-reserved"
                                      : "pill-other";

                                return (
                                  <div
                                    key={b.id}
                                    className={`rs-booking-pill ${pillClass}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedBooking(b);
                                    }}
                                    title={`#${b.id}: ${b.guest_name} (${b.status})`}
                                  >
                                    <strong>#{b.id}</strong> {b.guest_name}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Info & Legends */}
              <div className="rs-cal-sidebar">
                <div className="rs-side-block">
                  <h4>Status Legends</h4>
                  <div className="rs-legends-list">
                    {LEGENDS.map((leg, lIdx) => (
                      <div key={lIdx} className="rs-legend-row">
                        <span className="rs-legend-dot" style={{ background: leg.color }} />
                        <span className="rs-legend-label">{leg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedBooking ? (
                  <div className="rs-side-block rs-booking-inspector">
                    <div className="rs-inspector-head">
                      <User size={16} color="#2563eb" />
                      <h4>Booking Information</h4>
                    </div>

                    <div className="rs-inspector-data">
                      <div className="rs-data-row">
                        <span>Guest Name:</span>
                        <strong>{selectedBooking.guest_name}</strong>
                      </div>
                      <div className="rs-data-row">
                        <span>Phone:</span>
                        <strong>{selectedBooking.phone}</strong>
                      </div>
                      <div className="rs-data-row">
                        <span>Booking ID:</span>
                        <span className="mono-pill">#{selectedBooking.id}</span>
                      </div>
                      <div className="rs-data-row">
                        <span>Check-In:</span>
                        <strong>{selectedBooking.check_in}</strong>
                      </div>
                      <div className="rs-data-row">
                        <span>Check-Out:</span>
                        <strong>{selectedBooking.check_out}</strong>
                      </div>
                      <div className="rs-data-row">
                        <span>Status:</span>
                        <span className="mono-pill" style={{ color: "#059669", background: "#ecfdf5" }}>
                          {String(selectedBooking.status || "confirmed").toUpperCase()}
                        </span>
                      </div>
                      {selectedBooking.total_amount !== undefined && (
                        <div className="rs-data-row">
                          <span>Total Amount:</span>
                          <strong>₹{Number(selectedBooking.total_amount).toFixed(2)}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rs-side-block rs-side-placeholder">
                    <Clock size={22} color="#94a3b8" />
                    <p>
                      {roomBookings.length === 0
                        ? "No bookings registered for this room."
                        : "Click any guest bar on the calendar to view their full booking details."}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ background: "#f8fafc" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={closeCalendarModal}
              >
                Close Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}