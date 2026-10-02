import React, { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  ShoppingCart,
  CheckCircle2,
  Clock,
  IndianRupee,
  PackageCheck,
  Building2,
  Phone,
  Trash2,
  Edit2,
  Eye,
  X,
  Save,
  Layers,
  FileText,
  AlertTriangle,
  Briefcase,
  Printer,
  CreditCard,
  Send,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./procurement.css";

const VENDOR_TYPES = [
  "Food & Beverage",
  "Housekeeping & Linens",
  "Maintenance & Hardware",
  "Stationery & Office",
  "Beverages & Bar",
  "IT & Electronics",
  "General Supplier",
];

const PAYMENT_TERMS_OPTIONS = [
  "Due on Receipt",
  "Net 15 Days",
  "Net 30 Days",
  "Net 60 Days",
  "Advance Payment",
  "Cash on Delivery",
];

const emptyVendorForm = {
  vendor_name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  gst_number: "",
  vendor_type: "Food & Beverage",
  payment_terms: "Net 30 Days",
  status: "active",
  remarks: "",
};

const emptyPOForm = {
  vendor_id: "",
  expected_delivery_date: "",
  discount: "0",
  notes: "",
  items: [{ item_id: "", quantity: "1", unit_price: "0", tax_percent: "0" }],
};

export default function ProcurementPage() {
  const { user, hotelInfo } = useAuth();
  const hotelId =
    user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;

  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "vendors"
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Modals state
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isPODetailModalOpen, setIsPODetailModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);

  const [editingVendor, setEditingVendor] = useState(null);
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [poForm, setPoForm] = useState(emptyPOForm);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receiveRemarks, setReceiveRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  // Fetch initial data
  const fetchData = async () => {
    if (!hotelId && user?.role !== "super-admin") return;
    setLoading(true);
    try {
      const params = hotelId ? { hotel_id: hotelId } : {};
      const [vRes, poRes, itemsRes] = await Promise.all([
        api.get("/vendors", { params }).catch(() => ({ data: [] })),
        api.get("/purchase-orders", { params }).catch(() => ({ data: [] })),
        api.get("/inventory/items", { params }).catch(() => ({ data: [] })),
      ]);

      setVendors(normalizeList(vRes.data, "vendors"));
      setPurchaseOrders(normalizeList(poRes.data, "orders"));
      setInventoryItems(normalizeList(itemsRes.data, "items"));
    } catch (err) {
      console.error("Error loading procurement data:", err);
      showToast("Failed to load procurement records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId, user?.role]);

  // Update PO Payment Status & Link to Accounts
  const handleUpdatePaymentStatus = async (poId, newPaymentStatus) => {
    try {
      setSubmitting(true);
      await api.put(`/purchase-orders/${poId}`, { payment_status: newPaymentStatus });
      showToast(
        newPaymentStatus === "paid"
          ? "Payment marked as Paid and recorded in Accounts!"
          : `Payment status updated to ${newPaymentStatus}`
      );
      if (selectedPO?.id === poId) {
        setSelectedPO((prev) => ({ ...prev, payment_status: newPaymentStatus }));
      }
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Failed to update payment status", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Print Official Purchase Order
  const handlePrintPO = (po) => {
    if (!po) return;
    const vendor = vendors.find((v) => v.id === po.vendor_id) || po.vendor;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }
    const itemsHtml = (po.items || [])
      .map(
        (it, idx) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${idx + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>${it.item_name || it.item?.name || "Item"}</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${it.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₹${Number(it.unit_price || 0).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${it.tax_percent || 0}%</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;"><strong>₹${Number(it.total || 0).toFixed(2)}</strong></td>
        </tr>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Purchase Order - ${po.po_number}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: auto; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #2d5696; padding-bottom: 20px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #2d5696; margin: 0; }
          .po-meta { font-size: 14px; color: #64748b; margin-top: 4px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
          .card h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
          .summary { margin-left: auto; width: 300px; }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
          .summary-row.total { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 800; color: #0f172a; padding-top: 10px; }
          .footer { margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${hotelInfo?.name || user?.hotel?.name || user?.hotel_name || "HOTEL ERP"}</h1>
            <div class="po-meta">Official Purchase Order</div>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 20px; color: #0f172a;">${po.po_number}</h2>
            <div class="po-meta">Date: ${po.order_date ? po.order_date.slice(0, 10) : new Date().toISOString().slice(0, 10)}</div>
            <div class="po-meta">Status: <strong style="text-transform: uppercase;">${po.status}</strong></div>
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h4>Vendor / Supplier</h4>
            <div style="font-weight: 700; font-size: 15px;">${vendor?.vendor_name || "Supplier"}</div>
            <div>Contact: ${vendor?.contact_person || "N/A"}</div>
            <div>Phone: ${vendor?.phone || "N/A"}</div>
            <div>Email: ${vendor?.email || "N/A"}</div>
            <div>GST: ${vendor?.gst_number || "N/A"}</div>
          </div>
          <div class="card">
            <h4>Delivery & Terms</h4>
            <div>Expected: <strong>${po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : "Immediate"}</strong></div>
            <div>Payment Terms: ${vendor?.payment_terms || "Net 30 Days"}</div>
            <div>Payment Status: <strong style="text-transform: capitalize;">${po.payment_status || "Pending"}</strong></div>
            <div>Notes: ${po.notes || "None"}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Rate</th>
              <th style="text-align: right;">Tax %</th>
              <th style="text-align: right;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="summary">
          <div class="summary-row"><span>Subtotal:</span><span>₹${Number(po.subtotal || 0).toFixed(2)}</span></div>
          <div class="summary-row"><span>Tax Amount:</span><span>₹${Number(po.tax_amount || 0).toFixed(2)}</span></div>
          ${po.discount > 0 ? `<div class="summary-row"><span>Discount:</span><span>-₹${Number(po.discount || 0).toFixed(2)}</span></div>` : ""}
          <div class="summary-row total"><span>Grand Total:</span><span>₹${Number(po.grand_total || 0).toFixed(2)}</span></div>
        </div>

        <div class="footer">
          This is a computer-generated Purchase Order issued via ${hotelInfo?.name || "Hotel PMS ERP"}. For inquiries, contact procurement desk.
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const totalPOs = purchaseOrders.length;
    const pendingPOs = purchaseOrders.filter((p) => p.status === "ordered" || p.status === "draft" || p.status === "sent").length;
    const receivedPOs = purchaseOrders.filter((p) => p.status === "received").length;
    const totalSpend = purchaseOrders
      .filter((p) => p.status !== "cancelled")
      .reduce((sum, p) => sum + Number(p.grand_total || 0), 0);

    const totalVendors = vendors.length;
    const activeVendors = vendors.filter((v) => v.status === "active").length;

    return { totalPOs, pendingPOs, receivedPOs, totalSpend, totalVendors, activeVendors };
  }, [purchaseOrders, vendors]);

  // Filtered lists
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((p) => {
      const vendorName = vendors.find((v) => v.id === p.vendor_id)?.vendor_name || p.vendor?.vendor_name || "";
      const matchesSearch =
        !searchTerm ||
        p.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || p.status?.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, vendors, searchTerm, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const matchesSearch =
        !searchTerm ||
        v.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.phone?.includes(searchTerm);
      const matchesStatus =
        statusFilter === "ALL" || v.status?.toLowerCase() === statusFilter.toLowerCase();
      const matchesType =
        typeFilter === "ALL" || v.vendor_type?.toLowerCase() === typeFilter.toLowerCase();
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [vendors, searchTerm, statusFilter, typeFilter]);

  // Line item handlers
  const handleAddLineItem = () => {
    setPoForm((prev) => ({
      ...prev,
      items: [...prev.items, { item_id: "", quantity: "1", unit_price: "0", tax_percent: "0" }],
    }));
  };

  const handleRemoveLineItem = (index) => {
    if (poForm.items.length <= 1) {
      showToast("Purchase order must have at least one line item", "error");
      return;
    }
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleLineItemChange = (index, field, value) => {
    setPoForm((prev) => {
      const updated = [...prev.items];
      updated[index][field] = value;
      if (field === "item_id") {
        const itemObj = inventoryItems.find((i) => String(i.id) === String(value));
        if (itemObj) {
          updated[index].unit_price = String(itemObj.purchase_price || itemObj.unit_price || itemObj.average_cost || 0);
          updated[index].tax_percent = String(itemObj.tax_rate || 0);
        }
      }
      return { ...prev, items: updated };
    });
  };

  // Calculation in PO modal
  const poCalculations = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    poForm.items.forEach((item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_percent) || 0;
      const lineBase = qty * price;
      const lineTax = (lineBase * taxRate) / 100;
      subtotal += lineBase;
      taxAmount += lineTax;
    });
    const discount = parseFloat(poForm.discount) || 0;
    const grandTotal = Math.max(0, subtotal + taxAmount - discount);
    return { subtotal, taxAmount, discount, grandTotal };
  }, [poForm.items, poForm.discount]);

  // PO Save
  const handleSavePO = async (e) => {
    e.preventDefault();
    if (!poForm.vendor_id) {
      showToast("Please select a vendor", "error");
      return;
    }

    const validItems = poForm.items.filter((i) => i.item_id && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      showToast("Please select at least one item with valid quantity", "error");
      return;
    }

    const resolvedHotelId = Number(hotelId || inventoryItems[0]?.hotel_id || vendors[0]?.hotel_id || 1);

    try {
      setSubmitting(true);
      const payload = {
        hotel_id: resolvedHotelId,
        vendor_id: Number(poForm.vendor_id),
        expected_delivery_date: poForm.expected_delivery_date || null,
        status: "ordered",
        payment_status: "pending",
        discount: Number(poForm.discount || 0),
        notes: poForm.notes,
        created_by: user?.full_name || user?.username || "Admin",
        items: validItems.map((line) => ({
          item_id: Number(line.item_id),
          quantity: Number(line.quantity),
          unit_price: Number(line.unit_price),
          tax_percent: Number(line.tax_percent || 0),
        })),
      };

      await api.post("/purchase-orders", payload);
      showToast("Purchase order issued successfully!");
      setIsPOModalOpen(false);
      setPoForm(emptyPOForm);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Failed to create purchase order", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Vendor Save
  const handleSaveVendor = async (e) => {
    e.preventDefault();
    if (!vendorForm.vendor_name.trim() || !vendorForm.phone.trim()) {
      showToast("Vendor Name and Phone are required", "error");
      return;
    }

    const resolvedHotelId = Number(hotelId || inventoryItems[0]?.hotel_id || vendors[0]?.hotel_id || 1);

    try {
      setSubmitting(true);
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, vendorForm);
        showToast("Vendor updated successfully");
      } else {
        await api.post("/vendors", {
          ...vendorForm,
          hotel_id: resolvedHotelId,
        });
        showToast("Vendor registered successfully");
      }
      setIsVendorModalOpen(false);
      setVendorForm(emptyVendorForm);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Failed to save vendor", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // PO Goods Receive
  const handleConfirmReceive = async (e) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      setSubmitting(true);
      await api.post(`/purchase-orders/${selectedPO.id}/receive`, {
        received_by: user?.full_name || user?.username || "Admin",
        remarks: receiveRemarks || "Items inspected and received into inventory",
      });
      showToast(`PO ${selectedPO.po_number} received! Stock updated automatically.`);
      setIsReceiveModalOpen(false);
      setIsPODetailModalOpen(false);
      setSelectedPO(null);
      setReceiveRemarks("");
      fetchData();
    } catch (err) {
      console.error(err);
      showToast(err?.response?.data?.detail || "Failed to receive purchase order", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePO = async (poId) => {
    if (!window.confirm("Are you sure you want to delete this purchase order?")) return;
    try {
      await api.delete(`/purchase-orders/${poId}`);
      showToast("Purchase order deleted successfully");
      fetchData();
      if (selectedPO?.id === poId) {
        setIsPODetailModalOpen(false);
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || "Failed to delete purchase order", "error");
    }
  };

  const handleDeleteVendor = async (vendorId) => {
    if (!window.confirm("Are you sure you want to delete this vendor?")) return;
    try {
      await api.delete(`/vendors/${vendorId}`);
      showToast("Vendor deleted successfully");
      fetchData();
    } catch (err) {
      showToast(err?.response?.data?.detail || "Failed to delete vendor", "error");
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  return (
    <div className="directory-page procurement-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER (Matching StockDirectory) */}
      <PortalHeader
        title="Procurement & Suppliers"
        kicker="SUPPLY CHAIN • PURCHASE ORDERS"
        description="Manage vendors, issue purchase orders, and receive goods directly into hotel stock."
        icon={Truck}
        backPath="/dashboard"
        rightAction={
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="portal-action-btn-secondary"
              onClick={() => {
                setEditingVendor(null);
                setVendorForm(emptyVendorForm);
                setIsVendorModalOpen(true);
              }}
            >
              <Building2 size={16} /> Add Vendor
            </button>
            <button
              type="button"
              className="portal-action-btn"
              onClick={() => {
                if (vendors.length === 0) {
                  showToast("Please register a vendor before creating a purchase order", "error");
                  return;
                }
                setPoForm({
                  ...emptyPOForm,
                  vendor_id: vendors[0]?.id || "",
                  items: [{ item_id: inventoryItems[0]?.id || "", quantity: "1", unit_price: "0", tax_percent: "0" }],
                });
                setIsPOModalOpen(true);
              }}
            >
              <Plus size={16} /> Create PO
            </button>
          </div>
        }
      />

      {/* STATS GRID (Matching Theme Tokens: blue, orange, purple, green) */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Purchase Orders"
          value={stats.totalPOs}
          Icon={ShoppingCart}
          colorTheme="blue"
        />
        <StatCard
          title="Pending Deliveries"
          value={stats.pendingPOs}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="Goods Received"
          value={stats.receivedPOs}
          Icon={CheckCircle2}
          colorTheme="green"
        />
        <StatCard
          title="Total Order Value"
          value={`₹${stats.totalSpend.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="purple"
        />
      </div>

      <section className="dir-modules-section">
        {/* TAB BUTTONS (Matching Bookings/Preventive Tabs) */}
        <div className="booking-sections-tabs">
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("orders");
              clearFilters();
            }}
          >
            <ShoppingCart size={15} />
            <span>Purchase Orders</span>
            <span className="tab-count-badge">{purchaseOrders.length}</span>
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${activeTab === "vendors" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("vendors");
              clearFilters();
            }}
          >
            <Building2 size={15} />
            <span>Registered Vendors</span>
            <span className="tab-count-badge">{vendors.length}</span>
          </button>
        </div>

        {/* SECTION HEADER */}
        <ModuleWriternHeader
          title={activeTab === "orders" ? "Purchase Order Management" : "Vendor Directory"}
          description={
            activeTab === "orders"
              ? "Track ordered supplies, verify delivery statuses, and ingest received stock."
              : "Registered suppliers, payment terms, and vendor point of contacts."
          }
          badgeCount={activeTab === "orders" ? filteredPOs.length : filteredVendors.length}
          badgeLabel={activeTab === "orders" ? "orders" : "vendors"}
        />

        {/* CONTROLS & SEARCH */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={
                activeTab === "orders"
                  ? "Search by PO number or vendor..."
                  : "Search vendors by name, contact, phone..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              className="dir-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              {activeTab === "orders" ? (
                <>
                  <option value="ordered">Ordered</option>
                  <option value="received">Received</option>
                  <option value="draft">Draft</option>
                  <option value="cancelled">Cancelled</option>
                </>
              ) : (
                <>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </>
              )}
            </select>

            {activeTab === "vendors" && (
              <select
                className="dir-filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                {VENDOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            <button type="button" className="btn-cancel" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>

        {/* DATA TABLES */}
        <div className="dir-table-container">
          {activeTab === "orders" ? (
            <table className="dir-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Order Date</th>
                  <th>Expected Delivery</th>
                  <th>Items</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading purchase orders...
                    </td>
                  </tr>
                ) : filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const vendor = vendors.find((v) => v.id === po.vendor_id);
                    const vendorName = vendor?.vendor_name || po.vendor?.vendor_name || "Supplier";
                    const isReceived = po.status === "received";
                    const isOrdered = po.status === "ordered";

                    return (
                      <tr
                        key={po.id}
                        className="dir-table-row"
                        onClick={() => {
                          setSelectedPO(po);
                          setIsPODetailModalOpen(true);
                        }}
                      >
                        <td>
                          <span className="mono-pill">{po.po_number}</span>
                        </td>
                        <td>
                          <div className="customer-cell">
                            <div className="staff-avatar">{vendorName.charAt(0).toUpperCase()}</div>
                            <div>
                              <div className="customer-name">{vendorName}</div>
                              <span className="text-muted" style={{ fontSize: "11.5px" }}>
                                {vendor?.phone || "No phone"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{po.order_date ? po.order_date.slice(0, 10) : po.created_at ? po.created_at.slice(0, 10) : "N/A"}</td>
                        <td>{po.expected_delivery_date ? po.expected_delivery_date.slice(0, 10) : "—"}</td>
                        <td>{po.items?.length || 0} line items</td>
                        <td>
                          <div className="bank-cell">
                            <span className="bank-primary">₹{Number(po.grand_total || 0).toFixed(2)}</span>
                            <span className="bank-sub">{po.payment_status || "pending"}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`mono-pill ${isReceived ? "pill-normal" : isOrdered ? "pill-warning" : "pill-neutral"
                              }`}
                          >
                            {po.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            {isOrdered && (
                              <button
                                type="button"
                                className="btn-receive-action"
                                title="Receive Goods into Inventory"
                                onClick={() => {
                                  setSelectedPO(po);
                                  setIsReceiveModalOpen(true);
                                }}
                              >
                                <PackageCheck size={14} /> Receive
                              </button>
                            )}
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="Print Purchase Order"
                              onClick={() => handlePrintPO(po)}
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="View Details"
                              onClick={() => {
                                setSelectedPO(po);
                                setIsPODetailModalOpen(true);
                              }}
                            >
                              <Eye size={14} />
                            </button>
                            {!isReceived && (
                              <button
                                type="button"
                                className="dir-action-inline-btn"
                                style={{ color: "#dc2626" }}
                                title="Delete PO"
                                onClick={() => handleDeletePO(po.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="dir-table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Contact Person</th>
                  <th>Phone & Email</th>
                  <th>Category</th>
                  <th>GST Number</th>
                  <th>Payment Terms</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading vendors...
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      No registered vendors found.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v) => (
                    <tr
                      key={v.id}
                      className="dir-table-row"
                      onClick={() => {
                        setEditingVendor(v);
                        setVendorForm(v);
                        setIsVendorModalOpen(true);
                      }}
                    >
                      <td>
                        <div className="customer-cell">
                          <div className="staff-avatar">{v.vendor_name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="customer-name">{v.vendor_name}</div>
                            {v.city && (
                              <span className="text-muted" style={{ fontSize: "11.5px" }}>
                                {v.city}, {v.state}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{v.contact_person || "—"}</td>
                      <td>
                        <span className="mono-pill">
                          <Phone size={10} style={{ marginRight: "3px" }} />
                          {v.phone}
                        </span>
                        {v.email && <div className="text-muted" style={{ fontSize: "11px" }}>{v.email}</div>}
                      </td>
                      <td>
                        <span className="text-muted">{v.vendor_type || "General Supplier"}</span>
                      </td>
                      <td>{v.gst_number || "—"}</td>
                      <td>{v.payment_terms || "Net 30 Days"}</td>
                      <td>
                        <span className={`mono-pill ${v.status === "active" ? "pill-normal" : "pill-neutral"}`}>
                          {v.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            title="Edit Vendor"
                            onClick={() => {
                              setEditingVendor(v);
                              setVendorForm(v);
                              setIsVendorModalOpen(true);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            style={{ color: "#dc2626" }}
                            title="Delete Vendor"
                            onClick={() => handleDeleteVendor(v.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* CREATE PURCHASE ORDER MODAL */}
      {isPOModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPOModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "780px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Issue Purchase Order</h2>
                <p className="modal-kicker">Creates a formal order linked to the supplier</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsPOModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePO}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Select Vendor *</label>
                    <select
                      className="dir-select-field"
                      value={poForm.vendor_id}
                      onChange={(e) => setPoForm({ ...poForm, vendor_id: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Vendor --</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendor_name} ({v.phone})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={poForm.expected_delivery_date}
                      onChange={(e) => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Delivery Instructions / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Deliver to kitchen receiving dock between 9 AM - 12 PM"
                    value={poForm.notes}
                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                  />
                </div>

                {/* Line Items Section */}
                <div className="pm-checklist-container">
                  <div className="pm-checklist-header">
                    <strong>Order Line Items</strong>
                    <button type="button" className="btn-add-item" onClick={handleAddLineItem}>
                      <Plus size={13} /> Add Line Item
                    </button>
                  </div>

                  {poForm.items.map((line, idx) => {
                    const lineTotal =
                      (Number(line.quantity) || 0) *
                      (Number(line.unit_price) || 0) *
                      (1 + (Number(line.tax_percent) || 0) / 100);

                    return (
                      <div key={idx} className="po-item-row-card">
                        <select
                          className="dir-select-field"
                          style={{ flex: 2 }}
                          value={line.item_id}
                          onChange={(e) => handleLineItemChange(idx, "item_id", e.target.value)}
                          required
                        >
                          <option value="">-- Choose Inventory Item --</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name || inv.item_name} (SKU: {inv.sku})
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          step="any"
                          min="0.1"
                          placeholder="Qty"
                          title="Quantity"
                          style={{ flex: 1 }}
                          value={line.quantity}
                          onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                          required
                        />

                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price (₹)"
                          title="Unit Price"
                          style={{ flex: 1 }}
                          value={line.unit_price}
                          onChange={(e) => handleLineItemChange(idx, "unit_price", e.target.value)}
                          required
                        />

                        <input
                          type="number"
                          step="any"
                          placeholder="Tax %"
                          title="Tax Rate"
                          style={{ flex: 0.8 }}
                          value={line.tax_percent}
                          onChange={(e) => handleLineItemChange(idx, "tax_percent", e.target.value)}
                        />

                        <div className="po-line-total-pill">₹{lineTotal.toFixed(2)}</div>

                        {poForm.items.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-item"
                            title="Remove Line"
                            onClick={() => handleRemoveLineItem(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Calculations Box */}
                  <div className="po-summary-box">
                    <div className="po-summary-line">
                      <span>Subtotal:</span>
                      <strong>₹{poCalculations.subtotal.toFixed(2)}</strong>
                    </div>
                    <div className="po-summary-line">
                      <span>Tax Amount:</span>
                      <strong>₹{poCalculations.taxAmount.toFixed(2)}</strong>
                    </div>
                    <div className="po-summary-line">
                      <span>Discount (₹):</span>
                      <input
                        type="number"
                        style={{ width: "95px", textAlign: "right", height: "30px", padding: "0 6px" }}
                        value={poForm.discount}
                        onChange={(e) => setPoForm({ ...poForm, discount: e.target.value })}
                      />
                    </div>
                    <div className="po-summary-line grand">
                      <span>Grand Total:</span>
                      <strong>₹{poCalculations.grandTotal.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsPOModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  <Save size={14} /> {submitting ? "Creating..." : "Issue Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT VENDOR MODAL */}
      {isVendorModalOpen && (
        <div className="modal-overlay" onClick={() => setIsVendorModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{editingVendor ? "Edit Vendor Details" : "Register New Vendor"}</h2>
                <p className="modal-kicker">Manage supply partner profile and payment terms</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsVendorModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVendor}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Vendor / Supplier Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Royal Fresh Farm Supplies"
                    value={vendorForm.vendor_name}
                    onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={vendorForm.phone}
                      onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="supplier@company.com"
                      value={vendorForm.email}
                      onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Person</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={vendorForm.contact_person}
                      onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>GST Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      value={vendorForm.gst_number}
                      onChange={(e) => setVendorForm({ ...vendorForm, gst_number: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Vendor Category</label>
                    <select
                      className="dir-select-field"
                      value={vendorForm.vendor_type}
                      onChange={(e) => setVendorForm({ ...vendorForm, vendor_type: e.target.value })}
                    >
                      {VENDOR_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Payment Terms</label>
                    <select
                      className="dir-select-field"
                      value={vendorForm.payment_terms}
                      onChange={(e) => setVendorForm({ ...vendorForm, payment_terms: e.target.value })}
                    >
                      {PAYMENT_TERMS_OPTIONS.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={vendorForm.city}
                      onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={vendorForm.state}
                      onChange={(e) => setVendorForm({ ...vendorForm, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Full Address</label>
                  <textarea
                    rows={2}
                    placeholder="Street, industrial area, landmark..."
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsVendorModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  <Save size={14} /> {submitting ? "Saving..." : editingVendor ? "Save Changes" : "Register Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO DETAIL MODAL */}
      {isPODetailModalOpen && selectedPO && (
        <div className="modal-overlay" onClick={() => setIsPODetailModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedPO.po_number}</h2>
                <span className="mono-pill pill-normal" style={{ textTransform: "capitalize" }}>
                  {selectedPO.status}
                </span>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsPODetailModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "12px",
                  padding: "14px",
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div>
                  <span className="text-muted" style={{ fontSize: "11px" }}>VENDOR</span>
                  <div style={{ fontWeight: 600 }}>
                    {vendors.find((v) => v.id === selectedPO.vendor_id)?.vendor_name || selectedPO.vendor?.vendor_name}
                  </div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: "11px" }}>EXPECTED DELIVERY</span>
                  <div style={{ fontWeight: 600 }}>
                    {selectedPO.expected_delivery_date ? selectedPO.expected_delivery_date.slice(0, 10) : "Not specified"}
                  </div>
                </div>
                <div>
                  <span className="text-muted" style={{ fontSize: "11px" }}>PAYMENT STATUS</span>
                  <div style={{ fontWeight: 600, textTransform: "capitalize" }}>
                    {selectedPO.payment_status || "Pending"}
                  </div>
                </div>
              </div>

              <h4 style={{ margin: "14px 0 6px", fontSize: "13.5px", color: "#0f172a" }}>Purchased Items</h4>
              <table className="dir-table" style={{ border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Unit Cost</th>
                    <th>Tax %</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPO.items?.map((it) => (
                    <tr key={it.id}>
                      <td><strong>{it.item_name || it.item?.name}</strong></td>
                      <td>{it.quantity}</td>
                      <td>₹{Number(it.unit_price || 0).toFixed(2)}</td>
                      <td>{it.tax_percent || 0}%</td>
                      <td><strong>₹{Number(it.total || 0).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="po-summary-box" style={{ marginTop: "12px" }}>
                <div className="po-summary-line">
                  <span>Subtotal:</span>
                  <strong>₹{Number(selectedPO.subtotal || 0).toFixed(2)}</strong>
                </div>
                <div className="po-summary-line">
                  <span>Tax:</span>
                  <strong>₹{Number(selectedPO.tax_amount || 0).toFixed(2)}</strong>
                </div>
                {selectedPO.discount > 0 && (
                  <div className="po-summary-line">
                    <span>Discount:</span>
                    <strong>-₹{Number(selectedPO.discount || 0).toFixed(2)}</strong>
                  </div>
                )}
                <div className="po-summary-line grand">
                  <span>Grand Total:</span>
                  <strong>₹{Number(selectedPO.grand_total || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left" style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={() => handlePrintPO(selectedPO)}
                >
                  <Printer size={14} /> Print Order
                </button>
                {selectedPO.status !== "received" && (
                  <button
                    type="button"
                    className="btn-danger-outline"
                    onClick={() => handleDeletePO(selectedPO.id)}
                  >
                    <Trash2 size={14} /> Cancel / Delete PO
                  </button>
                )}
              </div>
              <div className="footer-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {selectedPO.payment_status !== "paid" && selectedPO.status !== "cancelled" ? (
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ background: "#2563eb", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    onClick={() => handleUpdatePaymentStatus(selectedPO.id, "paid")}
                    disabled={submitting}
                  >
                    <CreditCard size={14} /> Mark as Paid
                  </button>
                ) : (
                  <span
                    className="mono-pill pill-normal"
                    style={{ background: "#ecfdf5", color: "#059669", display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px" }}
                  >
                    <CheckCircle2 size={13} /> Paid & Logged
                  </span>
                )}
                {selectedPO.status === "ordered" && (
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ background: "#059669", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    onClick={() => {
                      setIsPODetailModalOpen(false);
                      setIsReceiveModalOpen(true);
                    }}
                  >
                    <PackageCheck size={14} /> Receive Goods
                  </button>
                )}
                <button type="button" className="btn-cancel" onClick={() => setIsPODetailModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM GOODS RECEIVE MODAL */}
      {isReceiveModalOpen && selectedPO && (
        <div className="modal-overlay nested-modal" onClick={() => setIsReceiveModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Confirm Goods Receipt</h2>
                <p className="modal-kicker">PO: {selectedPO.po_number}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setIsReceiveModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive}>
              <div className="modal-body">
                <div className="info-box-note">
                  <Briefcase size={16} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Receiving this delivery will automatically update on-hand stock in your Hotel Inventory and log auditable stock movements.
                  </span>
                </div>

                <div className="form-group" style={{ marginTop: "10px" }}>
                  <label>Receiving Remarks / Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. Inspected by Head Storekeeper, Invoice #INV-8891"
                    value={receiveRemarks}
                    onChange={(e) => setReceiveRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsReceiveModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" style={{ background: "#059669" }} disabled={submitting}>
                  <CheckCircle2 size={14} /> {submitting ? "Updating Stock..." : "Confirm & Update Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}