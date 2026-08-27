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
  UserCheck,
  Users
} from "lucide-react";

import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import "./housekeepingAssignedWork.css";

const taskStatuses = ["pending", "in-progress", "completed", "cancelled"];

export default function HousekeepingAssignedWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
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

      const [tasksRes, staffRes, roomsRes] = await Promise.all([
        api.get("/housekeeping/tasks").catch(() => ({ data: [] })),
        api.get("/staff").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] }))
      ]);

      const hotelId = getLoggedInHotelId();
      let tasksList = normalizeList(tasksRes.data, "tasks");
      let staffList = normalizeList(staffRes.data, "staff");
      let roomsList = normalizeList(roomsRes.data, "rooms");

      if (hotelId) {
        tasksList = tasksList.filter((t) => Number(t.hotel_id) === Number(hotelId));
        staffList = staffList.filter((s) => Number(s.hotel_id) === Number(hotelId));
        roomsList = roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId));
      }

      setTasks(tasksList);
      setStaffMembers(staffList);
      setRooms(roomsList);
    } catch (err) {
      console.error("Fetch assigned work error:", err);
      setError(getApiErrorMessage(err, "Failed to load assigned work data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const updateTaskStatus = async (task, nextStatus) => {
    try {
      setUpdatingId(task.id);
      setError("");
      setSuccess("");

      await api.patch(`/housekeeping/tasks/${task.id}/status`, {
        status: nextStatus,
      });

      setSuccess(`Task marked as ${nextStatus}.`);

      setTimeout(() => {
        setSuccess("");
      }, 2000);

      await fetchData();
    } catch (err) {
      console.error("Update task status error:", err);
      setError(getApiErrorMessage(err, "Failed to update task status."));
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter tasks to ONLY those that are assigned to someone
  const assignedTasks = useMemo(() => {
    return tasks.filter((task) => task.assigned_to || task.assigned_staff_id);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return assignedTasks.filter((task) => {
      const search = searchText.toLowerCase();
      const status = String(task.status || "").toLowerCase();
      
      const assignedTo = String(task.assigned_to || "").toLowerCase();
      const roomNum = String(getRoomNumber(task.room_id)).toLowerCase();
      const taskType = String(task.task_type || "").toLowerCase();

      const matchesSearch = 
        !search || 
        assignedTo.includes(search) || 
        roomNum.includes(search) || 
        taskType.includes(search);

      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [assignedTasks, searchText, statusFilter, rooms]);

  const stats = useMemo(() => {
    const pending = assignedTasks.filter((t) => t.status === "pending").length;
    const inProgress = assignedTasks.filter((t) => t.status === "in-progress").length;
    const completed = assignedTasks.filter((t) => t.status === "completed").length;
    
    // Count unique staff members currently assigned to active tasks
    const activeStaffIds = new Set();
    assignedTasks.forEach((t) => {
      if (t.status !== "completed" && t.status !== "cancelled") {
        if (t.assigned_to) activeStaffIds.add(t.assigned_to);
      }
    });

    return {
      total: assignedTasks.length,
      activeStaff: activeStaffIds.size,
      pending,
      inProgress,
      completed
    };
  }, [assignedTasks]);

  return (
    <div className="hk-aw-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Assigned Work"
        kicker="HOUSEKEEPING PORTAL"
        description="View and manage housekeeping tasks grouped by assigned staff members."
        icon={UserCheck}
        backPath="/housekeeping"
      />

      {error && <div className="hk-aw-error-box">{error}</div>}
      {success && <div className="hk-aw-success-box">{success}</div>}

      {/* Stats Grid */}
      <div className="hk-aw-stats-grid">
        <div className="hk-aw-stat-card">
          <div className="hk-aw-stat-icon-wrapper bg-light-purple">
            <Users size={22} className="color-purple" />
          </div>
          <div className="hk-aw-stat-info">
            <p>Active Staff</p>
            <h2>{stats.activeStaff}</h2>
            <span>Staff on duty</span>
          </div>
        </div>

        <div className="hk-aw-stat-card">
          <div className="hk-aw-stat-icon-wrapper bg-light-orange">
            <Clock size={22} className="color-orange" />
          </div>
          <div className="hk-aw-stat-info">
            <p>Pending</p>
            <h2>{stats.pending}</h2>
            <span>Awaiting action</span>
          </div>
        </div>

        <div className="hk-aw-stat-card">
          <div className="hk-aw-stat-icon-wrapper bg-light-blue">
            <Sparkles size={22} className="color-blue" />
          </div>
          <div className="hk-aw-stat-info">
            <p>In Progress</p>
            <h2>{stats.inProgress}</h2>
            <span>Currently cleaning</span>
          </div>
        </div>

        <div className="hk-aw-stat-card">
          <div className="hk-aw-stat-icon-wrapper bg-light-green">
            <CheckCircle2 size={22} className="color-green" />
          </div>
          <div className="hk-aw-stat-info">
            <p>Completed</p>
            <h2>{stats.completed}</h2>
            <span>Finished tasks</span>
          </div>
        </div>
      </div>

      <section className="hk-aw-table-card">
        <div className="hk-aw-table-header">
          <div className="hk-aw-section-title">
            <div className="hk-aw-section-icon">
              <UserCheck size={18} />
            </div>
            <div>
              <h3>Staff Assignments</h3>
              <p>All tasks currently assigned to personnel.</p>
            </div>
          </div>

          <div className="hk-aw-filter-row">
            <div className="hk-aw-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search staff, room, or task..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="hk-aw-filter-box">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="hk-aw-empty-state">
            <h4>Loading assigned work...</h4>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="hk-aw-empty-state">
            <h4>No assigned tasks found</h4>
            <p>Assign tasks from the active housekeeping queue.</p>
          </div>
        ) : (
          <div className="hk-aw-table-scroll">
            <table className="hk-aw-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Assigned To</th>
                  <th>Room</th>
                  <th>Task Details</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td><span className="hk-aw-id-tag">#{task.id}</span></td>
                    
                    <td>
                      <div className="hk-aw-details-cell">
                        <strong><UserCheck size={13}/> {task.assigned_to || "Assigned"}</strong>
                      </div>
                    </td>

                    <td>
                      <strong>Room {getRoomNumber(task.room_id)}</strong>
                    </td>

                    <td>
                      <div className="hk-aw-details-cell">
                        <strong>{String(task.task_type || "").replace("-", " ")}</strong>
                        <span>{task.notes || "-"}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`hk-aw-priority-text ${task.priority}`}>
                        {task.priority}
                      </span>
                    </td>

                    <td>
                      <span className={`hk-aw-status-pill ${task.status}`}>
                        {task.status.replace("-", " ")}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="hk-aw-action-row">
                        {task.status === "pending" && (
                          <button
                            type="button"
                            className="hk-aw-start-btn"
                            onClick={() => updateTaskStatus(task, "in-progress")}
                            disabled={updatingId === task.id}
                          >
                            Start
                          </button>
                        )}

                        {task.status !== "completed" && task.status !== "cancelled" && (
                          <button
                            type="button"
                            className="hk-aw-complete-btn"
                            onClick={() => updateTaskStatus(task, "completed")}
                            disabled={updatingId === task.id}
                          >
                            Complete
                          </button>
                        )}
                        
                        {(task.status === "completed" || task.status === "cancelled") && (
                           <span className="hk-aw-done-text">No actions</span>
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