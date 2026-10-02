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
  User,
  AlertTriangle,
  Clock,
  Archive,
  RotateCw,
  X,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader } from "@components";
import "./housekeepingReports.css";

const getDateValue = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getReportStatusInfo = (task) => {
  const notes = String(task?.notes || "");
  const rawStatus = String(task?.status || "pending").toLowerCase();

  const lastPassedIdx = notes.lastIndexOf("[Inspection PASSED");
  const lastFailedIdx = notes.lastIndexOf("[Inspection FAILED");

  const isPassed = lastPassedIdx !== -1 && (lastFailedIdx === -1 || lastPassedIdx > lastFailedIdx);
  const isFailed = lastFailedIdx !== -1 && (lastPassedIdx === -1 || lastFailedIdx > lastPassedIdx);

  if (rawStatus === "archived") {
    return {
      key: "archived",
      label: "Archived",
      pillClass: "archived",
    };
  }

  if (isFailed) {
    return {
      key: "failed",
      label: "Failed Inspection",
      pillClass: "failed",
    };
  }

  if (rawStatus === "completed" || rawStatus === "approved") {
    if (isPassed) {
      return {
        key: "completed",
        label: "Cleaned & Inspected",
        pillClass: "completed",
      };
    }
    return {
      key: "pending-inspection",
      label: "Awaiting Inspection",
      pillClass: "pending-inspection",
    };
  }

  if (rawStatus === "in-progress" || rawStatus === "cleaning") {
    return {
      key: "in-progress",
      label: "In Cleaning",
      pillClass: "in-progress",
    };
  }

  return {
    key: "pending",
    label: "Pending Turnover",
    pillClass: "pending",
  };
};

