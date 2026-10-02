import React, { useEffect, useState, useMemo } from "react";
import {
  Shirt,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Truck,
  Trash2,
  Edit,
  X,
  DollarSign,
  AlertCircle,
  Package,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader } from "@components";
import "./laundry.css";

const SERVICE_TYPES = [
  "Wash & Iron",
  "Dry Clean",
  "Pressing Only",
  "Express Laundry",
  "Linen & Bedding",
];

const PRESET_ITEMS = [
  { name: "Shirt / T-Shirt", price: 80 },
  { name: "Trousers / Jeans", price: 100 },
  { name: "Suit (2-Piece)", price: 350 },
  { name: "Dress / Gown", price: 250 },
  { name: "Saree", price: 200 },
  { name: "Kurta / Pyjama", price: 120 },
  { name: "Jacket / Blazer", price: 250 },
  { name: "Bed Sheet / Duvet", price: 150 },
  { name: "Bath Towel", price: 60 },
  { name: "Custom Item", price: 0 },
];

const emptyLaundryForm = {
  room_id: "",
  guest_id: "",
  booking_id: "",
  service_type: "Wash & Iron",
  item_name: "Shirt / T-Shirt",
  quantity: 1,
  price_per_item: 80,
  status: "received",
  payment_status: "bill-to-room",
  remarks: "",
};

