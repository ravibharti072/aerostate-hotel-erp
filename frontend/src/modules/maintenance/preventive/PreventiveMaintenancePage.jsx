import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  Wrench,
  User,
  Building,
  CheckSquare,
  ListPlus,
  RefreshCw,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./preventiveMaintenance.css";

const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initialPlanForm = {
  asset_id: "",
  title: "",
  description: "",
  category: "HVAC",
  location: "",
  frequency: "monthly",
  interval_days: 30,
  start_date: getTodayDate(),
  assigned_staff_id: "",
  checklist: [""],
  is_active: true,
};

const FREQUENCIES = [
  { label: "Daily", value: "daily", days: 1 },
  { label: "Weekly", value: "weekly", days: 7 },
  { label: "Bi-Weekly", value: "bi-weekly", days: 14 },
  { label: "Monthly", value: "monthly", days: 30 },
  { label: "Quarterly", value: "quarterly", days: 90 },
  { label: "Semi-Annual", value: "semi-annual", days: 180 },
  { label: "Annual", value: "annual", days: 365 },
];

const CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Generator",
  "Elevator",
  "Kitchen Equipment",
  "Pool & Spa",
  "Fire & Safety",
  "Other",
];

export default function PreventiveMaintenancePage() {
  const { user } = useAuth();

  const [plans, setPlans] = useState([]);
  const [assets, setAssets] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchTriggering, setBatchTriggering] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialPlanForm);

  // Filters & Controls
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || null;
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

  const normalizeList = (data, key) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [plansRes, assetsRes, staffRes] = await Promise.all([
        api.get("/preventive-maintenance/", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance-assets/", { params }).catch(() => ({ data: [] })),
        api.get("/staff", { params }).catch(() => ({ data: [] })),
      ]);

      let pList = normalizeList(plansRes.data, "plans");
      let aList = normalizeList(assetsRes.data, "assets");
      let sList = normalizeList(staffRes.data, "staff");

      if (hotelId) {
        pList = pList.filter((p) => Number(p.hotel_id) === Number(hotelId));
        aList = aList.filter((a) => Number(a.hotel_id) === Number(hotelId));
        sList = sList.filter((s) => Number(s.hotel_id) === Number(hotelId));
      }

      setPlans(pList);
      setAssets(aList);
      setStaffList(sList);
    } catch (err) {
      console.error("Fetch PM plans error:", err);
      showToast(getApiErrorMessage(err, "Failed to load PM schedules."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getAsset = (assetId) => assets.find((a) => Number(a.id) === Number(assetId));
  const getStaff = (staffId) => staffList.find((s) => Number(s.id) === Number(staffId));

  const isOverdue = (nextDueDateStr) => {
    if (!nextDueDateStr) return false;
    const due = new Date(nextDueDateStr);
    const now = new Date();
    return due < now;
  };

  // Stats Card Calculations
  const stats = useMemo(() => {
    let activeCount = 0;
    let overdueCount = 0;
    let dueThisMonthCount = 0;

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    plans.forEach((p) => {
      if (p.is_active) activeCount++;
      const due = new Date(p.next_due_date);
      if (due < now) {
        overdueCount++;
      } else if (due <= thirtyDaysFromNow) {
        dueThisMonthCount++;
      }
    });

    return {
      total: plans.length,
      active: activeCount,
      overdue: overdueCount,
      dueSoon: dueThisMonthCount,
    };
  }, [plans]);

  // Tab & Search Filtering
  const filteredPlans = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    const now = new Date();

    return plans.filter((p) => {
      const asset = getAsset(p.asset_id);
      const staff = getStaff(p.assigned_staff_id);

      const title = String(p.title || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();
      const cat = String(p.category || "").toLowerCase();
      const loc = String(p.location || "").toLowerCase();
      const assetName = String(asset?.name || asset?.asset_code || "").toLowerCase();
      const staffName = String(staff?.full_name || "").toLowerCase();

      const matchesSearch =
        !search ||
        title.includes(search) ||
        desc.includes(search) ||
        cat.includes(search) ||
        loc.includes(search) ||
        assetName.includes(search) ||
        staffName.includes(search);

      if (!matchesSearch) return false;

      const due = new Date(p.next_due_date);
      if (activeTab === "active" && !p.is_active) return false;
      if (activeTab === "overdue" && (!p.is_active || due >= now)) return false;
      if (activeTab === "paused" && p.is_active) return false;

      if (frequencyFilter !== "all" && String(p.frequency || "").toLowerCase() !== frequencyFilter.toLowerCase()) {
        return false;
      }
      if (categoryFilter !== "all" && String(p.category || "").toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [plans, assets, staffList, searchText, activeTab, frequencyFilter, categoryFilter]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "frequency") {
      const matched = FREQUENCIES.find((f) => f.value === value);
      setFormData((prev) => ({
        ...prev,
        frequency: value,
        interval_days: matched ? matched.days : prev.interval_days,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Checklist Item Mutators
  const handleChecklistChange = (index, value) => {
    setFormData((prev) => {
      const updated = [...prev.checklist];
      updated[index] = value;
      return { ...prev, checklist: updated };
    });
  };

  const handleAddChecklistItem = () => {
    setFormData((prev) => ({
      ...prev,
      checklist: [...prev.checklist, ""],
    }));
  };

  const handleRemoveChecklistItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index),
    }));
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setFormData(initialPlanForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (plan) => {
    setEditingPlan(plan);
    setFormData({
      asset_id: plan.asset_id ? String(plan.asset_id) : "",
      title: plan.title || "",
      description: plan.description || "",
      category: plan.category || "HVAC",
      location: plan.location || "",
      frequency: plan.frequency || "monthly",
      interval_days: plan.interval_days || 30,
      start_date: plan.start_date ? String(plan.start_date).split("T")[0] : getTodayDate(),
      assigned_staff_id: plan.assigned_staff_id ? String(plan.assigned_staff_id) : "",
      checklist: Array.isArray(plan.checklist) && plan.checklist.length > 0 ? plan.checklist : [""],
      is_active: Boolean(plan.is_active),
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingPlan(null);
    setIsEditing(false);
    setFormData(initialPlanForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hotelId =
      getLoggedInHotelId() ||
      (formData.asset_id && assets.find((a) => Number(a.id) === Number(formData.asset_id))?.hotel_id) ||
      assets[0]?.hotel_id ||
      staffList[0]?.hotel_id ||
      1;
    if (!hotelId) {
      showToast("Hotel session expired. Please log in again.", "error");
      return;
    }

    if (!formData.title.trim()) {
      showToast("Please enter a plan title.", "error");
      return;
    }

    try {
      setSaving(true);
      const cleanChecklist = formData.checklist.filter((item) => item.trim() !== "");

      const payload = {
        hotel_id: Number(hotelId),
        asset_id: formData.asset_id ? Number(formData.asset_id) : null,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category,
        location: formData.location.trim() || null,
        frequency: formData.frequency,
        interval_days: Number(formData.interval_days || 30),
        start_date: new Date(`${formData.start_date}T00:00:00`).toISOString(),
        next_due_date: new Date(`${formData.start_date}T00:00:00`).toISOString(),
        assigned_staff_id: formData.assigned_staff_id ? Number(formData.assigned_staff_id) : null,
        checklist: cleanChecklist,
        is_active: Boolean(formData.is_active),
      };

      if (editingPlan?.id) {
        await api.put(`/preventive-maintenance/${editingPlan.id}`, payload);
        showToast("PM schedule plan updated successfully.", "success");
      } else {
        await api.post("/preventive-maintenance/", payload);
        showToast("Recurring PM schedule created successfully.", "success");
      }

      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Save PM plan error:", err);
      showToast(getApiErrorMessage(err, "Failed to save plan."), "error");
    } finally {
      setSaving(false);
    }
  };

  // Mark occurrence completed manually
  const handleCompleteOccurrence = async (planId, e) => {
    e.stopPropagation();
    try {
      await api.post(`/preventive-maintenance/${planId}/complete`);
      showToast("PM occurrence recorded. Next due date advanced.", "success");
      await fetchData();
    } catch (err) {
      console.error("Complete occurrence error:", err);
      showToast(getApiErrorMessage(err, "Failed to record completion."), "error");
    }
  };

  // Batch trigger generation for all due plans
  const handleBatchGenerate = async () => {
    try {
      setBatchTriggering(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      const res = await api.post("/preventive-maintenance/generate-due", null, {
        params,
      });
      showToast(res.data?.message || "Successfully generated due work orders.", "success");
      await fetchData();
    } catch (err) {
      console.error("Batch generate error:", err);
      showToast(getApiErrorMessage(err, "Failed to process due plans."), "error");
    } finally {
      setBatchTriggering(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPlan?.id) return;
    if (!window.confirm(`Are you sure you want to delete PM plan "${editingPlan.title}"?`)) {
      return;
    }

    try {
      setSaving(true);
      await api.delete(`/preventive-maintenance/${editingPlan.id}`);
      showToast("PM plan deleted successfully.", "success");
      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Delete plan error:", err);
      showToast(getApiErrorMessage(err, "Failed to delete plan."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("all");
    setFrequencyFilter("all");
    setCategoryFilter("all");
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
        title="Preventive Maintenance"
        kicker="PLANNED UPKEEP • RECURRING SERVICING"
        description="Configure scheduled inspections, servicing intervals, and automated work orders for hotel equipment."
        icon={CalendarClock}
        backPath="/dashboard"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              className="portal-action-btn-secondary"
              onClick={handleBatchGenerate}
              disabled={batchTriggering}
            >
              <RefreshCw size={14} className={batchTriggering ? "spin-icon" : ""} />
              {batchTriggering ? "Processing..." : "Generate Due Tasks"}
            </button>
            <button type="button" className="portal-action-btn" onClick={openCreateModal}>
              <Plus size={16} /> New PM Schedule
            </button>
          </div>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Plans"
          value={stats.total}
          Icon={CalendarClock}
          colorTheme="blue"
        />
        <StatCard
          title="Active Schedules"
          value={stats.active}
          Icon={PlayCircle}
          colorTheme="green"
        />
        <StatCard
          title="Overdue Servicing"
          value={stats.overdue}
          Icon={AlertTriangle}
          colorTheme="orange"
        />
        <StatCard
          title="Due in 30 Days"
          value={stats.dueSoon}
          Icon={Clock}
          colorTheme="purple"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Scheduled Servicing Matrix"
          description="Recurring calendar routines maintaining operational reliability for HVAC, plumbing, generators, and hardware."
          badgeCount={filteredPlans.length}
          badgeLabel="schedules"
        />

        {/* TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Plans <span className="tab-count-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "active" ? "active" : ""}`}
            onClick={() => setActiveTab("active")}
          >
            Active <span className="tab-count-badge">{stats.active}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "overdue" ? "active" : ""}`}
            onClick={() => setActiveTab("overdue")}
          >
            Overdue <span className="tab-count-badge">{stats.overdue}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "paused" ? "active" : ""}`}
            onClick={() => setActiveTab("paused")}
          >
            Paused
          </button>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by schedule title, machine, category, or technician..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="dir-filter-select"
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
            >
              <option value="all">All Frequencies</option>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
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

            <button type="button" className="btn-cancel" style={{ height: "40px" }} onClick={clearFilters}>
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
                <th style={{ minWidth: "220px" }}>Schedule / Machine</th>
                <th style={{ minWidth: "140px" }}>Frequency</th>
                <th style={{ minWidth: "160px" }}>Next Due Date</th>
                <th style={{ minWidth: "140px" }}>Assigned Tech</th>
                <th style={{ minWidth: "110px" }}>Status</th>
                <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading preventive maintenance schedules...
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No preventive maintenance plans matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => {
                  const asset = getAsset(plan.asset_id);
                  const staff = getStaff(plan.assigned_staff_id);
                  const overdue = isOverdue(plan.next_due_date);
                  const dueDateFormatted = plan.next_due_date
                    ? new Date(plan.next_due_date).toLocaleDateString()
                    : "-";
                  const lastPerformedFormatted = plan.last_performed_date
                    ? new Date(plan.last_performed_date).toLocaleDateString()
                    : "Never";

                  return (
                    <tr
                      key={plan.id}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(plan)}
                    >
                      <td>
                        <span className="booking-id-tag">#{plan.id}</span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            <Wrench size={16} />
                          </div>
                          <div>
                            <span className="customer-name">{plan.title}</span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {asset ? `${asset.asset_code} • ${asset.name}` : plan.location || "General Property"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f172a", textTransform: "capitalize" }}>
                            {plan.frequency}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11px" }}>
                            Every {plan.interval_days} days
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: overdue ? "#dc2626" : "#0f172a" }}>
                            {dueDateFormatted}
                          </span>
                          <span className="bank-sub" style={{ fontSize: "11px" }}>
                            Last done: {lastPerformedFormatted}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <User size={13} color="#2d5696" />
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>
                            {staff ? staff.full_name : "Unassigned"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`mono-pill ${
                            !plan.is_active
                              ? "pill-neutral"
                              : overdue
                              ? "pill-urgent"
                              : "pill-normal"
                          }`}
                        >
                          {!plan.is_active ? "PAUSED" : overdue ? "OVERDUE" : "ACTIVE"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            title="Complete Servicing Occurrence"
                            onClick={(e) => handleCompleteOccurrence(plan.id, e)}
                          >
                            <CheckCircle2 size={13} color="#166962" />
                          </button>
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            title="View / Edit Plan"
                            onClick={() => openDetailsModal(plan)}
                          >
                            <Edit2 size={13} />
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

      {/* CREATE & EDIT PM PLAN MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && closeModal()}>
          <div
            className="modal-content"
            style={{ maxWidth: "700px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {!editingPlan
                    ? "Create Preventive Maintenance Plan"
                    : isEditing
                    ? `Edit Schedule • ${editingPlan.title}`
                    : `Schedule • ${editingPlan.title} Overview`}
                </h2>
                {editingPlan && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to make changes</p>
                )}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Plan Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g., Monthly HVAC Filter Clean & Coil Descaling"
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Target Machine / Asset (Optional)</label>
                    <select
                      name="asset_id"
                      value={formData.asset_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- General Infrastructure --</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.asset_code} &bull; {a.name} ({a.category})
                        </option>
                      ))}
                    </select>
                  </div>

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
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Servicing Frequency *</label>
                    <select
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label} ({f.days} Days)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assigned Technician</label>
                    <select
                      name="assigned_staff_id"
                      value={formData.assigned_staff_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- Unassigned --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.designation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location / Facility Area</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Roof Plant Room / Basement"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>First Service Start Date *</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Maintenance Instructions & Overview</label>
                  <textarea
                    name="description"
                    rows="2"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Step-by-step guidance for technicians executing this recurring service..."
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                {/* Service Checklist Items */}
                <div className="pm-checklist-container">
                  <div className="pm-checklist-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckSquare size={15} color="#2d5696" />
                      <strong>Service Verification Checklist</strong>
                    </div>
                    {isEditing && (
                      <button
                        type="button"
                        className="btn-add-item"
                        onClick={handleAddChecklistItem}
                      >
                        <Plus size={13} /> Add Check Item
                      </button>
                    )}
                  </div>

                  {formData.checklist.map((item, idx) => (
                    <div key={idx} className="checklist-row-item">
                      <input
                        type="text"
                        placeholder={`Inspection Step ${idx + 1}...`}
                        value={item}
                        onChange={(e) => handleChecklistChange(idx, e.target.value)}
                        disabled={!isEditing || saving}
                        className="checklist-input"
                      />
                      {isEditing && formData.checklist.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => handleRemoveChecklistItem(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status Toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    padding: "10px 14px",
                    borderRadius: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    id="pm_is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    disabled={!isEditing || saving}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label
                    htmlFor="pm_is_active"
                    style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600, cursor: "pointer", margin: 0 }}
                  >
                    Schedule Active (Auto-generate work order upon due date)
                  </label>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingPlan ? (
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
                          <button type="button" className="btn-cancel" onClick={closeModal}>
                            Close
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            onClick={() => setIsEditing(true)}
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
                  <div className="footer-right" style={{ width: "100%", justifyContent: "flex-end" }}>
                    <button type="button" className="btn-cancel" onClick={closeModal} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={saving}>
                      <Save size={14} /> {saving ? "Creating..." : "Create Schedule"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}