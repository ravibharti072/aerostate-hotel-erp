import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  BedDouble,
  UserCheck
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import "./checkoutCleaning.css";

export default function CheckoutCleaningPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${item.loc?.join(".") || ""}: ${item.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotelId || user?.hotel?.id || null;
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((r) => Number(r.id) === Number(roomId));
    return room?.room_number || roomId || "-";
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [tasksRes, roomsRes] = await Promise.all([
        api.get("/housekeeping/tasks").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] }))
      ]);

      const hotelId = getLoggedInHotelId();
      let tasksList = normalizeList(tasksRes.data, "tasks");
      let roomsList = normalizeList(roomsRes.data, "rooms");

      if (hotelId) {
        tasksList = tasksList.filter((t) => Number(t.hotel_id) === Number(hotelId));
        roomsList = roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId));
      }

      setTasks(tasksList);
      setRooms(roomsList);
    } catch (err) {
      console.error("Fetch checkout cleaning error:", err);
      setError(getApiErrorMessage(err, "Failed to load checkout cleaning tasks."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQuickStatus = async (task, nextStatus) => {
    try {
      setUpdatingId(task.id);
      setError("");
      setSuccess("");

      await api.patch(`/housekeeping/tasks/${task.id}/status`, {
        status: nextStatus,
      });

      setSuccess(`Task marked as ${nextStatus}.`);
      setTimeout(() => setSuccess(""), 2000);
      await fetchData();
    } catch (err) {
      console.error("Update status error:", err);
      setError(getApiErrorMessage(err, "Failed to update task status."));
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter specifically for checkout cleaning tasks
  const checkoutTasks = useMemo(() => {
    return tasks.filter((t) => String(t.task_type || "").toLowerCase() === "checkout-cleaning");
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return checkoutTasks.filter((task) => {
      const search = searchText.toLowerCase();
      const status = String(task.status || "").toLowerCase();
      const roomNum = String(getRoomNumber(task.room_id)).toLowerCase();

      const matchesSearch = !search || roomNum.includes(search) || String(task.notes || "").toLowerCase().includes(search);
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [checkoutTasks, searchText, statusFilter, rooms]);

  const stats = useMemo(() => {
    const pending = checkoutTasks.filter((t) => t.status === "pending").length;
    const inProgress = checkoutTasks.filter((t) => t.status === "in-progress").length;
    const completed = checkoutTasks.filter((t) => t.status === "completed").length;

    return {
      total: checkoutTasks.length,
      pending,
      inProgress,
      completed,
    };
  }, [checkoutTasks]);

  return (
    <div className="hk-cc-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Checkout Cleaning"
        kicker="HOUSEKEEPING PORTAL"
        description="Manage rooms checked out from front desk awaiting turnover."
        icon={Sparkles}
        backPath="/housekeeping"
      />

      {error && <div className="hk-cc-error-box">{error}</div>}
      {success && <div className="hk-cc-success-box">{success}</div>}

      <div className="hk-cc-stats-grid">
        <div className="hk-cc-stat-card">
          <div className="hk-cc-stat-icon-wrapper bg-light-blue">
            <BedDouble size={22} className="color-blue" />
          </div>
          <div className="hk-cc-stat-info">
            <p>Total Checkout Tasks</p>
            <h2>{stats.total}</h2>
            <span>All checkouts</span>
          </div>
        </div>

        <div className="hk-cc-stat-card">
          <div className="hk-cc-stat-icon-wrapper bg-light-orange">
            <Clock size={22} className="color-orange" />
          </div>
          <div className="hk-cc-stat-info">
            <p>Pending</p>
            <h2>{stats.pending}</h2>
            <span>Awaiting cleaning</span>
          </div>
        </div>

        <div className="hk-cc-stat-card">
          <div className="hk-cc-stat-icon-wrapper bg-light-purple">
            <Sparkles size={22} className="color-purple" />
          </div>
          <div className="hk-cc-stat-info">
            <p>In Progress</p>
            <h2>{stats.inProgress}</h2>
            <span>Cleaning active</span>
          </div>
        </div>

        <div className="hk-cc-stat-card">
          <div className="hk-cc-stat-icon-wrapper bg-light-green">
            <CheckCircle2 size={22} className="color-green" />
          </div>
          <div className="hk-cc-stat-info">
            <p>Completed</p>
            <h2>{stats.completed}</h2>
            <span>Ready for guests</span>
          </div>
        </div>
      </div>

      <section className="hk-cc-table-card">
        <div className="hk-cc-table-header">
          <div className="hk-cc-section-title">
            <div className="hk-cc-section-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <h3>Checkout Queue</h3>
              <p>Rooms that require turnover post-checkout.</p>
            </div>
          </div>

          <div className="hk-cc-filter-row">
            <div className="hk-cc-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search room..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="hk-cc-filter-box">
              <Filter size={16} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="hk-cc-empty-state"><h4>Loading checkout cleaning tasks...</h4></div>
        ) : filteredTasks.length === 0 ? (
          <div className="hk-cc-empty-state">
            <h4>No checkout cleaning tasks found</h4>
            <p>Rooms checked out from the front desk will appear here.</p>
          </div>
        ) : (
          <div className="hk-cc-table-scroll">
            <table className="hk-cc-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Room</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td><span className="hk-cc-id-tag">#{task.id}</span></td>
                    <td><strong>Room {getRoomNumber(task.room_id)}</strong></td>
                    <td><UserCheck size={13} /> {task.assigned_to || "Unassigned"}</td>
                    <td><span className={`hk-cc-priority ${task.priority}`}>{task.priority}</span></td>
                    <td><span className={`hk-cc-status-pill ${task.status}`}>{task.status}</span></td>
                    <td style={{ textAlign: "right" }}>
                      <div className="hk-cc-action-row">
                        {task.status === "pending" && (
                          <button
                            type="button"
                            className="hk-cc-start-btn"
                            onClick={() => handleQuickStatus(task, "in-progress")}
                            disabled={updatingId === task.id}
                          >
                            Start
                          </button>
                        )}
                        {task.status !== "completed" && (
                          <button
                            type="button"
                            className="hk-cc-complete-btn"
                            onClick={() => handleQuickStatus(task, "completed")}
                            disabled={updatingId === task.id}
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}