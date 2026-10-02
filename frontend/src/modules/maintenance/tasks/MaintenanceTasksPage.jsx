import React, { useEffect, useState, useMemo } from "react";
import {
  ClipboardList,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  UserCheck,
  UserX,
  UserPlus,
  Calendar,
  MapPin,
  AlertOctagon,
  ChevronRight,
  ShieldCheck,
  Filter,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./maintenanceTasks.css";

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

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "#b91c1c" },
  { value: "high", label: "High", color: "#c2410c" },
  { value: "normal", label: "Normal", color: "#1d4ed8" },
  { value: "low", label: "Low", color: "#475569" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "pending", label: "Pending Assignment" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const initialTaskForm = {
  title: "",
  description: "",
  category: "Electrical",
  priority: "normal",
  location: "",
  due_date: "",
  estimated_hours: 1.0,
  assigned_to_staff_id: "",
};

export default function MaintenanceTasksPage() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    urgent: 0,
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [techFilter, setTechFilter] = useState("all");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [formData, setFormData] = useState(initialTaskForm);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Quick Assign Modal State
  const [quickAssignTask, setQuickAssignTask] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState("");

  const hotelId = user?.hotel_id;

  // 1. Fetch maintenance tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = { department: "maintenance" };
      if (hotelId) params.hotel_id = hotelId;

      const [taskRes, statsRes] = await Promise.all([
        api.get("/tasks", { params }),
        api.get("/tasks/stats", { params }),
      ]);

      setTasks(Array.isArray(taskRes.data) ? taskRes.data : []);
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load maintenance tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch active technicians for Maintenance department
  const fetchTechnicians = async () => {
    try {
      const res = await api.get("/staff", {
        params: { department: "maintenance" },
      });
      const activeTechs = (Array.isArray(res.data) ? res.data : []).filter(
        (s) => s.status === "active"
      );
      setTechnicians(activeTechs);
    } catch (err) {
      console.error("Failed to load maintenance staff:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchTechnicians();
  }, [hotelId]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      const term = search.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (t.title || "").toLowerCase().includes(term) ||
        (t.task_number || "").toLowerCase().includes(term) ||
        (t.location || "").toLowerCase().includes(term) ||
        (t.description || "").toLowerCase().includes(term);

      // Status filter
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;

      // Priority filter
      const matchesPriority =
        priorityFilter === "all" || t.priority === priorityFilter;

      // Category filter
      const matchesCategory =
        categoryFilter === "all" || t.category === categoryFilter;

      // Technician filter
      let matchesTech = true;
      if (techFilter === "unassigned") {
        matchesTech = !t.assigned_to_staff_id;
      } else if (techFilter !== "all") {
        matchesTech = String(t.assigned_to_staff_id) === String(techFilter);
      }

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory &&
        matchesTech
      );
    });
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter, techFilter]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingTaskId(null);
    setFormData(initialTaskForm);
    setErrorMessage("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (task) => {
    setIsEditing(true);
    setEditingTaskId(task.id);
    setFormData({
      title: task.title || "",
      description: task.description || "",
      category: task.category || "General",
      priority: task.priority || "normal",
      location: task.location || "",
      due_date: task.due_date ? task.due_date.slice(0, 16) : "",
      estimated_hours: task.estimated_hours || 1.0,
      assigned_to_staff_id: task.assigned_to_staff_id || "",
    });
    setErrorMessage("");
    setIsModalOpen(true);
  };

  // Submit Create or Edit
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setErrorMessage("Task title is required.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || null,
        category: formData.category,
        priority: formData.priority,
        location: formData.location?.trim() || null,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        estimated_hours: parseFloat(formData.estimated_hours) || 1.0,
        assigned_to_staff_id: formData.assigned_to_staff_id
          ? parseInt(formData.assigned_to_staff_id, 10)
          : null,
        department: "maintenance",
        hotel_id: hotelId,
      };

      if (isEditing) {
        await api.put(`/tasks/${editingTaskId}`, payload);
      } else {
        await api.post("/tasks", payload);
      }

      setIsModalOpen(false);
      fetchTasks();
    } catch (err) {
      console.error("Error saving task:", err);
      setErrorMessage(
        err.response?.data?.detail || "Failed to save maintenance task."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId, taskNumber) => {
    if (!window.confirm(`Are you sure you want to delete task ${taskNumber}?`)) {
      return;
    }
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert(err.response?.data?.detail || "Failed to delete task.");
    }
  };

  // Open Quick Assign
  const handleOpenQuickAssign = (task) => {
    setQuickAssignTask(task);
    setSelectedTechId(task.assigned_to_staff_id ? String(task.assigned_to_staff_id) : "");
  };

  // Save Quick Assign
  const handleSaveQuickAssign = async () => {
    if (!quickAssignTask) return;
    try {
      await api.post(`/tasks/${quickAssignTask.id}/assign`, {
        staff_id: selectedTechId ? parseInt(selectedTechId, 10) : null,
      });
      setQuickAssignTask(null);
      fetchTasks();
    } catch (err) {
      console.error("Failed to assign technician:", err);
      alert(err.response?.data?.detail || "Failed to assign technician.");
    }
  };

  return (
    <div className="tasks-page">
      <PortalHeader
        title="Maintenance Tasks & Assignments"
        kicker="MAINTENANCE & ENGINEERING"
        description="Create, assign, schedule, and oversee technical maintenance tasks and engineering work orders."
        icon={Wrench}
        backPath="/maintenance/dashboard"
        rightAction={
          <button className="dir-add-btn" onClick={handleOpenCreate}>
            <Plus size={18} /> Create New Task
          </button>
        }
      />

      {/* TOP STATS CARDS */}
      <div className="tasks-stats-grid">
        <StatCard
          title="Total Tasks"
          value={stats.total}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Pending Assignment"
          value={stats.pending}
          Icon={AlertTriangle}
          colorTheme="orange"
        />
        <StatCard
          title="In Progress"
          value={stats.in_progress}
          Icon={Clock}
          colorTheme="purple"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
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

      {/* MAIN MODULE SECTION */}
      <section className="tasks-modules-section">
        <ModuleWriternHeader
          title="Engineering Task Roster"
          description="Live overview of maintenance tasks, assigned specialists, priorities, and schedules."
          badgeCount={filteredTasks.length}
          badgeLabel="tasks"
        />

        {/* TOOLBAR CONTROLS */}
        <div className="tasks-controls">
          <div className="tasks-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by title, task ID, location, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="tasks-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            className="tasks-filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label} Priority
              </option>
            ))}
          </select>

          <select
            className="tasks-filter-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="tasks-filter-select"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
          >
            <option value="all">All Technicians</option>
            <option value="unassigned">Unassigned Only</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.designation || "Tech"})
              </option>
            ))}
          </select>
        </div>

        {/* TASKS TABLE */}
        <div className="tasks-table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th style={{ width: "28%" }}>Task Details</th>
                <th style={{ width: "16%" }}>Category & Location</th>
                <th style={{ width: "12%" }}>Priority</th>
                <th style={{ width: "12%" }}>Status</th>
                <th style={{ width: "18%" }}>Assigned Specialist</th>
                <th style={{ width: "14%" }} className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading maintenance tasks...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No maintenance tasks found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const assignedTech = task.assigned_staff;
                  const initials = assignedTech
                    ? assignedTech.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "";

                  return (
                    <tr key={task.id}>
                      {/* Task Details */}
                      <td>
                        <span className="task-number-pill">
                          {task.task_number}
                        </span>
                        <span className="task-title">{task.title}</span>
                        {task.description && (
                          <span className="task-desc-snippet">
                            {task.description}
                          </span>
                        )}
                      </td>

                      {/* Category & Location */}
                      <td>
                        <strong style={{ color: "#0f172a" }}>
                          {task.category}
                        </strong>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            marginTop: "4px",
                            fontSize: "12px",
                            color: "#64748b",
                          }}
                        >
                          <MapPin size={12} />
                          <span>{task.location || "Unspecified Area"}</span>
                        </div>
                      </td>

                      {/* Priority */}
                      <td>
                        <span
                          className={`priority-badge priority-${task.priority}`}
                        >
                          {task.priority === "urgent" && (
                            <AlertOctagon size={12} />
                          )}
                          {task.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`task-status-badge status-${task.status}`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                        {task.due_date && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#64748b",
                              marginTop: "4px",
                              display: "flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Calendar size={11} />
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Assigned Specialist */}
                      <td>
                        {assignedTech ? (
                          <div className="tech-cell">
                            <div className="tech-avatar">{initials}</div>
                            <div>
                              <span className="tech-name">
                                {assignedTech.full_name}
                              </span>
                              <span className="tech-role">
                                {assignedTech.designation || "Technician"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="unassigned-badge">
                            <UserX size={12} /> Unassigned
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="tasks-actions">
                          <button
                            className="task-action-btn btn-assign-quick"
                            onClick={() => handleOpenQuickAssign(task)}
                            title="Assign or reassign technician"
                          >
                            <UserCheck size={14} /> Assign
                          </button>
                          <button
                            className="task-action-btn"
                            onClick={() => handleOpenEdit(task)}
                            title="Edit task details"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="task-action-btn btn-delete"
                            onClick={() =>
                              handleDeleteTask(task.id, task.task_number)
                            }
                            title="Delete task"
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
      </section>

      {/* CREATE / EDIT TASK MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                {isEditing ? "Edit Maintenance Task" : "Create New Maintenance Task"}
              </h2>
              <button
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitTask}>
              <div className="modal-body">
                {errorMessage && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "500",
                    }}
                  >
                    {errorMessage}
                  </div>
                )}

                <div className="form-group">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Repair air handling unit in conference hall"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Engineering Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority Level</label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: e.target.value })
                      }
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location / Room / Area</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 304, Main Kitchen, Basement Chiller"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Estimated Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="48"
                      value={formData.estimated_hours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          estimated_hours: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assign To Specialist / Technician</label>
                    <select
                      value={formData.assigned_to_staff_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          assigned_to_staff_id: e.target.value,
                        })
                      }
                    >
                      <option value="">-- Unassigned (Assign Later) --</option>
                      {technicians.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.designation || "Technician"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Due Date & Target Time</label>
                    <input
                      type="datetime-local"
                      value={formData.due_date}
                      onChange={(e) =>
                        setFormData({ ...formData, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Technical Description & Instructions</label>
                  <textarea
                    rows="3"
                    placeholder="Provide details on tools required, specific symptoms, or safety precautions..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        description: e.target.value,
                      })
                    }
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : isEditing
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ASSIGN MODAL */}
      {quickAssignTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "420px" }}>
            <div className="modal-header">
              <h2>Assign Specialist</h2>
              <button
                className="modal-close"
                onClick={() => setQuickAssignTask(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div>
                <span className="task-number-pill">
                  {quickAssignTask.task_number}
                </span>
                <h4 style={{ margin: "6px 0", color: "#0f172a" }}>
                  {quickAssignTask.title}
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "#64748b",
                  }}
                >
                  Area: {quickAssignTask.location || "Unspecified"}
                </p>
              </div>

              <div className="form-group" style={{ marginTop: "12px" }}>
                <label>Select Maintenance Specialist</label>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  autoFocus
                >
                  <option value="">-- Unassigned --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} - {t.designation || "Technician"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setQuickAssignTask(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={handleSaveQuickAssign}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
