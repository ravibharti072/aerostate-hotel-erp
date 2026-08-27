import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  Building2,
  CheckCircle2,
  DoorOpen,
  Filter,
  Search,
  Sparkles,
  Wrench,
  XCircle,
  LayoutDashboard,
  CalendarDays,
  Percent
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader"; // Corrected path
import "./roomStatus.css";

const roomStatuses = [
  "available",
  "occupied",
  "reserved",
  "cleaning",
  "maintenance",
  "out-of-service",
];

const statusConfig = {
  available: {
    label: "Available",
    icon: CheckCircle2,
    bgClass: "bg-light-green",
    iconClass: "color-green",
  },
  occupied: {
    label: "Occupied",
    icon: DoorOpen,
    bgClass: "bg-light-orange",
    iconClass: "color-orange",
  },
  reserved: {
    label: "Reserved",
    icon: Building2,
    bgClass: "bg-light-purple",
    iconClass: "color-purple",
  },
  cleaning: {
    label: "Cleaning",
    icon: Sparkles,
    bgClass: "bg-light-blue",
    iconClass: "color-blue",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    bgClass: "bg-light-gray",
    iconClass: "color-gray",
  },
  "out-of-service": {
    label: "Out of Service",
    icon: XCircle,
    bgClass: "bg-light-red",
    iconClass: "color-red",
  },
};

export default function RoomStatusPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
          return `${field}: ${item.msg}`;
        })
        .join(" | ");
    }
    if (detail && typeof detail === "object") {
      return JSON.stringify(detail);
    }
    return err.message || fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get(`/rooms?date=${selectedDate}`);
      setRooms(normalizeList(response.data, "rooms"));
    } catch (err) {
      console.error("Fetch room status error:", err);
      setError(getApiErrorMessage(err, "Failed to load room status."));
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [selectedDate]);

  const getStatusKey = (status) => {
    const cleanStatus = String(status || "available").toLowerCase().trim();
    return statusConfig[cleanStatus] ? cleanStatus : "available";
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const status = getStatusKey(room.status);
      const roomNumber = String(room.room_number || "").toLowerCase();
      const roomType = String(room.room_type || "").toLowerCase();
      const floor = String(room.floor || "").toLowerCase();
      const search = searchText.toLowerCase();

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesSearch =
        !search ||
        roomNumber.includes(search) ||
        roomType.includes(search) ||
        floor.includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [rooms, statusFilter, searchText]);

  const roomsByFloor = useMemo(() => {
    const grouped = {};
    filteredRooms.forEach((room) => {
      const floorKey = room.floor !== null && room.floor !== undefined ? String(room.floor) : "Ground / Other";
      if (!grouped[floorKey]) {
        grouped[floorKey] = [];
      }
      grouped[floorKey].push(room);
    });

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((floor) => ({
        floor,
        rooms: grouped[floor],
      }));
  }, [filteredRooms]);

  const roomStats = useMemo(() => {
    const stats = {
      total: rooms.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      maintenance: 0,
      "out-of-service": 0,
      occupancyRate: 0,
    };

    rooms.forEach((room) => {
      const status = getStatusKey(room.status);
      if (stats[status] !== undefined) {
        stats[status] += 1;
      }
    });

    if (stats.total > 0) {
      stats.occupancyRate = Math.round((stats.occupied / stats.total) * 100);
    }

    return stats;
  }, [rooms]);

  return (
    <div className="rs-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Room Status"
        kicker="GRAPHICAL ROOM VIEW"
        description="Visual room tiles with color-coded status organized floor by floor."
        icon={LayoutDashboard}
        backPath="/rooms"
      />

      {error && <div className="rs-error-box">{error}</div>}

      {/* STATS GRID */}
      <div className="rs-stats-grid">
        <div className="rs-stat-card">
          <div className="rs-stat-icon-wrapper bg-light-blue">
            <BedDouble size={22} className="color-blue" />
          </div>
          <div className="rs-stat-info">
            <p>Total Rooms</p>
            <h2>{roomStats.total}</h2>
          </div>
        </div>

        <div className="rs-stat-card">
          <div className="rs-stat-icon-wrapper bg-light-purple">
            <Percent size={22} className="color-purple" />
          </div>
          <div className="rs-stat-info">
            <p>Occupancy Rate</p>
            <h2>{roomStats.occupancyRate}%</h2>
          </div>
        </div>

        {roomStatuses.map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;

          return (
            <div
              key={status}
              className={`rs-stat-card cursor-pointer ${statusFilter === status ? "active-filter" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              <div className={`rs-stat-icon-wrapper ${config.bgClass}`}>
                <Icon size={22} className={config.iconClass} />
              </div>
              <div className="rs-stat-info">
                <p>{config.label}</p>
                <h2>{roomStats[status]}</h2>
              </div>
            </div>
          );
        })}
      </div>

      {/* TOOLBAR */}
      <div className="rs-filter-card">
        <div className="rs-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by room number, type, or floor..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="rs-filter-box" style={{ marginLeft: "auto" }}>
          <CalendarDays size={16} />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", color: "#0f172a", fontWeight: "600", cursor: "pointer" }}
          />
        </div>

        <div className="rs-filter-box">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {roomStatuses.map((status) => (
              <option key={status} value={status}>
                {statusConfig[status].label}
              </option>
            ))}
          </select>
        </div>

        {statusFilter !== "all" && (
          <button
            type="button"
            className="rs-clear-btn"
            onClick={() => setStatusFilter("all")}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rs-empty-state">
          <h4>Loading rooms...</h4>
        </div>
      ) : roomsByFloor.length === 0 ? (
        <div className="rs-empty-state">
          <h4>No rooms found</h4>
          <p>Adjust your search, date, or filter to see results.</p>
        </div>
      ) : (
        <div className="rs-floors-container">
          {roomsByFloor.map(({ floor, rooms: floorRooms }) => (
            <div key={floor} className="rs-floor-section">
              <div className="rs-floor-header">
                <h2>Floor {floor}</h2>
                <span>{floorRooms.length} rooms</span>
              </div>

              <div className="rs-floor-tile-grid">
                {floorRooms.map((room) => {
                  const status = getStatusKey(room.status);
                  const config = statusConfig[status];
                  const Icon = config.icon;

                  return (
                    <div key={room.id} className={`rs-tile-card status-${status}`}>
                      <div className="rs-tile-header">
                        <div className="rs-tile-title">
                          <div className={`rs-tile-icon ${config.bgClass} ${config.iconClass}`}>
                            <Icon size={16} />
                          </div>
                          <h3>Room {room.room_number || "-"}</h3>
                        </div>
                        <span className={`rs-tile-badge ${config.bgClass} ${config.iconClass}`}>
                          {config.label}
                        </span>
                      </div>

                      <div className="rs-tile-body">
                        <div className="rs-tile-info">
                          <span>Type</span>
                          <strong>{room.room_type || "-"}</strong>
                        </div>
                        <div className="rs-tile-info">
                          <span>Floor</span>
                          <strong>{room.floor ?? "-"}</strong>
                        </div>
                        <div className="rs-tile-info rs-price-info">
                          <span>Price / Night</span>
                          <strong>
                            ₹{Number(room.base_price || room.price_per_night || 0).toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      {room.description && (
                        <p className="rs-tile-description">{room.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}