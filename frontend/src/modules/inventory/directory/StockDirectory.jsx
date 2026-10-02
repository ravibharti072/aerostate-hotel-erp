import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  Plus,
  Package,
  X,
  Edit2,
  Layers,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Briefcase,
  Save,
  Trash2,
  Lock,
  Shield,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./stockDirectory.css";

// Simplified, concise category structure
const CATEGORY_GROUPS = [
  {
    group: "Rooms & Housekeeping",
    categories: ["Housekeeping", "Linens", "Toiletries"],
  },
  {
    group: "Kitchen & F&B",
    categories: ["Groceries", "Dairy", "Produce", "Beverages", "Disposables"],
  },
  {
    group: "Operations & Maintenance",
    categories: ["Maintenance", "Stationery", "General"],
  },
];

// Capitalized, standardized units
const UNIT_OPTIONS = [
  {
    group: "Count / Pieces",
    units: ["Pcs", "Pack", "Box", "Set", "Bottle", "Can", "Roll"],
  },
  {
    group: "Weight",
    units: ["Kg", "Gm"],
  },
  {
    group: "Volume",
    units: ["Ltr", "Ml"],
  },
];

const emptyForm = {
  sku: "",
  name: "",
  category: "Housekeeping",
  min_stock_level: "5",
  unit: "Pcs",
  unit_price: "",
};

