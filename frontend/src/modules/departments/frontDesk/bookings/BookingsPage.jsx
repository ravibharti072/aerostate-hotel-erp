import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarCheck,
  CheckCircle,
  CreditCard,
  Edit,
  Filter,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
  User,
  X
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard";
import "./bookings.css";

// Helper: Returns today's date formatted as YYYY-MM-DDTHH:MM with time locked to 11:00 AM
const getTodayDateTimeLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T11:00`;
};

// Helper: Returns tomorrow's date formatted as YYYY-MM-DDTHH:MM with time locked to 11:00 AM
const getTomorrowDateTimeLocal = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T11:00`;
};

const getAutoGstRate = (amount) => {
  const roomAmount = Number(amount || 0);
  if (roomAmount <= 1000) return 0;
  if (roomAmount <= 7500) return 5;
  return 18;
};

// Calculate nights between check-in and check-out
const calculateNights = (checkin, checkout) => {
  if (!checkin || !checkout) return 1;
  const start = new Date(checkin);
  const end = new Date(checkout);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 1;
};

const calculateTaxAndTotal = ({ nightlyRate, nights, discount, taxMode, taxRate }) => {
  const ratePerNight = Number(nightlyRate || 0);
  const totalNights = Number(nights || 1);
  const grossRoomRate = ratePerNight * totalNights;
  
  const discountAmount = Number(discount || 0);
  const gstRate = Number(taxRate || 0);

  const amountAfterDiscount = Math.max(grossRoomRate - discountAmount, 0);

  let taxAmount = 0;
  let totalAmount = amountAfterDiscount;

  if (gstRate > 0 && taxMode === "exclusive") {
    taxAmount = amountAfterDiscount * (gstRate / 100);
    totalAmount = amountAfterDiscount + taxAmount;
  }

  if (gstRate > 0 && taxMode === "inclusive") {
    taxAmount =
      amountAfterDiscount - amountAfterDiscount / (1 + gstRate / 100);
    totalAmount = amountAfterDiscount;
  }

  return {
    grossRoomRate: Number(grossRoomRate.toFixed(2)),
    taxAmount: Number(taxAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

const initialFormData = {
  full_name: "",
  phone: "",
  email: "",
  id_proof_type: "Aadhar",
  id_proof_number: "",
  room_id: "",
  checkin_date: getTodayDateTimeLocal(),
  checkout_date: getTomorrowDateTimeLocal(),
  adults: 1,
  children: 0,
  booking_source: "walk-in",
  status: "confirmed",
  room_rate: "",
  discount: 0,
  tax_mode: "inclusive",
  tax_rate_type: "auto",
  tax_rate: 0,
  advance_paid: 0,
  payment_status: "pending",
};

const bookingStatuses = ["confirmed", "checked-in", "checked-out", "cancelled"];
const paymentStatuses = ["pending", "partial", "paid"];
const bookingSources = ["walk-in", "phone", "website", "agent", "ota", "other"];

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [formData, setFormData] = useState(initialFormData);
  const [editingBooking, setEditingBooking] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getApiErrorMessage = (err, fallbackMessage) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
          return `${field}: ${item.msg}`;
        })
        .join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (err.message) return err.message;
    return fallbackMessage;
  };

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [bookingsResponse, guestsResponse, roomsResponse] =
        await Promise.all([
          api.get("/bookings"),
          api.get("/guests"),
          api.get("/rooms"),
        ]);

      const hotelId = getLoggedInHotelId();

      const bookingsList = normalizeList(bookingsResponse.data, "bookings");
      const guestsList = normalizeList(guestsResponse.data, "guests");
      const roomsList = normalizeList(roomsResponse.data, "rooms");

      if (hotelId) {
        setBookings(
          bookingsList.filter(
            (booking) => Number(booking.hotel_id) === Number(hotelId)
          )
        );
        setGuests(
          guestsList.filter((guest) => Number(guest.hotel_id) === Number(hotelId))
        );
        setRooms(
          roomsList.filter((room) => Number(room.hotel_id) === Number(hotelId))
        );
      } else {
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
      }
    } catch (err) {
      console.error("Fetch booking data error:", err);
      setError(getApiErrorMessage(err, "Failed to load booking data."));
      setBookings([]);
      setGuests([]);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGuestName = (guestId) => {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || "-";
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || "-";
  };

  const nightsCount = useMemo(() => {
    return calculateNights(formData.checkin_date, formData.checkout_date);
  }, [formData.checkin_date, formData.checkout_date]);

  const activeTaxRate = useMemo(() => {
    if (formData.tax_rate_type === "auto") {
      return getAutoGstRate(formData.room_rate);
    }
    return Number(formData.tax_rate || 0);
  }, [formData.room_rate, formData.tax_rate, formData.tax_rate_type]);

  const amountCalculation = useMemo(() => {
    return calculateTaxAndTotal({
      nightlyRate: formData.room_rate,
      nights: nightsCount,
      discount: formData.discount,
      taxMode: formData.tax_mode,
      taxRate: activeTaxRate,
    });
  }, [formData.room_rate, nightsCount, formData.discount, formData.tax_mode, activeTaxRate]);

  const calculatedGrossRoomRate = amountCalculation.grossRoomRate;
  const calculatedTaxAmount = amountCalculation.taxAmount;
  const calculatedTotalAmount = amountCalculation.totalAmount;

  const discountAmount = Number(formData.discount || 0);
  const advancePaidAmount = Number(formData.advance_paid || 0);
  const balanceAmount = Math.max(calculatedTotalAmount - advancePaidAmount, 0);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Enforce fixed 11:00 AM time whenever check-in or check-out date is changed
    if (name === "checkin_date" || name === "checkout_date") {
      const selectedDateOnly = value.split("T")[0]; // extract YYYY-MM-DD
      const lockedDateTime = selectedDateOnly ? `${selectedDateOnly}T11:00` : value;

      setFormData((prev) => ({
        ...prev,
        [name]: lockedDateTime,
      }));
      return;
    }

    if (name === "room_id") {
      const selectedRoom = rooms.find(
        (room) => Number(room.id) === Number(value)
      );

      const selectedRoomRate =
        selectedRoom?.base_price ??
        selectedRoom?.price_per_night ??
        formData.room_rate;

      setFormData((prev) => ({
        ...prev,
        room_id: value,
        room_rate: selectedRoomRate,
        tax_rate:
          prev.tax_rate_type === "auto"
            ? getAutoGstRate(selectedRoomRate)
            : prev.tax_rate,
      }));

      return;
    }

    if (name === "room_rate") {
      setFormData((prev) => ({
        ...prev,
        room_rate: value,
        tax_rate:
          prev.tax_rate_type === "auto" ? getAutoGstRate(value) : prev.tax_rate,
      }));

      return;
    }

    if (name === "tax_rate_type") {
      setFormData((prev) => ({
        ...prev,
        tax_rate_type: value,
        tax_rate:
          value === "auto" ? getAutoGstRate(prev.room_rate) : Number(value),
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingBooking(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const hotelId = getLoggedInHotelId();
      if (!hotelId) {
        throw new Error("Hotel ID not found. Please logout and login again.");
      }

      let guestId = editingBooking?.guest_id;
      const matchedGuest = guests.find(
        (g) => String(g.phone).trim() === String(formData.phone).trim() && Number(g.hotel_id) === Number(hotelId)
      );

      if (matchedGuest) {
        guestId = matchedGuest.id;
      } else {
        const guestRes = await api.post("/guests", {
          hotel_id: Number(hotelId),
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || null,
          id_type: formData.id_proof_type,
          id_number: formData.id_proof_number.trim() || null,
        });
        guestId = guestRes.data.id;
      }

      const payload = {
        hotel_id: Number(hotelId),
        guest_id: Number(guestId),
        room_id: Number(formData.room_id),
        checkin_date: new Date(formData.checkin_date).toISOString(),
        checkout_date: new Date(formData.checkout_date).toISOString(),
        adults: Number(formData.adults || 1),
        children: Number(formData.children || 0),
        booking_source: formData.booking_source,
        status: formData.status,
        room_rate: Number(calculatedGrossRoomRate || 0),
        discount: Number(formData.discount || 0),
        tax: Number(calculatedTaxAmount || 0),
        total_amount: Number(calculatedTotalAmount || 0),
        advance_paid: Number(formData.advance_paid || 0),
        payment_status: formData.payment_status,
      };

      if (editingBooking) {
        await api.put(`/bookings/${editingBooking.id}`, payload);
        setSuccess("Booking updated successfully.");
      } else {
        await api.post("/bookings", payload);
        setSuccess("Booking created successfully.");
      }

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      resetForm();
      await fetchData();
    } catch (err) {
      console.error("Save booking error:", err);
      setError(getApiErrorMessage(err, "Failed to save booking."));
    } finally {
      setSaving(false);
    }
  };

  const toDateTimeLocal = (value) => {
    if (!value) return "";
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setError("");
    setSuccess("");

    const nights = calculateNights(booking.checkin_date, booking.checkout_date);
    const totalStoredRate = booking.room_rate ?? 0;
    const nightlyRate = nights > 0 ? totalStoredRate / nights : totalStoredRate;
    const autoRate = getAutoGstRate(nightlyRate);

    const bookingGuest = guests.find((g) => Number(g.id) === Number(booking.guest_id));

    setFormData({
      full_name: bookingGuest?.full_name || "",
      phone: bookingGuest?.phone || "",
      email: bookingGuest?.email || "",
      id_proof_type: bookingGuest?.id_type || "Aadhar",
      id_proof_number: bookingGuest?.id_number || "",
      room_id: booking.room_id || "",
      checkin_date: toDateTimeLocal(booking.checkin_date),
      checkout_date: toDateTimeLocal(booking.checkout_date),
      adults: booking.adults ?? 1,
      children: booking.children ?? 0,
      booking_source: booking.booking_source || "walk-in",
      status: booking.status || "confirmed",
      room_rate: nightlyRate,
      discount: booking.discount ?? 0,
      tax_mode: "inclusive",
      tax_rate_type: "auto",
      tax_rate: autoRate,
      advance_paid: booking.advance_paid ?? 0,
      payment_status: booking.payment_status || "pending",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (booking) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete booking #${booking.id}?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(booking.id);
      setError("");
      setSuccess("");

      await api.delete(`/bookings/${booking.id}`);
      setSuccess("Booking deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      if (editingBooking?.id === booking.id) {
        resetForm();
      }

      await fetchData();
    } catch (err) {
      console.error("Delete booking error:", err);
      setError(getApiErrorMessage(err, "Failed to delete booking."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleCheckIn = async (booking) => {
    try {
      setProcessingId(booking.id);
      setError("");
      setSuccess("");

      await api.post(`/bookings/${booking.id}/check-in`);
      setSuccess("Guest checked in successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      await fetchData();
    } catch (err) {
      console.error("Check-in error:", err);
      setError(getApiErrorMessage(err, "Failed to check in guest."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckOut = async (booking) => {
    try {
      setProcessingId(booking.id);
      setError("");
      setSuccess("");

      await api.post(`/bookings/${booking.id}/check-out`);
      setSuccess("Guest checked out successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      await fetchData();
    } catch (err) {
      console.error("Check-out error:", err);
      setError(getApiErrorMessage(err, "Failed to check out guest."));
    } finally {
      setProcessingId(null);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const search = searchText.toLowerCase();
      const status = String(booking.status || "").toLowerCase();

      const guestName = getGuestName(booking.guest_id).toLowerCase();
      const roomNumber = getRoomNumber(booking.room_id).toLowerCase();
      const bookingId = String(booking.id || "").toLowerCase();

      const matchesSearch =
        !search ||
        guestName.includes(search) ||
        roomNumber.includes(search) ||
        bookingId.includes(search);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [bookings, guests, rooms, searchText, statusFilter]);

  const recentBookings = useMemo(() => {
    return [...filteredBookings]
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
      .slice(0, 10);
  }, [filteredBookings]);

  const bookingStats = useMemo(() => {
    return {
      total: bookings.length,
      confirmed: bookings.filter(
        (booking) => String(booking.status || "").toLowerCase() === "confirmed"
      ).length,
      checkedIn: bookings.filter((booking) => {
        const status = String(booking.status || "").toLowerCase();
        return status === "checked-in" || status === "checked_in";
      }).length,
      pendingPayment: bookings.filter(
        (booking) =>
          String(booking.payment_status || "").toLowerCase() === "pending"
      ).length,
    };
  }, [bookings]);

  return (
    <div className="bookings-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Bookings"
        kicker="BOOKINGS MANAGEMENT"
        description="Create reservations, assign guests to rooms, manage check-in, check-out, and payment status."
        icon={CalendarCheck}
        backPath="/front-desk"
      />

      {error && <div className="bookings-error-box">{error}</div>}
      {success && <div className="bookings-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID (No Subtext) --- */}
      <div className="bookings-stats-grid">
        <StatCard
          title="Total Bookings"
          value={bookingStats.total}
          Icon={CalendarCheck}
          colorTheme="blue"
        />
        <StatCard
          title="Confirmed"
          value={bookingStats.confirmed}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Checked-in"
          value={bookingStats.checkedIn}
          Icon={LogIn}
          colorTheme="purple"
        />
        <StatCard
          title="Pending Payment"
          value={bookingStats.pendingPayment}
          Icon={CreditCard}
          colorTheme="orange"
        />
      </div>
      {/* --------------------------------------- */}

      <div className="bookings-layout-stacked">
        
        {/* Form Card (Full Width) */}
        <section className="bookings-form-card">
          <div className="bookings-section-header">
            <div className="bookings-section-title">
              <div className="bookings-section-icon">
                {editingBooking ? <Edit size={18} /> : <Plus size={18} />}
              </div>
              <div>
                <h3>{editingBooking ? "Edit Booking" : "Create Booking"}</h3>
                <p>
                  {editingBooking
                    ? "Update selected reservation."
                    : "Create a new reservation for guest and room. Check-in and Check-out times are fixed at 11:00 AM."}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bookings-form-grid-full">
            <div className="bookings-form-group">
              <label>Guest Full Name *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Enter guest name"
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Phone Number *</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="10-digit mobile number"
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="guest@example.com"
              />
            </div>

            <div className="bookings-form-group">
              <label>Room *</label>
              <select
                name="room_id"
                value={formData.room_id}
                onChange={handleChange}
                required
              >
                <option value="">Select room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.room_number} - {room.room_type} - ₹
                    {Number(room.base_price || room.price_per_night || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="bookings-form-group">
              <label>Check-in Date (Fixed at 11:00 AM) *</label>
              <input
                type="datetime-local"
                name="checkin_date"
                value={formData.checkin_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Check-out Date (Fixed at 11:00 AM) *</label>
              <input
                type="datetime-local"
                name="checkout_date"
                value={formData.checkout_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Adults</label>
              <input
                type="number"
                name="adults"
                min="1"
                value={formData.adults}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Children</label>
              <input
                type="number"
                name="children"
                min="0"
                value={formData.children}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Booking Source</label>
              <select
                name="booking_source"
                value={formData.booking_source}
                onChange={handleChange}
                required
                className="capitalize-select"
              >
                {bookingSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div className="bookings-form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="capitalize-select"
              >
                {bookingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="bookings-form-group">
              <label>Nightly Room Rate (₹)</label>
              <input
                type="number"
                name="room_rate"
                min="0"
                step="0.01"
                value={formData.room_rate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Discount</label>
              <input
                type="number"
                name="discount"
                min="0"
                step="0.01"
                value={formData.discount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>GST Mode</label>
              <select
                name="tax_mode"
                value={formData.tax_mode}
                onChange={handleChange}
                required
              >
                <option value="inclusive">GST Included in Room Rate</option>
                <option value="exclusive">GST Extra on Room Rate</option>
              </select>
            </div>

            <div className="bookings-form-group">
              <label>GST Rate</label>
              <select
                name="tax_rate_type"
                value={formData.tax_rate_type}
                onChange={handleChange}
                required
              >
                <option value="auto">Auto GST Slab ({activeTaxRate}%)</option>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="18">18%</option>
              </select>
            </div>

            <div className="bookings-form-group">
              <label>GST Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calculatedTaxAmount}
                readOnly
                className="read-only-input"
              />
            </div>

            <div className="bookings-form-group">
              <label>Advance Paid</label>
              <input
                type="number"
                name="advance_paid"
                min="0"
                step="0.01"
                value={formData.advance_paid}
                onChange={handleChange}
                required
              />
            </div>

            <div className="bookings-form-group">
              <label>Payment Status</label>
              <select
                name="payment_status"
                value={formData.payment_status}
                onChange={handleChange}
                required
                className="capitalize-select"
              >
                {paymentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Submitting Section / Amount Breakdown */}
            <div className="bookings-submit-row-full">
              <div className="bookings-total-breakdown">
                <div className="bookings-breakdown-header">
                  <div>
                    <span>Amount Breakdown ({nightsCount} Night{nightsCount > 1 ? "s" : ""})</span>
                    <p>
                      GST {activeTaxRate}%{" "}
                      {formData.tax_mode === "inclusive"
                        ? "included in room rate"
                        : "added extra"}
                    </p>
                  </div>
                  <strong>
                    ₹{Number(calculatedTotalAmount || 0).toFixed(2)}
                  </strong>
                </div>

                <div className="bookings-breakdown-grid-full">
                  <div>
                    <p>Nightly Rate</p>
                    <h4>₹{Number(formData.room_rate || 0).toFixed(2)}</h4>
                  </div>
                  <div>
                    <p>Total Nights</p>
                    <h4>{nightsCount} Nights</h4>
                  </div>
                  <div>
                    <p>Gross Room Total</p>
                    <h4>₹{calculatedGrossRoomRate.toFixed(2)}</h4>
                  </div>
                  <div>
                    <p>Discount</p>
                    <h4>₹{discountAmount.toFixed(2)}</h4>
                  </div>
                  <div>
                    <p>GST Amount</p>
                    <h4>₹{Number(calculatedTaxAmount || 0).toFixed(2)}</h4>
                  </div>
                  <div>
                    <p>Balance Due</p>
                    <h4>₹{balanceAmount.toFixed(2)}</h4>
                  </div>
                </div>
              </div>

              <div className="bookings-form-actions-full">
                {editingBooking && (
                  <button
                    type="button"
                    className="bookings-cancel-btn"
                    onClick={resetForm}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                )}

                <button
                  type="submit"
                  className="bookings-save-btn"
                  disabled={saving}
                >
                  {editingBooking ? <Edit size={16} /> : <Plus size={16} />}
                  {saving
                    ? "Saving..."
                    : editingBooking
                    ? "Update Booking"
                    : "Create Booking"}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Table Card (Full Width Below) */}
        <section className="bookings-table-card">
          <div className="bookings-table-header">
            <div className="bookings-section-title compact">
              <div className="bookings-section-icon">
                <CalendarCheck size={18} />
              </div>
              <div>
                <h3>Recent 10 Bookings</h3>
                <p>Latest 10 reservations created for this hotel.</p>
              </div>
            </div>

            <div className="bookings-filter-row">
              <div className="bookings-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search booking..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              <div className="bookings-filter-box">
                <Filter size={16} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="capitalize-select"
                >
                  <option value="all">All Status</option>
                  {bookingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bookings-empty-state">
              <h4>Loading bookings...</h4>
            </div>
          ) : recentBookings.length === 0 ? (
            <div className="bookings-empty-state">
              <h4>No bookings found</h4>
              <p>Create your first booking using the form above.</p>
            </div>
          ) : (
            <div className="bookings-table-scroll">
              <table className="bookings-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Dates</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {recentBookings.map((booking) => (
                    <tr key={booking.id}>
                      <td><span className="booking-id-tag">#{booking.id}</span></td>

                      <td>
                        <div className="booking-details-cell">
                          <strong>{getGuestName(booking.guest_id)}</strong>
                          <span>
                            <User size={12} /> Guest #{booking.guest_id}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="booking-details-cell">
                          <strong>Room {getRoomNumber(booking.room_id)}</strong>
                          <span>
                            <BedDouble size={12} /> Room #{booking.room_id}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="booking-details-cell">
                          <strong>
                            {booking.checkin_date
                              ? new Date(booking.checkin_date).toLocaleDateString()
                              : "-"}
                          </strong>
                          <span>
                            to{" "}
                            {booking.checkout_date
                              ? new Date(booking.checkout_date).toLocaleDateString()
                              : "-"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong className="booking-price">₹{Number(booking.total_amount || 0).toFixed(2)}</strong>
                      </td>

                      <td>
                        <span className={`booking-status-pill ${booking.status || "confirmed"}`}>
                          {booking.status || "confirmed"}
                        </span>
                      </td>

                      <td>
                        <span className={`booking-payment-pill ${booking.payment_status || "pending"}`}>
                          {booking.payment_status || "pending"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="bookings-action-row">
                          <button
                            type="button"
                            className="bookings-checkin-btn"
                            onClick={() => handleCheckIn(booking)}
                            disabled={processingId === booking.id}
                            title="Check In"
                          >
                            <LogIn size={15} />
                          </button>

                          <button
                            type="button"
                            className="bookings-checkout-btn"
                            onClick={() => handleCheckOut(booking)}
                            disabled={processingId === booking.id}
                            title="Check Out"
                          >
                            <LogOut size={15} />
                          </button>

                          <button
                            type="button"
                            className="bookings-edit-btn"
                            onClick={() => handleEdit(booking)}
                            title="Edit"
                          >
                            <Edit size={15} />
                          </button>

                          <button
                            type="button"
                            className="bookings-delete-btn"
                            onClick={() => handleDelete(booking)}
                            disabled={deletingId === booking.id}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}