import React, { useEffect, useMemo, useState } from "react";
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  BedDouble,
  Building,
  User,
  X,
  Save,
  Trash2,
  Edit2,
  Users,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./requests.css";

const initialRequestForm = {
  room_id: "",
  asset_id: "",
  assigned_staff_id: "",
  category: "General",
  source: "Direct",
  priority: "normal",
  status: "open",
  blocks_room: false,
  issue_title: "",
  issue_description: "",
  estimated_cost: 0,
  remarks: "",
};

const CATEGORIES = [
  "General",
  "AC / HVAC",
  "Plumbing",
  "Electrical",
  "Carpentry",
  "Appliance",
  "Elevator",
  "Generator",
  "Painting",
  "Other",
];

const SOURCES = [
  "Direct",
  "Front Desk",
  "Housekeeping",
  "Guest",
  "Inspection",
  "Restaurant",
  "Kitchen",
  "Management",
  "Preventive Maintenance",
];

const PRIORITIES = ["low", "normal", "medium", "high", "urgent"];
const STATUSES = [
  "open",
  "assigned",
  "in-progress",
  "pending_parts",
  "completed",
  "verified",
  "closed",
  "cancelled",
];

export default function MaintenanceRequestsPage() {
  const { user } = useAuth();
  const getLoggedInHotelId = () => user?.hotel_id || user?.hotelId || user?.hotel?.id || null;

  const [requestsData, setRequestsData] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    pending_parts: 0,
    resolved: 0,
    requests: [],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Form dropdown options (fetched on-demand when opening modal)
  const [rooms, setRooms] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [assets, setAssets] = useState([]);

  // Defect Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialRequestForm);

  // Roster Modal State
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterCandidates, setRosterCandidates] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [savingRoster, setSavingRoster] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getApiErrorMessage = (err, fallbackMessage = "Request failed") => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((i) => `${i.loc?.join(".") || ""}: ${i.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  };

  const fetchBackendData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      const res = await api.get("/maintenance-requests/", { params });
      setRequestsData(
        res.data || {
          total: 0,
          open: 0,
          in_progress: 0,
          pending_parts: 0,
          resolved: 0,
          requests: [],
        }
      );
    } catch (err) {
      console.error("Fetch maintenance backend error:", err);
      showToast(getApiErrorMessage(err, "Failed to load maintenance records."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, [user]);

  const loadModalOptions = async () => {
    try {
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      const [roomsRes, techRes, assetsRes] = await Promise.all([
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance/technicians", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance-assets/", { params }).catch(() => ({ data: [] })),
      ]);
      setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : roomsRes.data?.rooms || []);
      setTechnicians(Array.isArray(techRes.data) ? techRes.data : techRes.data?.staff || []);
      setAssets(Array.isArray(assetsRes.data) ? assetsRes.data : assetsRes.data?.assets || []);
    } catch (err) {
      console.error("Modal options load error:", err);
    }
  };

  const openRosterModal = async () => {
    try {
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      const res = await api.get("/maintenance/technician-roster", { params });
      const list = res.data || [];
      setRosterCandidates(list);
      setSelectedStaffIds(list.filter((c) => c.is_assigned).map((c) => c.id));
      setIsRosterModalOpen(true);
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to load technician roster."), "error");
    }
  };

  const toggleStaffSelection = (id) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveRoster = async () => {
    try {
      setSavingRoster(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      await api.post("/maintenance/technician-roster", { staff_ids: selectedStaffIds }, { params });
      showToast("Technician assignment roster saved.", "success");
      setIsRosterModalOpen(false);
      loadModalOptions();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update technician roster."), "error");
    } finally {
      setSavingRoster(false);
    }
  };

  const handleQuickStatusChange = async (reqId, newStatus) => {
    try {
      setSaving(true);
      await api.put(`/maintenance-requests/${reqId}`, { status: newStatus });
      showToast(`Request #${reqId} status updated to ${newStatus.replace("_", " ")}.`, "success");
      await fetchBackendData();
      if (editingRequest?.id === reqId) {
        setFormData((prev) => ({ ...prev, status: newStatus }));
        setEditingRequest((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update status."), "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    return (requestsData.requests || []).filter((r) => {
      const roomStr = String(r.room_number || "").toLowerCase();
      const guestStr = String(r.guest_name || "").toLowerCase();
      const titleStr = String(r.issue_title || "").toLowerCase();
      const descStr = String(r.issue_description || "").toLowerCase();
      const staffStr = String(r.assigned_staff_name || r.reported_by || "").toLowerCase();
      const assetStr = String(r.asset_name || r.asset_code || "").toLowerCase();
      const idStr = String(r.id || "");

      const matchesSearch =
        !search ||
        roomStr.includes(search) ||
        guestStr.includes(search) ||
        titleStr.includes(search) ||
        descStr.includes(search) ||
        staffStr.includes(search) ||
        assetStr.includes(search) ||
        idStr.includes(search);

      if (!matchesSearch) return false;

      const st = String(r.status || "open").toLowerCase();
      if (activeTab === "open" && !(st === "open" || st === "assigned")) return false;
      if (activeTab === "in_progress" && !(st === "in-progress" || st === "in_progress")) return false;
      if (activeTab === "pending_parts" && st !== "pending_parts") return false;
      if (activeTab === "resolved" && !(st === "completed" || st === "verified" || st === "closed")) return false;

      if (priorityFilter !== "all" && String(r.priority || "").toLowerCase() !== priorityFilter.toLowerCase()) return false;
      if (categoryFilter !== "all" && String(r.category || "").toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (sourceFilter !== "all" && String(r.source || "").toLowerCase() !== sourceFilter.toLowerCase()) return false;

      return true;
    });
  }, [requestsData.requests, searchText, activeTab, priorityFilter, categoryFilter, sourceFilter]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openCreateModal = () => {
    loadModalOptions();
    setEditingRequest(null);
    setFormData(initialRequestForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (req) => {
    loadModalOptions();
    setEditingRequest(req);
    setFormData({
      room_id: req.room_id ? String(req.room_id) : "",
      asset_id: req.asset_id ? String(req.asset_id) : "",
      assigned_staff_id: req.assigned_staff_id ? String(req.assigned_staff_id) : "",
      category: req.category || "General",
      source: req.source || "Direct",
      priority: req.priority || "normal",
      status: req.status || "open",
      blocks_room: Boolean(req.blocks_room),
      issue_title: req.issue_title || "",
      issue_description: req.issue_description || "",
      estimated_cost: req.estimated_cost || 0,
      remarks: req.remarks || "",
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingRequest(null);
    setIsEditing(false);
    setFormData(initialRequestForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.issue_title.trim()) {
      showToast("Please enter an issue summary.", "error");
      return;
    }

    try {
      setSaving(true);
      const hotelId = getLoggedInHotelId();
      const payload = {
        hotel_id: hotelId ? Number(hotelId) : undefined,
        room_id: formData.room_id ? Number(formData.room_id) : null,
        asset_id: formData.asset_id ? Number(formData.asset_id) : null,
        assigned_staff_id: formData.assigned_staff_id ? Number(formData.assigned_staff_id) : null,
        category: formData.category,
        source: formData.source,
        priority: formData.priority,
        status: formData.status,
        blocks_room: Boolean(formData.blocks_room),
        issue_title: formData.issue_title.trim(),
        issue_description: formData.issue_description.trim() || null,
        estimated_cost: Number(formData.estimated_cost || 0),
        remarks: formData.remarks.trim() || null,
      };

      if (editingRequest?.id) {
        await api.put(`/maintenance-requests/${editingRequest.id}`, payload);
        showToast("Maintenance request updated successfully.", "success");
      } else {
        await api.post("/maintenance-requests/", payload);
        showToast("Maintenance request recorded successfully.", "success");
      }

      closeModal();
      await fetchBackendData();
    } catch (err) {
      console.error("Save maintenance error:", err);
      showToast(getApiErrorMessage(err, "Failed to save request."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingRequest?.id) return;
    if (!window.confirm(`Are you sure you want to delete maintenance request #${editingRequest.id}?`)) return;

    try {
      setSaving(true);
      await api.delete(`/maintenance-requests/${editingRequest.id}`);
      showToast("Maintenance request deleted successfully.", "success");
      closeModal();
      await fetchBackendData();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to delete request."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSourceFilter("all");
  };

  return (
    <div className="directory-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Maintenance Requests"
        kicker="ENGINEERING & MAINTENANCE • DEFECT INTAKE"
        description="Monitor, evaluate, and track physical defect reports raised across all hotel operations."
        icon={Wrench}
        backPath="/dashboard"
        rightAction={
          <div className="portal-header-actions">
            <button
              type="button"
              className="portal-action-btn-outline"
              onClick={openRosterModal}
            >
              <Users size={15} />
              <span>Manage Technicians</span>
            </button>
            <button
              type="button"
              className="portal-action-btn"
              onClick={openCreateModal}
            >
              <Plus size={16} />
              <span>Log Defect</span>
            </button>
          </div>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard title="Total Issues" value={requestsData.total} Icon={Wrench} colorTheme="blue" />
        <StatCard title="Open / Assigned" value={requestsData.open} Icon={AlertTriangle} colorTheme="orange" />
        <StatCard title="In Progress" value={requestsData.in_progress} Icon={Clock} colorTheme="purple" />
        <StatCard title="Resolved" value={requestsData.resolved} Icon={CheckCircle2} colorTheme="green" />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Central Operational Defect Registry"
          description="Consolidated feed linking room defects, active guest stays, assets, and technician assignments."
          badgeCount={filteredRequests.length}
          badgeLabel="requests"
        />

        {/* TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Requests <span className="tab-count-badge">{requestsData.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "open" ? "active" : ""}`}
            onClick={() => setActiveTab("open")}
          >
            Open / Assigned <span className="tab-count-badge">{requestsData.open}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "in_progress" ? "active" : ""}`}
            onClick={() => setActiveTab("in_progress")}
          >
            In Progress <span className="tab-count-badge">{requestsData.in_progress}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "pending_parts" ? "active" : ""}`}
            onClick={() => setActiveTab("pending_parts")}
          >
            Pending Parts <span className="tab-count-badge">{requestsData.pending_parts}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "resolved" ? "active" : ""}`}
            onClick={() => setActiveTab("resolved")}
          >
            Resolved <span className="tab-count-badge">{requestsData.resolved}</span>
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by room, guest, asset, summary, or description..."
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
              <option value="normal">Normal / Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="dir-filter-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">All Sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

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

            <button type="button" className="btn-cancel" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th style={{ width: "90px", minWidth: "90px" }}>Ref</th>
                <th style={{ minWidth: "170px" }}>Location / Room</th>
                <th style={{ minWidth: "220px" }}>Issue Summary</th>
                <th style={{ minWidth: "130px" }}>Category & Source</th>
                <th style={{ minWidth: "100px" }}>Priority</th>
                <th style={{ minWidth: "120px" }}>Status</th>
                <th style={{ minWidth: "140px" }}>Assignee</th>
                <th style={{ width: "90px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">Loading maintenance requests...</td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No maintenance issues matching current criteria.</td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const st = String(req.status || "open").toLowerCase();
                  const pr = String(req.priority || "normal").toLowerCase();

                  return (
                    <tr key={req.id} className="dir-table-row" onClick={() => openDetailsModal(req)}>
                      <td><span className="booking-id-tag">#{req.id}</span></td>
                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            {req.room_id ? <BedDouble size={16} /> : <Building size={16} />}
                          </div>
                          <div>
                            <span className="customer-name">
                              {req.room_number ? `Room ${req.room_number}` : "Hotel Facility"}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {req.guest_name ? `Guest: ${req.guest_name}` : req.asset_name ? req.asset_name : "Facility Area"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{req.issue_title}</strong>
                          {req.issue_description && (
                            <span className="text-muted" style={{ fontSize: "11.5px" }}>{req.issue_description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f172a" }}>{req.category}</span>
                          <span className="text-muted" style={{ fontSize: "11px" }}>via {req.source}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`mono-pill ${pr === "urgent" || pr === "high" ? "pill-urgent" : pr === "medium" || pr === "normal" ? "pill-warning" : "pill-normal"}`}>
                          {pr.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`mono-pill ${st === "completed" || st === "verified" || st === "closed" ? "pill-normal" : st === "in-progress" || st === "in_progress" ? "pill-warning" : st === "pending_parts" ? "pill-urgent" : "pill-neutral"}`}>
                          {st.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#334155", fontWeight: 500 }}>
                          {req.assigned_staff_name || req.reported_by || "Unassigned"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="dir-row-edit-btn" title="View / Edit Request" onClick={() => openDetailsModal(req)}>
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DEFECT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && closeModal()}>
          <div className="modal-content" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>
                  {!editingRequest
                    ? "Log New Maintenance Defect"
                    : isEditing
                    ? `Edit Maintenance Request #${editingRequest.id}`
                    : `Maintenance Request #${editingRequest.id} Overview`}
                </h2>
                {editingRequest && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to update issue</p>
                )}
              </div>
              <button type="button" className="modal-close" onClick={closeModal} disabled={saving}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Defect Summary / Title *</label>
                  <input
                    type="text"
                    name="issue_title"
                    value={formData.issue_title}
                    onChange={handleInputChange}
                    placeholder="Brief description of the problem (e.g. AC leaking water)"
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Room Allocation (Optional)</label>
                    <select
                      name="room_id"
                      value={formData.room_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- General Facility (No Room) --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>Room {r.room_number} ({r.room_type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Asset / Machine (Optional)</label>
                    <select
                      name="asset_id"
                      value={formData.asset_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- None / General Hardware --</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>{a.asset_code} &bull; {a.name} ({a.category})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Origin Department / Source *</label>
                    <select
                      name="source"
                      value={formData.source}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Priority *</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Status *</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>{st.replace("_", " ").toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assign Technician / Staff</label>
                    <select
                      name="assigned_staff_id"
                      value={formData.assigned_staff_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- Unassigned --</option>
                      {technicians.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.department} - {s.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Estimated Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="estimated_cost"
                      value={formData.estimated_cost}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Defect Details & Inspection Notes</label>
                  <textarea
                    name="issue_description"
                    rows="3"
                    value={formData.issue_description}
                    onChange={handleInputChange}
                    placeholder="Provide specific details about the fault, symptoms, and observations..."
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    padding: "10px 14px",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    id="maint_blocks_room"
                    name="blocks_room"
                    checked={formData.blocks_room}
                    onChange={handleInputChange}
                    disabled={!isEditing || saving}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label
                    htmlFor="maint_blocks_room"
                    style={{ fontSize: "12.5px", color: "#9a3412", fontWeight: 600, cursor: "pointer", margin: 0 }}
                  >
                    Take Room Out of Order (Blocks room status if currently vacant)
                  </label>
                </div>
              </div>

              {/* FOOTER */}
              <div className={`modal-footer ${editingRequest ? "footer-split" : "footer-end"}`}>
                {editingRequest ? (
                  <>
                    <div className="footer-left">
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={handleDelete}
                        disabled={saving}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>

                    <div className="footer-right">
                      {!isEditing ? (
                        <>
                          {editingRequest && !editingRequest.converted_to_task_id && (
                            <button
                              type="button"
                              className="btn-submit"
                              style={{ background: "#2563eb", display: "inline-flex", alignItems: "center", gap: "6px" }}
                              onClick={async () => {
                                try {
                                  setSaving(true);
                                  await api.post(`/tasks/convert-from-request/${editingRequest.id}`, {
                                    estimated_hours: 1.0,
                                  });
                                  showToast(`Request #${editingRequest.id} converted into an official task!`, "success");
                                  closeModal();
                                  fetchBackendData();
                                } catch (err) {
                                  showToast(err?.response?.data?.detail || "Failed to convert request to task.", "error");
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                            >
                              <Wrench size={14} /> Convert to Task
                            </button>
                          )}
                          {editingRequest?.converted_to_task_id && (
                            <span style={{ fontSize: "0.8rem", color: "#3b82f6", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={14} /> Linked Task #{editingRequest.converted_to_task_id}
                            </span>
                          )}
                          {formData.status === "open" && (
                            <button
                              type="button"
                              className="btn-submit"
                              style={{ background: "#d97706" }}
                              onClick={() => handleQuickStatusChange(editingRequest.id, "in-progress")}
                              disabled={saving}
                            >
                              Start Work
                            </button>
                          )}
                          {(formData.status === "in-progress" || formData.status === "open" || formData.status === "pending_parts") && (
                            <button
                              type="button"
                              className="btn-submit"
                              style={{ background: "#059669" }}
                              onClick={() => handleQuickStatusChange(editingRequest.id, "completed")}
                              disabled={saving}
                            >
                              <CheckCircle2 size={14} /> Mark Resolved
                            </button>
                          )}
                          <button type="button" className="btn-cancel" onClick={closeModal}>
                            Close
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            onClick={(e) => {
                              e.preventDefault();
                              setIsEditing(true);
                            }}
                          >
                            <Edit2 size={14} /> Edit Details
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={() => setIsEditing(false)}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button type="submit" className="btn-submit" disabled={saving}>
                            <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="footer-right">
                    <button type="button" className="btn-cancel" onClick={closeModal} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={saving}>
                      <Save size={14} /> {saving ? "Recording..." : "Record Request"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROSTER MODAL */}
      {isRosterModalOpen && (
        <div className="modal-overlay" onClick={() => !savingRoster && setIsRosterModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={18} color="#2d5696" />
                <h2>Designate Maintenance Staff</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsRosterModalOpen(false)}
                disabled={savingRoster}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: "0 0 10px 0", fontSize: "12.5px", color: "#64748b", lineHeight: "1.4" }}>
                Select employees eligible to receive maintenance work and defect repair tasks.
                Only selected employees will appear in the technician assignment dropdown.
              </p>

              <div className="roster-staff-list">
                {rosterCandidates.length === 0 ? (
                  <p className="empty-state">No active staff found.</p>
                ) : (
                  rosterCandidates.map((staff) => {
                    const isSelected = selectedStaffIds.includes(staff.id);
                    return (
                      <div
                        key={staff.id}
                        className={`roster-staff-item ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleStaffSelection(staff.id)}
                      >
                        <div>
                          <span className="roster-staff-name">{staff.full_name}</span>
                          <span className="roster-staff-role" style={{ display: "block" }}>
                            {staff.department} &bull; {staff.designation}
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          className="roster-checkbox"
                          checked={isSelected}
                          onChange={() => toggleStaffSelection(staff.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-footer footer-end">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setIsRosterModalOpen(false)}
                disabled={savingRoster}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={handleSaveRoster}
                disabled={savingRoster}
              >
                <Save size={14} /> {savingRoster ? "Saving..." : "Save Maintenance Roster"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}