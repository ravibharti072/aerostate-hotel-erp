import React, { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Activity,
  AlertOctagon,
  Wrench,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  BedDouble,
  Building,
  History,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./assets.css";

const initialAssetForm = {
  asset_code: "",
  name: "",
  category: "HVAC",
  room_id: "",
  location: "",
  serial_number: "",
  manufacturer: "",
  model: "",
  installation_date: "",
  warranty_expiry_date: "",
  status: "operational",
  notes: "",
};

const CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Generator",
  "Elevator",
  "Kitchen Equipment",
  "Laundry Equipment",
  "Television & AV",
  "Fire & Safety",
  "Other",
];

const STATUSES = [
  "operational",
  "degraded",
  "broken",
  "under_repair",
  "disposed",
];

export default function AssetsPage() {
  const { user } = useAuth();

  const [assets, setAssets] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialAssetForm);

  // History Drawer Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Filters & Controls
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
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

      const [assetsRes, roomsRes] = await Promise.all([
        api.get("/maintenance-assets/", { params }).catch(() => ({ data: [] })),
        api.get("/rooms", { params }).catch(() => ({ data: [] })),
      ]);

      let aList = normalizeList(assetsRes.data, "assets");
      let rList = normalizeList(roomsRes.data, "rooms");

      if (hotelId) {
        aList = aList.filter((a) => Number(a.hotel_id) === Number(hotelId));
        rList = rList.filter((r) => Number(r.hotel_id) === Number(hotelId));
      }

      setAssets(aList);
      setRooms(rList);
    } catch (err) {
      console.error("Fetch assets error:", err);
      showToast(getApiErrorMessage(err, "Failed to load assets registry."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getRoom = (roomId) => rooms.find((r) => Number(r.id) === Number(roomId));

  // StatCard Metrics
  const stats = useMemo(() => {
    let operationalCount = 0;
    let underRepairCount = 0;
    let degradedOrBrokenCount = 0;

    assets.forEach((a) => {
      const st = String(a.status || "").toLowerCase();
      if (st === "operational") operationalCount++;
      else if (st === "under_repair") underRepairCount++;
      else if (st === "broken" || st === "degraded") degradedOrBrokenCount++;
    });

    return {
      total: assets.length,
      operational: operationalCount,
      underRepair: underRepairCount,
      faulty: degradedOrBrokenCount,
    };
  }, [assets]);

  // Tab & Search Filtering
  const filteredAssets = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return assets.filter((a) => {
      const room = getRoom(a.room_id);
      const code = String(a.asset_code || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      const cat = String(a.category || "").toLowerCase();
      const loc = String(a.location || "").toLowerCase();
      const roomNum = String(room?.room_number || "").toLowerCase();
      const serial = String(a.serial_number || "").toLowerCase();

      const matchesSearch =
        !search ||
        code.includes(search) ||
        name.includes(search) ||
        cat.includes(search) ||
        loc.includes(search) ||
        roomNum.includes(search) ||
        serial.includes(search);

      if (!matchesSearch) return false;

      const st = String(a.status || "operational").toLowerCase();
      if (activeTab === "operational" && st !== "operational") return false;
      if (activeTab === "under_repair" && st !== "under_repair") return false;
      if (activeTab === "faulty" && !(st === "broken" || st === "degraded")) return false;
      if (activeTab === "disposed" && st !== "disposed") return false;

      if (categoryFilter !== "all" && String(a.category || "").toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [assets, rooms, searchText, activeTab, categoryFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingAsset(null);
    setFormData(initialAssetForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (asset) => {
    setEditingAsset(asset);
    setFormData({
      asset_code: asset.asset_code || "",
      name: asset.name || "",
      category: asset.category || "HVAC",
      room_id: asset.room_id ? String(asset.room_id) : "",
      location: asset.location || "",
      serial_number: asset.serial_number || "",
      manufacturer: asset.manufacturer || "",
      model: asset.model || "",
      installation_date: asset.installation_date ? String(asset.installation_date).split("T")[0] : "",
      warranty_expiry_date: asset.warranty_expiry_date ? String(asset.warranty_expiry_date).split("T")[0] : "",
      status: asset.status || "operational",
      notes: asset.notes || "",
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openHistoryModal = async (asset, e) => {
    e.stopPropagation();
    try {
      setLoadingHistory(true);
      setIsHistoryModalOpen(true);
      const res = await api.get(`/maintenance-assets/${asset.id}/history`);
      setHistoryData(res.data);
    } catch (err) {
      console.error("Fetch asset history error:", err);
      showToast(getApiErrorMessage(err, "Failed to load asset service history."), "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingAsset(null);
    setIsEditing(false);
    setFormData(initialAssetForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hotelId =
      getLoggedInHotelId() ||
      (formData.room_id && rooms.find((r) => Number(r.id) === Number(formData.room_id))?.hotel_id) ||
      assets[0]?.hotel_id ||
      rooms[0]?.hotel_id ||
      1;
    if (!hotelId) {
      showToast("Hotel session expired. Please log in again.", "error");
      return;
    }

    if (!formData.name.trim()) {
      showToast("Please enter an asset name.", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        hotel_id: Number(hotelId),
        asset_code: formData.asset_code.trim() || "",
        name: formData.name.trim(),
        category: formData.category,
        room_id: formData.room_id ? Number(formData.room_id) : null,
        location: formData.location.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        model: formData.model.trim() || null,
        installation_date: formData.installation_date ? new Date(`${formData.installation_date}T00:00:00`).toISOString() : null,
        warranty_expiry_date: formData.warranty_expiry_date ? new Date(`${formData.warranty_expiry_date}T00:00:00`).toISOString() : null,
        status: formData.status,
        notes: formData.notes.trim() || null,
      };

      if (editingAsset?.id) {
        await api.put(`/maintenance-assets/${editingAsset.id}`, payload);
        showToast("Asset details updated successfully.", "success");
      } else {
        await api.post("/maintenance-assets/", payload);
        showToast("Equipment registered successfully.", "success");
      }

      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Save asset error:", err);
      showToast(getApiErrorMessage(err, "Failed to save asset."), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingAsset?.id) return;
    if (!window.confirm(`Are you sure you want to delete asset "${editingAsset.name}" (${editingAsset.asset_code})?`)) {
      return;
    }

    try {
      setSaving(true);
      await api.delete(`/maintenance-assets/${editingAsset.id}`);
      showToast("Asset deleted successfully.", "success");
      closeModal();
      await fetchData();
    } catch (err) {
      console.error("Delete asset error:", err);
      showToast(getApiErrorMessage(err, "Failed to delete asset."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchText("");
    setActiveTab("all");
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
        title="Assets & Equipment"
        kicker="INFRASTRUCTURE • EQUIPMENT REGISTRY"
        description="Register and track mechanical machinery, appliances, warranty expirations, and historical servicing costs."
        icon={Boxes}
        backPath="/dashboard"
        rightAction={
          <button type="button" className="portal-action-btn" onClick={openCreateModal}>
            <Plus size={16} /> Register Asset
          </button>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Equipment"
          value={stats.total}
          Icon={Boxes}
          colorTheme="blue"
        />
        <StatCard
          title="Operational"
          value={stats.operational}
          Icon={Activity}
          colorTheme="green"
        />
        <StatCard
          title="Under Repair"
          value={stats.underRepair}
          Icon={Wrench}
          colorTheme="orange"
        />
        <StatCard
          title="Degraded / Broken"
          value={stats.faulty}
          Icon={AlertOctagon}
          colorTheme="purple"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Property Machinery & Asset Ledger"
          description="Central equipment inventory mapped across guest rooms, public areas, boilers, and utility rooms."
          badgeCount={filteredAssets.length}
          badgeLabel="assets"
        />

        {/* TABS */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Equipment <span className="tab-count-badge">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "operational" ? "active" : ""}`}
            onClick={() => setActiveTab("operational")}
          >
            Operational <span className="tab-count-badge">{stats.operational}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "under_repair" ? "active" : ""}`}
            onClick={() => setActiveTab("under_repair")}
          >
            Under Repair <span className="tab-count-badge">{stats.underRepair}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "faulty" ? "active" : ""}`}
            onClick={() => setActiveTab("faulty")}
          >
            Degraded / Faulty <span className="tab-count-badge">{stats.faulty}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "disposed" ? "active" : ""}`}
            onClick={() => setActiveTab("disposed")}
          >
            Disposed
          </button>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by code, equipment name, category, location, or serial..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
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
                <th style={{ width: "130px", minWidth: "130px" }}>Asset Code</th>
                <th style={{ minWidth: "220px" }}>Equipment Name & Category</th>
                <th style={{ minWidth: "170px" }}>Installed Location</th>
                <th style={{ minWidth: "160px" }}>Brand / Serial</th>
                <th style={{ minWidth: "140px" }}>Warranty Status</th>
                <th style={{ minWidth: "120px" }}>Health Status</th>
                <th style={{ width: "130px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading equipment registry...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No equipment found matching current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const room = getRoom(asset.room_id);
                  const st = String(asset.status || "operational").toLowerCase();
                  const isWarrantyExpired =
                    asset.warranty_expiry_date && new Date(asset.warranty_expiry_date) < new Date();

                  return (
                    <tr
                      key={asset.id}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(asset)}
                    >
                      <td>
                        <span className="booking-id-tag">{asset.asset_code}</span>
                      </td>

                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            <Boxes size={16} />
                          </div>
                          <div>
                            <span className="customer-name">{asset.name}</span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {asset.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {asset.room_id ? <BedDouble size={14} color="#2d5696" /> : <Building size={14} color="#64748b" />}
                          <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f172a" }}>
                            {room ? `Room ${room.room_number}` : asset.location || "Facility Common"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="bank-cell">
                          <span className="bank-primary">
                            {asset.manufacturer || "Generic"} {asset.model ? `(${asset.model})` : ""}
                          </span>
                          <span className="bank-sub" style={{ fontSize: "11px" }}>
                            SN: {asset.serial_number || "N/A"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="bank-cell">
                          <span
                            className="bank-primary"
                            style={{
                              fontSize: "12px",
                              color: isWarrantyExpired ? "#dc2626" : asset.warranty_expiry_date ? "#059669" : "#64748b",
                            }}
                          >
                            {asset.warranty_expiry_date
                              ? new Date(asset.warranty_expiry_date).toLocaleDateString()
                              : "Not Tracked"}
                          </span>
                          <span className="bank-sub" style={{ fontSize: "10.5px" }}>
                            {isWarrantyExpired ? "Expired" : asset.warranty_expiry_date ? "Active" : "Standard"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`mono-pill ${
                            st === "operational"
                              ? "pill-normal"
                              : st === "under_repair"
                              ? "pill-warning"
                              : st === "disposed"
                              ? "pill-neutral"
                              : "pill-urgent"
                          }`}
                        >
                          {st.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            title="View Lifecycle & Service History"
                            onClick={(e) => openHistoryModal(asset, e)}
                          >
                            <History size={13} color="#2d5696" />
                          </button>
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            title="View / Edit Asset"
                            onClick={() => openDetailsModal(asset)}
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

      {/* CREATE & EDIT ASSET MODAL */}
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
                  {!editingAsset
                    ? "Register Asset or Equipment"
                    : isEditing
                    ? `Edit Asset • ${editingAsset.asset_code}`
                    : `Asset • ${editingAsset.name} (${editingAsset.asset_code})`}
                </h2>
                {editingAsset && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to update specifications</p>
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
                <div className="form-row">
                  <div className="form-group">
                    <label>Equipment / Machine Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g., Daikin 1.5 Ton Inverter AC"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Asset Code / Tag (Optional)</label>
                    <input
                      type="text"
                      name="asset_code"
                      value={formData.asset_code}
                      onChange={handleInputChange}
                      placeholder="Leave blank for auto-generation (e.g. HVA-2026-0001)"
                      disabled={!isEditing || saving || Boolean(editingAsset)}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Equipment Category *</label>
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

                  <div className="form-group">
                    <label>Operational Status *</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Installed Room (Optional)</label>
                    <select
                      name="room_id"
                      value={formData.room_id}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                    >
                      <option value="">-- Facility / Common Area --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number} ({r.room_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Specific Location Notes</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g. Master Bedroom Wall / Roof Deck"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Manufacturer / Brand</label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      placeholder="e.g. Daikin, Cummins, Otis, Samsung"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Model Number</label>
                    <input
                      type="text"
                      name="model"
                      value={formData.model}
                      onChange={handleInputChange}
                      placeholder="e.g. FTKF50TV"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Serial Number</label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number}
                      onChange={handleInputChange}
                      placeholder="Hardware serial barcode string"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Installation Date</label>
                    <input
                      type="date"
                      name="installation_date"
                      value={formData.installation_date}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Warranty Expiry Date</label>
                  <input
                    type="date"
                    name="warranty_expiry_date"
                    value={formData.warranty_expiry_date}
                    onChange={handleInputChange}
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                <div className="form-group">
                  <label>Technical Specifications & Notes</label>
                  <textarea
                    name="notes"
                    rows="2"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Voltage requirements, service contracts, supplier references..."
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingAsset ? (
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
                      <Save size={14} /> {saving ? "Registering..." : "Register Asset"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET SERVICE HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: "660px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <History size={18} color="#2d5696" />
                <h2>Service Lifecycle & Expenditure</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              {loadingHistory ? (
                <p className="empty-state">Aggregating lifetime repairs and cost records...</p>
              ) : !historyData ? (
                <p className="empty-state">No service records found for this equipment.</p>
              ) : (
                <>
                  <div className="asset-history-stats-bar">
                    <div className="asset-history-col">
                      <span>Lifetime Repair Cost</span>
                      <strong style={{ color: "#166962" }}>
                        ₹{Number(historyData.total_maintenance_cost || 0).toFixed(2)}
                      </strong>
                    </div>
                    <div className="asset-history-col">
                      <span>Total Breakdown Events</span>
                      <strong>{historyData.total_service_records || 0} Incident(s)</strong>
                    </div>
                  </div>

                  {/* Work Orders List */}
                  <div className="asset-log-section">
                    <div className="asset-log-section-title">
                      <Wrench size={14} color="#2d5696" /> Executed Work Orders
                    </div>
                    {historyData.work_orders?.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>
                        No technical work orders recorded yet.
                      </p>
                    ) : (
                      historyData.work_orders.map((wo) => (
                        <div key={wo.id} className="asset-log-item">
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                              {wo.work_order_number} &bull; {wo.diagnosis || "Repair Work"}
                            </strong>
                            <span className="text-muted" style={{ fontSize: "11px" }}>
                              Status: {wo.status?.toUpperCase()} &bull; Completed:{" "}
                              {wo.completed_at ? new Date(wo.completed_at).toLocaleDateString() : "In-Flight"}
                            </span>
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#166962" }}>
                            ₹{Number(wo.total_cost || 0).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Incident Reports List */}
                  <div className="asset-log-section" style={{ marginTop: "6px" }}>
                    <div className="asset-log-section-title">
                      <AlertTriangle size={14} color="#d97706" /> Incident & Defect Reports
                    </div>
                    {historyData.requests?.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0, fontSize: "12px", fontStyle: "italic" }}>
                        No defect reports logged for this asset.
                      </p>
                    ) : (
                      historyData.requests.map((req) => (
                        <div key={req.id} className="asset-log-item">
                          <div>
                            <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
                              #{req.id} &bull; {req.title}
                            </strong>
                            <span className="text-muted" style={{ fontSize: "11px" }}>
                              Reported by {req.reported_by || "Staff"} on{" "}
                              {new Date(req.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="mono-pill pill-neutral">{req.status?.toUpperCase()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer" style={{ background: "#f8fafc" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setIsHistoryModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}