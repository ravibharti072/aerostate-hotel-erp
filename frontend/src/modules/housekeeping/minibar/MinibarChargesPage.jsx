import React, { useEffect, useState, useMemo } from "react";
import {
  Wine,
  Plus,
  Search,
  CheckCircle2,
  DollarSign,
  Coffee,
  Trash2,
  Edit,
  X,
  CreditCard,
  Ban,
  FileText,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader } from "@components";
import "./minibar.css";

const PRESET_MINIBAR_ITEMS = [
  { name: "Mineral Water (500ml)", price: 40 },
  { name: "Sparkling Water", price: 90 },
  { name: "Soft Drink / Cola (Can)", price: 60 },
  { name: "Fresh Juice Can", price: 80 },
  { name: "Premium Beer (Pint)", price: 250 },
  { name: "Red Wine (Mini Bottle)", price: 600 },
  { name: "Whiskey / Vodka (Miniature 50ml)", price: 450 },
  { name: "Roasted Salted Cashews", price: 150 },
  { name: "Salted Almonds", price: 160 },
  { name: "Pringles / Potato Crisps", price: 100 },
  { name: "Premium Chocolate Bar", price: 120 },
  { name: "Energy Drink", price: 140 },
  { name: "Custom Item", price: 0 },
];

const emptyChargeForm = {
  room_id: "",
  guest_id: "",
  booking_id: "",
  item_name: "Mineral Water (500ml)",
  quantity: 1,
  price_per_item: 40,
  status: "active",
  payment_status: "bill-to-room",
  remarks: "",
};

