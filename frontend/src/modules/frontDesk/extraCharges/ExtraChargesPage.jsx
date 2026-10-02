import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Sparkles,
  Receipt,
  Clock,
  CheckCircle,
  X,
  BedDouble,
  User,
  Calendar,
  Edit2,
  RotateCcw,
  CreditCard,
  Wallet,
  Banknote,
  Layers,
  Power,
  Check,
  Printer,
  Download,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./extraCharges.css";

const initialFormState = {
  booking_id: "",
  room_id: "",
  charge_name: "",
  quantity: 1,
  rate: "",
  description: "",
  status: "pending",
};

export default function ExtraChargesPage() {
  const { user, hotelInfo } = useAuth();

  const [charges, setCharges] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [catalog, setCatalog] = useState([]); // Completely blank by default

  const [formData, setFormData] = useState(initialFormState);
  const [bookingScope, setBookingScope] = useState("in_house"); // 'in_house' | 'all'
  const [bookingSearchText, setBookingSearchText] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("all"); // 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom'
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);
  const [catalogSearchText, setCatalogSearchText] = useState("");

  const [editingCatalogItemId, setEditingCatalogItemId] = useState(null);
  const [editCatalogItemData, setEditCatalogItemData] = useState({
    name: "",
    default_price: "",
    is_active: true,
  });
  const [savingCatalogEdit, setSavingCatalogEdit] = useState(false);

  // Quick Settlement Modal State
  const [settleModalCharge, setSettleModalCharge] = useState(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("cash"); // 'cash' | 'upi' | 'card' | 'folio'
  const [settleNote, setSettleNote] = useState("");
  const [settling, setSettling] = useState(false);

  // Edit Charge Modal State
  const [editModalCharge, setEditModalCharge] = useState(null);
  const [editFormData, setEditFormData] = useState({
    booking_id: "",
    room_id: "",
    charge_name: "",
    quantity: 1,
    rate: "",
    status: "pending",
    description: "",
  });
  const [editingSaving, setEditingSaving] = useState(false);

  // Printable Slip / Voucher State
  const [printSlipCharge, setPrintSlipCharge] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id ||
      null
    );
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const hId = getLoggedInHotelId();

      const [chargesRes, bookingsRes, guestsRes, roomsRes, catalogRes] = await Promise.all([
        api.get("/extra-charges", { params: { hotel_id: hId } }).catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/extra-charges/catalog", { params: { hotel_id: hId, include_inactive: true } }).catch(() => ({ data: [] })),
      ]);

      const chargesList = normalizeList(chargesRes.data, "extra_charges");
      const bookingsList = normalizeList(bookingsRes.data, "bookings");
      const guestsList = normalizeList(guestsRes.data, "guests");
      const roomsList = normalizeList(roomsRes.data, "rooms");
      const catalogList = normalizeList(catalogRes.data, "services");

      setCharges(hId ? chargesList.filter((c) => !c.hotel_id || Number(c.hotel_id) === Number(hId)) : chargesList);
      setBookings(hId ? bookingsList.filter((b) => !b.hotel_id || Number(b.hotel_id) === Number(hId)) : bookingsList);
      setGuests(hId ? guestsList.filter((g) => !g.hotel_id || Number(g.hotel_id) === Number(hId)) : guestsList);
      setRooms(hId ? roomsList.filter((r) => !r.hotel_id || Number(r.hotel_id) === Number(hId)) : roomsList);
      setCatalog(catalogList || []);
    } catch (err) {
      console.error("Failed to load extra charges data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getGuest = (id) => guests.find((g) => Number(g.id) === Number(id));
  const getRoom = (id) => rooms.find((r) => Number(r.id) === Number(id));
  const getBooking = (id) => bookings.find((b) => Number(b.id) === Number(id));

  const getBookingRooms = (booking) => {
    if (!booking) return [];
    const roomList = [];
    const addedIds = new Set();

    if (booking.room_id) {
      const r = getRoom(booking.room_id);
      if (r) {
        roomList.push(r);
        addedIds.add(Number(r.id));
      }
    }

    let raw = booking.assigned_room_ids;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (Array.isArray(raw)) {
      raw.forEach((id) => {
        if (id && !addedIds.has(Number(id))) {
          const r = getRoom(id);
          if (r) {
            roomList.push(r);
            addedIds.add(Number(r.id));
          }
        }
      });
    }

    return roomList;
  };

  const formatBookingRoomLabel = (booking) => {
    const bRooms = getBookingRooms(booking);
    if (bRooms.length > 0) {
      return bRooms.map((r) => `Room ${r.room_number}`).join(", ");
    }
    return booking?.room_id ? `Room ${getRoom(booking.room_id)?.room_number || booking.room_id}` : "No Room Assigned";
  };

  const inHouseBookings = useMemo(() => {
    return bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "checked_in";
    });
  }, [bookings]);

  const activeAllBookings = useMemo(() => {
    return bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s !== "cancelled" && s !== "canceled";
    });
  }, [bookings]);

  const selectableBookings = useMemo(() => {
    const baseList = bookingScope === "in_house" ? inHouseBookings : activeAllBookings;

    if (!bookingSearchText.trim()) return baseList;

    const q = bookingSearchText.trim().toLowerCase();
    return baseList.filter((b) => {
      const g = getGuest(b.guest_id);
      const guestName = (g?.full_name || "").toLowerCase();
      const guestPhone = (g?.phone || "").toLowerCase();
      const resCode = (b.reservation_code || `#${b.id}`).toLowerCase();

      const bRooms = getBookingRooms(b);
      const roomMatch = bRooms.some((r) =>
        String(r.room_number || "").toLowerCase().includes(q)
      );

      return guestName.includes(q) || guestPhone.includes(q) || resCode.includes(q) || roomMatch;
    });
  }, [bookingScope, inHouseBookings, activeAllBookings, bookingSearchText, guests, rooms]);

  const selectedBooking = useMemo(() => {
    if (!formData.booking_id) return null;
    return bookings.find((b) => String(b.id) === String(formData.booking_id));
  }, [formData.booking_id, bookings]);

  const selectedBookingRooms = useMemo(() => {
    return getBookingRooms(selectedBooking);
  }, [selectedBooking, rooms]);

  const handleBookingSelect = (bookingId) => {
    if (!bookingId) {
      setFormData((prev) => ({ ...prev, booking_id: "", room_id: "" }));
      return;
    }

    const b = bookings.find((item) => String(item.id) === String(bookingId));
    if (!b) return;

    const bRooms = getBookingRooms(b);
    const defaultRoomId = bRooms.length > 0 ? String(bRooms[0].id) : (b.room_id ? String(b.room_id) : "");

    setFormData((prev) => ({
      ...prev,
      booking_id: String(b.id),
      room_id: defaultRoomId,
    }));
  };

  const activeCatalog = useMemo(() => {
    return catalog.filter((c) => c.is_active !== false);
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (!catalogSearchText.trim()) return catalog;
    const q = catalogSearchText.trim().toLowerCase();
    return catalog.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [catalog, catalogSearchText]);

  const handleServiceSelect = (e) => {
    const selectedName = e.target.value;
    const found = activeCatalog.find((c) => c.name === selectedName);

    setFormData((prev) => ({
      ...prev,
      charge_name: selectedName,
      rate: found ? found.default_price : prev.rate,
    }));
  };

  const calculatedTotal = useMemo(() => {
    const q = Number(formData.quantity || 1);
    const r = Number(formData.rate || 0);
    return (q * r).toFixed(2);
  }, [formData.quantity, formData.rate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hId = getLoggedInHotelId() || 1;
    if (!formData.booking_id || !formData.charge_name || Number(formData.rate) < 0) {
      showToast("Please select a booking, service name, and rate.", "error");
      return;
    }

    try {
      setSaving(true);
      await api.post("/extra-charges", {
        hotel_id: Number(hId),
        booking_id: Number(formData.booking_id),
        room_id: formData.room_id ? Number(formData.room_id) : null,
        charge_name: formData.charge_name,
        quantity: Number(formData.quantity),
        rate: Number(formData.rate),
        description: formData.description.trim() || null,
        status: formData.status,
      });

      showToast("Charge posted successfully!");
      setFormData(initialFormState);
      setBookingSearchText("");
      await loadData();
    } catch (err) {
      console.error("Failed to post extra charge:", err);
      const detail = err.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Failed to post charge.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewCatalogItem = async (e) => {
    e.preventDefault();
    if (!newServiceName.trim()) {
      showToast("Please enter a service name.", "error");
      return;
    }

    const hId = getLoggedInHotelId() || 1;

    try {
      setSavingCatalogItem(true);
      const res = await api.post("/extra-charges/catalog", {
        hotel_id: Number(hId),
        name: newServiceName.trim(),
        default_price: Number(newServicePrice || 0),
      });

      setCatalog((prev) => {
        const index = prev.findIndex((item) => item.id === res.data.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = res.data;
          return updated;
        }
        return [...prev, res.data];
      });

      setFormData((prev) => ({
        ...prev,
        charge_name: res.data.name,
        rate: res.data.default_price,
      }));

      showToast(`'${res.data.name}' added to master catalog!`);
      setNewServiceName("");
      setNewServicePrice("");
    } catch (err) {
      console.error("Failed to add catalog service:", err);
      const detail = err.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Failed to save to master list.", "error");
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleStartEditCatalog = (item) => {
    setEditingCatalogItemId(item.id);
    setEditCatalogItemData({
      name: item.name,
      default_price: String(item.default_price || 0),
      is_active: item.is_active !== false,
    });
  };

  const handleCancelEditCatalog = () => {
    setEditingCatalogItemId(null);
  };

  const handleSaveEditCatalog = async (itemId) => {
    if (!editCatalogItemData.name.trim()) {
      showToast("Service name cannot be empty.", "error");
      return;
    }
    try {
      setSavingCatalogEdit(true);
      const res = await api.put(`/extra-charges/catalog/${itemId}`, {
        name: editCatalogItemData.name.trim(),
        default_price: Number(editCatalogItemData.default_price || 0),
        is_active: Boolean(editCatalogItemData.is_active),
      });

      setCatalog((prev) => prev.map((c) => (c.id === itemId ? res.data : c)));
      showToast(`Service '${res.data.name}' updated!`);
      setEditingCatalogItemId(null);
    } catch (err) {
      console.error("Failed to update catalog item:", err);
      const detail = err.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Failed to update item.", "error");
    } finally {
      setSavingCatalogEdit(false);
    }
  };

  const handleToggleCatalogActive = async (item) => {
    const nextState = !item.is_active;
    try {
      const res = await api.put(`/extra-charges/catalog/${item.id}`, {
        is_active: nextState,
      });

      setCatalog((prev) => prev.map((c) => (c.id === item.id ? res.data : c)));
      showToast(`'${item.name}' ${nextState ? "activated" : "deactivated"}!`);
    } catch (err) {
      console.error("Failed to toggle catalog status:", err);
      showToast("Failed to update status.", "error");
    }
  };

  const handleDeleteCatalogItem = async (item) => {
    if (!window.confirm(`Permanently remove '${item.name}' from the master service catalog?`)) return;
    try {
      await api.delete(`/extra-charges/catalog/${item.id}`);
      setCatalog((prev) => prev.filter((c) => c.id !== item.id));
      showToast(`'${item.name}' removed from catalog.`);
    } catch (err) {
      console.error("Failed to delete catalog item:", err);
      showToast("Failed to delete catalog item.", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this extra charge?")) return;
    try {
      await api.delete(`/extra-charges/${id}`);
      showToast("Charge removed.");
      await loadData();
    } catch (err) {
      console.error("Failed to delete extra charge:", err);
      showToast("Failed to delete charge.", "error");
    }
  };

  const handleOpenSettle = (charge) => {
    setSettleModalCharge(charge);
    setSettlePaymentMethod("cash");
    setSettleNote("");
  };

  const handleConfirmSettle = async () => {
    if (!settleModalCharge) return;
    try {
      setSettling(true);
      const methodLabels = {
        cash: "Cash",
        upi: "UPI / QR",
        card: "Card",
        folio: "Billed to Room Folio",
      };
      const label = methodLabels[settlePaymentMethod] || settlePaymentMethod.toUpperCase();
      const prefix = `[Settled via ${label}${settleNote.trim() ? `: ${settleNote.trim()}` : ""}]`;
      const existingDesc = settleModalCharge.description || "";
      const updatedDescription = existingDesc ? `${prefix} ${existingDesc}` : prefix;

      await api.put(`/extra-charges/${settleModalCharge.id}`, {
        status: "paid",
        description: updatedDescription,
      });

      showToast(`Charge #${settleModalCharge.id} marked as PAID (${label})!`);
      setSettleModalCharge(null);
      await loadData();
    } catch (err) {
      console.error("Failed to settle extra charge:", err);
      showToast("Failed to mark charge as paid.", "error");
    } finally {
      setSettling(false);
    }
  };

  const handleRevertPending = async (charge) => {
    if (!window.confirm(`Revert Charge #${charge.id} back to PENDING?`)) return;
    try {
      await api.put(`/extra-charges/${charge.id}`, {
        status: "pending",
      });
      showToast(`Charge #${charge.id} reverted to PENDING.`);
      await loadData();
    } catch (err) {
      console.error("Failed to revert charge status:", err);
      showToast("Failed to revert charge status.", "error");
    }
  };

  const handleOpenEdit = (charge) => {
    setEditModalCharge(charge);
    setEditFormData({
      booking_id: String(charge.booking_id || ""),
      room_id: charge.room_id ? String(charge.room_id) : "",
      charge_name: charge.charge_name || "",
      quantity: charge.quantity || 1,
      rate: charge.rate !== undefined ? String(charge.rate) : "",
      status: charge.status || "pending",
      description: charge.description || "",
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModalCharge) return;
    if (!editFormData.charge_name.trim() || Number(editFormData.rate) < 0 || Number(editFormData.quantity) <= 0) {
      showToast("Please provide valid charge name, quantity, and rate.", "error");
      return;
    }

    try {
      setEditingSaving(true);
      await api.put(`/extra-charges/${editModalCharge.id}`, {
        booking_id: editFormData.booking_id ? Number(editFormData.booking_id) : undefined,
        room_id: editFormData.room_id ? Number(editFormData.room_id) : null,
        charge_name: editFormData.charge_name.trim(),
        quantity: Number(editFormData.quantity),
        rate: Number(editFormData.rate),
        status: editFormData.status,
        description: editFormData.description ? editFormData.description.trim() : null,
      });

      showToast(`Charge #${editModalCharge.id} updated successfully!`);
      setEditModalCharge(null);
      await loadData();
    } catch (err) {
      console.error("Failed to update extra charge:", err);
      const detail = err.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Failed to update charge.", "error");
    } finally {
      setEditingSaving(false);
    }
  };

  const isDateInPreset = (createdAt, preset, customStart, customEnd) => {
    if (!preset || preset === "all") return true;
    if (!createdAt) return true;

    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (preset === "today") {
      return d >= startOfToday && d <= endOfToday;
    }

    if (preset === "yesterday") {
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const endOfYesterday = new Date(endOfToday);
      endOfYesterday.setDate(endOfYesterday.getDate() - 1);
      return d >= startOfYesterday && d <= endOfYesterday;
    }

    if (preset === "this_week") {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      return d >= startOfWeek && d <= endOfToday;
    }

    if (preset === "this_month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return d >= startOfMonth && d <= endOfToday;
    }

    if (preset === "custom") {
      if (customStart) {
        const s = new Date(customStart + "T00:00:00");
        if (!isNaN(s.getTime()) && d < s) return false;
      }
      if (customEnd) {
        const e = new Date(customEnd + "T23:59:59.999");
        if (!isNaN(e.getTime()) && d > e) return false;
      }
      return true;
    }

    return true;
  };

  const filteredCharges = useMemo(() => {
    return charges.filter((c) => {
      const search = searchText.toLowerCase();
      const nameMatch = (c.charge_name || "").toLowerCase().includes(search);
      const bObj = getBooking(c.booking_id);
      const gObj = bObj ? getGuest(bObj.guest_id) : getGuest(c.guest_id);
      const guestMatch = (gObj?.full_name || "").toLowerCase().includes(search);
      const codeMatch = (bObj?.reservation_code || "").toLowerCase().includes(search);
      const rObj = c.room_id ? getRoom(c.room_id) : (bObj ? getRoom(bObj.room_id) : null);
      const roomMatch = rObj ? String(rObj.room_number || "").toLowerCase().includes(search) : false;

      const statusMatch = statusFilter === "all" || String(c.status).toLowerCase() === statusFilter.toLowerCase();
      const dateMatch = isDateInPreset(c.created_at, datePreset, customStartDate, customEndDate);

      return (nameMatch || guestMatch || codeMatch || roomMatch) && statusMatch && dateMatch;
    });
  }, [charges, searchText, statusFilter, datePreset, customStartDate, customEndDate, bookings, guests, rooms]);

  const stats = useMemo(() => {
    const list = filteredCharges;
    const totalCount = list.length;
    const pendingCount = list.filter((c) => String(c.status).toLowerCase() === "pending").length;
    const paidCount = list.filter((c) => String(c.status).toLowerCase() === "paid").length;
    const totalRevenue = list.reduce((acc, c) => acc + Number(c.total_amount || 0), 0);
    return { totalCount, pendingCount, paidCount, totalRevenue };
  }, [filteredCharges]);

  const handleExportCSV = () => {
    if (filteredCharges.length === 0) {
      showToast("No records to export.", "error");
      return;
    }

    const headers = [
      "Charge ID",
      "Date & Time",
      "Booking Reference",
      "Resident Guest",
      "Guest Phone",
      "Room",
      "Charge / Service Name",
      "Description / Notes",
      "Quantity",
      "Unit Rate (INR)",
      "Total Amount (INR)",
      "Payment Status",
    ];

    const rows = filteredCharges.map((c) => {
      const bObj = getBooking(c.booking_id);
      const gObj = bObj ? getGuest(bObj.guest_id) : getGuest(c.guest_id);
      const rObj = c.room_id ? getRoom(c.room_id) : (bObj ? getRoom(bObj.room_id) : null);
      const roomLabel = rObj ? `Room ${rObj.room_number}` : (bObj ? formatBookingRoomLabel(bObj) : "N/A");
      const dateStr = c.created_at ? new Date(c.created_at).toLocaleString("en-IN") : "";

      return [
        `#${c.id}`,
        dateStr,
        bObj?.reservation_code || `#${c.booking_id}`,
        gObj?.full_name || "Guest",
        gObj?.phone || "",
        roomLabel,
        c.charge_name,
        c.description || "",
        c.quantity,
        Number(c.rate).toFixed(2),
        Number(c.total_amount).toFixed(2),
        String(c.status).toUpperCase(),
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateTag =
      datePreset === "today"
        ? "today"
        : datePreset === "yesterday"
        ? "yesterday"
        : new Date().toISOString().slice(0, 10);
    link.download = `extra_charges_${dateTag}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredCharges.length} charges to CSV!`);
  };

  return (
    <div className="directory-page extra-charges-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* HEADER WITH TOP RIGHT ACTION BUTTON */}
      <PortalHeader
        title="Extra Charges"
        kicker="FRONT DESK OPERATIONS"
        description="Add and manage extra charges like extra mattress, laundry, late checkout, and amenities."
        icon={Receipt}
        backPath="/front-desk"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={() => setShowCatalogModal(true)}
          >
            <Layers size={16} /> Master Catalog ({catalog.length})
          </button>
        }
      />

      <div className="dir-stats-grid">
        <StatCard title="Total Charges" value={stats.totalCount} Icon={Receipt} colorTheme="blue" />
        <StatCard title="Pending" value={stats.pendingCount} Icon={Clock} colorTheme="orange" />
        <StatCard title="Paid" value={stats.paidCount} Icon={CheckCircle} colorTheme="green" />
        <StatCard title="Total Amount" value={`₹${stats.totalRevenue.toFixed(2)}`} Icon={Sparkles} colorTheme="purple" />
      </div>

      <section className="dir-modules-section">
        <div className="extra-charges-form-card">
          <div className="form-card-header">
            <Plus size={18} color="#2d5696" />
            <div>
              <h3>Add Extra Charge</h3>
              <p>Add charge against a guest booking.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* TARGET RESIDENT & ROOM SELECTION */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                  <BedDouble size={16} color="#2d5696" />
                  <span>Target Resident / Room Assignment *</span>
                </div>

                {/* Scope selector tabs */}
                <div style={{ display: "flex", gap: "4px", background: "#e2e8f0", padding: "3px", borderRadius: "8px" }}>
                  <button
                    type="button"
                    onClick={() => setBookingScope("in_house")}
                    style={{
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: bookingScope === "in_house" ? "700" : "500",
                      background: bookingScope === "in_house" ? "#ffffff" : "transparent",
                      color: bookingScope === "in_house" ? "#166962" : "#64748b",
                      cursor: "pointer",
                      boxShadow: bookingScope === "in_house" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    In-House Residents ({inHouseBookings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingScope("all")}
                    style={{
                      border: "none",
                      padding: "4px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: bookingScope === "all" ? "700" : "500",
                      background: bookingScope === "all" ? "#ffffff" : "transparent",
                      color: bookingScope === "all" ? "#2d5696" : "#64748b",
                      cursor: "pointer",
                      boxShadow: bookingScope === "all" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    All Active ({activeAllBookings.length})
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "12px" }}>
                {/* Search filter for room or guest */}
                <div style={{ position: "relative" }}>
                  <Search
                    size={15}
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "13px",
                      color: "#94a3b8",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    value={bookingSearchText}
                    onChange={(e) => setBookingSearchText(e.target.value)}
                    placeholder="Search room no. or guest name..."
                    style={{
                      width: "100%",
                      height: "40px",
                      paddingLeft: "32px",
                      paddingRight: "10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                {/* Dropdown with filtered bookings */}
                <div>
                  <select
                    value={formData.booking_id}
                    onChange={(e) => handleBookingSelect(e.target.value)}
                    className="dir-select-field"
                    required
                    style={{ height: "40px", fontSize: "13px" }}
                  >
                    <option value="">
                      {selectableBookings.length === 0
                        ? "-- No matching bookings found --"
                        : "-- Select Resident / Room --"}
                    </option>
                    {selectableBookings.map((b) => {
                      const g = getGuest(b.guest_id);
                      const roomLabel = formatBookingRoomLabel(b);
                      const statusUpper = String(b.status || "").toUpperCase();
                      return (
                        <option key={b.id} value={b.id}>
                          {roomLabel} • {g?.full_name || "Guest"} ({b.reservation_code || `#${b.id}`}) [{statusUpper}]
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Selected Booking Info & Multi-room Sub-selector */}
              {selectedBooking && (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 14px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                    fontSize: "12.5px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={14} color="#64748b" />
                      <strong style={{ color: "#0f172a" }}>
                        {getGuest(selectedBooking.guest_id)?.full_name || "Guest"}
                      </strong>
                    </div>
                    {getGuest(selectedBooking.guest_id)?.phone && (
                      <span style={{ color: "#64748b" }}>
                        📞 {getGuest(selectedBooking.guest_id)?.phone}
                      </span>
                    )}
                    <span className="mono-pill pill-normal" style={{ fontSize: "10px" }}>
                      {String(selectedBooking.status || "").toUpperCase()}
                    </span>
                  </div>

                  {/* Multi-room selector if booking has multiple rooms */}
                  {selectedBookingRooms.length > 1 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontWeight: "600", color: "#475569" }}>Deliver to Specific Room:</span>
                      <select
                        value={formData.room_id}
                        onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                        style={{
                          height: "32px",
                          padding: "0 10px",
                          borderRadius: "6px",
                          border: "1px solid #166962",
                          background: "#f0fdf4",
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#166962",
                        }}
                      >
                        {selectedBookingRooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            Room {r.room_number} ({r.room_type || "Room"})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : selectedBookingRooms.length === 1 ? (
                    <div style={{ color: "#166962", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                      <BedDouble size={14} color="#166962" />
                      <span>Billed to: Room {selectedBookingRooms[0].room_number}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* CHARGE SERVICE DETAILS */}
            <div className="form-row" style={{ gridTemplateColumns: "1.8fr 0.8fr 1fr 1fr" }}>
              <div className="form-group">
                <label>Charge / Service Name *</label>
                <select
                  value={formData.charge_name}
                  onChange={handleServiceSelect}
                  className="dir-select-field"
                  required
                >
                  <option value="">
                    {activeCatalog.length === 0
                      ? "-- No Active Services (Click 'Master Catalog' in Header to configure) --"
                      : "-- Select Service --"}
                  </option>
                  {activeCatalog.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name} (Std: ₹{cat.default_price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Rate (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Example: 500"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Total Amount</label>
                <div className="total-display-box">₹{calculatedTotal}</div>
              </div>
            </div>

            <div className="form-row" style={{ gridTemplateColumns: "1fr 2fr", marginTop: "12px" }}>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="dir-select-field"
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="form-group">
                <label>Description / Item Notes</label>
                <input
                  type="text"
                  placeholder="Example: Extra mattress delivered to room at 8 PM"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button type="submit" className="btn-submit" disabled={saving}>
                <Plus size={14} /> {saving ? "Saving..." : "+ Create Charge"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Extra Charges List"
          description="All extra charges added against bookings."
          badgeCount={filteredCharges.length}
          badgeLabel="records"
        />

        <div className="dir-controls" style={{ marginTop: 0, flexWrap: "wrap", gap: "10px" }}>
          <div className="dir-search-box" style={{ minWidth: "220px", flex: "1.5 1 240px" }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search charge, guest, or room..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <select
            className="dir-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>

          {/* Date Handover Preset Filter */}
          <select
            className="dir-filter-select"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
          >
            <option value="all">📅 All Dates</option>
            <option value="today">📅 Today</option>
            <option value="yesterday">📅 Yesterday (Handover)</option>
            <option value="this_week">📅 Last 7 Days</option>
            <option value="this_month">📅 This Month</option>
            <option value="custom">📅 Custom Range...</option>
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            className="btn-cancel"
            onClick={handleExportCSV}
            title="Export filtered charges to CSV"
            style={{ gap: "6px" }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Custom Date Range Picker sub-row */}
        {datePreset === "custom" && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              fontSize: "12.5px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "600", color: "#475569" }}>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  height: "32px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "600", color: "#475569" }}>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  height: "32px",
                  padding: "0 8px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12px",
                }}
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setCustomStartDate("");
                  setCustomEndDate("");
                }}
                style={{ height: "32px", padding: "0 10px", fontSize: "12px" }}
              >
                Clear Range
              </button>
            )}
          </div>
        )}

        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>CHARGE / DATE</th>
                <th>BOOKING</th>
                <th>GUEST / ROOM</th>
                <th>CHARGE DETAILS</th>
                <th>QTY X RATE</th>
                <th>TOTAL</th>
                <th>STATUS</th>
                <th style={{ textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">Loading extra charges...</td>
                </tr>
              ) : filteredCharges.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">No extra charges recorded.</td>
                </tr>
              ) : (
                filteredCharges.map((c) => {
                  const bObj = getBooking(c.booking_id);
                  const gObj = bObj ? getGuest(bObj.guest_id) : null;
                  const rObj = c.room_id ? getRoom(c.room_id) : (bObj ? getRoom(bObj.room_id) : null);
                  const isInHouse = bObj && (String(bObj.status || "").toLowerCase().includes("check"));

                  return (
                    <tr key={c.id} className="dir-table-row">
                      <td>
                        <span className="booking-id-tag">#{c.id}</span>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                          {c.created_at
                            ? new Date(c.created_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: "#2d5696" }}>{bObj?.reservation_code || `#${c.booking_id}`}</strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: "600", color: "#0f172a" }}>{gObj?.full_name || "Guest"}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <span className="text-muted" style={{ fontSize: "11px", fontWeight: "600" }}>
                              {rObj ? `Room ${rObj.room_number}` : (bObj ? formatBookingRoomLabel(bObj) : "-")}
                            </span>
                            {isInHouse && (
                              <span className="mono-pill pill-normal" style={{ fontSize: "9px", padding: "1px 5px" }}>
                                IN-HOUSE
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong>{c.charge_name}</strong>
                          {c.description && <span className="text-muted" style={{ fontSize: "11px" }}>{c.description}</span>}
                        </div>
                      </td>
                      <td>{c.quantity} x ₹{Number(c.rate).toFixed(2)}</td>
                      <td><strong style={{ color: "#166962" }}>₹{Number(c.total_amount).toFixed(2)}</strong></td>
                      <td>
                        <span className={`mono-pill ${c.status === "paid" ? "pill-normal" : "pill-warning"}`}>
                          {String(c.status).toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {c.status === "pending" ? (
                            <button
                              type="button"
                              className="dir-action-inline-btn settle-btn"
                              onClick={() => handleOpenSettle(c)}
                              title="Settle / Mark as Paid"
                            >
                              <CreditCard size={13} color="#166962" />
                              <span style={{ fontSize: "11px", fontWeight: "700", color: "#166962", marginLeft: "4px" }}>
                                Settle
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              onClick={() => handleRevertPending(c)}
                              title="Revert to Pending"
                            >
                              <RotateCcw size={13} color="#b45309" />
                            </button>
                          )}

                          <button
                            type="button"
                            className="dir-action-inline-btn edit-btn"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Charge"
                          >
                            <Edit2 size={13} color="#2563eb" />
                          </button>

                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            onClick={() => setPrintSlipCharge(c)}
                            title="Print Service Delivery Voucher / Slip"
                            style={{ background: "#f8fafc" }}
                          >
                            <Printer size={13} color="#475569" />
                          </button>

                          <button
                            type="button"
                            className="dir-action-inline-btn"
                            onClick={() => handleDelete(c.id)}
                            title="Delete Charge"
                          >
                            <Trash2 size={13} color="#dc2626" />
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

      {/* MASTER SERVICE CATALOG MANAGER MODAL */}
      {showCatalogModal && (
        <div className="modal-overlay" onClick={() => !savingCatalogItem && !savingCatalogEdit && setShowCatalogModal(false)}>
          <div className="modal-content" style={{ maxWidth: "720px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Layers size={18} color="#2d5696" />
                <h3 style={{ margin: 0 }}>Master Service Catalog</h3>
                <span className="mono-pill pill-normal" style={{ fontSize: "11px" }}>
                  {catalog.length} Services ({activeCatalog.length} Active)
                </span>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowCatalogModal(false)}
                disabled={savingCatalogItem || savingCatalogEdit}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: "18px 20px" }}>
              {/* Quick Add New Service Inline Form */}
              <form
                onSubmit={handleCreateNewCatalogItem}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "1.8fr 1fr auto",
                  gap: "10px",
                  alignItems: "end",
                }}
              >
                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: "700" }}>Service / Item Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Laundry Express, Airport Cab"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    required
                    style={{ height: "38px" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "12px", fontWeight: "700" }}>Standard Rate (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 500"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    required
                    style={{ height: "38px" }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-submit"
                  disabled={savingCatalogItem}
                  style={{ height: "38px", whiteSpace: "nowrap" }}
                >
                  <Plus size={14} /> {savingCatalogItem ? "Adding..." : "Add Item"}
                </button>
              </form>

              {/* Search catalog filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={14} style={{ position: "absolute", left: "10px", top: "12px", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Search master services..."
                    value={catalogSearchText}
                    onChange={(e) => setCatalogSearchText(e.target.value)}
                    style={{
                      width: "100%",
                      height: "36px",
                      paddingLeft: "32px",
                      paddingRight: "10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                    }}
                  />
                </div>
              </div>

              {/* Catalog Items Table */}
              <div className="catalog-table-container" style={{ marginTop: "4px" }}>
                <table className="catalog-table">
                  <thead>
                    <tr>
                      <th>SERVICE NAME</th>
                      <th>STANDARD RATE</th>
                      <th>STATUS</th>
                      <th style={{ textAlign: "right" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", padding: "24px", color: "#878e99" }}>
                          {catalog.length === 0
                            ? "No service catalog items defined yet. Use the form above to add items."
                            : "No matching catalog items found."}
                        </td>
                      </tr>
                    ) : (
                      filteredCatalog.map((item) => {
                        const isEditingThis = editingCatalogItemId === item.id;

                        if (isEditingThis) {
                          return (
                            <tr key={item.id} style={{ background: "#eff6ff" }}>
                              <td>
                                <input
                                  type="text"
                                  value={editCatalogItemData.name}
                                  onChange={(e) => setEditCatalogItemData({ ...editCatalogItemData, name: e.target.value })}
                                  style={{ height: "32px", fontSize: "12.5px", width: "100%" }}
                                  required
                                  autoFocus
                                />
                              </td>
                              <td style={{ width: "130px" }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editCatalogItemData.default_price}
                                  onChange={(e) => setEditCatalogItemData({ ...editCatalogItemData, default_price: e.target.value })}
                                  style={{ height: "32px", fontSize: "12.5px", width: "100%" }}
                                  required
                                />
                              </td>
                              <td style={{ width: "120px" }}>
                                <select
                                  value={editCatalogItemData.is_active ? "active" : "inactive"}
                                  onChange={(e) => setEditCatalogItemData({ ...editCatalogItemData, is_active: e.target.value === "active" })}
                                  style={{ height: "32px", fontSize: "12px", width: "100%", borderRadius: "4px" }}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                </select>
                              </td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <button
                                  type="button"
                                  className="dir-action-inline-btn"
                                  style={{ background: "#ecfdf5", borderColor: "#a7f3d0", marginRight: "4px" }}
                                  onClick={() => handleSaveEditCatalog(item.id)}
                                  disabled={savingCatalogEdit}
                                  title="Save Changes"
                                >
                                  <Check size={14} color="#059669" />
                                </button>
                                <button
                                  type="button"
                                  className="dir-action-inline-btn"
                                  onClick={handleCancelEditCatalog}
                                  disabled={savingCatalogEdit}
                                  title="Cancel Edit"
                                >
                                  <X size={14} color="#64748b" />
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong style={{ color: item.is_active ? "#0f172a" : "#94a3b8" }}>
                                {item.name}
                              </strong>
                            </td>
                            <td>
                              <span style={{ fontWeight: "600", color: item.is_active ? "#166962" : "#94a3b8" }}>
                                ₹{Number(item.default_price || 0).toFixed(2)}
                              </span>
                            </td>
                            <td>
                              <span className={`mono-pill ${item.is_active ? "pill-normal" : "pill-warning"}`}>
                                {item.is_active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="dir-action-inline-btn edit-btn"
                                  onClick={() => handleStartEditCatalog(item)}
                                  title="Edit Service"
                                >
                                  <Edit2 size={13} color="#2563eb" />
                                </button>
                                <button
                                  type="button"
                                  className="dir-action-inline-btn"
                                  onClick={() => handleToggleCatalogActive(item)}
                                  title={item.is_active ? "Deactivate Service" : "Activate Service"}
                                  style={{
                                    background: item.is_active ? "#f0fdf4" : "#fef2f2",
                                    borderColor: item.is_active ? "#bbf7d0" : "#fecaca",
                                  }}
                                >
                                  <Power size={13} color={item.is_active ? "#16a34a" : "#dc2626"} />
                                </button>
                                <button
                                  type="button"
                                  className="dir-action-inline-btn"
                                  onClick={() => handleDeleteCatalogItem(item)}
                                  title="Delete Service"
                                >
                                  <Trash2 size={13} color="#dc2626" />
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
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowCatalogModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK SETTLEMENT MODAL */}
      {settleModalCharge && (
        <div className="modal-overlay" onClick={() => !settling && setSettleModalCharge(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle size={18} color="#166962" />
                <h3 style={{ margin: 0 }}>Settle Extra Charge #{settleModalCharge.id}</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !settling && setSettleModalCharge(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: "18px 20px" }}>
              {/* Charge Summary Box */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Charge Item:</span>
                  <strong style={{ color: "#0f172a" }}>{settleModalCharge.charge_name}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Resident:</span>
                  <span>{getGuest(settleModalCharge.guest_id)?.full_name || "Guest"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Quantity & Rate:</span>
                  <span>{settleModalCharge.quantity} x ₹{Number(settleModalCharge.rate).toFixed(2)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "6px",
                    borderTop: "1px dashed #cbd5e1",
                    fontSize: "14px",
                  }}
                >
                  <span style={{ fontWeight: "700", color: "#0f172a" }}>Total Amount Due:</span>
                  <strong style={{ color: "#166962", fontSize: "16px" }}>
                    ₹{Number(settleModalCharge.total_amount).toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div style={{ marginTop: "8px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>
                  Payment Method *
                </label>
                <div className="payment-method-grid">
                  <button
                    type="button"
                    className={`payment-method-card ${settlePaymentMethod === "cash" ? "selected" : ""}`}
                    onClick={() => setSettlePaymentMethod("cash")}
                  >
                    <Banknote size={18} />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    className={`payment-method-card ${settlePaymentMethod === "upi" ? "selected" : ""}`}
                    onClick={() => setSettlePaymentMethod("upi")}
                  >
                    <CreditCard size={18} />
                    <span>UPI / QR</span>
                  </button>

                  <button
                    type="button"
                    className={`payment-method-card ${settlePaymentMethod === "card" ? "selected" : ""}`}
                    onClick={() => setSettlePaymentMethod("card")}
                  >
                    <Wallet size={18} />
                    <span>Card</span>
                  </button>

                  <button
                    type="button"
                    className={`payment-method-card ${settlePaymentMethod === "folio" ? "selected" : ""}`}
                    onClick={() => setSettlePaymentMethod("folio")}
                  >
                    <Receipt size={18} />
                    <span>Folio / Bill</span>
                  </button>
                </div>
              </div>

              {/* Settlement Note */}
              <div style={{ marginTop: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>
                  Receipt / Transaction Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #827361 or Handed to Front Desk"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  style={{
                    width: "100%",
                    height: "38px",
                    padding: "0 10px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    marginTop: "4px",
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSettleModalCharge(null)}
                disabled={settling}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={handleConfirmSettle}
                disabled={settling}
              >
                <CheckCircle size={14} />
                {settling ? "Settling..." : `Mark Paid (₹${Number(settleModalCharge.total_amount).toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EXTRA CHARGE MODAL */}
      {editModalCharge && (
        <div className="modal-overlay" onClick={() => !editingSaving && setEditModalCharge(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Edit2 size={18} color="#2563eb" />
                <h3 style={{ margin: 0 }}>Edit Extra Charge #{editModalCharge.id}</h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !editingSaving && setEditModalCharge(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="modal-body" style={{ padding: "18px 20px" }}>
                {/* Booking & Room row */}
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "10px" }}>
                  <div className="form-group">
                    <label>Assigned Resident / Booking *</label>
                    <select
                      value={editFormData.booking_id}
                      onChange={(e) => {
                        const newBookingId = e.target.value;
                        const targetB = bookings.find((b) => String(b.id) === String(newBookingId));
                        const bRooms = getBookingRooms(targetB);
                        const defaultRId = bRooms.length > 0 ? String(bRooms[0].id) : (targetB?.room_id ? String(targetB.room_id) : "");
                        setEditFormData((prev) => ({
                          ...prev,
                          booking_id: newBookingId,
                          room_id: defaultRId,
                        }));
                      }}
                      className="dir-select-field"
                      required
                      style={{ height: "38px", fontSize: "12.5px" }}
                    >
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {formatBookingRoomLabel(b)} • {getGuest(b.guest_id)?.full_name} ({b.reservation_code || `#${b.id}`})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Target Room</label>
                    {(() => {
                      const editB = bookings.find((b) => String(b.id) === String(editFormData.booking_id));
                      const bRooms = getBookingRooms(editB);
                      if (bRooms.length > 1) {
                        return (
                          <select
                            value={editFormData.room_id}
                            onChange={(e) => setEditFormData({ ...editFormData, room_id: e.target.value })}
                            className="dir-select-field"
                            style={{ height: "38px", fontSize: "12.5px" }}
                          >
                            {bRooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                Room {r.room_number}
                              </option>
                            ))}
                          </select>
                        );
                      }
                      return (
                        <input
                          type="text"
                          disabled
                          value={bRooms.length === 1 ? `Room ${bRooms[0].room_number}` : (editFormData.room_id ? `Room ${getRoom(editFormData.room_id)?.room_number || editFormData.room_id}` : "Auto")}
                          style={{ height: "38px", fontSize: "12.5px", background: "#f8fafc" }}
                        />
                      );
                    })()}
                  </div>
                </div>

                {/* Service Name & Status */}
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginTop: "4px" }}>
                  <div className="form-group">
                    <label>Charge / Service Name *</label>
                    <input
                      type="text"
                      value={editFormData.charge_name}
                      onChange={(e) => setEditFormData({ ...editFormData, charge_name: e.target.value })}
                      required
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="dir-select-field"
                      style={{ height: "38px" }}
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>

                {/* Qty, Rate, Total Amount */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "4px" }}>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.quantity}
                      onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                      required
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Rate (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editFormData.rate}
                      onChange={(e) => setEditFormData({ ...editFormData, rate: e.target.value })}
                      required
                      style={{ height: "38px" }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Total Amount</label>
                    <div className="total-display-box" style={{ height: "38px", fontSize: "14px" }}>
                      ₹{(Number(editFormData.quantity || 1) * Number(editFormData.rate || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="form-group" style={{ marginTop: "4px" }}>
                  <label>Description / Notes</label>
                  <input
                    type="text"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    placeholder="Charge details, delivery instructions, or notes"
                    style={{ height: "38px" }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditModalCharge(null)}
                  disabled={editingSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={editingSaving}
                >
                  <Edit2 size={14} />
                  {editingSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE CHARGE SLIP / SERVICE DELIVERY VOUCHER MODAL */}
      {printSlipCharge && (() => {
        const bObj = getBooking(printSlipCharge.booking_id);
        const gObj = bObj ? getGuest(bObj.guest_id) : getGuest(printSlipCharge.guest_id);
        const rObj = printSlipCharge.room_id ? getRoom(printSlipCharge.room_id) : (bObj ? getRoom(bObj.room_id) : null);
        const hotelName = hotelInfo?.name || user?.hotel?.name || user?.hotel_name || "HOTEL OPERATIONS";
        const voucherNumber = `EC-${String(printSlipCharge.id).padStart(5, "0")}`;
        const chargeDate = printSlipCharge.created_at
          ? new Date(printSlipCharge.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
          : new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

        return (
          <div className="modal-overlay" onClick={() => setPrintSlipCharge(null)}>
            <div
              className="modal-content"
              style={{ maxWidth: "680px", background: "#ffffff" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header no-print">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Printer size={18} color="#2d5696" />
                  <h3 style={{ margin: 0 }}>Service Delivery Voucher #{voucherNumber}</h3>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setPrintSlipCharge(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: "20px" }}>
                {/* THE ACTUAL PRINTABLE SHEET */}
                <div className="printable-charge-slip">
                  {/* Header */}
                  <div
                    style={{
                      borderBottom: "2px solid #0f172a",
                      paddingBottom: "12px",
                      marginBottom: "16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: "800",
                          color: "#0f172a",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {hotelName}
                      </h2>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          marginTop: "3px",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Front Desk & Hospitality Operations • Extra Service Voucher
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#2d5696" }}>
                        VOUCHER #{voucherNumber}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        Date: {chargeDate}
                      </div>
                    </div>
                  </div>

                  {/* Guest & Room Details Grid */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "12px 14px",
                      marginBottom: "16px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
                      fontSize: "12.5px",
                    }}
                  >
                    <div>
                      <div style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>
                        Guest / Resident Name
                      </div>
                      <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>
                        {gObj?.full_name || "Resident Guest"}
                      </strong>
                      {gObj?.phone && (
                        <div style={{ color: "#475569", fontSize: "11.5px" }}>Phone: {gObj.phone}</div>
                      )}
                    </div>

                    <div>
                      <div style={{ color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>
                        Room & Reservation
                      </div>
                      <strong style={{ fontSize: "13.5px", color: "#166962" }}>
                        {rObj ? `Room ${rObj.room_number}` : (bObj ? formatBookingRoomLabel(bObj) : "Room -")}
                      </strong>
                      <div style={{ color: "#475569", fontSize: "11.5px" }}>
                        Booking Ref: <strong>{bObj?.reservation_code || `#${printSlipCharge.booking_id}`}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Itemized Table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1.5px solid #cbd5e1", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", width: "40px" }}>#</th>
                        <th style={{ padding: "8px 10px" }}>ITEM / SERVICE DESCRIPTION</th>
                        <th style={{ padding: "8px 10px", textAlign: "center", width: "70px" }}>QTY</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: "100px" }}>RATE (₹)</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: "110px" }}>AMOUNT (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "10px" }}>1</td>
                        <td style={{ padding: "10px" }}>
                          <strong style={{ color: "#0f172a" }}>{printSlipCharge.charge_name}</strong>
                          {printSlipCharge.description && (
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                              {printSlipCharge.description}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "10px", textAlign: "center" }}>{printSlipCharge.quantity}</td>
                        <td style={{ padding: "10px", textAlign: "right" }}>₹{Number(printSlipCharge.rate).toFixed(2)}</td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: "700" }}>
                          ₹{Number(printSlipCharge.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #cbd5e1" }}>
                        <td colSpan="3" style={{ padding: "10px", verticalAlign: "top" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              color: printSlipCharge.status === "paid" ? "#059669" : "#b45309",
                            }}
                          >
                            Status: {printSlipCharge.status === "paid" ? "PAID / SETTLED" : "PENDING - POSTED TO ROOM FOLIO"}
                          </span>
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: "700", fontSize: "13px" }}>
                          TOTAL DUE:
                        </td>
                        <td style={{ padding: "10px", textAlign: "right", fontWeight: "800", fontSize: "15px", color: "#166962" }}>
                          ₹{Number(printSlipCharge.total_amount).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Guest Acknowledgment text */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      fontSize: "11px",
                      color: "#475569",
                      lineHeight: "1.4",
                      marginBottom: "24px",
                    }}
                  >
                    <strong>Acknowledgment & Authorization:</strong> I hereby acknowledge the receipt and delivery of the above items/services in good condition. I authorize {hotelName} to post the total amount of <strong>₹{Number(printSlipCharge.total_amount).toFixed(2)}</strong> to my room account folio.
                  </div>

                  {/* Signatures */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginTop: "20px" }}>
                    <div>
                      <div style={{ borderBottom: "1.5px solid #0f172a", height: "40px", marginBottom: "6px" }}></div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>Guest Signature</div>
                      <div style={{ fontSize: "10.5px", color: "#64748b" }}>Date: ____ / ____ / 20___</div>
                    </div>
                    <div>
                      <div style={{ borderBottom: "1.5px solid #0f172a", height: "40px", marginBottom: "6px" }}></div>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>Attendant / Front Desk Signature</div>
                      <div style={{ fontSize: "10.5px", color: "#64748b" }}>Handled By: ____________________</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer no-print">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setPrintSlipCharge(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={() => window.print()}
                >
                  <Printer size={14} /> Print Voucher
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}