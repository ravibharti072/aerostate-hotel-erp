import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCheck,
  BedDouble,
  Clock,
  CheckCircle2,
  Search,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "../checkoutCleaning/checkoutCleaning.css";

export default function AssignedWork() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [toast, setToast] = useState(null);

  const [selectedStaffId, setSelectedStaffId] = useState("my_tasks");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

      let tasksList = normalizeList(tasksRes.data, "tasks");
      let roomsList = normalizeList(roomsRes.data, "rooms");
      let staffList = normalizeList(staffRes.data, "staff");

      if (hotelId) {
        tasksList = tasksList.filter((t) => Number(t.hotel_id) === Number(hotelId));
        roomsList = roomsList.filter((r) => Number(r.hotel_id) === Number(hotelId));
        staffList = staffList.filter((s) => Number(s.hotel_id) === Number(hotelId));
      }

      setTasks(tasksList);
      setRooms(roomsList);
      setStaffMembers(staffList);
    } catch (err) {
      console.error("Fetch assigned work error:", err);
      showToast(getApiErrorMessage(err, "Failed to load assigned work tasks."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartTask = async (task) => {
    try {
      setUpdatingId(task.id);
      await api.post(`/housekeeping/tasks/${task.id}/start`);
      showToast(`Started cleaning for Room ${getRoom(task.room_id)?.room_number || task.room_id}.`, "success");
      await fetchData();
    } catch (err) {
      console.error("Start task error:", err);
      showToast(getApiErrorMessage(err, "Failed to start cleaning task."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      setUpdatingId(task.id);
      await api.post(`/housekeeping/tasks/${task.id}/complete`, {
        notes: "Work completed by assigned attendant.",
        requires_inspection: false,
      });
      showToast(`Completed work for Room ${getRoom(task.room_id)?.room_number || task.room_id}.`, "success");
      await fetchData();
    } catch (err) {
      console.error("Complete task error:", err);
      showToast(getApiErrorMessage(err, "Failed to complete cleaning task."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter tasks based on current attendant / staff selection
  const assignedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedStaffId === "all") return Boolean(t.assigned_to || t.assigned_staff_id);
      if (selectedStaffId === "my_tasks") {
        const username = String(user?.username || "").toLowerCase();
        const fullName = String(user?.full_name || "").toLowerCase();
        const assignedName = String(t.assigned_to || "").toLowerCase();

        return (
          assignedName === username ||
          assignedName === fullName ||
          (user?.staff_id && Number(t.assigned_staff_id) === Number(user.staff_id))
        );
      }
      return Number(t.assigned_staff_id) === Number(selectedStaffId);
    });
  }, [tasks, selectedStaffId, user]);

  const stats = useMemo(() => {
    let pending = 0;
    let inProgress = 0;
    let completed = 0;

    assignedTasks.forEach((t) => {
      const st = String(t.status || "").toLowerCase();
      if (st === "pending" || st === "assigned") pending++;
      else if (st === "in-progress" || st === "cleaning") inProgress++;
      else if (st === "completed" || st === "approved") completed++;
    });

    return { total: assignedTasks.length, pending, inProgress, completed };
  }, [assignedTasks]);

  const filteredTasks = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return assignedTasks.filter((task) => {
      const room = getRoom(task.room_id);
      const roomNum = String(room?.room_number || task.room_id || "").toLowerCase();
      const floorStr = String(room?.floor || "").toLowerCase();
      const staffStr = String(task.assigned_to || "").toLowerCase();
      const idStr = String(task.id || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        floorStr.includes(search) ||
        staffStr.includes(search) ||
        idStr.includes(search);

      if (!matchesSearch) return false;

      const st = String(task.status || "").toLowerCase();
      if (statusFilter !== "all" && st !== statusFilter.toLowerCase()) return false;

      return true;
    });
  }, [assignedTasks, rooms, searchText, statusFilter]);

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setSelectedStaffId("all");
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
        title="Assigned Workboard"
        kicker="HOUSEKEEPING ATTENDANT TASKS"
        description="Daily cleaning and turnover duties assigned to housekeeping attendants."
        icon={UserCheck}
        backPath="/dashboard"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={() => navigate("/housekeeping/maintenance")}
          >
            <Wrench size={15} /> Report Problem
          </button>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Assigned"
          value={stats.total}
          Icon={UserCheck}
          colorTheme="blue"
        />
        <StatCard
          title="Awaiting Start"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="Active Cleaning"
          value={stats.inProgress}
          Icon={Sparkles}
          colorTheme="purple"
        />
        <StatCard
          title="Work Completed"
          value={stats.completed}
          Icon={CheckCircle2}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Staff Assignment Workboard"
          description="Track tasks distributed across active staff members."
          badgeCount={filteredTasks.length}
          badgeLabel="assigned tasks"
        />

        {/* CONTROLS & STAFF SWITCHER */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by room number, floor, or attendant name..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Attendant Selection Switcher */}
            <select
              className="dir-filter-select"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="my_tasks">My Assigned Tasks</option>
              <option value="all">All Attendants (Supervisor View)</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.designation || "Staff"})
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="assigned">Assigned / Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
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
                <th style={{ width: "90px", minWidth: "90px" }}>Ref</th>
                <th style={{ minWidth: "160px" }}>Room</th>
                <th style={{ minWidth: "180px" }}>Assigned Staff</th>
                <th style={{ minWidth: "160px" }}>Task Type</th>
                <th style={{ minWidth: "110px" }}>Priority</th>
                <th style={{ minWidth: "130px" }}>Status</th>
                <th style={{ width: "160px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading assigned duties...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No assigned tasks found matching your filter.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const room = getRoom(task.room_id);
                  const st = String(task.status || "assigned").toLowerCase();
                  const pr = String(task.priority || "normal").toLowerCase();

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
                              Room {room?.room_number || task.room_id}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {room?.room_type || "Standard"} • Floor {room?.floor || "1"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <UserCheck size={14} color="#2563eb" />
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                            {task.assigned_to || "Assigned Attendant"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
                          {task.task_type.replace("-", " ").toUpperCase()}
                        </span>
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
                        <div style={{ display: "inline-flex", gap: "6px", justifyContent: "flex-end" }}>
                          {(st === "pending" || st === "assigned") && (
                            <button
                              type="button"
                              className="btn-submit"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => handleStartTask(task)}
                              disabled={updatingId === task.id}
                            >
                              Start
                            </button>
                          )}
                          {st === "in-progress" && (
                            <button
                              type="button"
                              className="portal-action-btn"
                              style={{ padding: "6px 12px", fontSize: "12px" }}
                              onClick={() => handleCompleteTask(task)}
                              disabled={updatingId === task.id}
                            >
                              Complete
                            </button>
                          )}
                          {(st === "completed" || st === "approved") && (
                            <span className="balance-paid-text" style={{ padding: "6px" }}>
                              Finished
                            </span>
                          )}
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
    </div>
  );
}