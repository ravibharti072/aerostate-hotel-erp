import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle2,
  Clock,
  Edit,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  X,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import "./housekeeping.css";

const initialFormData = {
  room_id: "",
  task_type: "room-cleaning",
  priority: "medium",
  status: "pending",
  assigned_staff_ids: [],
  assigned_to: "",
  notes: "",
};

const taskTypes = [
  { value: "room-cleaning", label: "Room Cleaning" },
  { value: "checkout-cleaning", label: "Checkout Cleaning" },
  { value: "inspection", label: "Room Inspection" },
  { value: "laundry", label: "Laundry / Linen" },
  { value: "minibar", label: "Minibar Refill" },
  { value: "maintenance-report", label: "Maintenance Report" },
  { value: "other", label: "Other" },
];

const taskStatuses = ["pending", "in-progress", "completed", "cancelled"];
const activeStatuses = ["pending", "in-progress"];
const reportStatuses = ["completed", "cancelled"];
const priorities = ["low", "medium", "high", "urgent"];

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

export default function HousekeepingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);

  const [formData, setFormData] = useState(initialFormData);
  const [editingTask, setEditingTask] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [activeView, setActiveView] = useState("active");
  const [reportDate, setReportDate] = useState(getTodayDateValue());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

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

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotelId || user?.hotel?.id || null;
  };

  const getRoomById = (roomId) => {
    return rooms.find((room) => Number(room.id) === Number(roomId));
  };

  const getRoomNumber = (task) => {
    const room = getRoomById(task.room_id);
    return room?.room_number || task.room_number || task.room_id || "-";
  };

  const getRoomType = (task) => {
    const room = getRoomById(task.room_id);
    return room?.room_type || task.room_type || "Room";
  };

  const getRoomFloor = (task) => {
    const room = getRoomById(task.room_id);
    return room?.floor ?? task.floor ?? "-";
  };

  const getTaskTypeLabel = (value) => {
    return taskTypes.find((item) => item.value === value)?.label || value;
  };

  const getTaskReportDate = (task) => {
    return task.completed_at || task.updated_at || task.created_at;
  };

  const fetchRooms = async () => {
    const hotelId = getLoggedInHotelId();
    const params = hotelId ? { hotel_id: hotelId } : {};
    const response = await api.get("/rooms", { params });
    return normalizeList(response.data, "rooms");
  };

  const fetchTasks = async () => {
    const hotelId = getLoggedInHotelId();
    const params = hotelId ? { hotel_id: hotelId } : {};
    const response = await api.get("/housekeeping/tasks", { params });
    return normalizeList(response.data, "tasks");
  };

  const fetchStaffMembers = async () => {
    const hotelId = getLoggedInHotelId();
    const params = hotelId ? { hotel_id: hotelId } : {};
    const response = await api.get("/staff", { params });
    return normalizeList(response.data, "staff");
  };

  const fetchHousekeepingData = async () => {
    try {
      setLoading(true);
      setError("");

      const [roomsData, tasksData, staffData] = await Promise.all([
        fetchRooms(),
        fetchTasks(),
        fetchStaffMembers(),
      ]);

      setRooms(roomsData);
      setTasks(tasksData);
      setStaffMembers(staffData);
    } catch (err) {
      console.error("Fetch housekeeping data error:", err);
      setError(getApiErrorMessage(err, "Failed to load housekeeping data."));
      setRooms([]);
      setTasks([]);
      setStaffMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHousekeepingData();
  }, []);

  const housekeepingStaffMembers = useMemo(() => {
    const housekeepingOnly = staffMembers.filter((staff) => {
      const department = String(staff.department || "").toLowerCase();
      return department.includes("housekeeping") || department.includes("house");
    });
    return housekeepingOnly.length > 0 ? housekeepingOnly : staffMembers;
  }, [staffMembers]);

  const getSelectedStaffNames = () => {
    return housekeepingStaffMembers
      .filter((staff) => formData.assigned_staff_ids.includes(String(staff.id)))
      .map((staff) => staff.full_name)
      .filter(Boolean);
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingTask(null);
    setError("");
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStaffCheckboxChange = (staffId) => {
    setFormData((prev) => {
      const id = String(staffId);
      const exists = prev.assigned_staff_ids.includes(id);

      return {
        ...prev,
        assigned_staff_ids: exists
          ? prev.assigned_staff_ids.filter((item) => item !== id)
          : [...prev.assigned_staff_ids, id],
      };
    });
  };

  const buildPayload = () => {
    const hotelId = getLoggedInHotelId();

    if (!hotelId) {
      throw new Error("Hotel ID not found. Please logout and login again.");
    }
    if (!formData.room_id) {
      throw new Error("Please select a room.");
    }

    const selectedStaffNames = getSelectedStaffNames();
    const manualAssignedTo = formData.assigned_to.trim();

    let finalAssignedTo = null;

    if (selectedStaffNames.length > 0 && manualAssignedTo) {
      finalAssignedTo = `${selectedStaffNames.join(", ")} | ${manualAssignedTo}`;
    } else if (selectedStaffNames.length > 0) {
      finalAssignedTo = selectedStaffNames.join(", ");
    } else if (manualAssignedTo) {
      finalAssignedTo = manualAssignedTo;
    }

    return {
      hotel_id: Number(hotelId),
      room_id: Number(formData.room_id),
      booking_id: editingTask?.booking_id || null,
      assigned_staff_id:
        formData.assigned_staff_ids.length === 1
          ? Number(formData.assigned_staff_ids[0])
          : null,
      task_type: formData.task_type,
      priority: formData.priority,
      status: formData.status,
      assigned_to: finalAssignedTo,
      notes: formData.notes.trim() || null,
      created_by: user?.username || null,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = buildPayload();

      if (editingTask) {
        const updatePayload = {
          room_id: payload.room_id,
          booking_id: payload.booking_id,
          assigned_staff_id: payload.assigned_staff_id,
          task_type: payload.task_type,
          priority: payload.priority,
          status: payload.status,
          assigned_to: payload.assigned_to,
          notes: payload.notes,
        };

        await api.put(`/housekeeping/tasks/${editingTask.id}`, updatePayload);
        setSuccess("Housekeeping task updated successfully.");
      } else {
        await api.post("/housekeeping/tasks", payload);
        setSuccess("Housekeeping task created successfully.");
      }

      setTimeout(() => {
        setSuccess("");
      }, 2500);

      closeForm();
      await fetchHousekeepingData();
    } catch (err) {
      console.error("Save housekeeping task error:", err);
      setError(getApiErrorMessage(err, "Failed to save housekeeping task."));
    } finally {
      setSaving(false);
    }
  };

  const getAssignedStaffIdsFromTask = (task) => {
    const ids = [];

    if (task.assigned_staff_id) {
      ids.push(String(task.assigned_staff_id));
    }

    if (task.assigned_to) {
      const assignedText = String(task.assigned_to).toLowerCase();

      housekeepingStaffMembers.forEach((staff) => {
        const staffName = String(staff.full_name || "").toLowerCase();
        if (staffName && assignedText.includes(staffName)) {
          const staffId = String(staff.id);
          if (!ids.includes(staffId)) {
            ids.push(staffId);
          }
        }
      });
    }

    return ids;
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setShowForm(true);
    setError("");
    setSuccess("");

    setFormData({
      room_id: String(task.room_id || ""),
      task_type: task.task_type || "room-cleaning",
      priority: task.priority || "medium",
      status: task.status || "pending",
      assigned_staff_ids: getAssignedStaffIdsFromTask(task),
      assigned_to: task.assigned_to || "",
      notes: task.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (task) => {
    const confirmed = window.confirm(
      `Delete housekeeping task for room ${getRoomNumber(task)}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(task.id);
      setError("");
      setSuccess("");

      await api.delete(`/housekeeping/tasks/${task.id}`);
      setSuccess("Housekeeping task deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 2500);

      if (editingTask?.id === task.id) {
        closeForm();
      }

      await fetchHousekeepingData();
    } catch (err) {
      console.error("Delete housekeeping task error:", err);
      setError(getApiErrorMessage(err, "Failed to delete housekeeping task."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickStatus = async (task, nextStatus) => {
    try {
      setError("");
      setSuccess("");

      await api.patch(`/housekeeping/tasks/${task.id}/status`, {
        status: nextStatus,
      });

      setSuccess(`Task marked as ${nextStatus}.`);

      setTimeout(() => {
        setSuccess("");
      }, 2000);

      await fetchHousekeepingData();
    } catch (err) {
      console.error("Update housekeeping status error:", err);
      setError(getApiErrorMessage(err, "Failed to update task status."));
    }
  };

  const applyTaskFilters = (taskList) => {
    return taskList.filter((task) => {
      const search = searchText.toLowerCase();

      const roomNumber = String(getRoomNumber(task)).toLowerCase();
      const roomType = String(getRoomType(task)).toLowerCase();
      const floor = String(getRoomFloor(task)).toLowerCase();
      const assignedTo = String(task.assigned_to || "").toLowerCase();
      const taskType = getTaskTypeLabel(task.task_type).toLowerCase();

      const matchesStatus =
        statusFilter === "all" || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || task.priority === priorityFilter;

      const matchesSearch =
        !search ||
        roomNumber.includes(search) ||
        roomType.includes(search) ||
        floor.includes(search) ||
        assignedTo.includes(search) ||
        taskType.includes(search);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  };

  const activeTasks = useMemo(() => {
    const list = tasks.filter((task) => activeStatuses.includes(task.status));
    return applyTaskFilters(list);
  }, [tasks, rooms, statusFilter, priorityFilter, searchText]);

  const reportTasks = useMemo(() => {
    const list = tasks.filter((task) => {
      const isReportStatus = reportStatuses.includes(task.status);
      const matchesDate = getDateValue(getTaskReportDate(task)) === reportDate;

      return isReportStatus && matchesDate;
    });

    return applyTaskFilters(list);
  }, [tasks, rooms, statusFilter, priorityFilter, searchText, reportDate]);

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status === "pending").length;
    const inProgress = tasks.filter((task) => task.status === "in-progress").length;

    const completedToday = tasks.filter((task) => {
      return (
        task.status === "completed" &&
        getDateValue(getTaskReportDate(task)) === getTodayDateValue()
      );
    }).length;

    return {
      active: pending + inProgress,
      pending,
      inProgress,
      completedToday,
      urgent: tasks.filter(
        (task) =>
          activeStatuses.includes(task.status) && task.priority === "urgent"
      ).length,
    };
  }, [tasks]);

  const visibleTasks = activeView === "active" ? activeTasks : reportTasks;

  return (
    <div className="housekeeping-page">
      <header className="hk-header-card">
        <div className="hk-header-left">
          <button
            type="button"
            className="hk-back-btn"
            onClick={() => navigate("/housekeeping")}
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="hk-header-title-group">
            <div className="hk-header-icon">
              <Sparkles size={24} />
            </div>
            <div>
              <span className="hk-kicker">Hotel Operations</span>
              <h1>Housekeeping Tasks</h1>
              <p>
                Manage active housekeeping work and keep completed tasks in daily reports.
              </p>
            </div>
          </div>
        </div>

        <div className="hk-header-actions">
          <button
            type="button"
            className="hk-create-top-btn"
            onClick={openCreateForm}
          >
            <Plus size={16} />
            Create Task
          </button>
        </div>
      </header>

      {error && <div className="housekeeping-error-box">{error}</div>}
      {success && <div className="housekeeping-success-box">{success}</div>}

      <div className="housekeeping-stats-grid">
        <div className="housekeeping-stat-card">
          <div className="housekeeping-stat-icon-wrapper bg-light-blue">
            <BedDouble size={22} className="color-blue" />
          </div>
          <div className="housekeeping-stat-info">
            <p>Active Tasks</p>
            <h2>{stats.active}</h2>
            <span>Total active</span>
          </div>
        </div>

        <div className="housekeeping-stat-card">
          <div className="housekeeping-stat-icon-wrapper bg-light-orange">
            <Clock size={22} className="color-orange" />
          </div>
          <div className="housekeeping-stat-info">
            <p>Pending</p>
            <h2>{stats.pending}</h2>
            <span>Awaiting action</span>
          </div>
        </div>

        <div className="housekeeping-stat-card">
          <div className="housekeeping-stat-icon-wrapper bg-light-purple">
            <Sparkles size={22} className="color-purple" />
          </div>
          <div className="housekeeping-stat-info">
            <p>In Progress</p>
            <h2>{stats.inProgress}</h2>
            <span>Currently cleaning</span>
          </div>
        </div>

        <div className="housekeeping-stat-card">
          <div className="housekeeping-stat-icon-wrapper bg-light-green">
            <CheckCircle2 size={22} className="color-green" />
          </div>
          <div className="housekeeping-stat-info">
            <p>Completed</p>
            <h2>{stats.completedToday}</h2>
            <span>Finished today</span>
          </div>
        </div>

        <div className="housekeeping-stat-card">
          <div className="housekeeping-stat-icon-wrapper bg-light-red">
            <AlertTriangle size={22} className="color-red" />
          </div>
          <div className="housekeeping-stat-info">
            <p>Urgent</p>
            <h2>{stats.urgent}</h2>
            <span>High priority</span>
          </div>
        </div>
      </div>

      <div className={`housekeeping-layout ${showForm ? "" : "single"}`}>
        {showForm && (
          <section className="housekeeping-form-card">
            <div className="housekeeping-section-title">
              <div className="housekeeping-section-icon">
                {editingTask ? <Edit size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editingTask ? "Edit Task" : "Create Task"}</h3>
                <p>
                  {editingTask
                    ? "Update the existing housekeeping task."
                    : "Create a new housekeeping work order."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="housekeeping-form-grid">
              <div className="hk-form-group hk-full-width">
                <label>Room</label>
                <select
                  name="room_id"
                  value={formData.room_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.room_number} - {room.room_type || "Room"} -
                      Floor {room.floor ?? "-"} - {room.status || "available"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hk-form-group">
                <label>Task Type</label>
                <select
                  name="task_type"
                  value={formData.task_type}
                  onChange={handleChange}
                  required
                >
                  {taskTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hk-form-group">
                <label>Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  required
                >
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hk-form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  {taskStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() +
                        status.slice(1).replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hk-form-group hk-full-width">
                <label>Assign Housekeeping Staff</label>
                <div className="housekeeping-staff-picker">
                  {housekeepingStaffMembers.length === 0 ? (
                    <p className="housekeeping-staff-empty">
                      No staff found. Add housekeeping staff from Staff / HR.
                    </p>
                  ) : (
                    housekeepingStaffMembers.map((staff) => (
                      <label
                        key={staff.id}
                        className="housekeeping-staff-option"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assigned_staff_ids.includes(
                            String(staff.id)
                          )}
                          onChange={() => handleStaffCheckboxChange(staff.id)}
                        />
                        <span>
                          <strong>{staff.full_name}</strong>
                          <small>
                            {staff.department || "Staff"} ·{" "}
                            {staff.designation || "Team Member"}
                          </small>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="hk-form-group hk-full-width">
                <label>Manual Assignment / Team Note</label>
                <input
                  type="text"
                  name="assigned_to"
                  placeholder="Example: Team A / temporary staff / supervisor note"
                  value={formData.assigned_to}
                  onChange={handleChange}
                />
              </div>

              <div className="hk-form-group hk-full-width">
                <label>Notes</label>
                <textarea
                  name="notes"
                  placeholder="Cleaning notes, missing items, guest request, etc."
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                />
              </div>

              <div className="hk-form-actions">
                <button
                  type="button"
                  className="hk-cancel-btn"
                  onClick={closeForm}
                >
                  <X size={16} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="hk-save-btn"
                  disabled={saving}
                >
                  {editingTask ? <Edit size={16} /> : <Plus size={16} />}
                  {saving
                    ? "Saving..."
                    : editingTask
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="housekeeping-list-card">
          <div className="housekeeping-list-header">
            <div className="housekeeping-section-title">
              <div className="housekeeping-section-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <h3>
                  {activeView === "active"
                    ? "Active Housekeeping Tasks"
                    : "Daily Completed Report"}
                </h3>
                <p>
                  {activeView === "active"
                    ? "Only pending and in-progress tasks are shown here."
                    : "Completed and cancelled tasks are stored here by date."}
                </p>
              </div>
            </div>

            <div className="housekeeping-filter-row">
              <div className="housekeeping-view-tabs">
                <button
                  type="button"
                  className={activeView === "active" ? "active" : ""}
                  onClick={() => setActiveView("active")}
                >
                  Active Tasks
                </button>

                <button
                  type="button"
                  className={activeView === "report" ? "active" : ""}
                  onClick={() => setActiveView("report")}
                >
                  Daily Report
                </button>
              </div>

              {activeView === "report" && (
                <input
                  type="date"
                  className="hk-date-picker"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              )}

              <div className="hk-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search task..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="hk-filter-box">
                <Filter size={16} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  {(activeView === "active"
                    ? activeStatuses
                    : reportStatuses
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() +
                        status.slice(1).replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hk-filter-box">
                <Filter size={16} />
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="all">All Priority</option>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="hk-empty-state">
              <h4>Loading housekeeping tasks...</h4>
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="hk-empty-state">
              <h4>No tasks found</h4>
              <p>
                {activeView === "active"
                  ? "No pending or in-progress housekeeping tasks are available."
                  : "No completed or cancelled task report found for this date."}
              </p>
            </div>
          ) : (
            <div className="hk-task-grid">
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className={`hk-task-card status-${task.status}`}
                >
                  <div className="hk-task-top">
                    <div>
                      <h4>Room {getRoomNumber(task)}</h4>
                      <p>
                        {getRoomType(task)} · Floor {getRoomFloor(task)}
                        {task.booking_id
                          ? ` · Booking #${task.booking_id}`
                          : ""}
                      </p>
                    </div>

                    <span className={`hk-status-pill ${task.status}`}>
                      {task.status.replace("-", " ")}
                    </span>
                  </div>

                  <div className="hk-task-meta">
                    <div>
                      <span>Task Type</span>
                      <strong>{getTaskTypeLabel(task.task_type)}</strong>
                    </div>

                    <div>
                      <span>Priority</span>
                      <strong className={`priority-text ${task.priority}`}>
                        {task.priority}
                      </strong>
                    </div>

                    <div>
                      <span>Assigned To</span>
                      <strong>{task.assigned_to || "Unassigned"}</strong>
                    </div>
                  </div>

                  {task.assigned_to && (
                    <div className="hk-assigned-box">
                      <UserCheck size={14} />
                      <span>{task.assigned_to}</span>
                    </div>
                  )}

                  {task.notes && (
                    <p className="hk-task-notes">{task.notes}</p>
                  )}

                  {activeView === "report" && (
                    <p className="hk-report-time">
                      Report Date: {getDateValue(getTaskReportDate(task))}
                    </p>
                  )}

                  <div className="hk-task-actions">
                    <div className="hk-quick-actions">
                      {activeView === "active" &&
                        task.status === "pending" && (
                          <button
                            type="button"
                            className="hk-btn-start"
                            onClick={() =>
                              handleQuickStatus(task, "in-progress")
                            }
                          >
                            Start Task
                          </button>
                        )}

                      {activeView === "active" &&
                        task.status !== "completed" &&
                        task.status !== "cancelled" && (
                          <button
                            type="button"
                            className="hk-btn-complete"
                            onClick={() =>
                              handleQuickStatus(task, "completed")
                            }
                          >
                            Complete
                          </button>
                        )}

                      {activeView === "active" &&
                        task.status !== "cancelled" &&
                        task.status !== "completed" && (
                          <button
                            type="button"
                            className="hk-btn-cancel"
                            onClick={() =>
                              handleQuickStatus(task, "cancelled")
                            }
                          >
                            Cancel
                          </button>
                        )}
                    </div>

                    <div className="hk-icon-actions">
                      {activeView === "active" && (
                        <button
                          type="button"
                          className="hk-edit-icon"
                          onClick={() => handleEdit(task)}
                          title="Edit Task"
                        >
                          <Edit size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="hk-delete-icon"
                        onClick={() => handleDelete(task)}
                        disabled={deletingId === task.id}
                        title="Delete Task"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}