export default function StockDirectory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");

  // Modal & Mode states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState(emptyForm);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || items[0]?.hotel_id || null;
  };

  const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
    const detail = error?.response?.data?.detail;
    if (!detail) return error?.response?.data?.message || error?.message || fallback;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((err) => {
          const field = Array.isArray(err.loc) ? err.loc.join(" → ") : "field";
          return `${field}: ${err.msg}`;
        })
        .join("\n");
    }
    if (typeof detail === "object") return JSON.stringify(detail, null, 2);
    return String(detail);
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};
      const response = await api.get("/inventory/items", { params });

      const loadedItems = normalizeList(response.data, "items");
      setItems(loadedItems);
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
      showToast(getApiErrorMessage(error, "Unable to load inventory items."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const summary = useMemo(() => {
    const total = items.length;
    const low = items.filter(
      (i) => Number(i.current_stock) > 0 && Number(i.current_stock) <= Number(i.min_stock_level || i.reorder_level || 0)
    ).length;
    const out = items.filter((i) => Number(i.current_stock) <= 0).length;
    const adequate = total - (low + out);
    const totalValue = items.reduce(
      (sum, i) => sum + Number(i.unit_price || i.average_cost || 0) * Number(i.current_stock || 0),
      0
    );
    return { total, adequate, low, totalValue };
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let list = items.filter((item) => {
      if (!search) return true;
      return (
        String(item.name || item.item_name || "").toLowerCase().includes(search) ||
        String(item.sku || "").toLowerCase().includes(search) ||
        String(item.category || item.category_name || "").toLowerCase().includes(search) ||
        String(item.unit || item.unit_name || "").toLowerCase().includes(search)
      );
    });

    list = list.filter((item) => {
      const stock = Number(item.current_stock || 0);
      const minStock = Number(item.min_stock_level || item.reorder_level || 0);

      if (filterBy === "in_stock") return stock > minStock;
      if (filterBy === "low_stock") return stock > 0 && stock <= minStock;
      if (filterBy === "out_of_stock") return stock <= 0;
      return true;
    });

    list.sort((a, b) => {
      const nameA = String(a.name || a.item_name || "");
      const nameB = String(b.name || b.item_name || "");

      if (sortBy === "name_desc") return nameB.localeCompare(nameA, "en", { sensitivity: "base" });
      if (sortBy === "stock_high") return Number(b.current_stock || 0) - Number(a.current_stock || 0);
      if (sortBy === "stock_low") return Number(a.current_stock || 0) - Number(b.current_stock || 0);
      if (sortBy === "newest") return Number(b.id || 0) - Number(a.id || 0);
      return nameA.localeCompare(nameB, "en", { sensitivity: "base" });
    });

    return list;
  }, [items, searchTerm, filterBy, sortBy]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "sku" ? value.toUpperCase() : value,
    }));
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetailsModal = (item) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku || "",
      name: item.name || item.item_name || "",
      category: item.category || item.category_name || "Housekeeping",
      min_stock_level: String(item.min_stock_level ?? item.reorder_level ?? 5),
      unit: item.unit || item.unit_name || "Pcs",
      unit_price: String(item.unit_price ?? item.average_cost ?? 0),
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving || deleting) return;
    setIsModalOpen(false);
    setEditingItem(null);
    setIsEditing(false);
    setFormData(emptyForm);
  };

  const handleCancelEdit = () => {
    if (editingItem) {
      setFormData({
        sku: editingItem.sku || "",
        name: editingItem.name || editingItem.item_name || "",
        category: editingItem.category || editingItem.category_name || "Housekeeping",
        min_stock_level: String(editingItem.min_stock_level ?? editingItem.reorder_level ?? 5),
        unit: editingItem.unit || editingItem.unit_name || "Pcs",
        unit_price: String(editingItem.unit_price ?? editingItem.average_cost ?? 0),
      });
      setIsEditing(false);
    } else {
      closeModal();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const hotelIdNum = Number(getLoggedInHotelId() || items[0]?.hotel_id || 1);
    if (!hotelIdNum) {
      showToast("Hotel ID not resolved. Please re-login.", "error");
      return;
    }

    const payload = {
      hotel_id: hotelIdNum,
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      category: formData.category,
      min_stock_level: Number(formData.min_stock_level || 0),
      unit: formData.unit || "Pcs",
      unit_price: Number(formData.unit_price || 0),
      average_cost: Number(formData.unit_price || 0),
      reorder_level: Number(formData.min_stock_level || 5),
    };

    if (!editingItem) {
      payload.current_stock = 0;
      payload.opening_stock = 0;
    }

    if (!payload.sku || !payload.name) {
      showToast("Please enter SKU and Item Name.", "error");
      return;
    }

    try {
      setSaving(true);
      if (editingItem?.id) {
        await api.put(`/inventory/items/${editingItem.id}`, payload);
        showToast("Item updated successfully.", "success");
      } else {
        await api.post("/inventory/items", payload);
        showToast("Item registered successfully.", "success");
      }
      closeModal();
      fetchItems();
    } catch (error) {
      console.error("Error saving item:", error);
      showToast(getApiErrorMessage(error, "Inventory item could not be saved."), "error");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirmation = () => {
    setAdminPassword("");
    setIsDeleteModalOpen(true);
  };

  const closeDeleteConfirmation = () => {
    if (deleting) return;
    setIsDeleteModalOpen(false);
    setAdminPassword("");
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      showToast("Please enter admin password.", "error");
      return;
    }

    try {
      setDeleting(true);
      await api.delete(`/inventory/items/${editingItem.id}`, {
        data: { admin_password: adminPassword },
      });
      showToast("Item deleted successfully.", "success");
      setIsDeleteModalOpen(false);
      closeModal();
      fetchItems();
    } catch (error) {
      console.error("Delete error:", error);
      showToast(getApiErrorMessage(error, "Invalid admin password or item has movement history."), "error");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterBy("all");
    setSortBy("name_asc");
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
        title="Stock Directory"
        kicker="INVENTORY • CATALOG"
        description="Register inventory items, track catalog SKUs, and manage minimum reorder thresholds."
        icon={Package}
        backPath="/dashboard"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={openCreateModal}
          >
            <Plus size={16} /> Register Item
          </button>
        }
      />

      {/* STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total SKUs"
          value={summary.total}
          Icon={Layers}
          colorTheme="blue"
        />
        <StatCard
          title="Adequate Stock"
          value={summary.adequate}
          Icon={CheckCircle2}
          colorTheme="green"
        />
        <StatCard
          title="Low Stock Alerts"
          value={summary.low}
          Icon={AlertTriangle}
          colorTheme="purple"
        />
        <StatCard
          title="Catalog Valuation"
          value={`₹${summary.totalValue.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="orange"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Inventory Catalog"
          description="Master items, on-hand counts, categories, and unit pricing."
          badgeCount={filteredItems.length}
          badgeLabel="items"
        />

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by SKU, item name, category, or unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              className="dir-filter-select"
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
              <option value="stock_high">Highest Stock</option>
              <option value="stock_low">Lowest Stock</option>
              <option value="newest">Newest First</option>
            </select>

            <button
              type="button"
              className="btn-cancel"
              style={{ height: "38px", padding: "0 16px" }}
              onClick={clearFilters}
            >
              Clear
            </button>
          </div>
        </div>

        {/* INVENTORY TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th className="th-customer">Item</th>
                <th className="th-phone">SKU / Code</th>
                <th className="th-address">Category</th>
                <th className="th-identity">Stock / Min</th>
                <th className="th-bank">Unit Price</th>
                <th className="th-action"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading inventory items...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No registered inventory items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const initials = String(item.name || item.item_name || "I")
                    .charAt(0)
                    .toUpperCase();
                  const stock = Number(item.current_stock || 0);
                  const min = Number(item.min_stock_level ?? item.reorder_level ?? 0);
                  const isOut = stock <= 0;
                  const isLow = !isOut && stock <= min;
                  const unitPrice = Number(item.unit_price ?? item.average_cost ?? 0);

                  return (
                    <tr
                      key={item.id || item.sku}
                      className="dir-table-row"
                      onClick={() => openDetailsModal(item)}
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">{initials}</div>
                          <span className="customer-name">
                            {item.name || item.item_name || "Unnamed Item"}
                          </span>
                        </div>
                      </td>

                      <td className="th-phone">
                        <span className="mono-pill" title="SKU">
                          {item.sku || "N/A"}
                        </span>
                      </td>

                      <td className="th-address">
                        <span className="truncate-cell text-muted" title={item.category || item.category_name || "General"}>
                          {item.category || item.category_name || "General"}
                        </span>
                      </td>

                      <td className="th-identity">
                        <div className="identity-pills-row">
                          <span
                            className={`mono-pill ${isOut ? "pill-urgent" : isLow ? "pill-warning" : "pill-normal"
                              }`}
                          >
                            {stock} {item.unit || item.unit_name || "Pcs"}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11.5px" }}>
                            / Min: {min}
                          </span>
                        </div>
                      </td>

                      <td className="th-bank">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            ₹{unitPrice.toFixed(2)}
                          </span>
                          <span className="bank-sub">Per {item.unit || item.unit_name || "Pcs"}</span>
                        </div>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="dir-row-edit-btn"
                          onClick={() => openDetailsModal(item)}
                          title="View / Edit Item"
                        >
                          <Edit2 size={14} />
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

      {/* DETAILS & EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            style={{ maxWidth: "680px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {!editingItem
                    ? "Register New Item"
                    : isEditing
                      ? "Edit Inventory Item"
                      : "Item Details"}
                </h2>
                {editingItem && !isEditing && (
                  <p className="modal-kicker">Read-Only Mode • Click 'Edit Details' to make changes</p>
                )}
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>SKU / Barcode *</label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      placeholder="e.g. 001 / LIN-BED-01"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Department / Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {CATEGORY_GROUPS.map((grp) => (
                        <optgroup key={grp.group} label={grp.group}>
                          {grp.categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Bed Sheet (King)"
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Unit of Measure *</label>
                    <select
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
                      disabled={!isEditing || saving}
                      className={`dir-select-field ${!isEditing ? "input-locked" : ""}`}
                      required
                    >
                      {UNIT_OPTIONS.map((grp) => (
                        <optgroup key={grp.group} label={grp.group}>
                          {grp.units.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Min Alert Level *</label>
                    <input
                      type="number"
                      step="any"
                      name="min_stock_level"
                      value={formData.min_stock_level}
                      onChange={handleInputChange}
                      placeholder="5"
                      disabled={!isEditing || saving}
                      className={!isEditing ? "input-locked" : ""}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="unit_price"
                    value={formData.unit_price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    disabled={!isEditing || saving}
                    className={!isEditing ? "input-locked" : ""}
                  />
                </div>

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Initial stock is automatically set to 0 and managed via Stock In/Out and Adjustments modules. Unit prices determine asset valuation.
                  </span>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                {editingItem ? (
                  <>
                    <div className="footer-left">
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeleteConfirmation();
                        }}
                        disabled={saving}
                      >
                        <Trash2 size={14} /> Delete Item
                      </button>
                    </div>

                    <div className="footer-right">
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            className="btn-cancel"
                            onClick={(e) => {
                              e.preventDefault();
                              closeModal();
                            }}
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            className="btn-submit"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
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
                            onClick={(e) => {
                              e.preventDefault();
                              handleCancelEdit();
                            }}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="btn-submit"
                            disabled={saving}
                          >
                            <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="footer-right" style={{ width: "100%", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={(e) => {
                        e.preventDefault();
                        closeModal();
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-submit" disabled={saving}>
                      <Save size={14} /> {saving ? "Saving..." : "Register Item"}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="modal-overlay nested-modal" onClick={closeDeleteConfirmation}>
          <div
            className="modal-content delete-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Shield size={18} color="#dc2626" />
                <h2 style={{ fontSize: "16px", color: "#dc2626" }}>Confirm Deletion</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeDeleteConfirmation}
                disabled={deleting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete}>
              <div className="modal-body" style={{ gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                  Are you sure you want to permanently delete item{" "}
                  <strong>{editingItem?.name || editingItem?.item_name}</strong>? This action cannot be undone.
                </p>

                <div className="form-group" style={{ marginTop: "6px" }}>
                  <label style={{ fontSize: "12px", color: "#0f172a" }}>
                    Enter Admin Password to proceed *
                  </label>
                  <div className="password-input-wrap">
                    <Lock size={14} className="password-icon" />
                    <input
                      type="password"
                      className="asr-input"
                      style={{ paddingLeft: "34px" }}
                      placeholder="Admin Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      disabled={deleting}
                      autoFocus
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ background: "#f8fafc" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeDeleteConfirmation}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger"
                  disabled={deleting || !adminPassword.trim()}
                >
                  <Trash2 size={14} /> {deleting ? "Deleting..." : "Delete Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}