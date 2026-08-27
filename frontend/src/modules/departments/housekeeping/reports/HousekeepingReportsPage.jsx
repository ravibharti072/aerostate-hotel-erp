import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Filter,
  Search,
  XCircle,
  User
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import "./housekeepingReports.css";

const reportStatuses = ["completed", "cancelled"];

const getTodayDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateValue = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function HousekeepingReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [reportDate, setReportDate] = useState(getTodayDateValue());
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

  const getTaskReportDate = (task) => {
    return task.completed_at || task.updated_at || task.created_at;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [tasksRes, roomsRes] = await Promise.all([
        api.get("/housekeeping/tasks").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
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
      console.error("Fetch reports error:", err);
      setError(getApiErrorMessage(err, "Failed to load report data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reportTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isReportStatus = reportStatuses.includes(task.status);
      const matchesDate = getDateValue(getTaskReportDate(task)) === reportDate;

      const search = searchText.toLowerCase();
      const roomNum = String(getRoomNumber(task.room_id)).toLowerCase();
      const assignedTo = String(task.assigned_to || "").toLowerCase();
      const taskType = String(task.task_type || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        assignedTo.includes(search) ||
        taskType.includes(search);

      const matchesStatus = statusFilter === "all" || task.status === statusFilter;

      return isReportStatus && matchesDate && matchesSearch && matchesStatus;
    });
  }, [tasks, rooms, reportDate, searchText, statusFilter]);

  const stats = useMemo(() => {
    const completed = reportTasks.filter((t) => t.status === "completed").length;
    const cancelled = reportTasks.filter((t) => t.status === "cancelled").length;

    return {
      total: reportTasks.length,
      completed,
      cancelled,
    };
  }, [reportTasks]);

  const exportReport = () => {
    const rows = [
      ["Task ID", "Room", "Task Type", "Assigned To", "Priority", "Status", "Date"],
      ...reportTasks.map((t) => [
        t.id,
        getRoomNumber(t.room_id),
        t.task_type.replace("-", " "),
        t.assigned_to || "Unassigned",
        t.priority,
        t.status,
        getDateValue(getTaskReportDate(t)),
      ]),
    ];

    const csvContent = rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `housekeeping_report_${reportDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="hk-rep-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Daily Reports"
        kicker="HOUSEKEEPING PORTAL"
        description="View completed and cancelled housekeeping tasks by date."
        icon={BarChart3}
        backPath="/housekeeping"
      />

      {error && <div className="hk-rep-error-box">{error}</div>}

      {/* Stats Grid */}
      <div className="hk-rep-stats-grid">
        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-blue">
            <CalendarDays size={22} className="color-blue" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Total Tasks</p>
            <h2>{stats.total}</h2>
            <span>For selected date</span>
          </div>
        </div>

        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-green">
            <CheckCircle2 size={22} className="color-green" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Completed</p>
            <h2>{stats.completed}</h2>
            <span>Successfully finished</span>
          </div>
        </div>

        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-gray">
            <XCircle size={22} className="color-gray" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Cancelled</p>
            <h2>{stats.cancelled}</h2>
            <span>Tasks not performed</span>
          </div>
        </div>
      </div>

      <section className="hk-rep-table-card">
        <div className="hk-rep-table-header">
          <div className="hk-rep-section-title">
            <div className="hk-rep-section-icon">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3>Activity Log</h3>
              <p>Detailed log of housekeeping activity.</p>
            </div>
          </div>

          <div className="hk-rep-filter-row">
            <div className="hk-rep-date-picker">
              <CalendarDays size={16} />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>

            <div className="hk-rep-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search room, task, staff..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="hk-rep-filter-box">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                {reportStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="hk-rep-export-btn"
              onClick={exportReport}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="hk-rep-empty-state">
            <h4>Loading reports...</h4>
          </div>
        ) : reportTasks.length === 0 ? (
          <div className="hk-rep-empty-state">
            <h4>No activity found</h4>
            <p>There are no completed or cancelled tasks for {reportDate}.</p>
          </div>
        ) : (
          <div className="hk-rep-table-scroll">
            <table className="hk-rep-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Date Logged</th>
                  <th>Room</th>
                  <th>Task / Priority</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportTasks.map((task) => (
                  <tr key={task.id}>
                    <td><span className="hk-rep-id-tag">#{task.id}</span></td>
                    
                    <td>
                      <div className="hk-rep-details-cell">
                        <strong>{getDateValue(getTaskReportDate(task))}</strong>
                      </div>
                    </td>

                    <td>
                      <strong>Room {getRoomNumber(task.room_id)}</strong>
                    </td>

                    <td>
                      <div className="hk-rep-details-cell">
                        <strong style={{textTransform: "capitalize"}}>
                          {String(task.task_type || "").replace("-", " ")}
                        </strong>
                        <span className={`hk-rep-priority-text ${task.priority}`}>
                          {task.priority} Priority
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="hk-rep-details-cell">
                        <strong><User size={13}/> {task.assigned_to || "Unassigned"}</strong>
                      </div>
                    </td>

                    <td>
                      <span className={`hk-rep-status-pill ${task.status}`}>
                        {task.status}
                      </span>
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