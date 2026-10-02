import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Package,
  AlertTriangle,
  Hourglass,
  Layers,
  IndianRupee,
  ShoppingCart,
  Phone,
  Briefcase,
  X,
  Save,
  CheckCircle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./lowStock.css";

const CATEGORIES = [
  "Housekeeping",
  "Linens",
  "Toiletries",
  "Groceries",
  "Dairy",
  "Produce",
  "Beverages",
  "Disposables",
  "Maintenance",
  "Stationery",
  "General",
];

export default function LowStock() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("deficit_high");

  // Procurement Action Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [poForm, setPoForm] = useState({
    supplier_name: "",
    supplier_contact: "",
    order_quantity: 1,
    notes: "",
  });

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const fetchLowStock = async () => {
    try {
      setLoading(true);
      const hotelId = getLoggedInHotelId();
      const params = { low_stock_only: true };
      if (hotelId) params.hotel_id = hotelId;

      const res = await api.get("/inventory/items", { params });
      setItems(normalizeList(res.data, "items"));
    } catch (err) {
      console.error("Fetch low stock error:", err);
      showToast(getApiErrorMessage(err, "Failed to load low stock alerts."), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLowStock();
  }, []);

  const summary = useMemo(() => {
    const total = items.length;
    const outOfStock = items.filter((i) => Number(i.current_stock || 0) <= 0).length;
    const hkAlerts = items.filter((i) =>
      ["Housekeeping", "Linens", "Toiletries"].includes(i.category)
    ).length;

    const reorderValuation = items.reduce((sum, i) => {
      const deficit = Math.max(
        0,
        Number(i.min_stock_level || 0) - Number(i.current_stock || 0)
      );
      return sum + deficit * Number(i.unit_price || 0);
    }, 0);

    return { total, outOfStock, hkAlerts, reorderValuation };
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    let list = items.filter((item) => {
      const name = String(item.name || item.item_name || "").toLowerCase();
      const sku = String(item.sku || "").toLowerCase();
      const cat = String(item.category || "").toLowerCase();

      const matchesSearch = !search || name.includes(search) || sku.includes(search);
      const matchesCategory =
        categoryFilter === "all" || cat === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });

    list.sort((a, b) => {
      const defA = Math.max(0, Number(a.min_stock_level || 0) - Number(a.current_stock || 0));
      const defB = Math.max(0, Number(b.min_stock_level || 0) - Number(b.current_stock || 0));

      if (sortBy === "deficit_low") return defA - defB;
      if (sortBy === "stock_low") return Number(a.current_stock || 0) - Number(b.current_stock || 0);
      if (sortBy === "name_asc") {
        return String(a.name || a.item_name || "").localeCompare(String(b.name || b.item_name || ""));
      }
      return defB - defA; // default deficit_high
    });

    return list;
  }, [items, searchTerm, categoryFilter, sortBy]);

  const openPoModal = (item) => {
    const deficit = Math.max(1, Number(item.min_stock_level || 0) - Number(item.current_stock || 0));
    setSelectedItem(item);
    setPoForm({
      supplier_name: item.supplier_name || "",
      supplier_contact: item.supplier_contact || "",
      order_quantity: deficit,
      notes: `Restock request for ${item.name || item.item_name} (SKU: ${item.sku})`,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleCreatePR = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      setSubmitting(true);
      const resolvedHotelId = Number(getLoggedInHotelId() || selectedItem.hotel_id || 1);

      // Check or find/create vendor
      let vendorId = null;
      try {
        const vendorsRes = await api.get("/vendors", { params: { hotel_id: resolvedHotelId } });
        const vendorList = normalizeList(vendorsRes.data, "vendors");
        const preferredName = (poForm.supplier_name || "").trim().toLowerCase();
        const preferredPhone = (poForm.supplier_contact || "").trim();

        const match = vendorList.find(
          (v) =>
            (preferredName && v.vendor_name?.toLowerCase() === preferredName) ||
            (preferredPhone && v.phone === preferredPhone)
        );

        if (match) {
          vendorId = match.id;
        } else {
          // Register vendor automatically if name provided or default
          const newVendorRes = await api.post("/vendors", {
            hotel_id: resolvedHotelId,
            vendor_name: (poForm.supplier_name || "").trim() || `${selectedItem.name || selectedItem.item_name} Supplier`,
            contact_person: "Procurement Desk",
            phone: preferredPhone || `+91-${Date.now().toString().slice(-10)}`,
            email: "vendor@hotel-procurement.internal",
            vendor_type: selectedItem.category || "General",
            status: "active",
          });
          vendorId = newVendorRes.data?.id;
        }
      } catch (vendErr) {
        console.warn("Could not auto-resolve vendor:", vendErr);
      }

      if (!vendorId) {
        showToast("Could not determine or create supplier for this purchase order.", "error");
        return;
      }

      const poPayload = {
        hotel_id: resolvedHotelId,
        vendor_id: vendorId,
        status: "ordered",
        payment_status: "pending",
        discount: 0,
        notes: poForm.notes || `Low stock replenishment for ${selectedItem.name || selectedItem.item_name}`,
        created_by: user?.full_name || user?.username || "Inventory Manager",
        items: [
          {
            item_id: selectedItem.id,
            quantity: Number(poForm.order_quantity || 1),
            unit_price: Number(selectedItem.unit_price || selectedItem.average_cost || 10),
            tax_percent: 0,
          },
        ],
      };

      await api.post("/purchase-orders", poPayload);
      showToast(
        `Purchase Order created in Procurement for ${poForm.order_quantity} ${selectedItem.unit || "Pcs"} of ${
          selectedItem.name || selectedItem.item_name
        }!`,
        "success"
      );
      closeModal();
    } catch (err) {
      console.error(err);
      showToast(getApiErrorMessage(err, "Failed to initiate replenishment order."), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCategoryFilter("all");
    setSortBy("deficit_high");
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
        title="Low Stock Alerts"
        kicker="INVENTORY • REPLENISHMENT"
        description="Monitor critical inventory shortages, depleted stock, and initiate replenishment procurement."
        icon={AlertTriangle}
        backPath="/dashboard"
        rightAction={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="portal-action-btn secondary"
              onClick={() => navigate("/procurement")}
            >
              <ShoppingCart size={16} /> Procurement & POs
            </button>
            <button
              type="button"
              className="portal-action-btn amber"
              onClick={() => navigate("/inventory/directory")}
            >
              <Package size={16} /> Master Catalog
            </button>
          </div>
        }
      />

      {/* STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Active Alerts"
          value={summary.total}
          Icon={AlertTriangle}
          colorTheme="purple"
        />
        <StatCard
          title="Depleted (0 Units)"
          value={summary.outOfStock}
          Icon={Hourglass}
          colorTheme="orange"
        />
        <StatCard
          title="Housekeeping Deficits"
          value={summary.hkAlerts}
          Icon={Layers}
          colorTheme="blue"
        />
        <StatCard
          title="Est. Restock Budget"
          value={`₹${summary.reorderValuation.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Replenishment Alert List"
          description="Catalog items currently at or below their assigned minimum safety threshold."
          badgeCount={filteredItems.length}
          badgeLabel="alerts"
        />

        {/* CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by SKU, item name, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              className="dir-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c.toLowerCase()}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="deficit_high">Highest Deficit</option>
              <option value="deficit_low">Lowest Deficit</option>
              <option value="stock_low">Lowest On-Hand</option>
              <option value="name_asc">Name A-Z</option>
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
                <th className="th-customer">Low Item</th>
                <th className="th-phone">SKU / Code</th>
                <th className="th-address">Category</th>
                <th className="th-identity">On-Hand / Min</th>
                <th className="th-bank">Deficit Needed</th>
                <th className="th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Analyzing safety stock thresholds...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state" style={{ color: "#166962" }}>
                    <CheckCircle size={24} style={{ display: "block", margin: "0 auto 8px", color: "#166962" }} />
                    Inventory is healthy! No items currently fall below minimum reorder thresholds.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const initials = String(item.name || item.item_name || "I").charAt(0).toUpperCase();
                  const stock = Number(item.current_stock || 0);
                  const min = Number(item.min_stock_level || 0);
                  const isOut = stock <= 0;
                  const deficit = Math.max(0, min - stock);
                  const estCost = deficit * Number(item.unit_price || 0);

                  return (
                    <tr
                      key={item.id || item.sku}
                      className="dir-table-row"
                      onClick={() => openPoModal(item)}
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">{initials}</div>
                          <div>
                            <span className="customer-name">
                              {item.name || item.item_name || "Unnamed Item"}
                            </span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              Est: ₹{estCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <span className="mono-pill" title="SKU">
                          {item.sku || "N/A"}
                        </span>
                      </td>

                      <td className="th-address">
                        <span className="truncate-cell text-muted" title={item.category || "General"}>
                          {item.category || "General"}
                        </span>
                      </td>

                      <td className="th-identity">
                        <div className="identity-pills-row">
                          <span
                            className={`mono-pill ${isOut ? "pill-urgent" : "pill-warning"}`}
                            style={{ fontWeight: 700 }}
                          >
                            {stock} {item.unit || "Pcs"}
                          </span>
                          <span className="text-muted" style={{ fontSize: "11.5px" }}>
                            / Min: {min}
                          </span>
                        </div>
                      </td>

                      <td className="th-bank">
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: "#dc2626" }}>
                            +{deficit} {item.unit || "Pcs"}
                          </span>
                          <span className="bank-sub">
                            ₹{Number(item.unit_price || 0).toFixed(2)}/unit
                          </span>
                        </div>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="dir-row-edit-btn pr-action-btn"
                          onClick={() => openPoModal(item)}
                          title="Generate Purchase Request"
                        >
                          <ShoppingCart size={14} />
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

      {/* CREATE PURCHASE REQUEST MODAL */}
      {isModalOpen && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            style={{ maxWidth: "620px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Replenishment Request (PR)</h2>
                <p className="modal-kicker">
                  SKU: {selectedItem.sku} • On-Hand: {selectedItem.current_stock} {selectedItem.unit || "Pcs"}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreatePR}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Item Name</label>
                  <input
                    type="text"
                    value={selectedItem.name || selectedItem.item_name}
                    disabled
                    className="input-locked"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Order Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      name="order_quantity"
                      value={poForm.order_quantity}
                      onChange={(e) => setPoForm({ ...poForm, order_quantity: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Est. Unit Cost (₹)</label>
                    <input
                      type="text"
                      value={`₹${Number(selectedItem.unit_price || 0).toFixed(2)} / ${selectedItem.unit || "Pcs"}`}
                      disabled
                      className="input-locked"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Preferred Supplier / Vendor</label>
                    <input
                      type="text"
                      placeholder="e.g. City Wholesale Supplies"
                      value={poForm.supplier_name}
                      onChange={(e) => setPoForm({ ...poForm, supplier_name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Supplier Contact Phone</label>
                    <input
                      type="text"
                      placeholder="+91 98765 43210"
                      value={poForm.supplier_contact}
                      onChange={(e) => setPoForm({ ...poForm, supplier_contact: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Order Notes / Department Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Urgent linen replenishment for weekend occupancy"
                    value={poForm.notes}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  />
                </div>

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Submitting creates an internal procurement purchase request (PR). When deliveries arrive, record them in Stock In to update inventory.
                  </span>
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button type="submit" className="btn-submit" disabled={submitting}>
                  <ShoppingCart size={14} /> {submitting ? "Initiating..." : "Create Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}