export const formatReportNote = (rawNotes) => {
  if (!rawNotes || typeof rawNotes !== "string") return "-";
  const lines = rawNotes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "-";

  const lastPassIdx = rawNotes.lastIndexOf("[Inspection PASSED");
  const lastFailIdx = rawNotes.lastIndexOf("[Inspection FAILED");

  if (lastFailIdx !== -1 && (lastPassIdx === -1 || lastFailIdx > lastPassIdx)) {
    const failLine = [...lines].reverse().find((l) => /\[Inspection FAILED/i.test(l));
    return failLine || "Inspection failed. Rework required.";
  }

  if (lastPassIdx !== -1 && (lastFailIdx === -1 || lastPassIdx > lastFailIdx)) {
    const passLine = [...lines].reverse().find((l) => /\[Inspection PASSED/i.test(l));
    return passLine || "Room inspected & approved.";
  }

  const completionLine = [...lines].reverse().find((l) => /completion remarks:/i.test(l));
  if (completionLine) return completionLine;

  return lines[lines.length - 1];
};

export default function HousekeepingReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Default to "" (All Dates) so every historical report is visible
  const [reportDate, setReportDate] = useState("");
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

  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));

  const getRoomNumber = (roomId) => {
    const room = getRoom(roomId);
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
      const statusInfo = getReportStatusInfo(task);
      const taskDate = getDateValue(getTaskReportDate(task));
      const matchesDate = !reportDate || taskDate === reportDate;

      const search = searchText.toLowerCase().trim();
      const roomNum = String(getRoomNumber(task.room_id)).toLowerCase();
      const assignedTo = String(task.assigned_to || "").toLowerCase();
      const taskType = String(task.task_type || "").toLowerCase();
      const notes = String(task.notes || "").toLowerCase();
      const priority = String(task.priority || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        assignedTo.includes(search) ||
        taskType.includes(search) ||
        notes.includes(search) ||
        priority.includes(search) ||
        String(task.id).includes(search);

      const matchesStatus = statusFilter === "all" || statusInfo.key === statusFilter;

      return matchesDate && matchesSearch && matchesStatus;
    });
  }, [tasks, rooms, reportDate, searchText, statusFilter]);

  const stats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    let active = 0;

    reportTasks.forEach((t) => {
      const info = getReportStatusInfo(t);
      if (info.key === "completed") completed++;
      else if (info.key === "failed") failed++;
      else if (info.key === "pending" || info.key === "in-progress" || info.key === "pending-inspection") {
        active++;
      }
    });

    return {
      total: reportTasks.length,
      completed,
      failed,
      active,
    };
  }, [reportTasks]);

  const exportReport = () => {
    const rows = [
      ["Task ID", "Date", "Room", "Task Type", "Priority", "Assigned To", "Status", "Notes & Remarks"],
      ...reportTasks.map((t) => {
        const info = getReportStatusInfo(t);
        return [
          t.id,
          getDateValue(getTaskReportDate(t)),
          `Room ${getRoomNumber(t.room_id)}`,
          String(t.task_type || "").replace("-", " "),
          t.priority || "normal",
          t.assigned_to || "Unassigned",
          info.label,
          `"${String(formatReportNote(t.notes)).replace(/"/g, '""')}"`,
        ];
      }),
    ];

    const csvContent = rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `housekeeping_full_report_${reportDate || "all_time"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="hk-rep-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader
        title="Housekeeping Reports & Activity Log"
        kicker="HOUSEKEEPING PORTAL"
        description="Comprehensive audit log of all room cleanings, inspections, rework reports, and turnovers."
        icon={BarChart3}
        backPath="/housekeeping"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={fetchData}
            style={{
              padding: "0 14px",
              height: "38px",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
            title="Refresh Reports"
            disabled={loading}
          >
            <RotateCw size={14} style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }} />
            Refresh
          </button>
        }
      />

      {error && <div className="hk-rep-error-box">{error}</div>}

      {/* Stats Grid (4 items) */}
      <div className="hk-rep-stats-grid">
        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-blue">
            <CalendarDays size={22} className="color-blue" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Total Activity Records</p>
            <h2>{stats.total}</h2>
            <span>{reportDate ? `For ${reportDate}` : "All-time history"}</span>
          </div>
        </div>

        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-green">
            <CheckCircle2 size={22} className="color-green" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Cleaned & Inspected</p>
            <h2>{stats.completed}</h2>
            <span>Passed HOD inspection</span>
          </div>
        </div>

        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-red">
            <AlertTriangle size={22} className="color-red" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Failed Inspections</p>
            <h2>{stats.failed}</h2>
            <span>Returned for rework</span>
          </div>
        </div>

        <div className="hk-rep-stat-card">
          <div className="hk-rep-stat-icon-wrapper bg-light-orange">
            <Clock size={22} className="color-orange" />
          </div>
          <div className="hk-rep-stat-info">
            <p>Pending / In-Cleaning</p>
            <h2>{stats.active}</h2>
            <span>Turnover queue</span>
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
              <h3>Housekeeping Activity & Inspection Records</h3>
              <p>All-time logs showing inspection results, rework notes, and turnover audit trail.</p>
            </div>
          </div>

          <div className="hk-rep-filter-row">
            <div className="hk-rep-date-picker">
              <CalendarDays size={16} />
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                title="Filter by specific date (leave empty for All Dates)"
              />
              {reportDate && (
                <button
                  type="button"
                  onClick={() => setReportDate("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "0 2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Show All Dates"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="hk-rep-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search room, task, staff, notes..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "0 2px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="hk-rep-filter-box">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="completed">Cleaned & Inspected</option>
                <option value="failed">Failed Inspection</option>
                <option value="pending-inspection">Awaiting Inspection</option>
                <option value="in-progress">In Cleaning</option>
                <option value="pending">Pending Turnover</option>
                <option value="archived">Archived / Soft-Deleted</option>
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
            <h4>Loading housekeeping reports...</h4>
          </div>
        ) : reportTasks.length === 0 ? (
          <div className="hk-rep-empty-state">
            <h4>No activity records found</h4>
            <p>
              {reportDate
                ? `No records found for ${reportDate}. Click the 'X' in the date box to show all dates.`
                : "No housekeeping tasks match the selected search or status filter."}
            </p>
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
                  <th>Inspection & Turnover Remarks</th>
                </tr>
              </thead>
              <tbody>
                {reportTasks.map((task) => {
                  const statusInfo = getReportStatusInfo(task);
                  const room = getRoom(task.room_id);
                  const roomType = room?.room_type || "Standard Room";
                  const floorNum = room?.floor || "1";
                  const noteSummary = formatReportNote(task.notes);

                  return (
                    <tr key={task.id}>
                      <td>
                        <span className="hk-rep-id-tag">#{task.id}</span>
                      </td>

                      <td>
                        <div className="hk-rep-details-cell">
                          <strong>{getDateValue(getTaskReportDate(task))}</strong>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong>Room {getRoomNumber(task.room_id)}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            Floor {floorNum} • {roomType}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="hk-rep-details-cell">
                          <strong style={{ textTransform: "capitalize" }}>
                            {String(task.task_type || "").replace("-", " ")}
                          </strong>
                          <span className={`hk-rep-priority-text ${task.priority || "normal"}`}>
                            {task.priority || "normal"} Priority
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="hk-rep-details-cell">
                          <strong>
                            <User size={13} /> {task.assigned_to || "Unassigned"}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span className={`hk-rep-status-pill ${statusInfo.pillClass}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      <td style={{ maxWidth: "340px", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <span
                          style={{
                            fontSize: "12px",
                            color: statusInfo.key === "failed" ? "#b91c1c" : "#475569",
                            fontWeight: statusInfo.key === "failed" ? 600 : 400,
                            lineHeight: "1.4",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={task.notes}
                        >
                          {statusInfo.key === "failed" && "⚠️ "}
                          {noteSummary}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}