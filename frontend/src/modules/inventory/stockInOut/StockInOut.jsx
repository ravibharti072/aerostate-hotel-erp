import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Package,
  Layers,
  X,
  Save,
  Briefcase,
  Eye,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./stockInOut.css";

const emptyMovementForm = {
  item_id: "",
  transaction_type: "receive",
  quantity: "1",
  reference: "",
  reason: "",
};

export default function StockInOut() {
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [formData, setFormData] = useState(emptyMovementForm);

  // Modal & View Mode State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
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

  const fetchData = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = hotelId ? { hotel_id: hotelId } : {};

      const [itemsRes, txRes] = await Promise.all([
        api.get("/inventory/items", { params }).catch(() => ({ data: [] })),
        api.get("/inventory/stock-transactions", { params }).catch(() => ({ data: [] })),
      ]);

      setItems(normalizeList(itemsRes.data, "items"));
      setTransactions(normalizeList(txRes.data, "transactions"));
    } catch (err) {
      console.error("Fetch stock movement error:", err);
      showToast(getApiErrorMessage(err, "Failed to load stock movement ledger."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary = useMemo(() => {
    const receiveLogs = transactions.filter((t) => t.transaction_type === "receive");
    const issueLogs = transactions.filter((t) => t.transaction_type === "issue");
    const totalReceived = receiveLogs.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const totalIssued = issueLogs.reduce((sum, t) => sum + Number(t.quantity || 0), 0);
    const activeItems = new Set(transactions.map((t) => t.item_id)).size;

    return {
      totalLogs: transactions.length,
      received: totalReceived,
      issued: totalIssued,
      activeItems,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let list = transactions.filter((tx) => {
      const name = getItemName(tx.item_id).toLowerCase();
      const ref = String(tx.reference || "").toLowerCase();
      const reason = String(tx.reason || "").toLowerCase();
      const loggedBy = String(tx.created_by || "").toLowerCase();
      const idStr = String(tx.id || "");

      const matchesSearch =
        !search ||
        name.includes(search) ||
        ref.includes(search) ||
        reason.includes(search) ||
        loggedBy.includes(search) ||
        idStr.includes(search);

      const matchesType = typeFilter === "all" || tx.transaction_type === typeFilter;

      return matchesSearch && matchesType;
    });

    list.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.id || 0) - Number(b.id || 0);
      if (sortBy === "qty_high") return Number(b.quantity || 0) - Number(a.quantity || 0);
      if (sortBy === "qty_low") return Number(a.quantity || 0) - Number(b.quantity || 0);
      return Number(b.id || 0) - Number(a.id || 0); // newest default
    });

    return list;
  }, [transactions, items, searchTerm, typeFilter, sortBy]);

  const selectedItemObj = useMemo(() => {
    return getItem(formData.item_id);
  }, [items, formData.item_id]);

  const openCreateModal = () => {
    setSelectedTx(null);
    setFormData(emptyMovementForm);
    setIsModalOpen(true);
  };

  const openViewModal = (tx) => {
    setSelectedTx(tx);
    setFormData({
      item_id: tx.item_id,
      transaction_type: tx.transaction_type,
      quantity: tx.quantity,
      reference: tx.reference || "",
      reason: tx.reason || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setSelectedTx(null);
    setFormData(emptyMovementForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item_id) {
      showToast("Please select an inventory item.", "error");
      return;
    }

    const qty = parseInt(formData.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      showToast("Quantity must be greater than 0.", "error");
      return;
    }

    if (formData.transaction_type === "issue" && selectedItemObj) {
      if (qty > Number(selectedItemObj.current_stock || 0)) {
        showToast(
          `Cannot issue ${qty} units. Only ${selectedItemObj.current_stock} units on hand.`,
          "error"
        );
        return;
      }
    }

    try {
      setSaving(true);
      await api.post("/inventory/stock-transactions", {
        item_id: Number(formData.item_id),
        transaction_type: formData.transaction_type,
        quantity: qty,
        reference: formData.reference.trim() || "Manual Log",
        reason: formData.reason.trim() || "Operational Restock / Issue",
        created_by: user?.username || "Staff",
      });

      showToast("Stock movement recorded successfully.", "success");
      closeModal();
      fetchData();
    } catch (err) {
      console.error("Save stock transaction error:", err);
      showToast(getApiErrorMessage(err, "Failed to record stock movement."), "error");
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
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
        title="Stock In / Out"
        kicker="INVENTORY • LOGISTICS"
        description="Log incoming replenishments from suppliers or issue goods and linens to hotel departments."
        icon={Clock}
        backPath="/dashboard"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={openCreateModal}
          >
            <Plus size={16} /> Log Movement
          </button>
        }
      />

      {/* STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Movement Logs"
          value={summary.totalLogs}
          Icon={Clock}
          colorTheme="blue"
        />
        <StatCard
          title="Units Received (+)"
          value={summary.received}
          Icon={TrendingUp}
          colorTheme="green"
        />
        <StatCard
          title="Units Issued (-)"
          value={summary.issued}
          Icon={TrendingDown}
          colorTheme="orange"
        />
        <StatCard
          title="Active SKUs Moved"
          value={summary.activeItems}
          Icon={Package}
          colorTheme="purple"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Movement Ledger"
          description="Chronological audit logs of goods received, issued, and departmentally consumed."
          badgeCount={filteredTransactions.length}
          badgeLabel="logs"
        />

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by item, reference, reason, or staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              className="dir-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Movement Types</option>
              <option value="receive">Receive (Stock In)</option>
              <option value="issue">Issue (Stock Out)</option>
              <option value="adjust">Adjustment</option>
            </select>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="qty_high">Highest Quantity</option>
              <option value="qty_low">Lowest Quantity</option>
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
                <th className="th-customer">Item</th>
                <th className="th-phone">Movement</th>
                <th className="th-identity">Quantity</th>
                <th className="th-address">Reference & Reason</th>
                <th className="th-bank">Logged By</th>
                <th className="th-action"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading movement ledger...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No movement records found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const initials = String(getItemName(tx.item_id)).charAt(0).toUpperCase();
                  const isReceive = tx.transaction_type === "receive";
                  const isIssue = tx.transaction_type === "issue";

                  return (
                    <tr
                      key={tx.id}
                      className="dir-table-row"
                      onClick={() => openViewModal(tx)}
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">{initials}</div>
                          <div>
                            <span className="customer-name">{getItemName(tx.item_id)}</span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              Log #{tx.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <span
                          className={`mono-pill ${
                            isReceive
                              ? "pill-receive"
                              : isIssue
                              ? "pill-issue"
                              : "pill-warning"
                          }`}
                        >
                          {tx.transaction_type ? tx.transaction_type.toUpperCase() : "MOVEMENT"}
                        </span>
                      </td>

                      <td className="th-identity">
                        <div className="identity-pills-row">
                          <span
                            className={`mono-pill ${
                              isReceive
                                ? "pill-receive"
                                : isIssue
                                ? "pill-issue"
                                : "pill-normal"
                            }`}
                            style={{ fontWeight: 700 }}
                          >
                            {isReceive ? `+${tx.quantity}` : `-${tx.quantity}`} {getItemUnit(tx.item_id)}
                          </span>
                        </div>
                      </td>

                      <td className="th-address">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            {tx.reason || "Operational Entry"}
                          </span>
                          <span className="bank-sub">
                            Ref: {tx.reference || "Internal"}
                          </span>
                        </div>
                      </td>

                      <td className="th-bank">
                        <span className="text-muted" style={{ color: "#334155", fontWeight: 600 }}>
                          {tx.created_by || "Staff"}
                        </span>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="dir-row-edit-btn"
                          onClick={() => openViewModal(tx)}
                          title="View Log Details"
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

      {/* LOG / VIEW MOVEMENT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            style={{ maxWidth: "640px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{selectedTx ? `Log Entry Details (#${selectedTx.id})` : "Record Stock Movement"}</h2>
                {selectedTx && (
                  <p className="modal-kicker">Audit Record • Logged by {selectedTx.created_by || "Staff"}</p>
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
                    <label>Movement Type *</label>
                    <select
                      name="transaction_type"
                      value={formData.transaction_type}
                      onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                      disabled={Boolean(selectedTx) || saving}
                      className={`dir-select-field ${selectedTx ? "input-locked" : ""}`}
                      required
                    >
                      <option value="receive">Receive / Restock (Add Quantity)</option>
                      <option value="issue">Issue / Consume (Deduct Quantity)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      name="quantity"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="1"
                      disabled={Boolean(selectedTx) || saving}
                      className={selectedTx ? "input-locked" : ""}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Select Inventory Item *</label>
                  <select
                    name="item_id"
                    value={formData.item_id}
                    onChange={(e) => setFormData({ ...formData, item_id: e.target.value })}
                    disabled={Boolean(selectedTx) || saving}
                    className={`dir-select-field ${selectedTx ? "input-locked" : ""}`}
                    required
                  >
                    <option value="">-- Choose registered SKU --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name || i.item_name} (SKU: {i.sku}) • Current Available: {i.current_stock} {i.unit || "Pcs"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Reference # / PO / Order</label>
                    <input
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      placeholder="e.g. PO-9801, Room 204, Delivery Note"
                      disabled={Boolean(selectedTx) || saving}
                      className={selectedTx ? "input-locked" : ""}
                    />
                  </div>

                  <div className="form-group">
                    <label>Reason / Department</label>
                    <input
                      type="text"
                      name="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="e.g. Linen change, supplier restock"
                      disabled={Boolean(selectedTx) || saving}
                      className={selectedTx ? "input-locked" : ""}
                    />
                  </div>
                </div>

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Receiving increases current on-hand counts. Issuing deducts inventory counts based on hotel and department consumption.
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

                {!selectedTx && (
                  <button type="submit" className="btn-submit" disabled={saving}>
                    <Save size={14} /> {saving ? "Saving..." : "Confirm Movement"}
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