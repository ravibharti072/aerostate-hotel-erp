import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Scale,
  MinusCircle,
  AlertTriangle,
  XOctagon,
  IndianRupee,
  Briefcase,
  X,
  Save,
  Eye,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./stockAdjustments.css";

const adjustmentReasons = [
  "Audited Discrepancy",
  "Broken / Damaged",
  "Spilled / Wasted",
  "Expired / Spoiled",
  "Lost / Theft",
  "Correction Entry",
];

const initialAdjForm = {
  item_id: "",
  quantity: "1",
  reason: "Audited Discrepancy",
  reference: "",
};

export default function StockAdjustments() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [formData, setFormData] = useState(initialAdjForm);

  // Modal & View State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAdj, setSelectedAdj] = useState(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || items[0]?.hotel_id || 1;
  };

  const getApiErrorMessage = (error, fallback = "Something went wrong.") => {
    const detail = error?.response?.data?.detail;
    if (!detail) return error?.response?.data?.message || fallback;
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
    return [];
  };

  const getItem = (itemId) => {
    return items.find((i) => Number(i.id) === Number(itemId));
  };

  const getItemName = (itemId) => {
    const item = getItem(itemId);
    return item?.name || item?.item_name || `Item #${itemId}`;
  };

  const getItemUnit = (itemId) => {
    const item = getItem(itemId);
    return item?.unit || "Pcs";
  };

  const getItemPrice = (itemId) => {
    const item = getItem(itemId);
    return Number(item?.unit_price || 0);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [itemsRes, txRes] = await Promise.all([
        api.get("/inventory/items", { params }).catch(() => ({ data: [] })),
        api
          .get("/inventory/stock-transactions", {
            params: { ...params, transaction_type: "adjust" },
          })
          .catch(() => ({ data: [] })),
      ]);

      setItems(normalizeList(itemsRes.data, "items"));
      setAdjustments(normalizeList(txRes.data, "transactions"));
    } catch (err) {
      console.error("Fetch adjustments error:", err);
      showToast(getApiErrorMessage(err, "Failed to load adjustment logs."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary = useMemo(() => {
    const breakage = adjustments.filter(
      (a) =>
        String(a.reason).toLowerCase().includes("broken") ||
        String(a.reason).toLowerCase().includes("waste") ||
        String(a.reason).toLowerCase().includes("spill")
    ).length;

    const loss = adjustments.filter(
      (a) =>
        String(a.reason).toLowerCase().includes("lost") ||
        String(a.reason).toLowerCase().includes("theft")
    ).length;

    const totalLostVal = adjustments.reduce((sum, a) => {
      const price = getItemPrice(a.item_id);
      return sum + price * Number(a.quantity || 0);
    }, 0);

    return {
      total: adjustments.length,
      breakage,
      loss,
      totalLostVal,
    };
  }, [adjustments, items]);

  const filteredAdjustments = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let list = adjustments.filter((a) => {
      const name = getItemName(a.item_id).toLowerCase();
      const reason = String(a.reason || "").toLowerCase();
      const ref = String(a.reference || "").toLowerCase();
      const loggedBy = String(a.created_by || "").toLowerCase();
      const idStr = String(a.id || "");

      const matchesSearch =
        !search ||
        name.includes(search) ||
        reason.includes(search) ||
        ref.includes(search) ||
        loggedBy.includes(search) ||
        idStr.includes(search);

      const matchesReason =
        reasonFilter === "all" || reason === reasonFilter.toLowerCase();

      return matchesSearch && matchesReason;
    });

    list.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.id || 0) - Number(b.id || 0);
      if (sortBy === "qty_high") return Number(b.quantity || 0) - Number(a.quantity || 0);
      if (sortBy === "qty_low") return Number(a.quantity || 0) - Number(b.quantity || 0);
      return Number(b.id || 0) - Number(a.id || 0); // newest default
    });

    return list;
  }, [adjustments, items, searchTerm, reasonFilter, sortBy]);

  const selectedItemObj = useMemo(() => {
    return getItem(formData.item_id);
  }, [items, formData.item_id]);

  const openCreateModal = () => {
    setSelectedAdj(null);
    setFormData(initialAdjForm);
    setIsModalOpen(true);
  };

  const openViewModal = (adj) => {
    setSelectedAdj(adj);
    setFormData({
      item_id: adj.item_id,
      quantity: adj.quantity,
      reason: adj.reason || "Audited Discrepancy",
      reference: adj.reference || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setSelectedAdj(null);
    setFormData(initialAdjForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_id) {
      showToast("Please select an inventory item to adjust.", "error");
      return;
    }

    const qty = parseInt(formData.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast("Quantity must be greater than 0.", "error");
      return;
    }

    if (selectedItemObj && qty > Number(selectedItemObj.current_stock || 0)) {
      showToast(
        `Cannot deduct ${qty} units. System record shows only ${selectedItemObj.current_stock} units.`,
        "error"
      );
      return;
    }

    try {
      setSaving(true);
      await api.post("/inventory/stock-transactions", {
        item_id: Number(formData.item_id),
        transaction_type: "adjust",
        quantity: qty,
        reason: formData.reason,
        reference: formData.reference.trim() || "Audited Reconciliation",
        created_by: user?.username || "Auditor",
      });

      showToast("Inventory adjustment recorded successfully.", "success");
      closeModal();
      fetchData();
    } catch (err) {
      console.error("Save adjustment error:", err);
      showToast(getApiErrorMessage(err, "Failed to record adjustment."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setReasonFilter("all");
    setSortBy("newest");
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
        title="Stock Adjustments"
        kicker="INVENTORY • AUDIT & RECONCILIATION"
        description="Reconcile system counts with physical counts due to breakage, spoilage, or audit variances."
        icon={Scale}
        backPath="/dashboard"
        rightAction={
          <button
            type="button"
            className="portal-action-btn amber"
            onClick={openCreateModal}
          >
            <Plus size={16} /> Log Adjustment
          </button>
        }
      />

      {/* STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Adjustment Events"
          value={summary.total}
          Icon={Scale}
          colorTheme="blue"
        />
        <StatCard
          title="Breakage / Wastage"
          value={summary.breakage}
          Icon={AlertTriangle}
          colorTheme="purple"
        />
        <StatCard
          title="Lost / Theft"
          value={summary.loss}
          Icon={XOctagon}
          colorTheme="orange"
        />
        <StatCard
          title="Variance Valuation"
          value={`₹${summary.totalLostVal.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Variance Ledger"
          description="Physical count audit records, scrap logs, and missing inventory entries."
          badgeCount={filteredAdjustments.length}
          badgeLabel="adjustments"
        />

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by item name, reason, reference, or auditor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              className="dir-filter-select"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
            >
              <option value="all">All Reasons</option>
              {adjustmentReasons.map((r) => (
                <option key={r} value={r.toLowerCase()}>
                  {r}
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="qty_high">Highest Deduction</option>
              <option value="qty_low">Lowest Deduction</option>
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

        {/* TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th className="th-customer">Adjusted Item</th>
                <th className="th-phone">Reason</th>
                <th className="th-identity">Quantity Deducted</th>
                <th className="th-address">Reference / Audit Note</th>
                <th className="th-bank">Audited By</th>
                <th className="th-action"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading adjustment ledger...
                  </td>
                </tr>
              ) : filteredAdjustments.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No adjustment records found.
                  </td>
                </tr>
              ) : (
                filteredAdjustments.map((adj) => {
                  const initials = String(getItemName(adj.item_id)).charAt(0).toUpperCase();
                  const itemPrice = getItemPrice(adj.item_id);
                  const totalLost = itemPrice * Number(adj.quantity || 0);

                  const reasonStr = String(adj.reason || "");
                  const isBreakage =
                    reasonStr.toLowerCase().includes("broken") ||
                    reasonStr.toLowerCase().includes("waste") ||
                    reasonStr.toLowerCase().includes("spill");
                  const isLoss =
                    reasonStr.toLowerCase().includes("lost") ||
                    reasonStr.toLowerCase().includes("theft");

                  return (
                    <tr
                      key={adj.id}
                      className="dir-table-row"
                      onClick={() => openViewModal(adj)}
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">{initials}</div>
                          <div>
                            <span className="customer-name">{getItemName(adj.item_id)}</span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              Audit #{adj.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <span
                          className={`mono-pill ${
                            isLoss
                              ? "pill-urgent"
                              : isBreakage
                              ? "pill-warning"
                              : "pill-normal"
                          }`}
                        >
                          {adj.reason || "Audited Discrepancy"}
                        </span>
                      </td>

                      <td className="th-identity">
                        <div className="identity-pills-row">
                          <span
                            className="mono-pill pill-deduct"
                            style={{ fontWeight: 700 }}
                          >
                            -{adj.quantity} {getItemUnit(adj.item_id)}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11.5px" }}>
                            (₹{totalLost.toFixed(2)})
                          </span>
                        </div>
                      </td>

                      <td className="th-address">
                        <span
                          className="truncate-cell text-muted"
                          title={adj.reference || "Internal Audit"}
                        >
                          {adj.reference || "Internal Audit"}
                        </span>
                      </td>

                      <td className="th-bank">
                        <span className="text-muted" style={{ color: "#334155", fontWeight: 600 }}>
                          {adj.created_by || "Auditor"}
                        </span>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="dir-row-edit-btn"
                          onClick={() => openViewModal(adj)}
                          title="View Audit Details"
                        >
                          <Eye size={14} />
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

      {/* LOG / VIEW ADJUSTMENT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>
                  {selectedAdj
                    ? `Audit Entry Details (#${selectedAdj.id})`
                    : "Record Inventory Discrepancy"}
                </h2>
                {selectedAdj && (
                  <p className="modal-kicker">
                    Logged by {selectedAdj.created_by || "Auditor"}
                  </p>
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
                <div className="form-group">
                  <label>Select Item to Adjust *</label>
                  <select
                    name="item_id"
                    value={formData.item_id}
                    onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                    disabled={Boolean(selectedAdj) || saving}
                    className={`dir-select-field ${selectedAdj ? "input-locked" : ""}`}
                    required
                  >
                    <option value="">-- Choose registered SKU --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name || i.item_name} (SKU: {i.sku}) • Recorded Stock: {i.current_stock} {i.unit || "Pcs"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity to Deduct *</label>
                    <input
                      type="number"
                      min="1"
                      name="quantity"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="1"
                      disabled={Boolean(selectedAdj) || saving}
                      className={selectedAdj ? "input-locked" : ""}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Variance Reason *</label>
                    <select
                      name="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      disabled={Boolean(selectedAdj) || saving}
                      className={`dir-select-field ${selectedAdj ? "input-locked" : ""}`}
                      required
                    >
                      {adjustmentReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Reference # / Audit Log Note</label>
                  <input
                    type="text"
                    name="reference"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="e.g. Audit-Aug-Variance or Discard-Tray"
                    disabled={Boolean(selectedAdj) || saving}
                    className={selectedAdj ? "input-locked" : ""}
                  />
                </div>

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Adjustments reduce on-hand count to match physical reality. These entries cannot be deleted once finalized for accounting accuracy.
                  </span>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Close
                </button>

                {!selectedAdj && (
                  <button type="submit" className="btn-submit amber" disabled={saving}>
                    <MinusCircle size={14} /> {saving ? "Saving..." : "Record Adjustment"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}