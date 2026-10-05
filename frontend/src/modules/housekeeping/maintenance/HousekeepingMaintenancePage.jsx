import React, { useEffect, useMemo, useState } from "react";
import {
  Wrench,
  BedDouble,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  X,
  Save,
  Building,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./housekeepingMaintenance.css";

const initialForm = {
  room_id: "",
  category: "AC",
  priority: "normal",
  blocks_room: false,
  description: "",
};

export default function HousekeepingMaintenancePage() {
  const { user } = useAuth();

  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const isSupervisorOrAdmin =
    user?.role === "super-admin" ||
    user?.role === "hotel-admin" ||
    user?.role_level === "department_head" ||
    (user?.role === "housekeeping" && (user?.designation || "").toLowerCase().includes("manager"));

  // Default to showing only issues reported by the current logged-in user
  const [viewScope, setViewScope] = useState("my"); // "my" | "all"

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
      const [maintRes, roomsRes] = await Promise.all([
        api.get("/maintenance-requests/", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
      ]);

      let list = normalizeList(maintRes.data, "requests");
      let rList = normalizeList(roomsRes.data, "rooms");

      if (hotelId) {
        list = list.filter((m) => Number(m.hotel_id) === Number(hotelId));
        rList = rList.filter((r) => Number(r.hotel_id) === Number(hotelId));
      }

      setRequests(list);
      setRooms(rList);
    } catch (err) {
      console.error("Fetch maintenance error:", err);
      showToast(getApiErrorMessage(err, "Failed to load maintenance requests."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.room_id) {
      showToast("Please select a room.", "error");
      return;
    }
    if (!formData.description.trim()) {
      showToast("Please enter an issue description.", "error");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/housekeeping/report-problem", {
        room_id: Number(formData.room_id),
        category: formData.category,
        description: formData.description.trim(),
        priority: formData.priority,
        blocks_room: Boolean(formData.blocks_room),
      });

      showToast("Maintenance problem reported successfully.", "success");
      setIsModalOpen(false);
      setFormData(initialForm);
      await fetchData();
    } catch (err) {
      console.error("Report problem error:", err);
      showToast(getApiErrorMessage(err, "Failed to report issue."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isReportedByMe = (m) => {
    if (!user) return false;
    const myId = user.id;
    const myFullName = (user.full_name || "").toLowerCase().trim();
    const myUsername = (user.username || "").toLowerCase().trim();
    const reportedBy = String(m.reported_by || "").toLowerCase().trim();

    if (myId && m.created_by_user_id && Number(m.created_by_user_id) === Number(myId)) return true;
    if (myFullName && (reportedBy === myFullName || reportedBy.includes(myFullName) || myFullName.includes(reportedBy))) return true;
    if (myUsername && (reportedBy === myUsername || reportedBy.includes(myUsername))) return true;
    return false;
  };

  const myReportsCount = useMemo(() => {
    return requests.filter(isReportedByMe).length;
  }, [requests, user]);

  // Show only requests reported by the current user (with scope toggle for supervisors/admins)
  const displayedRequests = useMemo(() => {
    if (viewScope === "all" && isSupervisorOrAdmin) {
      return requests;
    }
    return requests.filter(isReportedByMe);
  }, [requests, viewScope, isSupervisorOrAdmin, user]);

  const stats = useMemo(() => {
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;

    displayedRequests.forEach((r) => {
      const st = String(r.status || "").toLowerCase();
      if (st === "open" || st === "pending") openCount++;
      else if (st === "in-progress" || st === "in_progress") inProgressCount++;
      else if (st === "resolved" || st === "completed") resolvedCount++;
    });

    return {
      total: displayedRequests.length,
      open: openCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
    };
  }, [displayedRequests]);

  const filteredRequests = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return displayedRequests.filter((r) => {
      const room = getRoom(r.room_id);
      const roomNum = String(room?.room_number || r.room_id || "").toLowerCase();
      const title = String(r.issue_title || "").toLowerCase();
      const desc = String(r.issue_description || "").toLowerCase();
      const idStr = String(r.id || "").toLowerCase();

      const matchesSearch =
        !search ||
        roomNum.includes(search) ||
        title.includes(search) ||
        desc.includes(search) ||
        idStr.includes(search);

      if (!matchesSearch) return false;

      const st = String(r.status || "open").toLowerCase();
      if (statusFilter === "open" && !(st === "open" || st === "pending")) return false;
      if (statusFilter === "in-progress" && !(st === "in-progress" || st === "in_progress")) return false;
      if (statusFilter === "resolved" && !(st === "resolved" || st === "completed")) return false;

      if (priorityFilter !== "all" && String(r.priority || "").toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [displayedRequests, rooms, searchText, statusFilter, priorityFilter]);

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  return (
    <div className="directory-page hk-maint-directory">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Maintenance Requests"
        kicker="HOUSEKEEPING • PROBLEM REPORTING"
        description="Log and monitor room defects, damage, and repairs raised during housekeeping rounds."
        icon={Wrench}
        backPath="/dashboard"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={() => {
              setFormData(initialForm);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} /> Report Issue
          </button>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Requests"
          value={stats.total}
          Icon={Wrench}
          colorTheme="blue"
        />
        <StatCard
          title="Open Issues"
          value={stats.open}
          Icon={AlertTriangle}
          colorTheme="orange"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          Icon={Clock}
          colorTheme="purple"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          Icon={CheckCircle2}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Housekeeping Reported Issues"
          description="Direct integration with Maintenance module referencing unified room records."
          badgeCount={filteredRequests.length}
          badgeLabel="issues"
        />

        {/* SECTION TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All Issues <span className="tab-count-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === "open" ? "active" : ""}`}
            onClick={() => setStatusFilter("open")}
          >
            Open <span className="tab-count-badge">{stats.open}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === "in-progress" ? "active" : ""}`}
            onClick={() => setStatusFilter("in-progress")}
          >
            In Progress <span className="tab-count-badge">{stats.inProgress}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === "resolved" ? "active" : ""}`}
            onClick={() => setStatusFilter("resolved")}
          >
            Resolved <span className="tab-count-badge">{stats.resolved}</span>
          </button>

          {isSupervisorOrAdmin && (
            <div style={{ display: "inline-flex", gap: "4px", marginLeft: "auto", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              <button
                type="button"
                className={`booking-tab-btn ${viewScope === "my" ? "active" : ""}`}
                style={{ padding: "4px 10px", fontSize: "11.5px", borderRadius: "6px" }}
                onClick={() => setViewScope("my")}
              >
                My Reported ({myReportsCount})
              </button>
              <button
                type="button"
                className={`booking-tab-btn ${viewScope === "all" ? "active" : ""}`}
                style={{ padding: "4px 10px", fontSize: "11.5px", borderRadius: "6px" }}
                onClick={() => setViewScope("all")}
              >
                All Department ({requests.length})
              </button>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by room number, issue title, or description..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="dir-filter-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium / Normal</option>
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
                <th style={{ width: "90px", minWidth: "90px" }}>Ref</th>
                <th style={{ minWidth: "160px" }}>Room Info</th>
                <th style={{ minWidth: "220px" }}>Issue Details</th>
                <th style={{ minWidth: "110px" }}>Priority</th>
                <th style={{ minWidth: "130px" }}>Status</th>
                <th style={{ minWidth: "160px" }}>Reported By</th>
                <th style={{ width: "140px", textAlign: "right" }}>Reported Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading maintenance requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    {viewScope === "my"
                      ? "No maintenance issues reported by you yet. Click '+ Report Issue' to report a problem."
                      : "No maintenance issues reported for this view."}
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const room = getRoom(req.room_id);
                  const st = String(req.status || "open").toLowerCase();
                  const pr = String(req.priority || "normal").toLowerCase();
                  const dateStr = req.created_at
                    ? new Date(req.created_at).toLocaleDateString()
                    : "-";

                  return (
                    <tr key={req.id} className="dir-table-row">
                      <td>
                        <span className="booking-id-tag">#{req.id}</span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            <BedDouble size={16} />
                          </div>
                          <div>
                            <span className="customer-name">
                              Room {room?.room_number || req.room_id}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {room?.room_type || "Standard"} • Floor {room?.floor || "1"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                            {req.issue_title}
                          </strong>
                          {req.issue_description && (
                            <span className="text-muted" style={{ fontSize: "11.5px" }}>
                              {req.issue_description}
                            </span>
                          )}
                        </div>
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
                            st === "resolved" || st === "completed"
                              ? "pill-normal"
                              : st === "in-progress" || st === "in_progress"
                              ? "pill-warning"
                              : "pill-urgent"
                          }`}
                        >
                          {st.toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: 500 }}>
                          {req.reported_by || "Housekeeping Staff"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <span className="text-muted" style={{ fontSize: "12px" }}>
                          {dateStr}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* REPORT ISSUE MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setIsModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wrench size={18} color="#2d5696" />
                <h2>Report Room Maintenance Issue</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Room Allocation *</label>
                  <select
                    name="room_id"
                    className="dir-select-field"
                    value={formData.room_id}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  >
                    <option value="">-- Select Room --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} &bull; {r.room_type} (Floor {r.floor || 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Issue Category *</label>
                    <select
                      name="category"
                      className="dir-select-field"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={submitting}
                    >
                      <option value="AC">Air Conditioner (AC)</option>
                      <option value="Plumbing">Plumbing / Water</option>
                      <option value="Electrical">Electrical / Lighting</option>
                      <option value="TV">Television / Remote</option>
                      <option value="Furniture">Furniture / Fixtures</option>
                      <option value="Other">Other Maintenance</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority *</label>
                    <select
                      name="priority"
                      className="dir-select-field"
                      value={formData.priority}
                      onChange={handleInputChange}
                      disabled={submitting}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Issue Description *</label>
                  <textarea
                    name="description"
                    rows="3"
                    className="dir-select-field"
                    style={{ height: "auto", padding: "10px 12px" }}
                    placeholder="Provide specific details regarding the problem discovered in the room..."
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={submitting}
                    required
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    padding: "10px 12px",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    id="blocks_room"
                    name="blocks_room"
                    checked={formData.blocks_room}
                    onChange={handleInputChange}
                    disabled={submitting}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label
                    htmlFor="blocks_room"
                    style={{ fontSize: "12.5px", color: "#9a3412", fontWeight: 600, cursor: "pointer", margin: 0 }}
                  >
                    Block Room for Maintenance (Marks room status as maintenance)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  <Save size={14} /> {submitting ? "Reporting..." : "Submit Maintenance Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}