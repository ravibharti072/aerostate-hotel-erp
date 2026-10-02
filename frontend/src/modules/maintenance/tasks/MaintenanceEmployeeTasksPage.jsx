import React, { useEffect, useState, useMemo } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Play,
  Check,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  MapPin,
  Search,
  X,
  FileText,
  Timer,
  CheckCheck,
  UserCheck,
  Building,
  BedDouble,
  RotateCcw,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./maintenanceEmployeeTasks.css";

const CATEGORIES = [
  "General",
  "Electrical",
  "Plumbing",
  "AC / HVAC",
  "Carpentry",
  "Appliance",
  "Elevator",
  "Generator",
  "Painting",
  "Civil Work",
  "Safety / Fire",
];

export default function MaintenanceEmployeeTasksPage() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [unassignedTasks, setUnassignedTasks] = useState([]);
  const [stats, setStats] = useState({
    assigned: 0,
    in_progress: 0,
    completed_today: 0,
    completed_total: 0,
    urgent: 0,
    total_active: 0,
    unassigned: 0,
  });

  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("active"); // active | in_progress | unassigned | completed | all
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table | cards

  // Complete Modal State
  const [completeModalTask, setCompleteModalTask] = useState(null);
  const [actualHours, setActualHours] = useState("1.0");
  const [completionNotes, setCompletionNotes] = useState("");
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const [tasksRes, unassignedRes, statsRes] = await Promise.all([
        api.get("/tasks/my-tasks"),
        api.get("/tasks/my-tasks", { params: { status: "unassigned" } }),
        api.get("/tasks/my-stats"),
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setUnassignedTasks(Array.isArray(unassignedRes.data) ? unassignedRes.data : []);
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load technician tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, [user]);

  // Tab and client-side filtering
  const activeTaskList = useMemo(() => {
    if (tab === "unassigned") return unassignedTasks;
    return tasks;
  }, [tab, tasks, unassignedTasks]);

  const filteredTasks = useMemo(() => {
    return activeTaskList.filter((t) => {
      // Tab filter
      if (tab === "active" && !["assigned", "in_progress"].includes(t.status)) {
        return false;
      }
      if (tab === "in_progress" && t.status !== "in_progress") {
        return false;
      }
      if (tab === "completed" && t.status !== "completed") {
        return false;
      }
      if (tab === "unassigned" && (t.assigned_to_staff_id || t.status !== "pending")) {
        return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && t.priority !== priorityFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== "all" && t.category !== categoryFilter) {
        return false;
      }

      // Search filter
      const term = search.toLowerCase().trim();
      if (
        term &&
        !(
          (t.title || "").toLowerCase().includes(term) ||
          (t.task_number || "").toLowerCase().includes(term) ||
          (t.location || "").toLowerCase().includes(term) ||
          (t.description || "").toLowerCase().includes(term) ||
          (t.completion_notes || "").toLowerCase().includes(term)
        )
      ) {
        return false;
      }

      return true;
    });
  }, [activeTaskList, tab, search, categoryFilter, priorityFilter]);

  // Claim Task Handler (Technician picks up an unassigned task)
  const handleClaimTask = async (taskId) => {
    try {
      const staffId = user?.staff_id || user?.staff?.id;
      await api.post(`/tasks/${taskId}/assign`, {
        staff_id: staffId ? Number(staffId) : undefined,
      });
      await fetchMyTasks();
      setTab("active");
    } catch (err) {
      console.error("Failed to claim task:", err);
      alert(err?.response?.data?.detail || "Failed to claim task.");
    }
  };

  // Start Task Handler
  const handleStartTask = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/start`);
      fetchMyTasks();
    } catch (err) {
      console.error("Failed to start task:", err);
      alert(err.response?.data?.detail || "Failed to start task.");
    }
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (task) => {
    setCompleteModalTask(task);
    setCompleteError("");
    setCompletionNotes("");

    // Calculate default actual hours based on elapsed time or estimated
    let defaultHours = task.estimated_hours || 1.0;
    if (task.started_at) {
      const elapsed =
        (new Date() - new Date(task.started_at)) / (1000 * 60 * 60);
      defaultHours = Math.max(0.1, Math.round(elapsed * 10) / 10);
    }
    setActualHours(String(defaultHours));
  };

  // Submit Complete Task
  const handleSubmitComplete = async (e) => {
    e.preventDefault();
    if (!completeModalTask) return;

    setSubmittingComplete(true);
    setCompleteError("");

    try {
      await api.post(`/tasks/${completeModalTask.id}/complete`, {
        actual_hours: parseFloat(actualHours) || 1.0,
        completion_notes: completionNotes.trim() || null,
      });

      setCompleteModalTask(null);
      fetchMyTasks();
    } catch (err) {
      console.error("Failed to complete task:", err);
      setCompleteError(
        err.response?.data?.detail || "Failed to mark task as completed."
      );
    } finally {
      setSubmittingComplete(false);
    }
  };

  const displayName = user?.full_name || user?.username || "Specialist";
  const userDesig = user?.designation || "Maintenance Technician";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setPriorityFilter("all");
  };

  return (
    <div className="directory-page">
      {/* UNIFIED PORTAL HEADER */}
      <PortalHeader
        title="My Assigned Tasks"
        kicker="MAINTENANCE SPECIALIST WORKSPACE"
        description={`Logged in as ${displayName} (${userDesig}). Manage assignments, track repair hours, and record completions.`}
        icon={Wrench}
        backPath="/dashboard"
        rightAction={
          <div className="portal-header-actions">
            <button
              type="button"
              className="portal-action-btn-outline"
              onClick={fetchMyTasks}
              title="Refresh Task Queue"
            >
              <RotateCcw size={15} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* 4-CARD STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Assigned To Me"
          value={stats.assigned}
          Icon={Wrench}
          colorTheme="blue"
        />
        <StatCard
          title="In Progress"
          value={stats.in_progress}
          Icon={Clock}
          colorTheme="purple"
        />
        <StatCard
          title="Completed Today"
          value={stats.completed_today}
          Icon={CheckCircle2}
          colorTheme="green"
        />
        <StatCard
          title="Urgent Attention"
          value={stats.urgent}
          Icon={AlertOctagon}
          colorTheme="red"
        />
      </div>

      {/* CENTRAL MODULE WORKSPACE SECTION */}
      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Technician Work Queue"
          description="Direct personal operational feed for task execution, active repair timers, and verification sign-offs."
          badgeCount={filteredTasks.length}
          badgeLabel="tasks"
        />

        {/* TABS STRIP */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${tab === "active" ? "active" : ""}`}
            onClick={() => setTab("active")}
          >
            Active Tasks{" "}
            <span className="tab-count-badge">
              {stats.total_active || tasks.filter((t) => ["assigned", "in_progress"].includes(t.status)).length}
            </span>
          </button>

          <button
            type="button"
            className={`booking-tab-btn ${tab === "in_progress" ? "active" : ""}`}
            onClick={() => setTab("in_progress")}
          >
            In Progress{" "}
            <span className="tab-count-badge">
              {stats.in_progress || tasks.filter((t) => t.status === "in_progress").length}
            </span>
          </button>

          <button
            type="button"
            className={`booking-tab-btn ${tab === "unassigned" ? "active" : ""}`}
            onClick={() => setTab("unassigned")}
          >
            Available to Pick Up{" "}
            <span className="tab-count-badge amber">
              {unassignedTasks.length}
            </span>
          </button>

          <button
            type="button"
            className={`booking-tab-btn ${tab === "completed" ? "active" : ""}`}
            onClick={() => setTab("completed")}
          >
            Completed{" "}
            <span className="tab-count-badge green">
              {stats.completed_total || tasks.filter((t) => t.status === "completed").length}
            </span>
          </button>

          <button
            type="button"
            className={`booking-tab-btn ${tab === "all" ? "active" : ""}`}
            onClick={() => setTab("all")}
          >
            All History{" "}
            <span className="tab-count-badge">{tasks.length}</span>
          </button>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by task #, title, location, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="dir-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
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

            {/* View Mode Toggle */}
            <div className="dir-view-mode-toggle">
              <button
                type="button"
                className={`dir-view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
              <button
                type="button"
                className={`dir-view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
              >
                Cards
              </button>
            </div>

            {(search || categoryFilter !== "all" || priorityFilter !== "all") && (
              <button type="button" className="btn-cancel" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* PRIMARY VIEW: TABLE VIEW */}
        {viewMode === "table" ? (
          <div className="dir-table-container">
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "110px", minWidth: "110px" }}>Task #</th>
                  <th style={{ minWidth: "160px" }}>Location</th>
                  <th style={{ minWidth: "220px" }}>Issue Summary</th>
                  <th style={{ minWidth: "130px" }}>Category</th>
                  <th style={{ minWidth: "100px" }}>Priority</th>
                  <th style={{ minWidth: "120px" }}>Status</th>
                  <th style={{ minWidth: "140px" }}>Timing / Hours</th>
                  <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading technician tasks...
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      {tab === "active"
                        ? "You currently have no pending tasks assigned. Great job!"
                        : tab === "unassigned"
                        ? "No unassigned tasks currently waiting in your department queue."
                        : "No tasks found matching current filters."}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const st = String(task.status || "pending").toLowerCase();
                    const pr = String(task.priority || "normal").toLowerCase();
                    const isCompleted = st === "completed";
                    const isInProgress = st === "in_progress";
                    const isUnassigned = st === "pending" && !task.assigned_to_staff_id;

                    return (
                      <tr key={task.id} className="dir-table-row">
                        <td>
                          <span className="booking-id-tag">{task.task_number}</span>
                        </td>
                        <td>
                          <div className="customer-cell">
                            <div className="staff-avatar">
                              {task.location?.toLowerCase().includes("room") ? (
                                <BedDouble size={16} />
                              ) : (
                                <Building size={16} />
                              )}
                            </div>
                            <div>
                              <span className="customer-name">
                                {task.location || "Facility Area"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                              {task.title}
                            </strong>
                            {task.description && (
                              <span className="text-muted" style={{ fontSize: "11.5px" }}>
                                {task.description}
                              </span>
                            )}
                            {task.completion_notes && (
                              <span style={{ display: "block", fontSize: "11.5px", color: "#166534", marginTop: "2px" }}>
                                Note: {task.completion_notes}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="mono-pill pill-neutral">{task.category}</span>
                        </td>
                        <td>
                          <span
                            className={`mono-pill ${
                              pr === "urgent"
                                ? "pill-urgent"
                                : pr === "high"
                                ? "pill-warning"
                                : "pill-normal"
                            }`}
                          >
                            {pr.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`mono-pill ${
                              isCompleted
                                ? "pill-normal"
                                : isInProgress
                                ? "pill-warning"
                                : "pill-neutral"
                            }`}
                          >
                            {isCompleted
                              ? "COMPLETED"
                              : isInProgress
                              ? "IN PROGRESS"
                              : isUnassigned
                              ? "UNASSIGNED"
                              : "ASSIGNED"}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "12px", color: "#475569" }}>
                            {task.completed_at ? (
                              <div>
                                <strong>{new Date(task.completed_at).toLocaleDateString()}</strong>
                                <span style={{ display: "block", color: "#64748b" }}>
                                  {new Date(task.completed_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            ) : task.due_date ? (
                              <div>Due: {new Date(task.due_date).toLocaleDateString()}</div>
                            ) : (
                              <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
                            )}
                            <span style={{ display: "block", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>
                              {task.actual_hours > 0 ? `${task.actual_hours}h logged` : `${task.estimated_hours || 1.0}h est`}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {isUnassigned && (
                            <button
                              type="button"
                              className="emp-action-btn-claim"
                              onClick={() => handleClaimTask(task.id)}
                            >
                              <UserCheck size={13} /> Claim Task
                            </button>
                          )}
                          {task.status === "assigned" && (
                            <button
                              type="button"
                              className="emp-action-btn-start"
                              onClick={() => handleStartTask(task.id)}
                            >
                              <Play size={13} /> Start Task
                            </button>
                          )}
                          {isInProgress && (
                            <button
                              type="button"
                              className="emp-action-btn-complete"
                              onClick={() => handleOpenCompleteModal(task)}
                            >
                              <CheckCircle2 size={13} /> Complete
                            </button>
                          )}
                          {isCompleted && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "#166534",
                              }}
                            >
                              <Check size={14} /> Signed Off
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* SECONDARY VIEW: CARDS VIEW */
          <div className="emp-task-cards-list">
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b", gridColumn: "1 / -1" }}>
                Loading tasks...
              </div>
            ) : filteredTasks.length === 0 ? (
              <div
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  padding: "48px 24px",
                  textAlign: "center",
                  gridColumn: "1 / -1",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "14px",
                    backgroundColor: "#f0fdf4",
                    color: "#16a34a",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <CheckCheck size={26} />
                </div>
                <h3 style={{ margin: "0 0 6px 0", color: "#0f172a", fontSize: "16px" }}>
                  No Tasks in this View
                </h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                  {tab === "active"
                    ? "You currently have no pending tasks assigned. Great job!"
                    : tab === "unassigned"
                    ? "No unassigned tasks currently waiting in your department queue."
                    : "No tasks found matching current filters."}
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isUrgent = ["urgent", "high"].includes(task.priority);
                const isInProgress = task.status === "in_progress";
                const isCompleted = task.status === "completed";
                const isUnassigned = task.status === "pending" && !task.assigned_to_staff_id;

                let cardStateClass = "";
                if (isCompleted) cardStateClass = "is-completed";
                else if (isInProgress) cardStateClass = "is-in-progress";
                else if (isUrgent) cardStateClass = "is-urgent";

                return (
                  <div key={task.id} className={`emp-task-card ${cardStateClass}`}>
                    <div>
                      <div className="emp-card-header">
                        <span className="booking-id-tag">{task.task_number}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span
                            className={`mono-pill ${
                              isUrgent ? "pill-urgent" : "pill-normal"
                            }`}
                          >
                            {task.priority.toUpperCase()}
                          </span>
                          {isInProgress && (
                            <span className="mono-pill pill-warning">
                              <Timer size={11} style={{ marginRight: "3px" }} /> ACTIVE
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="emp-card-title">{task.title}</h3>
                      <div className="customer-cell" style={{ marginTop: "4px" }}>
                        <MapPin size={14} style={{ color: "#2563eb" }} />
                        <span style={{ fontSize: "13px", color: "#475569" }}>
                          {task.location || "Facility Area"}
                        </span>
                      </div>

                      {task.description && (
                        <div className="emp-card-instructions" style={{ marginTop: "10px" }}>
                          {task.description}
                        </div>
                      )}

                      {task.completion_notes && (
                        <div
                          style={{
                            marginTop: "10px",
                            padding: "8px 12px",
                            background: "#f0fdf4",
                            border: "1px solid #dcfce7",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#166534",
                          }}
                        >
                          <strong>Resolution: </strong> {task.completion_notes}
                        </div>
                      )}

                      <div className="emp-card-meta">
                        {task.due_date && (
                          <span className="text-muted" style={{ fontSize: "12px" }}>
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>
                          {task.actual_hours > 0
                            ? `Actual: ${task.actual_hours}h`
                            : `Est: ${task.estimated_hours || 1.0}h`}
                        </span>
                      </div>
                    </div>

                    <div className="emp-card-actions">
                      {isUnassigned && (
                        <button
                          type="button"
                          className="emp-action-btn-claim"
                          style={{ flex: 1, padding: "10px 16px", justifyContent: "center" }}
                          onClick={() => handleClaimTask(task.id)}
                        >
                          <UserCheck size={16} /> Claim Task
                        </button>
                      )}
                      {task.status === "assigned" && (
                        <button
                          type="button"
                          className="emp-action-btn-start"
                          style={{ flex: 1, padding: "10px 16px", justifyContent: "center" }}
                          onClick={() => handleStartTask(task.id)}
                        >
                          <Play size={16} /> Start Task
                        </button>
                      )}
                      {isInProgress && (
                        <button
                          type="button"
                          className="emp-action-btn-complete"
                          style={{ flex: 1, padding: "10px 16px", justifyContent: "center" }}
                          onClick={() => handleOpenCompleteModal(task)}
                        >
                          <CheckCircle2 size={16} /> Complete
                        </button>
                      )}
                      {isCompleted && (
                        <div
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            background: "#f0fdf4",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                            borderRadius: "8px",
                            fontSize: "12.5px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                          }}
                        >
                          <Check size={15} /> Completed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* COMPLETE TASK MODAL */}
      {completeModalTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h2>Complete Maintenance Task</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setCompleteModalTask(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitComplete}>
              <div className="modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span className="booking-id-tag">
                    {completeModalTask.task_number}
                  </span>
                  <h4 style={{ margin: "8px 0 3px 0", color: "#0f172a", fontSize: "15px" }}>
                    {completeModalTask.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    Location: {completeModalTask.location || "Facility Area"}
                  </p>
                </div>

                {completeError && (
                  <div
                    style={{
                      padding: "8px 12px",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      borderRadius: "8px",
                      fontSize: "13px",
                    }}
                  >
                    {completeError}
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                    Actual Time Spent (Hours) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="48"
                    required
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "0.5px solid #cbd5e1",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                    Completion Notes & Work Performed
                  </label>
                  <textarea
                    rows="3"
                    placeholder="e.g. Replaced leaking gasket, tightened connector valve, verified zero drips."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "0.5px solid #cbd5e1",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: "14px 20px", display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setCompleteModalTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ backgroundColor: "#059669" }}
                  disabled={submittingComplete}
                >
                  <Check size={16} />
                  {submittingComplete ? "Completing..." : "Confirm Completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
