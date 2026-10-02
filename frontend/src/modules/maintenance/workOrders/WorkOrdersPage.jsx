import React, { useEffect, useMemo, useState } from "react";
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
  Save,
  Package,
  ShoppingCart,
  User,
  BedDouble,
  Building,
  DollarSign,
  FileText,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./workOrders.css";

const initialWorkOrderForm = {
  maintenance_request_id: "",
  room_id: "",
  asset_id: "",
  technician_staff_id: "",
  priority: "normal",
  status: "assigned",
  diagnosis: "",
  work_performed: "",
  labor_hours: 0,
  labor_cost: 0,
  notes: "",
};

const initialPartUsageForm = {
  inventory_item_id: "",
  quantity_used: 1,
  unit_cost: 0,
  notes: "",
};

const initialProcurementForm = {
  item_id: "",
  quantity: 1,
  notes: "",
};

const STATUSES = [
  "assigned",
  "in_progress",
  "pending_parts",
  "completed",
  "verified",
  "closed",
  "cancelled",
];

const PRIORITIES = ["low", "normal", "medium", "high", "urgent"];

export default function WorkOrdersPage() {
  const { user } = useAuth();

  const [workOrders, setWorkOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [assets, setAssets] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialWorkOrderForm);

  // Sub-Modals for Inventory / Procurement
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [partFormData, setPartFormData] = useState(initialPartUsageForm);

  const [isProcureModalOpen, setIsProcureModalOpen] = useState(false);
  const [procureFormData, setProcureFormData] = useState(initialProcurementForm);

  // Filters & Controls
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");

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

      const [woRes, reqRes, roomsRes, staffRes, assetsRes, invRes] = await Promise.all([
        api.get("/work-orders/", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance-requests/", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
        api.get("/staff", { params }).catch(() => ({ data: [] })),
        api.get("/maintenance-assets/", { params }).catch(() => ({ data: [] })),
        api.get("/inventory/items", { params }).catch(() => ({ data: [] })),
      ]);

      let woList = normalizeList(woRes.data, "work_orders");
      let reqList = normalizeList(reqRes.data, "requests");
      let rList = normalizeList(roomsRes.data, "rooms");
      let sList = normalizeList(staffRes.data, "staff");
      let aList = normalizeList(assetsRes.data, "assets");
      let iList = normalizeList(invRes.data, "items");

      if (hotelId) {
        woList = woList.filter((w) => Number(w.hotel_id) === Number(hotelId));
        reqList = reqList.filter((r) => Number(r.hotel_id) === Number(hotelId));
        rList = rList.filter((r) => Number(r.hotel_id) === Number(hotelId));
        sList = sList.filter((s) => Number(s.hotel_id) === Number(hotelId));
        aList = aList.filter((a) => Number(a.hotel_id) === Number(hotelId));
        iList = iList.filter((i) => Number(i.hotel_id) === Number(hotelId));
      }

      setWorkOrders(woList);
      setRequests(reqList);
      setRooms(rList);
      setStaffList(sList);
      setAssets(aList);
      setInventoryItems(iList);
    } catch (err) {
      console.error("Fetch work orders error:", err);
      showToast(getApiErrorMessage(err, "Failed to load work orders."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRequest = (reqId) => requests.find((r) => Number(r.id) === Number(reqId));
  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));
  const getStaff = (staffId) => staffList.find((s) => Number(s.id) === Number(staffId));
  const getAsset = (assetId) => assets.find((a) => Number(a.id) === Number(assetId));

  // Compute Summary KPIs
  const stats = useMemo(() => {
    let assignedCount = 0;
    let inProgressCount = 0;
    let pendingPartsCount = 0;
    let completedCount = 0;

    workOrders.forEach((w) => {
      const st = String(w.status || "").toLowerCase();
      if (st === "assigned") assignedCount++;
      else if (st === "in_progress" || st === "in-progress") inProgressCount++;
      else if (st === "pending_parts") pendingPartsCount++;
      else if (st === "completed" || st === "verified" || st === "closed") completedCount++;
    });

    return {
      total: workOrders.length,
      assigned: assignedCount,
      inProgress: inProgressCount,
      pendingParts: pendingPartsCount,
      completed: completedCount,
    };
  }, [workOrders]);

  // Tab & Filter Logic
  const filteredWorkOrders = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return workOrders.filter((w) => {
      const req = getRequest(w.maintenance_request_id);
      const room = getRoom(w.room_id || req?.room_id);
      const staff = getStaff(w.technician_staff_id);
      const asset = getAsset(w.asset_id || req?.asset_id);

      const woNum = String(w.work_order_number || "").toLowerCase();
      const reqTitle = String(req?.issue_title || "").toLowerCase();
      const roomNum = String(room?.room_number || "").toLowerCase();
      const staffName = String(staff?.full_name || "").toLowerCase();
      const assetName = String(asset?.name || asset?.asset_code || "").toLowerCase();
      const diagnosis = String(w.diagnosis || "").toLowerCase();

      const matchesSearch =
        !search ||
        woNum.includes(search) ||
        reqTitle.includes(search) ||
        roomNum.includes(search) ||
        staffName.includes(search) ||
        assetName.includes(search) ||
        diagnosis.includes(search);

      if (!matchesSearch) return false;

      const st = String(w.status || "assigned").toLowerCase();
      if (activeTab === "assigned" && st !== "assigned") return false;
      if (activeTab === "in_progress" && !(st === "in_progress" || st === "in-progress")) return false;
      if (activeTab === "pending_parts" && st !== "pending_parts") return false;
      if (activeTab === "completed" && !(st === "completed" || st === "verified" || st === "closed")) return false;

      if (priorityFilter !== "all" && String(w.priority || "").toLowerCase() !== priorityFilter.toLowerCase()) {
        return false;
      }

      if (technicianFilter !== "all" && String(w.technician_staff_id) !== technicianFilter) {
        return false;
      }

      return true;
    });
  }, [workOrders, requests, rooms, staffList, assets, searchText, activeTab, priorityFilter, technicianFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setFormData(initialWorkOrderForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (wo) => {
    setEditingOrder(wo);
    setFormData({
      maintenance_request_id: String(wo.maintenance_request_id || ""),
      room_id: wo.room_id ? String(wo.room_id) : "",
      asset_id: wo.asset_id ? String(wo.asset_id) : "",
      technician_staff_id: wo.technician_staff_id ? String(wo.technician_staff_id) : "",
      priority: wo.priority || "normal",
      status: wo.status || "assigned",
      diagnosis: wo.diagnosis || "",
      work_performed: wo.work_performed || "",
      labor_hours: wo.labor_hours || 0,
      labor_cost: wo.labor_cost || 0,
      notes: wo.notes || "",
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingOrder(null);
    setIsEditing(false);
    setFormData(initialWorkOrderForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hotelId =
      getLoggedInHotelId() ||
      requests.find((r) => String(r.id) === String(formData.maintenance_request_id))?.hotel_id ||
      requests[0]?.hotel_id ||
      rooms[0]?.hotel_id ||
      assets[0]?.hotel_id ||
      1;
    if (!hotelId) {
      showToast("Hotel session expired. Please log in again.", "error");
      return;
    }

    if (!formData.maintenance_request_id) {
      showToast("Please link a parent maintenance request.", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        hotel_id: Number(hotelId),
        maintenance_request_id: Number(formData.maintenance_request_id),
        room_id: formData.room_id ? Number(formData.room_id) : null,
        asset_id: formData.asset_id ? Number(formData.asset_id) : null,
        technician_staff_id: formData.technician_staff_id ? Number(formData.technician_staff_id) : null,
        priority: formData.priority,
        status: formData.status,
        diagnosis: formData.diagnosis.trim() || null,
        work_performed: formData.work_performed.trim() || null,
        labor_hours: Number(formData.labor_hours || 0),
        labor_cost: Number(formData.labor_cost || 0),
        notes: formData.notes.trim() || null,
      };

      if (editingOrder?.id) {
        await api.put(`/work-orders/${editingOrder.id}`, payload);
        showToast("Work order updated successfully.", "success");
      } else {
        await api.post("/work-orders/", payload);
        showToast("Work order issued successfully.", "success");
      }

      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Save work order error:", err);
      showToast(getApiErrorMessage(err, "Failed to save work order."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingOrder?.id) return;
    if (!window.confirm(`Are you sure you want to delete Work Order ${editingOrder.work_order_number}?`)) {
      return;
    }

    try {
      setSaving(true);
      await api.delete(`/work-orders/${editingOrder.id}`);
      showToast("Work order deleted successfully.", "success");
      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Delete work order error:", err);
      showToast(getApiErrorMessage(err, "Failed to delete work order."), "error");
    } finally {
      setSaving(false);
    }
  };

  // Log Parts Used on Work Order
  const handleLogPartUsage = async (e) => {
    e.preventDefault();
    if (!editingOrder?.id) return;
    if (!partFormData.inventory_item_id) {
      showToast("Please select an inventory spare part.", "error");
      return;
    }

    try {
      setSaving(true);
      await api.post(`/work-orders/${editingOrder.id}/parts`, {
        inventory_item_id: Number(partFormData.inventory_item_id),
        quantity_used: Number(partFormData.quantity_used || 1),
        unit_cost: Number(partFormData.unit_cost || 0),
        notes: partFormData.notes.trim() || null,
      });

      showToast("Spare part logged and deducted from inventory.", "success");
      setIsPartModalOpen(false);
      setPartFormData(initialPartUsageForm);
      await fetchData();
    } catch (err) {
      console.error("Part usage error:", err);
      showToast(getApiErrorMessage(err, "Failed to deduct inventory part."), "error");
    } finally {
      setSaving(false);
    }
  };

  // Requisition Part Procurement
  const handleRequestProcurement = async (e) => {
    e.preventDefault();
    if (!editingOrder?.id) return;
    if (!procureFormData.item_id) {
      showToast("Please select the spare part to order.", "error");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post(`/work-orders/${editingOrder.id}/procurement-request`, {
        item_id: Number(procureFormData.item_id),
        quantity: Number(procureFormData.quantity || 1),
        notes: procureFormData.notes.trim() || null,
      });

      showToast(`Draft Purchase Order ${res.data?.po_number || ""} created successfully.`, "success");
      setIsProcureModalOpen(false);
      setProcureFormData(initialProcurementForm);
      await fetchData();
    } catch (err) {
      console.error("Procurement requisition error:", err);
      showToast(getApiErrorMessage(err, "Failed to draft procurement order."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("all");
    setPriorityFilter("all");
    setTechnicianFilter("all");
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
        title="Work Orders"
        kicker="ENGINEERING • REPAIRS & EXECUTION"
        description="Assign technical work orders, track technician labor hours, log inventory parts, and manage repair costs."
        icon={ClipboardList}
        backPath="/dashboard"
        rightAction={
          <button type="button" className="portal-action-btn" onClick={openCreateModal}>
            <Plus size={16} /> New Work Order
          </button>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Work Orders"
          value={stats.total}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Assigned Tasks"
          value={stats.assigned}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          Icon={Wrench}
          colorTheme="purple"
        />
        <StatCard
          title="Completed & Closed"
          value={stats.completed}
          Icon={CheckCircle2}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Work Order Execution Queue"
          description="Direct tracking of mechanical, electrical, HVAC, and plumbing job cards across the property."
          badgeCount={filteredWorkOrders.length}
          badgeLabel="orders"
        />

        {/* TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Orders <span className="tab-count-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "assigned" ? "active" : ""}`}
            onClick={() => setActiveTab("assigned")}
          >
            Assigned <span className="tab-count-badge">{stats.assigned}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "in_progress" ? "active" : ""}`}
            onClick={() => setActiveTab("in_progress")}
          >
            In Progress <span className="tab-count-badge">{stats.inProgress}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "pending_parts" ? "active" : ""}`}
            onClick={() => setActiveTab("pending_parts")}
          >
            Pending Parts <span className="tab-count-badge">{stats.pendingParts}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "completed" ? "active" : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            Completed <span className="tab-count-badge">{stats.completed}</span>
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by WO#, request title, room, technician, or diagnosis..."
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
              value={technicianFilter}
              onChange={(e) => setTechnicianFilter(e.target.value)}
            >
              <option value="all">All Technicians</option>
              {staffList.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.full_name}
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
                <th style={{ width: "130px", minWidth: "130px" }}>WO Number</th>
                <th style={{ minWidth: "180px" }}>Linked Request / Area</th>
                <th style={{ minWidth: "220px" }}>Diagnosis & Scope</th>
                <th style={{ minWidth: "130px" }}>Technician</th>
                <th style={{ minWidth: "100px" }}>Priority</th>
                <th style={{ minWidth: "120px" }}>Status</th>
                <th style={{ minWidth: "140px" }}>Cost Breakdown</th>
                <th style={{ width: "90px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    Loading technical work orders...
                  </td>
                </tr>
              ) : filteredWorkOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    No work orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredWorkOrders.map((wo) => {
                  const req = getRequest(wo.maintenance_request_id);
                  const room = getRoom(wo.room_id || req?.room_id);
                  const staff = getStaff(wo.technician_staff_id);
                  const st = String(wo.status || "assigned").toLowerCase();
                  const pr = String(wo.priority || "normal").toLowerCase();

                  return (
                    <tr
                      key={wo.id}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(wo)}
                    >
                      <td>
                        <span className="booking-id-tag">{wo.work_order_number}</span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            {wo.room_id ? <BedDouble size={16} /> : <Building size={16} />}
                          </div>
                          <div>
                            <span className="customer-name">
                              {req ? req.issue_title : `Request #${wo.maintenance_request_id}`}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {room ? `Room ${room.room_number}` : "Facility Infrastructure"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                            {wo.diagnosis || "Initial technical evaluation"}
                          </strong>
                          {wo.work_performed && (
                            <span className="text-muted" style={{ fontSize: "11.5px" }}>
                              Done: {wo.work_performed}
                            </span>
                          )}
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
                            st === "completed" || st === "verified" || st === "closed"
                              ? "pill-normal"
                              : st === "in_progress" || st === "in-progress"
                              ? "pill-warning"
                              : st === "pending_parts"
                              ? "pill-urgent"
                              : "pill-neutral"
                          }`}
                        >
                          {st.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: "#166962" }}>
                            Total: ₹{Number(wo.total_cost || 0).toFixed(2)}
                          </span>
                          <span className="bank-sub" style={{ fontSize: "11px" }}>
                            Labor: ₹{Number(wo.labor_cost || 0).toFixed(2)} | Parts: ₹{Number(wo.parts_cost || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="dir-row-edit-btn"
                          title="View / Edit Work Order"
                          onClick={() => openDetailsModal(wo)}
                        >
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

      {/* CREATE & EDIT WORK ORDER MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && closeModal()}>
          <div
            className="modal-content"
            style={{ maxWidth: "720px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {!editingOrder
                    ? "Issue Technical Work Order"
                    : isEditing
                    ? `Edit Work Order ${editingOrder.work_order_number}`
                    : `Work Order ${editingOrder.work_order_number} Overview`}
                </h2>
                {editingOrder && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to update diagnosis and labor</p>
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
                {/* Parent Request Selector */}
                <div className="form-group">
                  <label>Parent Maintenance Request *</label>
                  <select
                    name="maintenance_request_id"
                    value={formData.maintenance_request_id}
                    onChange={handleInputChange}
                    disabled={!isEditing || saving || Boolean(editingOrder)}
                    className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    required
                  >
                    <option value="">-- Select Defect Request --</option>
                    {requests.map((r) => (
                      <option key={r.id} value={r.id}>
                        #{r.id} &bull; {r.issue_title} ({r.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location & Asset */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Room Allocation</label>
                    <select
                      name="room_id"
                      value={formData.room_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- Facility / Not in Room --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number} ({r.room_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Asset / Machinery</label>
                    <select
                      name="asset_id"
                      value={formData.asset_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- None / General Hardware --</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.asset_code} &bull; {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Technician & Priority */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Assigned Technician *</label>
                    <select
                      name="technician_staff_id"
                      value={formData.technician_staff_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      <option value="">-- Assign Technician --</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.designation})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Job Priority *</label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status */}
                <div className="form-group">
                  <label>Work Order Status *</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={!isEditing || saving}
                    className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    required
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st.replace("_", " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Diagnosis & Action */}
                <div className="form-group">
                  <label>Technical Diagnosis</label>
                  <input
                    type="text"
                    name="diagnosis"
                    value={formData.diagnosis}
                    onChange={handleInputChange}
                    placeholder="e.g., Compressor capacitor blown, thermostat malfunctioning"
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                <div className="form-group">
                  <label>Work Performed / Corrective Action</label>
                  <textarea
                    name="work_performed"
                    rows="2"
                    value={formData.work_performed}
                    onChange={handleInputChange}
                    placeholder="Details of repair, component replacement, or recalibration executed..."
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                {/* Labor Tracking */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Labor Hours Spent</label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      name="labor_hours"
                      value={formData.labor_hours}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Labor Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="labor_cost"
                      value={formData.labor_cost}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                {/* Inventory Parts & Procurement Action Bar (When Viewing Existing Order) */}
                {editingOrder && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "#f1f5f9",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a", display: "block" }}>
                        Spare Parts Used: ₹{Number(editingOrder.parts_cost || 0).toFixed(2)}
                      </span>
                      <span className="text-muted" style={{ fontSize: "11px" }}>
                        Total Job Cost: ₹{Number(editingOrder.total_cost || 0).toFixed(2)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="btn-add-service"
                        onClick={() => setIsPartModalOpen(true)}
                      >
                        <Package size={13} /> Log Spare Part
                      </button>

                      <button
                        type="button"
                        className="btn-add-service"
                        style={{ background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" }}
                        onClick={() => setIsProcureModalOpen(true)}
                      >
                        <ShoppingCart size={13} /> Order Part (PO)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingOrder ? (
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
                      <Save size={14} /> {saving ? "Issuing..." : "Issue Work Order"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG SPARE PART MODAL */}
      {isPartModalOpen && (
        <div className="modal-overlay nested-modal" onClick={() => !saving && setIsPartModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Package size={18} color="#2d5696" />
                <h2>Log Inventory Spare Part</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsPartModalOpen(false)}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLogPartUsage}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Item from Inventory *</label>
                  <select
                    value={partFormData.inventory_item_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const matched = inventoryItems.find((i) => String(i.id) === String(selId));
                      setPartFormData((prev) => ({
                        ...prev,
                        inventory_item_id: selId,
                        unit_cost: matched?.purchase_price || 0,
                      }));
                    }}
                    className="dir-select-field"
                    required
                  >
                    <option value="">-- Select Inventory Part --</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) &bull; In Stock: {item.current_stock} {item.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity Used *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={partFormData.quantity_used}
                      onChange={(e) => setPartFormData((prev) => ({ ...prev, quantity_used: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={partFormData.unit_cost}
                      onChange={(e) => setPartFormData((prev) => ({ ...prev, unit_cost: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Usage Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Replaced worn-out valve washer"
                    value={partFormData.notes}
                    onChange={(e) => setPartFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button type="button" className="btn-cancel" onClick={() => setIsPartModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  <Save size={14} /> Deduct & Log Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROCUREMENT REQUISITION DRAFT MODAL */}
      {isProcureModalOpen && (
        <div className="modal-overlay nested-modal" onClick={() => !saving && setIsProcureModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <ShoppingCart size={18} color="#9a3412" />
                <h2 style={{ color: "#9a3412" }}>Draft Purchase Order (Requisition)</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsProcureModalOpen(false)}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRequestProcurement}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: "12.5px", color: "#64748b" }}>
                  Generates an auditable draft Purchase Order (PO) in Procurement when inventory stock is depleted.
                </p>

                <div className="form-group">
                  <label>Spare Part to Requisition *</label>
                  <select
                    value={procureFormData.item_id}
                    onChange={(e) => setProcureFormData((prev) => ({ ...prev, item_id: e.target.value }))}
                    className="dir-select-field"
                    required
                  >
                    <option value="">-- Select Required Item --</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} &bull; (Supplier: {item.supplier_name || "Primary"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Requisition Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={procureFormData.quantity}
                    onChange={(e) => setProcureFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Requisition Reason / Urgency</label>
                  <input
                    type="text"
                    placeholder="e.g. Critical breakdown repair; stock exhausted"
                    value={procureFormData.notes}
                    onChange={(e) => setProcureFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button type="button" className="btn-cancel" onClick={() => setIsProcureModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{ background: "#9a3412" }}
                  disabled={saving}
                >
                  <ShoppingCart size={14} /> Generate Draft PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}