export default function MinibarChargesPage() {
  const { user } = useAuth();
  const hotelId =
    user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;

  const [charges, setCharges] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState(null);
  const [formData, setFormData] = useState(emptyChargeForm);

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
      const [chgRes, rmsRes, gstRes, bkgRes] = await Promise.all([
        api.get(`/minibar-charges?hotel_id=${hotelId}`).catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
      ]);

      setCharges(chgRes.data || []);
      setRooms(normalizeList(rmsRes.data, "rooms"));
      setGuests(normalizeList(gstRes.data, "guests"));
      setBookings(normalizeList(bkgRes.data, "bookings"));
    } catch (err) {
      console.error("Error loading minibar data:", err);
      showToast("Failed to load minibar records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [hotelId]);

  const handleRoomSelect = (roomId) => {
    const matchedRoom = rooms.find((r) => String(r.id) === String(roomId));
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
    const preset = PRESET_MINIBAR_ITEMS.find((p) => p.name === itemName);
    setFormData((prev) => ({
      ...prev,
      item_name: itemName === "Custom Item" ? "" : itemName,
      price_per_item: preset ? preset.price : prev.price_per_item,
    }));
  };

  const handleOpenAdd = () => {
    setEditingCharge(null);
    const firstRoom = rooms[0];
    const activeBooking = bookings.find(
      (b) => String(b.room_id) === String(firstRoom?.id)
    );
    const guestId = activeBooking?.guest_id || guests[0]?.id || 1;

    setFormData({
      ...emptyChargeForm,
      room_id: firstRoom?.id || "",
      booking_id: activeBooking?.id || "",
      guest_id: guestId,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (charge) => {
    setEditingCharge(charge);
    setFormData({
      room_id: charge.room_id || "",
      guest_id: charge.guest_id || "",
      booking_id: charge.booking_id || "",
      item_name: charge.item_name || "",
      quantity: charge.quantity || 1,
      price_per_item: charge.price_per_item || 0,
      status: charge.status || "active",
      payment_status: charge.payment_status || "bill-to-room",
      remarks: charge.remarks || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.item_name.trim() || Number(formData.quantity) <= 0 || Number(formData.price_per_item) < 0) {
      showToast("Please enter a valid item name, quantity, and price", "error");
      return;
    }

    try {
      const payload = {
        hotel_id: Number(hotelId),
        guest_id: Number(formData.guest_id) || 1,
        room_id: formData.room_id ? Number(formData.room_id) : null,
        booking_id: formData.booking_id ? Number(formData.booking_id) : null,
        item_name: formData.item_name.trim(),
        quantity: Number(formData.quantity),
        price_per_item: Number(formData.price_per_item),
        status: formData.status,
        payment_status: formData.payment_status,
        remarks: formData.remarks,
      };

      if (editingCharge) {
        await api.put(`/minibar-charges/${editingCharge.id}`, payload);
        showToast("Minibar charge updated");
      } else {
        await api.post("/minibar-charges", payload);
        showToast("Minibar consumption recorded");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to record minibar charge";
      showToast(msg, "error");
    }
  };

  const handlePostToFolio = async (charge) => {
    try {
      await api.put(`/minibar-charges/${charge.id}`, { status: "posted" });
      showToast("Minibar charge posted to room folio");
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update status";
      showToast(msg, "error");
    }
  };

  const handleDelete = async (chargeId) => {
    if (!window.confirm("Are you sure you want to delete this minibar charge?")) return;
    try {
      await api.delete(`/minibar-charges/${chargeId}`);
      showToast("Charge deleted");
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete minibar charge";
      showToast(msg, "error");
    }
  };

  // Stats
  const stats = useMemo(() => {
    const totalCount = charges.length;
    const billedToRoom = charges
      .filter((c) => c.status !== "void" && c.payment_status === "bill-to-room")
      .reduce((sum, c) => sum + (c.total_amount || (c.quantity * c.price_per_item) || 0), 0);
    const directPaid = charges
      .filter((c) => c.status !== "void" && c.payment_status === "paid")
      .reduce((sum, c) => sum + (c.total_amount || (c.quantity * c.price_per_item) || 0), 0);
    const totalRevenue = charges
      .filter((c) => c.status !== "void")
      .reduce((sum, c) => sum + (c.total_amount || (c.quantity * c.price_per_item) || 0), 0);

    return { totalCount, billedToRoom, directPaid, totalRevenue };
  }, [charges]);

  // Filtered charges
  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const roomNum = rooms.find((r) => r.id === c.room_id)?.room_number || "";
      const guestName = guests.find((g) => g.id === c.guest_id)?.name || "";

      const matchesSearch =
        !searchQuery ||
        c.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        roomNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guestName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || c.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchesPayment =
        paymentFilter === "ALL" || c.payment_status?.toLowerCase() === paymentFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [charges, rooms, guests, searchQuery, statusFilter, paymentFilter]);

  return (
    <div className="minibar-page">
      {toast && (
        <div className={`mnb-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <PortalHeader
        title="Minibar Consumption & Charges"
        subtitle="Record guest in-room minibar usage, audit restocking, and post charges to folios"
        icon={Wine}
      />

      {/* Stats */}
      <div className="mnb-stats-grid">
        <div className="mnb-stat-card">
          <div className="mnb-stat-icon teal">
            <Wine size={24} />
          </div>
          <div className="mnb-stat-info">
            <h4>Total Items Consumed</h4>
            <div className="stat-value">{stats.totalCount}</div>
          </div>
        </div>

        <div className="mnb-stat-card">
          <div className="mnb-stat-icon emerald">
            <CreditCard size={24} />
          </div>
          <div className="mnb-stat-info">
            <h4>Billed to Room</h4>
            <div className="stat-value">₹{stats.billedToRoom.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="mnb-stat-card">
          <div className="mnb-stat-icon blue">
            <DollarSign size={24} />
          </div>
          <div className="mnb-stat-info">
            <h4>Direct Paid</h4>
            <div className="stat-value">₹{stats.directPaid.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="mnb-stat-card">
          <div className="mnb-stat-icon amber">
            <Coffee size={24} />
          </div>
          <div className="mnb-stat-info">
            <h4>Minibar Gross Revenue</h4>
            <div className="stat-value">₹{stats.totalRevenue.toLocaleString("en-IN")}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mnb-controls-bar">
        <div className="mnb-search-group">
          <div className="mnb-search-box">
            <Search size={16} />
            <input
              type="text"
              className="mnb-search-input"
              placeholder="Search by room, guest, beverage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="mnb-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active</option>
            <option value="posted">Posted to Folio</option>
            <option value="void">Void</option>
          </select>

          <select
            className="mnb-filter-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="ALL">All Payments</option>
            <option value="bill-to-room">Bill to Room</option>
            <option value="paid">Direct Paid</option>
            <option value="complimentary">Complimentary</option>
          </select>
        </div>

        <button className="mnb-primary-btn" onClick={handleOpenAdd}>
          <Plus size={16} />
          Log Minibar Consumption
        </button>
      </div>

      {/* Main Table */}
      <div className="mnb-table-card">
        {filteredCharges.length === 0 ? (
          <div className="mnb-empty">
            <Wine size={48} />
            <h4>No Minibar Charges Found</h4>
            <p>Log consumed beverages and snacks from in-room minibars during housekeeping inspection.</p>
          </div>
        ) : (
          <table className="mnb-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Room & Guest</th>
                <th>Item Consumed</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Amount</th>
                <th>Payment Mode</th>
                <th>Folio Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCharges.map((chg) => {
                const room = rooms.find((r) => r.id === chg.room_id);
                const guest = guests.find((g) => g.id === chg.guest_id);
                const total = chg.total_amount || chg.quantity * chg.price_per_item;

                return (
                  <tr key={chg.id}>
                    <td>
                      {chg.created_at
                        ? new Date(chg.created_at).toLocaleDateString()
                        : "—"}
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {chg.created_at
                          ? new Date(chg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ""}
                      </div>
                    </td>
                    <td>
                      <strong>{room ? `Room ${room.room_number}` : "Hotel / Direct"}</strong>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {guest ? guest.name : "In-House Guest"}
                      </div>
                    </td>
                    <td>
                      <strong>{chg.item_name}</strong>
                      {chg.remarks && (
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {chg.remarks}
                        </div>
                      )}
                    </td>
                    <td>{chg.quantity}</td>
                    <td>₹{Number(chg.price_per_item).toFixed(2)}</td>
                    <td>
                      <strong>₹{Number(total).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className={`mnb-badge ${chg.payment_status?.toLowerCase()}`}>
                        {chg.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className={`mnb-badge ${chg.status?.toLowerCase()}`}>
                        {chg.status}
                      </span>
                    </td>
                    <td>
                      <div className="mnb-actions">
                        {chg.status === "active" && (
                          <button
                            type="button"
                            className="mnb-action-btn"
                            title="Post to Folio"
                            style={{ color: "#0f766e" }}
                            onClick={() => handlePostToFolio(chg)}
                          >
                            <FileText size={16} />
                          </button>
                        )}
                        <button
                          className="mnb-action-btn"
                          title="Edit Charge"
                          onClick={() => handleOpenEdit(chg)}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="mnb-action-btn delete"
                          title="Delete Charge"
                          onClick={() => handleDelete(chg.id)}
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
        <div className="mnb-modal-overlay">
          <div className="mnb-modal">
            <div className="mnb-modal-header">
              <h3>{editingCharge ? "Edit Minibar Charge" : "Log Minibar Consumption"}</h3>
              <button
                className="mnb-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="mnb-modal-body">
                <div className="mnb-form-grid">
                  <div className="mnb-form-group">
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

                  <div className="mnb-form-group">
                    <label>Quick Select Catalog Item</label>
                    <select
                      onChange={(e) => handleItemSelect(e.target.value)}
                      defaultValue={formData.item_name}
                    >
                      {PRESET_MINIBAR_ITEMS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} {p.price > 0 ? `(₹${p.price})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mnb-form-group">
                    <label>Item Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mineral Water (500ml)"
                      value={formData.item_name}
                      onChange={(e) =>
                        setFormData({ ...formData, item_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="mnb-form-group">
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

                  <div className="mnb-form-group">
                    <label>Price Per Item (₹) *</label>
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

                  <div className="mnb-form-group">
                    <label>Payment / Billing Mode</label>
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

                  <div className="mnb-form-group">
                    <label>Folio Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="active">Active (Pending Folio Post)</option>
                      <option value="posted">Posted to Folio</option>
                      <option value="void">Void</option>
                    </select>
                  </div>

                  <div className="mnb-form-group mnb-form-full">
                    <label>Housekeeper / Inspection Notes</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Consumed during evening turndown inspection..."
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
                    Total Charge to Post:
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

              <div className="mnb-modal-footer">
                <button
                  type="button"
                  className="mnb-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="mnb-primary-btn">
                  {editingCharge ? "Save Changes" : "Post Minibar Charge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
