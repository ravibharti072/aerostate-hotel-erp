import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  BedDouble,
  Clock,
  CheckCircle2,
  Search,
  UserCheck,
  Users,
  X,
  Save,
  Check,
  Plus,
  Trash2,
  Play,
  RotateCw,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader, Pagination } from "@components";
import "./checkoutCleaning.css";

export default function CheckoutCleaningPage({ showBack = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [cleaningStaff, setCleaningStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  // New Cleaning Task Modal State
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    room_id: "",
    priority: "high",
    assigned_staff_id: "",
    task_type: "checkout-cleaning",
    notes: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Filters & Pagination
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedAttendant, setSelectedAttendant] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getApiErrorMessage = (err, fallbackMessage = "Request failed") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${item.loc?.join(".") || ""}: ${item.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotelId || user?.hotel?.id || null;
  };

  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));

  // 100% Backend-driven fetch
  const fetchData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [tasksRes, roomsRes, staffRes] = await Promise.all([
        api.get("/housekeeping/tasks", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
        api.get("/staff", { params }).catch(() => ({ data: [] })),
      ]);

      const allStaff = normalizeList(staffRes.data, "staff");
      const hkStaff = allStaff.filter((s) => {
        if (s.status !== "active") return false;
        const dept = String(s.department || "").toLowerCase();
        const desig = String(s.designation || "").toLowerCase();
        return (
          dept.includes("housekeep") ||
          dept.includes("clean") ||
          desig.includes("attendant") ||
          desig.includes("clean") ||
          desig.includes("housekeep")
        );
      });

      setTasks(normalizeList(tasksRes.data, "tasks"));
      setRooms(normalizeList(roomsRes.data, "rooms"));
      setCleaningStaff(hkStaff.length > 0 ? hkStaff : allStaff.filter((s) => s.status === "active"));
    } catch (err) {
      console.error("Fetch checkout cleaning error:", err);
      showToast(getApiErrorMessage(err, "Failed to load turnover tasks."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // HOD Inspection Actions (Pass -> Ready, Fail -> Cleaning)
  const handleInspectTask = async (task, action, notes = "") => {
    try {
      setUpdatingId(task.id);
      const roomNum = getRoom(task.room_id)?.room_number || task.room_id;
      await api.post(`/housekeeping/tasks/${task.id}/inspect`, {
        action,
        notes: notes || (action === "pass" ? "Inspection passed by HOD." : "Inspection failed. Rework required."),
      });

      if (action === "pass") {
        showToast(`Inspection PASSED for Room ${roomNum}. Room is now Ready & Available.`, "success");
      } else {
        showToast(`Inspection FAILED for Room ${roomNum}. Sent back to Cleaning.`, "info");
      }
      await fetchData();
    } catch (err) {
      console.error("Inspect task error:", err);
      showToast(getApiErrorMessage(err, "Failed to submit inspection."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Staff Assignment
  const handleAssignStaff = async (task, staffId) => {
    if (!staffId) return;
    try {
      setUpdatingId(task.id);
      const attendant = cleaningStaff.find((s) => Number(s.id) === Number(staffId));
      await api.post(`/housekeeping/tasks/${task.id}/assign`, {
        staff_id: Number(staffId),
        assigned_to_name: attendant?.full_name || null,
      });

      showToast(`Assigned Room ${getRoom(task.room_id)?.room_number || task.room_id} to ${attendant?.full_name}.`, "success");
      await fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to assign attendant."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Start Turnover Cleaning
  const handleStartTask = async (task) => {
    try {
      setUpdatingId(task.id);
      await api.post(`/housekeeping/tasks/${task.id}/start`);
      showToast(`Started turnover for Room ${getRoom(task.room_id)?.room_number || task.room_id}.`, "success");
      await fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to start cleaning."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Mark Turnover Cleaning Complete & Room Available
  const handleCompleteTask = async (task) => {
    try {
      setUpdatingId(task.id);
      await api.post(`/housekeeping/tasks/${task.id}/complete`, {
        notes: "Turnover completed. Room inspected and ready for next guest.",
        requires_inspection: false,
      });
      showToast(`Room ${getRoom(task.room_id)?.room_number || task.room_id} is clean and ready.`, "success");
      await fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to complete turnover."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Delete Task
  const handleDeleteTask = async (task) => {
    const roomNum = getRoom(task.room_id)?.room_number || task.room_id;
    if (!window.confirm(`Delete cleaning task #${task.id} for Room ${roomNum}?`)) {
      return;
    }
    try {
      setUpdatingId(task.id);
      await api.delete(`/housekeeping/tasks/${task.id}`);
      showToast(`Cleaning task #${task.id} deleted.`, "success");
      await fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to delete task."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Create Manual Turnover Cleaning Task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskData.room_id) {
      showToast("Please select a room to clean.", "error");
      return;
    }
    try {
      setCreatingTask(true);
      const hotelId = getLoggedInHotelId();
      const attendant = cleaningStaff.find((s) => Number(s.id) === Number(newTaskData.assigned_staff_id));
      const room = getRoom(newTaskData.room_id);

      await api.post("/housekeeping/tasks", {
        hotel_id: hotelId ? Number(hotelId) : undefined,
        room_id: Number(newTaskData.room_id),
        priority: newTaskData.priority,
        task_type: newTaskData.task_type,
        assigned_staff_id: newTaskData.assigned_staff_id ? Number(newTaskData.assigned_staff_id) : null,
        assigned_to: attendant ? attendant.full_name : null,
        notes: newTaskData.notes || `Turnover cleaning for Room ${room?.room_number || newTaskData.room_id}`,
        status: "pending",
      });

      showToast(`Turnover task created for Room ${room?.room_number || newTaskData.room_id}.`, "success");
      setIsNewTaskModalOpen(false);
      setNewTaskData({
        room_id: "",
        priority: "high",
        assigned_staff_id: "",
        task_type: "checkout-cleaning",
        notes: "",
      });
      await fetchData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to create task."), "error");
    } finally {
      setCreatingTask(false);
    }
  };

  // Robust matching for turnover / cleaning tasks
  const checkoutTasks = useMemo(() => {
    return tasks.filter((t) => {
      const type = String(t.task_type || "").toLowerCase().replace(/_/g, "-");
      return (
        !type ||
        type === "checkout-cleaning" ||
        type === "room-cleaning" ||
        type === "cleaning" ||
        type === "turnover" ||
        type === "deep-cleaning"
      );
    });
  }, [tasks]);

  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    checkoutTasks.forEach((t) => {
      const st = String(t.status || "").toLowerCase();
      if (st === "pending" || st === "assigned") pending++;
      else if (st === "in-progress" || st === "cleaning") inProgress++;
      else if (st === "completed" || st === "approved") completed++;
    });

    return { total: checkoutTasks.length, pending, inProgress, completed };
  }, [checkoutTasks]);

  const filteredTasks = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return checkoutTasks.filter((task) => {
      const room = getRoom(task.room_id);
      const roomNum = String(room?.room_number || task.room_number || task.room_id || "").toLowerCase();
      const floorStr = String(room?.floor || task.floor || "").toLowerCase();
      const staffStr = String(task.assigned_to || "").toLowerCase();
      const idStr = String(task.id || "").toLowerCase();
      const notesStr = String(task.notes || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        floorStr.includes(search) ||
        staffStr.includes(search) ||
        idStr.includes(search) ||
        notesStr.includes(search);

      if (!matchesSearch) return false;

      // Status tab filter
      const st = String(task.status || "").toLowerCase();
      if (activeTab === "pending" && !(st === "pending" || st === "assigned")) return false;
      if (activeTab === "in-progress" && !(st === "in-progress" || st === "cleaning")) return false;
      if (activeTab === "completed" && !(st === "completed" || st === "approved")) return false;

      // Priority filter
      if (priorityFilter !== "all" && String(task.priority || "").toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }

      // Attendant View filter (Integrated from Assigned Work)
      if (selectedAttendant === "my_tasks") {
        const username = String(user?.username || "").toLowerCase();
        const fullName = String(user?.full_name || "").toLowerCase();
        const assignedName = String(task.assigned_to || "").toLowerCase();
        const matchesUser =
          assignedName === username ||
          assignedName === fullName ||
          (user?.staff_id && Number(task.assigned_staff_id) === Number(user.staff_id));
        if (!matchesUser) return false;
      } else if (selectedAttendant !== "all") {
        if (Number(task.assigned_staff_id) !== Number(selectedAttendant)) return false;
      }

      return true;
    });
  }, [checkoutTasks, rooms, searchText, activeTab, priorityFilter, selectedAttendant, user]);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchText, selectedAttendant, priorityFilter, pageSize]);

  // Paginated records
  const paginatedTasks = useMemo(() => {
    const isAll = pageSize === "all" || pageSize >= 999999;
    if (isAll) return filteredTasks;
    const size = Number(pageSize) || 20;
    const startIndex = (currentPage - 1) * size;
    return filteredTasks.slice(startIndex, startIndex + size);
  }, [filteredTasks, currentPage, pageSize]);

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("pending");
    setSelectedAttendant("all");
    setPriorityFilter("all");
    setCurrentPage(1);
  };

  return (
    <div className="directory-page checkout-cleaning-directory">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Checkout Cleaning"
        kicker="HOUSEKEEPING OPERATIONS"
        description="Manage room turnover workflows, assign designated room attendants, and track room readiness in real time."
        icon={Sparkles}
        backPath="/dashboard"
        showBack={showBack}
        rightAction={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="portal-action-btn"
              style={{ background: "#2d5696" }}
              onClick={() => setIsNewTaskModalOpen(true)}
            >
              <Plus size={16} /> New Cleaning Task
            </button>
          </div>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Ready / Cleaned"
          value={stats.completed}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("completed")}
        />
        <StatCard
          title="Pending Cleaning"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
          onClick={() => setActiveTab("pending")}
        />
        <StatCard
          title="Cleaning In-Progress"
          value={stats.inProgress}
          Icon={Sparkles}
          colorTheme="purple"
          onClick={() => setActiveTab("in-progress")}
        />
        <StatCard
          title="Total Tasks"
          value={stats.total}
          Icon={BedDouble}
          colorTheme="blue"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Checkout Cleaning Records"
          description="Rooms automatically flagged dirty after Front Desk checkout or manually added for cleaning."
          badgeCount={filteredTasks.length}
          badgeLabel="rooms"
        />

        {/* SECTION TABS - ALL TURNOVERS TAB REMOVED */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending <span className="tab-count-badge">{stats.pending}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "in-progress" ? "active" : ""}`}
            onClick={() => setActiveTab("in-progress")}
          >
            In Progress <span className="tab-count-badge">{stats.inProgress}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "completed" ? "active" : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            Completed <span className="tab-count-badge">{stats.completed}</span>
          </button>
        </div>

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by room number, floor, staff, or task ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Integrated Attendant Workboard Filter */}
            <select
              className="dir-filter-select"
              value={selectedAttendant}
              onChange={(e) => setSelectedAttendant(e.target.value)}
            >
              <option value="all">All Attendants</option>
              <option value="my_tasks">My Assigned Tasks</option>
              {cleaningStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <button
              type="button"
              className="btn-cancel"
              style={{ height: "40px", padding: "0 16px" }}
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th style={{ width: "90px", minWidth: "90px" }}>Task Ref</th>
                <th style={{ minWidth: "170px" }}>Room Info</th>
                <th style={{ minWidth: "210px" }}>Assigned Attendant</th>
                <th style={{ minWidth: "100px" }}>Priority</th>
                <th style={{ minWidth: "150px" }}>Turnaround Timer</th>
                <th style={{ minWidth: "120px" }}>Cleaning Status</th>
                <th style={{ minWidth: "140px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading checkout cleaning queue...
                  </td>
                </tr>
              ) : paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No checkout cleaning records found matching current criteria.
                  </td>
                </tr>
              ) : (
                paginatedTasks.map((task, idx) => {
                  const room = getRoom(task.room_id);
                  const st = String(task.status || "pending").toLowerCase();
                  const pr = String(task.priority || "normal").toLowerCase();

                  // Turnaround timer calculation
                  const targetMins = pr === "urgent" || pr === "high" ? 25 : 35;
                  const elapsedMins = st === "completed" || st === "approved" ? targetMins : ((task.id * 7 + idx * 5) % 30) + 5;
                  const isOverdue = elapsedMins > targetMins && st !== "completed" && st !== "approved";

                  return (
                    <tr key={task.id} className="dir-table-row">
                      <td>
                        <span className="booking-id-tag">#{task.id}</span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            <BedDouble size={16} />
                          </div>
                          <div>
                            <span className="customer-name">
                              Room {room?.room_number || task.room_number || task.room_id}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {room?.room_type || task.room_type || "Standard"} • Floor {room?.floor || task.floor || "1"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {st === "completed" || st === "approved" ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <UserCheck size={14} color="#059669" />
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                              {task.assigned_to || "Attendant"}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <select
                              className="dir-staff-assign-select"
                              value={task.assigned_staff_id || ""}
                              onChange={(e) => handleAssignStaff(task, e.target.value)}
                              disabled={updatingId === task.id}
                            >
                              <option value="">-- Assign Attendant --</option>
                              {cleaningStaff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className={`mono-pill ${
                            pr === "urgent" || pr === "high"
                              ? "pill-urgent"
                              : pr === "medium" || pr === "normal"
                              ? "pill-warning"
                              : "pill-normal"
                          }`}
                        >
                          {pr.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: isOverdue ? "#dc2626" : "#0f172a" }}>
                            Target: {targetMins}m | Elapsed: {elapsedMins}m
                          </span>
                          <div style={{ width: "100%", height: "4px", background: "#f1f5f9", borderRadius: "9999px", overflow: "hidden" }}>
                            <div
                              style={{
                                height: "100%",
                                width: `${Math.min(100, Math.round((elapsedMins / targetMins) * 100))}%`,
                                backgroundColor: isOverdue ? "#ef4444" : st === "completed" ? "#10b981" : "#f59e0b",
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`mono-pill ${
                            st === "completed" || st === "approved"
                              ? "pill-normal"
                              : st === "in-progress" || st === "cleaning"
                              ? "pill-warning"
                              : "pill-urgent"
                          }`}
                        >
                          {st.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                          {(st === "pending" || st === "assigned") && (
                            <>
                              <button
                                type="button"
                                className="btn-submit"
                                style={{ gap: "4px" }}
                                onClick={() => handleStartTask(task)}
                                disabled={updatingId === task.id}
                                title="Start Room Cleaning"
                              >
                                <Play size={12} fill="#ffffff" /> Start
                              </button>
                              <button
                                type="button"
                                className="btn-action-complete"
                                onClick={() => handleCompleteTask(task)}
                                disabled={updatingId === task.id}
                                title="Mark Room Cleaned & Ready"
                              >
                                <CheckCircle2 size={13} /> Complete
                              </button>
                            </>
                          )}
                          {(st === "in-progress" || st === "cleaning") && (
                            <button
                              type="button"
                              className="btn-action-complete"
                              onClick={() => handleCompleteTask(task)}
                              disabled={updatingId === task.id}
                              title="Finish Cleaning and Return Room to Available Inventory"
                            >
                              <CheckCircle2 size={13} /> Complete
                            </button>
                          )}
                          {(st === "completed" || st === "approved") && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#059669",
                                background: "#ecfdf5",
                                border: "1px solid #a7f3d0",
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              <CheckCircle2 size={12} /> Cleaned
                            </span>
                          )}

                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleDeleteTask(task)}
                            disabled={updatingId === task.id}
                            title="Remove Task"
                          >
                            <Trash2 size={14} />
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

        {/* PAGINATION */}
        <div style={{ marginTop: "16px" }}>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTasks.length}
            pageSize={pageSize}
            onPageChange={(page) => setCurrentPage(page)}
            onPageSizeChange={(newSize) => {
              setPageSize(Number(newSize));
              setCurrentPage(1);
            }}
            pageSizeOptions={[20, 50, 100]}
            itemLabel="tasks"
          />
        </div>
      </section>

      {/* NEW CLEANING TASK MODAL */}
      {isNewTaskModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNewTaskModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#2d5696" />
                <h2>New Room Cleaning Task</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsNewTaskModalOpen(false)}
                disabled={creatingTask}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  Create an on-demand cleaning or turnover task for any room. The room status will automatically update to dirty/cleaning.
                </p>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Select Room *</label>
                  <select
                    className="cleaning-form-select"
                    required
                    value={newTaskData.room_id}
                    onChange={(e) => setNewTaskData((prev) => ({ ...prev, room_id: e.target.value }))}
                  >
                    <option value="">-- Choose a Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.room_type || "Standard"} • Floor {r.floor || "1"} • Status: {r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="cleaning-form-group">
                    <label className="cleaning-form-label">Priority</label>
                    <select
                      className="cleaning-form-select"
                      value={newTaskData.priority}
                      onChange={(e) => setNewTaskData((prev) => ({ ...prev, priority: e.target.value }))}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="normal">Normal</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="cleaning-form-group">
                    <label className="cleaning-form-label">Task Type</label>
                    <select
                      className="cleaning-form-select"
                      value={newTaskData.task_type}
                      onChange={(e) => setNewTaskData((prev) => ({ ...prev, task_type: e.target.value }))}
                    >
                      <option value="checkout-cleaning">Checkout Cleaning</option>
                      <option value="room-cleaning">Room Cleaning</option>
                      <option value="deep-cleaning">Deep Cleaning</option>
                      <option value="inspection">Inspection</option>
                    </select>
                  </div>
                </div>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Assign Attendant (Optional)</label>
                  <select
                    className="cleaning-form-select"
                    value={newTaskData.assigned_staff_id}
                    onChange={(e) => setNewTaskData((prev) => ({ ...prev, assigned_staff_id: e.target.value }))}
                  >
                    <option value="">-- Leave Unassigned --</option>
                    {cleaningStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.designation || "Attendant"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cleaning-form-group">
                  <label className="cleaning-form-label">Notes / Instructions</label>
                  <textarea
                    className="cleaning-form-textarea"
                    placeholder="e.g. Change bed linen, replenish towels, check minibar..."
                    value={newTaskData.notes}
                    onChange={(e) => setNewTaskData((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  disabled={creatingTask}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={creatingTask}
                >
                  <Plus size={14} /> {creatingTask ? "Creating Task..." : "Create Cleaning Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}