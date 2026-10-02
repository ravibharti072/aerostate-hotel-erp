import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle2,
  Key,
  Wrench,
  Clock,
  Coffee,
  Sparkles,
  Search,
  Plus,
  ArrowRight,
  RotateCw,
  SlidersHorizontal,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck,
  Layers,
  Activity,
  CheckCheck,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard } from "@components";
import styles from "./roomsDashboard.module.css";

export default function RoomsDashboard({
  isEmbedded = false,
  viewMode = "standalone",
  showBack = true,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmbeddedView = isEmbedded || viewMode === "embedded";

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  // Core Data States from Backend Server (Zero Mock Data)
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [hkTasks, setHkTasks] = useState([]);
  const [maintRequests, setMaintRequests] = useState([]);
  const [roomServiceOrders, setRoomServiceOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Section 1: Room Status Filter
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");
  const [showAllRooms, setShowAllRooms] = useState(false);

  // Section 2: Recent Operations Filter
  const [operationTypeFilter, setOperationTypeFilter] = useState("all");
  const [showAllOperations, setShowAllOperations] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [roomsRes, bookingsRes, hkRes, maintRes, rsRes] =
        await Promise.allSettled([
          api.get("/rooms", { params }).catch(() => ({ data: [] })),
          api.get("/bookings", { params }).catch(() => ({ data: [] })),
          api.get("/housekeeping/tasks", { params }).catch(() => ({ data: [] })),
          api.get("/maintenance-requests/", { params }).catch(() => ({ data: [] })),
          api.get("/restaurant/orders", { params: { ...params, order_type: "room-service" } }).catch(() => ({ data: [] })),
        ]);

      const rawRooms = filterByHotel(normalizeList(roomsRes.value?.data, "rooms"));
      const rawBookings = filterByHotel(normalizeList(bookingsRes.value?.data, "bookings"));
      const rawHkTasks = filterByHotel(normalizeList(hkRes.value?.data, "tasks"));
      const rawMaint = normalizeList(maintRes.value?.data, "items");
      const rawRoomService = filterByHotel(normalizeList(rsRes.value?.data, "orders"));

      setRooms(rawRooms);
      setBookings(rawBookings);
      setHkTasks(rawHkTasks);
      setMaintRequests(rawMaint.length > 0 ? rawMaint : normalizeList(maintRes.value?.data, "requests"));
      setRoomServiceOrders(rawRoomService);
    } catch (err) {
      console.error("Rooms dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackendData();
  }, [user]);

  // -------------------------------------------------------------
  // Enriched Room Entities
  // -------------------------------------------------------------
  const enrichedRooms = useMemo(() => {
    return rooms.map((r) => {
      const activeBooking = bookings.find(
        (b) => b.room_id === r.id && ["checked-in", "checked_in", "confirmed"].includes(b.status)
      );
      const isOccupied = activeBooking && ["checked-in", "checked_in"].includes(activeBooking.status);

      let statusKey = (r.status || "available").toLowerCase();
      let statusLabel = "Available";

      if (statusKey === "maintenance") {
        statusLabel = "Maintenance";
      } else if (isOccupied) {
        statusKey = "occupied";
        statusLabel = "Occupied";
      } else if (statusKey === "dirty") {
        statusLabel = "Dirty / Turnover";
      } else if (statusKey === "cleaning") {
        statusLabel = "In Cleaning";
      } else if (statusKey === "available") {
        statusLabel = "Clean / Ready";
      }

      return {
        ...r,
        roomNumber: String(r.room_number),
        roomType: r.room_type || "Deluxe",
        floor: r.floor || "1",
        statusKey,
        statusLabel,
        guestName: activeBooking?.guest_name || null,
        guestCheckIn: activeBooking?.check_in_date || null,
      };
    });
  }, [rooms, bookings]);

  // Top KPI Metrics
  const stats = useMemo(() => {
    const total = enrichedRooms.length;
    const available = enrichedRooms.filter((r) => r.statusKey === "available").length;
    const occupied = enrichedRooms.filter((r) => r.statusKey === "occupied").length;
    const dirty = enrichedRooms.filter((r) => r.statusKey === "dirty" || r.statusKey === "cleaning").length;
    const maintenance = enrichedRooms.filter((r) => r.statusKey === "maintenance").length;

    return { total, available, occupied, dirty, maintenance };
  }, [enrichedRooms]);

  // Filtered Rooms for Section 1
  const filteredRooms = useMemo(() => {
    if (roomStatusFilter === "all") return enrichedRooms;
    if (roomStatusFilter === "dirty") {
      return enrichedRooms.filter((r) => r.statusKey === "dirty" || r.statusKey === "cleaning");
    }
    return enrichedRooms.filter((r) => r.statusKey === roomStatusFilter);
  }, [enrichedRooms, roomStatusFilter]);

  const displayedRooms = useMemo(() => {
    return showAllRooms ? filteredRooms : filteredRooms.slice(0, 8);
  }, [filteredRooms, showAllRooms]);

  // -------------------------------------------------------------
  // Section 2: Recently Completed Operations List
  // Combines Room Service, Housekeeping Cleaning, and Maintenance
  // -------------------------------------------------------------
  const recentOperations = useMemo(() => {
    const items = [];

    // 1. Cleaning & Housekeeping Completed Tasks
    hkTasks.forEach((t) => {
      const room = rooms.find((r) => r.id === t.room_id);
      const isDone = ["completed", "inspected"].includes((t.status || "").toLowerCase());
      items.push({
        id: `hk-${t.id}`,
        type: "cleaning",
        typeLabel: "Housekeeping",
        roomNumber: room ? `Room ${room.room_number}` : `Room ${t.room_id || "101"}`,
        actionText: isDone ? "Turnover cleaning & inspection completed" : "Cleaning task currently in progress",
        actor: t.assigned_to || "Housekeeping Staff",
        timestamp: t.completed_at || t.updated_at || t.created_at || new Date().toISOString(),
        statusLabel: isDone ? "Cleaned" : "In Progress",
        statusType: isDone ? "completed" : "pending",
      });
    });

    // 2. Maintenance Resolved Requests
    maintRequests.forEach((m) => {
      const isDone = ["completed", "verified", "closed"].includes((m.status || "").toLowerCase());
      items.push({
        id: `maint-${m.id}`,
        type: "maintenance",
        typeLabel: "Maintenance",
        roomNumber: m.room_number ? `Room ${m.room_number}` : "General Facility",
        actionText: isDone ? `Repair resolved: ${m.issue_title}` : `Active repair: ${m.issue_title}`,
        actor: m.assigned_staff_name || "Technician",
        timestamp: m.completed_date || m.created_at || new Date().toISOString(),
        statusLabel: isDone ? "Resolved" : "Active",
        statusType: isDone ? "completed" : "pending",
      });
    });

    // 3. Room Service Delivered Orders
    roomServiceOrders.forEach((o) => {
      const isDone = ["served", "completed"].includes((o.order_status || "").toLowerCase());
      const dishes = (o.items || []).map((i) => i.item_name).join(", ");
      items.push({
        id: `rs-${o.id}`,
        type: "room_service",
        typeLabel: "Room Service",
        roomNumber: o.room_number ? `Room ${o.room_number}` : `Room ${o.room_id || "201"}`,
        actionText: isDone
          ? `Delivered & served: ${dishes || "Dining items"}`
          : `Preparing in kitchen: ${dishes || "Dining items"}`,
        actor: o.guest_name ? `Guest: ${o.guest_name}` : "Floor Attendant",
        timestamp: o.updated_at || o.created_at || new Date().toISOString(),
        statusLabel: isDone ? "Delivered" : "In Kitchen",
        statusType: isDone ? "completed" : "pending",
      });
    });

    // Sort by newest timestamp
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [hkTasks, maintRequests, roomServiceOrders, rooms]);

  const filteredOperations = useMemo(() => {
    if (operationTypeFilter === "all") return recentOperations;
    return recentOperations.filter((op) => op.type === operationTypeFilter);
  }, [recentOperations, operationTypeFilter]);

  const displayedOperations = useMemo(() => {
    return showAllOperations ? filteredOperations : filteredOperations.slice(0, 5);
  }, [filteredOperations, showAllOperations]);

  return (
    <div
      className={`${styles["rooms-dashboard-container"]} ${
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
          HEADER & ACTIONS
          ------------------------------------------------------------- */}
      <PortalHeader
        title="Rooms Operational Dashboard"
        kicker="HOTEL ROOMS & INVENTORY"
        description="Real-time room occupancy, live status directory, and recently completed service records."
        icon={BedDouble}
        isDashboard={true}
        showBack={viewMode === "standalone" && showBack}
        backPath="/dashboard"
        rightAction={
          <div className={styles["header-actions-group"]}>
            <button
              type="button"
              onClick={() => navigate("/room-status")}
              className={styles["secondary-header-btn"]}
              title="Open full interactive floor plan"
            >
              <Layers size={14} />
              Room Grid
            </button>
            <button
              type="button"
              onClick={() => navigate("/rooms/add")}
              className={styles["primary-header-btn"]}
            >
              <Plus size={14} />
              Add Room
            </button>
          </div>
        }
      />

      {/* -------------------------------------------------------------
          TOP KPI SECTION (Compact 4 StatCards)
          ------------------------------------------------------------- */}
      <div className={styles["stats-grid"]}>
        <StatCard
          title="Total Rooms"
          value={`${stats.total || 0}`}
          subtitle="Inventory capacity"
          Icon={BedDouble}
          colorTheme="blue"
        />
        <StatCard
          title="Available & Ready"
          value={`${stats.available || 0}`}
          subtitle="Inspected clean"
          Icon={CheckCircle2}
          colorTheme="green"
        />
        <StatCard
          title="Occupied"
          value={`${stats.occupied || 0}`}
          subtitle="In-house guests"
          Icon={Key}
          colorTheme="purple"
        />
        <StatCard
          title="Turnover / Maint"
          value={`${stats.dirty + stats.maintenance}`}
          subtitle={`${stats.dirty} dirty • ${stats.maintenance} maint`}
          Icon={Wrench}
          colorTheme="amber"
        />
      </div>

      {/* -------------------------------------------------------------
          TWO COMPACT CORE SECTIONS
          Section 1: Live Room Status
          Section 2: Recently Completed Operations List
          ------------------------------------------------------------- */}
      <div className={styles["sections-stack"]}>
        {/* SECTION 1: LIVE ROOM STATUS DIRECTORY */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <BedDouble size={16} color="#2563eb" />
                Live Room Status & Inventory Directory
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Real-time occupancy, cleanliness, and availability across hotel rooms
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {filteredRooms.length} Rooms
            </span>
          </div>

          {/* Filter Chips */}
          <div className={styles["filter-strip"]}>
            <div
              className={`${styles["filter-chip"]} ${roomStatusFilter === "all" ? styles["active"] : ""}`}
              onClick={() => setRoomStatusFilter("all")}
            >
              <span>All Rooms</span>
              <span className={styles["chip-count"]}>{enrichedRooms.length}</span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${roomStatusFilter === "available" ? styles["active"] : ""}`}
              onClick={() => setRoomStatusFilter("available")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#10b981" }} />
              <span>Available</span>
              <span className={styles["chip-count"]}>{stats.available}</span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${roomStatusFilter === "occupied" ? styles["active"] : ""}`}
              onClick={() => setRoomStatusFilter("occupied")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#2563eb" }} />
              <span>Occupied</span>
              <span className={styles["chip-count"]}>{stats.occupied}</span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${roomStatusFilter === "dirty" ? styles["active"] : ""}`}
              onClick={() => setRoomStatusFilter("dirty")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#ea580c" }} />
              <span>Turnover / Dirty</span>
              <span className={styles["chip-count"]}>{stats.dirty}</span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${roomStatusFilter === "maintenance" ? styles["active"] : ""}`}
              onClick={() => setRoomStatusFilter("maintenance")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#db2777" }} />
              <span>Maintenance</span>
              <span className={styles["chip-count"]}>{stats.maintenance}</span>
            </div>
          </div>

          {/* Rooms Grid */}
          {loading ? (
            <div className={styles["empty-state"]}>Loading original room records from server...</div>
          ) : displayedRooms.length === 0 ? (
            <div className={styles["empty-state"]}>No rooms match the selected status filter.</div>
          ) : (
            <div className={styles["rooms-grid"]}>
              {displayedRooms.map((rm) => (
                <div
                  key={rm.id}
                  className={styles["room-card"]}
                  onClick={() => navigate("/room-status")}
                  title={`Click to view Room ${rm.roomNumber} operational controls`}
                >
                  <div className={styles["room-card-top"]}>
                    <div className={styles["room-num-badge"]}>
                      <BedDouble size={14} color="#475569" />
                      <span>Room {rm.roomNumber}</span>
                    </div>
                    <span className={`${styles["room-status-tag"]} ${styles[rm.statusKey] || styles["available"]}`}>
                      {rm.statusLabel}
                    </span>
                  </div>

                  <div className={styles["room-meta-row"]}>
                    <span>{rm.roomType}</span>
                    <span>Floor {rm.floor}</span>
                  </div>

                  {rm.guestName ? (
                    <div className={styles["room-guest-row"]}>
                      👤 {rm.guestName}
                    </div>
                  ) : (
                    <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                      Ready for arrival
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Toggle All Button */}
          {filteredRooms.length > 8 && (
            <div className={styles["card-bottom-bar"]}>
              <span className={styles["count-info-text"]}>
                Showing {displayedRooms.length} of {filteredRooms.length} rooms
              </span>
              <button
                type="button"
                onClick={() => setShowAllRooms((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllRooms ? (
                  <>
                    <ChevronUp size={13} /> Show Top 8 Rooms
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} /> View All Rooms ({filteredRooms.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: RECENTLY DONE OPERATIONS (Room Service, Cleaning & Maintenance) */}
        <div className={styles["operations-card"]}>
          <div className={styles["card-header-between"]}>
            <div>
              <h3 className={styles["card-title-main"]} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Activity size={16} color="#059669" />
                Recently Completed Room Operations
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                Live record of completed room turnovers, maintenance fixes, and room service deliveries
              </span>
            </div>
            <span className={styles["card-badge-muted"]}>
              {filteredOperations.length} Records
            </span>
          </div>

          {/* Operation Filter Chips */}
          <div className={styles["filter-strip"]}>
            <div
              className={`${styles["filter-chip"]} ${operationTypeFilter === "all" ? styles["active"] : ""}`}
              onClick={() => setOperationTypeFilter("all")}
            >
              <span>All Operations</span>
              <span className={styles["chip-count"]}>{recentOperations.length}</span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${operationTypeFilter === "cleaning" ? styles["active"] : ""}`}
              onClick={() => setOperationTypeFilter("cleaning")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#10b981" }} />
              <span>🧹 Cleaning Done</span>
              <span className={styles["chip-count"]}>
                {recentOperations.filter((o) => o.type === "cleaning").length}
              </span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${operationTypeFilter === "maintenance" ? styles["active"] : ""}`}
              onClick={() => setOperationTypeFilter("maintenance")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#0284c7" }} />
              <span>🔧 Maintenance Resolved</span>
              <span className={styles["chip-count"]}>
                {recentOperations.filter((o) => o.type === "maintenance").length}
              </span>
            </div>

            <div
              className={`${styles["filter-chip"]} ${operationTypeFilter === "room_service" ? styles["active"] : ""}`}
              onClick={() => setOperationTypeFilter("room_service")}
            >
              <span className={styles["chip-dot"]} style={{ background: "#e11d48" }} />
              <span>🍽️ Room Service Delivered</span>
              <span className={styles["chip-count"]}>
                {recentOperations.filter((o) => o.type === "room_service").length}
              </span>
            </div>
          </div>

          {/* Operations List */}
          {loading ? (
            <div className={styles["empty-state"]}>Loading recent operational records...</div>
          ) : displayedOperations.length === 0 ? (
            <div className={styles["empty-state"]}>No recently completed operations recorded.</div>
          ) : (
            <div className={styles["operations-list"]}>
              {displayedOperations.map((op) => (
                <div key={op.id} className={styles["operation-item"]}>
                  <div className={styles["op-left"]}>
                    <div className={`${styles["op-icon-box"]} ${styles[op.type]}`}>
                      {op.type === "cleaning" ? (
                        <Sparkles size={16} />
                      ) : op.type === "maintenance" ? (
                        <Wrench size={16} />
                      ) : (
                        <Coffee size={16} />
                      )}
                    </div>
                    <div className={styles["op-details"]}>
                      <div className={styles["op-title-row"]}>
                        <span className={styles["op-room-text"]}>{op.roomNumber}</span>
                        <span className={`${styles["op-type-badge"]} ${styles[op.type]}`}>
                          {op.typeLabel}
                        </span>
                      </div>
                      <div className={styles["op-meta-text"]}>
                        {op.actionText} • <strong>{op.actor}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles["op-right"]}>
                    <span className={styles["op-status-pill"]}>
                      <CheckCheck size={11} /> {op.statusLabel}
                    </span>
                    <span className={styles["op-time-text"]}>
                      {new Date(op.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Toggle All Button */}
          {filteredOperations.length > 5 && (
            <div className={styles["card-bottom-bar"]}>
              <span className={styles["count-info-text"]}>
                Showing {displayedOperations.length} of {filteredOperations.length} operations
              </span>
              <button
                type="button"
                onClick={() => setShowAllOperations((prev) => !prev)}
                className={styles["toggle-view-all-btn"]}
              >
                {showAllOperations ? (
                  <>
                    <ChevronUp size={13} /> Show Top 5
                  </>
                ) : (
                  <>
                    <ChevronDown size={13} /> View All Records ({filteredOperations.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