export default function LaundryOrdersPage() {
  const { user } = useAuth();
  const hotelId =
    user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;

  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [serviceFilter, setServiceFilter] = useState("ALL");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState(emptyLaundryForm);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const fetchData = async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const [ordRes, rmsRes, gstRes, bkgRes] = await Promise.all([
        api.get(`/laundry-orders?hotel_id=${hotelId}`).catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
      ]);

      setOrders(ordRes.data || []);
      setRooms(normalizeList(rmsRes.data, "rooms"));
      setGuests(normalizeList(gstRes.data, "guests"));
      setBookings(normalizeList(bkgRes.data, "bookings"));
    } catch (err) {
      console.error("Error loading laundry orders:", err);
      showToast("Failed to load laundry records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  // Handle room / booking selection in form
  const handleRoomSelect = (roomId) => {
    const matchedRoom = rooms.find((r) => String(r.id) === String(roomId));
    // Find active booking for this room
    const activeBooking = bookings.find(
      (b) =>
        String(b.room_id) === String(roomId) &&
        (b.status === "checked_in" || b.status === "confirmed" || !b.status)
    );

    const guestId = activeBooking?.guest_id || matchedRoom?.current_guest_id || guests[0]?.id || 1;

    setFormData((prev) => ({
      ...prev,
      room_id: roomId,
      booking_id: activeBooking?.id || "",
      guest_id: guestId,
    }));
  };

  const handleItemSelect = (itemName) => {
    const preset = PRESET_ITEMS.find((p) => p.name === itemName);
    setFormData((prev) => ({
      ...prev,
      item_name: itemName === "Custom Item" ? "" : itemName,
      price_per_item: preset ? preset.price : prev.price_per_item,
    }));
  };

  const handleOpenAdd = () => {
    setEditingOrder(null);
    const firstRoom = rooms[0];
    const activeBooking = bookings.find(
      (b) => String(b.room_id) === String(firstRoom?.id)
    );
    const guestId = activeBooking?.guest_id || guests[0]?.id || 1;

    setFormData({
      ...emptyLaundryForm,
      room_id: firstRoom?.id || "",
      booking_id: activeBooking?.id || "",
      guest_id: guestId,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      room_id: order.room_id || "",
      guest_id: order.guest_id || "",
      booking_id: order.booking_id || "",
      service_type: order.service_type || "Wash & Iron",
      item_name: order.item_name || "",
      quantity: order.quantity || 1,
      price_per_item: order.price_per_item || 0,
      status: order.status || "received",
      payment_status: order.payment_status || "bill-to-room",
      remarks: order.remarks || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim() || Number(formData.quantity) <= 0 || Number(formData.price_per_item) < 0) {
      showToast("Please enter a valid item, quantity, and price", "error");
      return;
    }

    try {
      const payload = {
        hotel_id: Number(hotelId),
        guest_id: Number(formData.guest_id) || 1,
        room_id: formData.room_id ? Number(formData.room_id) : null,
        booking_id: formData.booking_id ? Number(formData.booking_id) : null,
        service_type: formData.service_type,
        item_name: formData.item_name.trim(),
        quantity: Number(formData.quantity),
        price_per_item: Number(formData.price_per_item),
        status: formData.status,
        payment_status: formData.payment_status,
        remarks: formData.remarks,
      };

      if (editingOrder) {
        await api.put(`/laundry-orders/${editingOrder.id}`, payload);
        showToast("Laundry order updated");
      } else {
        await api.post("/laundry-orders", payload);
        showToast("Laundry order created successfully");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save laundry order";
      showToast(msg, "error");
    }
  };

  // Quick workflow state progression
  const handleAdvanceStatus = async (order) => {
    let nextStatus = "processing";
    if (order.status === "received") nextStatus = "processing";
    else if (order.status === "processing") nextStatus = "ready";
    else if (order.status === "ready") nextStatus = "delivered";
    else return;

    try {
      await api.put(`/laundry-orders/${order.id}`, { status: nextStatus });
      showToast(`Order status updated to ${nextStatus}`);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to advance order";
      showToast(msg, "error");
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm("Are you sure you want to delete this laundry order?")) return;
    try {
      await api.delete(`/laundry-orders/${orderId}`);
      showToast("Laundry order deleted");
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete laundry order";
      showToast(msg, "error");
    }
  };

  // Stats
  const stats = useMemo(() => {
    const active = orders.filter((o) => o.status === "received" || o.status === "processing").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const revenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.total_amount || (o.quantity * o.price_per_item) || 0), 0);

    return { active, ready, delivered, revenue };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const roomNum = rooms.find((r) => r.id === o.room_id)?.room_number || "";
      const guestName = guests.find((g) => g.id === o.guest_id)?.name || "";

      const matchesSearch =
        !searchQuery ||
        o.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        roomNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guestName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || o.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchesService =
        serviceFilter === "ALL" || o.service_type === serviceFilter;

      return matchesSearch && matchesStatus && matchesService;
    });
  }, [orders, rooms, guests, searchQuery, statusFilter, serviceFilter]);

  return (
    <div className="laundry-page">
      {toast && (
        <div className={`lnd-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <PortalHeader
        title="Laundry Orders"
        subtitle="Manage guest and hotel laundry requests, status workflows, and billing"
        icon={Shirt}
      />

      {/* Stats */}
      <div className="lnd-stats-grid">
        <div className="lnd-stat-card">
          <div className="lnd-stat-icon blue">
            <Clock size={24} />
          </div>
          <div className="lnd-stat-info">
            <h4>Active In-Progress</h4>
            <div className="stat-value">{stats.active}</div>
          </div>
        </div>

        <div className="lnd-stat-card">
          <div className="lnd-stat-icon purple">
            <Sparkles size={24} />
          </div>
          <div className="lnd-stat-info">
            <h4>Ready for Delivery</h4>
            <div className="stat-value">{stats.ready}</div>
          </div>
        </div>

        <div className="lnd-stat-card">
          <div className="lnd-stat-icon emerald">
            <CheckCircle2 size={24} />
          </div>
          <div className="lnd-stat-info">
            <h4>Delivered / Done</h4>
            <div className="stat-value">{stats.delivered}</div>
          </div>
        </div>

        <div className="lnd-stat-card">
          <div className="lnd-stat-icon amber">
            <DollarSign size={24} />
          </div>
          <div className="lnd-stat-info">
            <h4>Laundry Revenue</h4>
            <div className="stat-value">₹{stats.revenue.toLocaleString("en-IN")}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="lnd-controls-bar">
        <div className="lnd-search-group">
          <div className="lnd-search-box">
            <Search size={16} />
            <input
              type="text"
              className="lnd-search-input"
              placeholder="Search by room, guest, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="lnd-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="lnd-filter-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="ALL">All Service Types</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <button className="lnd-primary-btn" onClick={handleOpenAdd}>
          <Plus size={16} />
          New Laundry Order
        </button>
      </div>

      {/* Main Table */}
      <div className="lnd-table-card">
        {filteredOrders.length === 0 ? (
          <div className="lnd-empty">
            <Shirt size={48} />
            <h4>No Laundry Orders</h4>
            <p>Create a new laundry request for an in-house guest or room.</p>
          </div>
        ) : (
          <table className="lnd-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Room & Guest</th>
                <th>Service Type</th>
                <th>Item & Qty</th>
                <th>Rate</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((ord) => {
                const room = rooms.find((r) => r.id === ord.room_id);
                const guest = guests.find((g) => g.id === ord.guest_id);
                const total = ord.total_amount || ord.quantity * ord.price_per_item;

                return (
                  <tr key={ord.id}>
                    <td>
                      <strong>#{ord.id}</strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {ord.created_at ? new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </div>
                    </td>
                    <td>
                      <strong>{room ? `Room ${room.room_number}` : "Hotel / Direct"}</strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {guest ? guest.name : "In-House Guest"}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{ord.service_type}</span>
                    </td>
                    <td>
                      <strong>{ord.item_name}</strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        Qty: {ord.quantity}
                      </div>
                    </td>
                    <td>₹{Number(ord.price_per_item).toFixed(2)}</td>
                    <td>
                      <strong>₹{Number(total).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className={`lnd-badge ${ord.payment_status?.toLowerCase()}`}>
                        {ord.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`lnd-badge ${ord.status?.toLowerCase()}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <div className="lnd-actions">
                        {ord.status === "received" && (
                          <button
                            className="lnd-advance-btn"
                            onClick={() => handleAdvanceStatus(ord)}
                          >
                            <Clock size={12} /> Process
                          </button>
                        )}
                        {ord.status === "processing" && (
                          <button
                            className="lnd-advance-btn"
                            onClick={() => handleAdvanceStatus(ord)}
                          >
                            <Sparkles size={12} /> Ready
                          </button>
                        )}
                        {ord.status === "ready" && (
                          <button
                            className="lnd-advance-btn"
                            onClick={() => handleAdvanceStatus(ord)}
                          >
                            <Truck size={12} /> Deliver
                          </button>
                        )}

                        <button
                          className="lnd-action-btn"
                          title="Edit Order"
                          onClick={() => handleOpenEdit(ord)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="lnd-action-btn delete"
                          title="Delete Order"
                          onClick={() => handleDelete(ord.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="lnd-modal-overlay">
          <div className="lnd-modal">
            <div className="lnd-modal-header">
              <h3>{editingOrder ? "Edit Laundry Order" : "New Laundry Order"}</h3>
              <button
                className="lnd-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="lnd-modal-body">
                <div className="lnd-form-grid">
                  <div className="lnd-form-group">
                    <label>Select Room / In-House Guest *</label>
                    <select
                      value={formData.room_id}
                      onChange={(e) => handleRoomSelect(e.target.value)}
                    >
                      <option value="">-- Choose Room --</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.room_number} ({r.room_type || "Standard"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lnd-form-group">
                    <label>Service Type *</label>
                    <select
                      value={formData.service_type}
                      onChange={(e) =>
                        setFormData({ ...formData, service_type: e.target.value })
                      }
                    >
                      {SERVICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lnd-form-group">
                    <label>Preset Item Quick-Pick</label>
                    <select
                      onChange={(e) => handleItemSelect(e.target.value)}
                      defaultValue={formData.item_name}
                    >
                      {PRESET_ITEMS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.price > 0 ? `(₹${p.price})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lnd-form-group">
                    <label>Item Name / Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cotton Shirt"
                      value={formData.item_name}
                      onChange={(e) =>
                        setFormData({ ...formData, item_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="lnd-form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={formData.quantity}
                      onChange={(e) =>
                        setFormData({ ...formData, quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="lnd-form-group">
                    <label>Rate / Price Per Item (₹) *</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={formData.price_per_item}
                      onChange={(e) =>
                        setFormData({ ...formData, price_per_item: e.target.value })
                      }
                    />
                  </div>

                  <div className="lnd-form-group">
                    <label>Payment Method / Status</label>
                    <select
                      value={formData.payment_status}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_status: e.target.value })
                      }
                    >
                      <option value="bill-to-room">Bill to Room</option>
                      <option value="paid">Direct Paid</option>
                      <option value="complimentary">Complimentary</option>
                    </select>
                  </div>

                  <div className="lnd-form-group">
                    <label>Order Pipeline Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="received">Received</option>
                      <option value="processing">Processing</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="lnd-form-group lnd-form-full">
                    <label>Special Instructions / Remarks</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Extra starch on collar, deliver before 6 PM..."
                      value={formData.remarks}
                      onChange={(e) =>
                        setFormData({ ...formData, remarks: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Total Estimated Amount:
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f766e" }}>
                    ₹
                    {(
                      (Number(formData.quantity) || 0) *
                      (Number(formData.price_per_item) || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="lnd-modal-footer">
                <button
                  type="button"
                  className="lnd-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="lnd-primary-btn">
                  {editingOrder ? "Save Changes" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
