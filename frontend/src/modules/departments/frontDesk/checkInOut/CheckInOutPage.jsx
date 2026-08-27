import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarCheck,
  CheckCircle,
  Filter,
  LogIn,
  LogOut,
  Search,
  User,
  Briefcase,
  Plus,
  X
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; // <-- Imported reusable component
import "./checkInOut.css";

const getTodayInputDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};

const getTomorrowInputDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const getAutoGstRate = (amount) => {
  const roomAmount = Number(amount || 0);
  if (roomAmount <= 1000) return 0;
  if (roomAmount <= 7500) return 5;
  return 18;
};

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

const initialWalkInState = {
  full_name: "",
  phone: "",
  email: "",
  address: "",
  id_proof_type: "Aadhar",
  id_proof_number: "",
  room_id: "",
  checkin_date: getTodayInputDate(),
  checkout_date: getTomorrowInputDate(),
  adults: 1,
  children: 0,
  room_rate: "",
  discount: 0,
  tax_mode: "inclusive",
  tax_rate_type: "auto",
  tax_rate: 0,
  advance_paid: 0,
  payment_method: "cash",
  payment_status: "paid",
};

export default function CheckInOut() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [activeTab, setActiveTab] = useState("arrivals");
  const [searchText, setSearchText] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState(initialWalkInState);
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const bookingSources = ["walk-in", "phone", "website", "agent", "ota", "other"];

  const normalizeList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

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

  const getLoggedInHotelId = () => {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  };

  const getDateKey = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayKey = getDateKey(new Date());

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
      console.error("Check-in / Checkout fetch error:", err);
      setError(getApiErrorMessage(err, "Failed to load Check-in / Checkout data."));
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

  const getGuest = (guestId) => {
    return guests.find((guest) => Number(guest.id) === Number(guestId));
  };

  const getRoom = (roomId) => {
    return rooms.find((room) => Number(room.id) === Number(roomId));
  };

  const getGuestName = (guestId) => {
    return getGuest(guestId)?.full_name || "-";
  };

  const getGuestPhone = (guestId) => {
    return getGuest(guestId)?.phone || "-";
  };

  const getRoomNumber = (roomId) => {
    return getRoom(roomId)?.room_number || "-";
  };

  const getRoomType = (roomId) => {
    return getRoom(roomId)?.room_type || "-";
  };

  const clearSuccess = () => {
    setTimeout(() => {
      setSuccess("");
    }, 3000);
  };

  const handleCheckIn = async (booking) => {
    try {
      setProcessingId(booking.id);
      setError("");
      setSuccess("");

      await api.post(`/bookings/${booking.id}/check-in`);

      setSuccess(`Booking #${booking.id} checked in successfully.`);
      clearSuccess();

      await fetchData();
    } catch (err) {
      console.error("Check-in error:", err);
      setError(getApiErrorMessage(err, "Failed to check in guest."));
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckout = async (booking) => {
    try {
      setProcessingId(booking.id);
      setError("");
      setSuccess("");

      await api.post(`/bookings/${booking.id}/check-out`);

      setSuccess(`Booking #${booking.id} Checkout completed successfully.`);
      clearSuccess();

      await fetchData();
    } catch (err) {
      console.error("Checkout error:", err);
      setError(getApiErrorMessage(err, "Failed to complete Checkout."));
    } finally {
      setProcessingId(null);
    }
  };

  const nightsCount = useMemo(() => {
    return calculateNights(walkInForm.checkin_date, walkInForm.checkout_date);
  }, [walkInForm.checkin_date, walkInForm.checkout_date]);

  const activeTaxRate = useMemo(() => {
    if (walkInForm.tax_rate_type === "auto") {
      return getAutoGstRate(walkInForm.room_rate);
    }
    return Number(walkInForm.tax_rate || 0);
  }, [walkInForm.room_rate, walkInForm.tax_rate, walkInForm.tax_rate_type]);

  const amountCalculation = useMemo(() => {
    return calculateTaxAndTotal({
      nightlyRate: walkInForm.room_rate,
      nights: nightsCount,
      discount: walkInForm.discount,
      taxMode: walkInForm.tax_mode,
      taxRate: activeTaxRate,
    });
  }, [walkInForm.room_rate, nightsCount, walkInForm.discount, walkInForm.tax_mode, activeTaxRate]);

  const calculatedTotalAmount = amountCalculation.totalAmount;

  const handleWalkInChange = (e) => {
    const { name, value } = e.target;

    if (name === "room_id") {
      const selectedRoom = rooms.find((r) => String(r.id) === String(value));
      const selectedRoomRate = selectedRoom?.base_price ?? selectedRoom?.price_per_night ?? "";
      const calculatedInitialTotal = calculateTaxAndTotal({
        nightlyRate: selectedRoomRate,
        nights: nightsCount,
        discount: walkInForm.discount,
        taxMode: walkInForm.tax_mode,
        taxRate: walkInForm.tax_rate_type === "auto" ? getAutoGstRate(selectedRoomRate) : walkInForm.tax_rate,
      }).totalAmount;

      setWalkInForm((prev) => ({
        ...prev,
        room_id: value,
        room_rate: selectedRoomRate,
        advance_paid: calculatedInitialTotal,
        tax_rate: prev.tax_rate_type === "auto" ? getAutoGstRate(selectedRoomRate) : prev.tax_rate,
      }));
      return;
    }

    if (name === "room_rate") {
      setWalkInForm((prev) => ({
        ...prev,
        room_rate: value,
        tax_rate: prev.tax_rate_type === "auto" ? getAutoGstRate(value) : prev.tax_rate,
      }));
      return;
    }

    if (name === "tax_rate_type") {
      setWalkInForm((prev) => ({
        ...prev,
        tax_rate_type: value,
        tax_rate: value === "auto" ? getAutoGstRate(prev.room_rate) : Number(value),
      }));
      return;
    }

    setWalkInForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (savingWalkIn) return;

    try {
      setSavingWalkIn(true);
      setError("");
      setSuccess("");

      const hotelId = getLoggedInHotelId();
      if (!hotelId) {
        throw new Error("Hotel ID not found. Please log out and log back in.");
      }

      const payload = {
        hotel_id: Number(hotelId),
        room_id: Number(walkInForm.room_id),
        full_name: walkInForm.full_name.trim(),
        phone: walkInForm.phone.trim(),
        email: walkInForm.email.trim() || null,
        address: walkInForm.address.trim() || null,
        id_proof_type: walkInForm.id_proof_type,
        id_proof_number: walkInForm.id_proof_number.trim() || null,
        checkin_date: new Date(walkInForm.checkin_date).toISOString(),
        checkout_date: new Date(walkInForm.checkout_date).toISOString(),
        adults: Number(walkInForm.adults),
        children: Number(walkInForm.children),
        room_rate: Number(walkInForm.room_rate || 0),
        total_amount: Number(calculatedTotalAmount),
        advance_paid: Number(walkInForm.advance_paid || 0),
        payment_status: walkInForm.payment_status,
        payment_method: walkInForm.payment_method,
      };

      await api.post("/bookings/walk-in", payload);

      setSuccess("Walk-in guest checked in successfully!");
      clearSuccess();
      setShowWalkInModal(false);
      setWalkInForm(initialWalkInState);
      await fetchData();
    } catch (err) {
      console.error("Walk-in error:", err);
      setError(getApiErrorMessage(err, "Failed to process walk-in check-in."));
    } finally {
      setSavingWalkIn(false);
    }
  };

  const availableRoomsForWalkIn = useMemo(() => {
    return rooms.filter((room) => {
      const status = String(room.status || "").toLowerCase();
      return status === "available" || status === "cleaning";
    });
  }, [rooms]);

  const stats = useMemo(() => {
    const todaysArrivals = bookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase();
      return (
        status === "confirmed" &&
        getDateKey(booking.checkin_date) === todayKey
      );
    }).length;

    const allConfirmed = bookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase();
      return status === "confirmed";
    }).length;

    const inHouseGuests = bookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase();
      return status === "checked-in" || status === "checked_in";
    }).length;

    const todaysDepartures = bookings.filter((booking) => {
      const status = String(booking.status || "").toLowerCase();
      return (
        (status === "checked-in" || status === "checked_in") &&
        getDateKey(booking.checkout_date) === todayKey
      );
    }).length;

    return {
      todaysArrivals,
      allConfirmed,
      inHouseGuests,
      todaysDepartures,
    };
  }, [bookings, todayKey]);

  const filteredBookings = useMemo(() => {
    let list = [];

    if (activeTab === "arrivals") {
      list = bookings.filter((booking) => {
        const status = String(booking.status || "").toLowerCase();
        return (
          status === "confirmed" &&
          getDateKey(booking.checkin_date) === todayKey
        );
      });
    }

    if (activeTab === "confirmed") {
      list = bookings.filter((booking) => {
        const status = String(booking.status || "").toLowerCase();
        return status === "confirmed";
      });
    }

    if (activeTab === "in-house") {
      list = bookings.filter((booking) => {
        const status = String(booking.status || "").toLowerCase();
        return status === "checked-in" || status === "checked_in";
      });
    }

    if (activeTab === "departures") {
      list = bookings.filter((booking) => {
        const status = String(booking.status || "").toLowerCase();
        return (
          (status === "checked-in" || status === "checked_in") &&
          getDateKey(booking.checkout_date) === todayKey
        );
      });
    }

    return list
      .filter((booking) => {
        const search = searchText.toLowerCase();
        const guestName = getGuestName(booking.guest_id).toLowerCase();
        const guestPhone = getGuestPhone(booking.guest_id).toLowerCase();
        const roomNumber = getRoomNumber(booking.room_id).toLowerCase();
        const bookingId = String(booking.id || "").toLowerCase();
        const source = String(booking.booking_source || "").toLowerCase();

        const matchesSearch =
          !search ||
          guestName.includes(search) ||
          guestPhone.includes(search) ||
          roomNumber.includes(search) ||
          bookingId.includes(search);

        const matchesSource =
          sourceFilter === "all" || source === sourceFilter.toLowerCase();

        return matchesSearch && matchesSource;
      })
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  }, [
    activeTab,
    bookings,
    guests,
    rooms,
    searchText,
    sourceFilter,
    todayKey,
  ]);

  const tabs = [
    { id: "arrivals", label: "Today's Arrivals", count: stats.todaysArrivals },
    { id: "confirmed", label: "All Confirmed", count: stats.allConfirmed },
    { id: "in-house", label: "In-house Guests", count: stats.inHouseGuests },
    { id: "departures", label: "Today's Departures", count: stats.todaysDepartures },
  ];

  return (
    <div className="checkinout-page">
      
      {/* SHARED UNIFIED PORTAL HEADER WITH QUICK WALK-IN BUTTON */}
      <PortalHeader 
        title="Check-in / Checkout"
        kicker="FRONT DESK OPERATIONS"
        description="Manage today's arrivals, advance bookings, in-house guests, and guest Checkout."
        icon={Briefcase}
        backPath="/front-desk"
        rightAction={
          <button
            type="button"
            className="cio-walkin-top-btn"
            onClick={() => setShowWalkInModal(true)}
          >
            <Plus size={16} />
            Quick Walk-In
          </button>
        }
      />

      {error && <div className="checkinout-error-box">{error}</div>}
      {success && <div className="checkinout-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <div className="checkinout-stats-grid">
        <StatCard
          title="Today's Arrivals"
          value={stats.todaysArrivals}
          Icon={CalendarCheck}
          colorTheme="blue"
        />
        <StatCard
          title="All Confirmed"
          value={stats.allConfirmed}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="In-house Guests"
          value={stats.inHouseGuests}
          Icon={User}
          colorTheme="purple"
        />
        <StatCard
          title="Today's Departures"
          value={stats.todaysDepartures}
          Icon={LogOut}
          colorTheme="orange"
        />
      </div>
      {/* --------------------------- */}

      {/* Main Reception Queue Card */}
      <section className="checkinout-card">
        <div className="checkinout-card-header">
          <div>
            <h3>Reception Queue</h3>
            <p>Use this page for actual guest Check-in and Checkout operations.</p>
          </div>

          <div className="checkinout-filter-row">
            <div className="checkinout-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search guest, room, phone..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="checkinout-filter-box">
              <Filter size={16} />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="all">All Sources</option>
                {bookingSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="checkinout-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? "checkinout-tab active"
                  : "checkinout-tab"
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <span>{tab.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="checkinout-empty-state">
            <h4>Loading bookings...</h4>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="checkinout-empty-state">
            <h4>No records found</h4>
            <p>No booking is available in this queue right now.</p>
          </div>
        ) : (
          <div className="checkinout-table-scroll">
            <table className="checkinout-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Dates</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredBookings.map((booking) => {
                  const status = String(booking.status || "").toLowerCase();
                  const canCheckIn = status === "confirmed";
                  const canCheckout =
                    status === "checked-in" || status === "checked_in";

                  return (
                    <tr key={booking.id}>
                      <td>
                        <div className="checkinout-details-cell">
                          <strong>#{booking.id}</strong>
                          <span>{booking.booking_source || "-"}</span>
                        </div>
                      </td>

                      <td>
                        <div className="checkinout-details-cell">
                          <strong>{getGuestName(booking.guest_id)}</strong>
                          <span>
                            <User size={13} />
                            {getGuestPhone(booking.guest_id)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="checkinout-details-cell">
                          <strong>Room {getRoomNumber(booking.room_id)}</strong>
                          <span>
                            <BedDouble size={13} />
                            {getRoomType(booking.room_id)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="checkinout-details-cell">
                          <strong>
                            {booking.checkin_date
                              ? new Date(booking.checkin_date).toLocaleDateString()
                              : "-"}
                          </strong>
                          <span>
                            to{" "}
                            {booking.checkout_date
                              ? new Date(
                                  booking.checkout_date
                                ).toLocaleDateString()
                              : "-"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="checkinout-details-cell">
                          <strong className="checkinout-price">
                            ₹{Number(booking.total_amount || 0).toFixed(2)}
                          </strong>
                          <span>
                            Advance ₹
                            {Number(booking.advance_paid || 0).toFixed(2)}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`checkinout-status-pill ${status}`}>
                          {booking.status || "-"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`checkinout-payment-pill ${
                            booking.payment_status || "pending"
                          }`}
                        >
                          {booking.payment_status || "pending"}
                        </span>
                      </td>

                      <td>
                        <div className="checkinout-action-row">
                          {canCheckIn && (
                            <button
                              type="button"
                              className="checkinout-checkin-btn"
                              onClick={() => handleCheckIn(booking)}
                              disabled={processingId === booking.id}
                            >
                              <LogIn size={15} />
                              {processingId === booking.id
                                ? "Checking..."
                                : "Check-in"}
                            </button>
                          )}

                          {canCheckout && (
                            <button
                              type="button"
                              className="checkinout-checkout-btn"
                              onClick={() => handleCheckout(booking)}
                              disabled={processingId === booking.id}
                            >
                              <LogOut size={15} />
                              {processingId === booking.id
                                ? "Checking..."
                                : "Checkout"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* QUICK WALK-IN MODAL */}
      {showWalkInModal && (
        <div className="cio-modal-overlay">
          <div className="cio-modal-card">
            <div className="cio-modal-header">
              <h3>Quick Walk-In Check-In</h3>
              <button
                type="button"
                className="cio-modal-close-btn"
                onClick={() => setShowWalkInModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleWalkInSubmit} className="cio-modal-form">
              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Guest Full Name *</label>
                  <input
                    type="text"
                    name="full_name"
                    required
                    placeholder="Enter guest name"
                    value={walkInForm.full_name}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    placeholder="10-digit mobile number"
                    value={walkInForm.phone}
                    onChange={handleWalkInChange}
                  />
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="guest@example.com"
                    value={walkInForm.email}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Select Available Room *</label>
                  <select
                    name="room_id"
                    required
                    value={walkInForm.room_id}
                    onChange={handleWalkInChange}
                  >
                    <option value="">-- Choose Room --</option>
                    {availableRoomsForWalkIn.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.room_number} ({r.room_type}) - ₹{r.base_price}/night
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Check-in Date *</label>
                  <input
                    type="date"
                    name="checkin_date"
                    required
                    value={walkInForm.checkin_date}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Checkout Date *</label>
                  <input
                    type="date"
                    name="checkout_date"
                    required
                    value={walkInForm.checkout_date}
                    onChange={handleWalkInChange}
                  />
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Adults</label>
                  <input
                    type="number"
                    name="adults"
                    min="1"
                    value={walkInForm.adults}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Children</label>
                  <input
                    type="number"
                    name="children"
                    min="0"
                    value={walkInForm.children}
                    onChange={handleWalkInChange}
                  />
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Nightly Room Rate (₹) *</label>
                  <input
                    type="number"
                    name="room_rate"
                    min="0"
                    step="0.01"
                    required
                    value={walkInForm.room_rate}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Discount</label>
                  <input
                    type="number"
                    name="discount"
                    min="0"
                    step="0.01"
                    value={walkInForm.discount}
                    onChange={handleWalkInChange}
                  />
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>GST Mode</label>
                  <select
                    name="tax_mode"
                    value={walkInForm.tax_mode}
                    onChange={handleWalkInChange}
                  >
                    <option value="inclusive">GST Included in Room Rate</option>
                    <option value="exclusive">GST Extra on Room Rate</option>
                  </select>
                </div>
                <div className="cio-form-group">
                  <label>GST Rate</label>
                  <select
                    name="tax_rate_type"
                    value={walkInForm.tax_rate_type}
                    onChange={handleWalkInChange}
                  >
                    <option value="auto">Auto GST Slab ({activeTaxRate}%)</option>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="18">18%</option>
                  </select>
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Payment Status</label>
                  <select
                    name="payment_status"
                    value={walkInForm.payment_status}
                    onChange={handleWalkInChange}
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </div>
                <div className="cio-form-group">
                  <label>Payment Method</label>
                  <select
                    name="payment_method"
                    value={walkInForm.payment_method}
                    onChange={handleWalkInChange}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>Payment Received / Advance Paid (₹)</label>
                  <input
                    type="number"
                    name="advance_paid"
                    min="0"
                    step="0.01"
                    value={walkInForm.advance_paid}
                    onChange={handleWalkInChange}
                  />
                </div>
                <div className="cio-form-group">
                  <label>Total Calculated Amount (₹)</label>
                  <input
                    type="number"
                    value={calculatedTotalAmount}
                    readOnly
                    className="read-only-input"
                  />
                </div>
              </div>

              <div className="cio-form-row">
                <div className="cio-form-group">
                  <label>ID Proof Type</label>
                  <select
                    name="id_proof_type"
                    value={walkInForm.id_proof_type}
                    onChange={handleWalkInChange}
                  >
                    <option value="Aadhar">Aadhar Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                  </select>
                </div>
                <div className="cio-form-group">
                  <label>ID Number</label>
                  <input
                    type="text"
                    name="id_proof_number"
                    placeholder="Document number"
                    value={walkInForm.id_proof_number}
                    onChange={handleWalkInChange}
                  />
                </div>
              </div>

              <div className="cio-form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  placeholder="Guest home address"
                  value={walkInForm.address}
                  onChange={handleWalkInChange}
                />
              </div>

              <div className="cio-modal-actions">
                <button
                  type="button"
                  className="cio-modal-cancel-btn"
                  onClick={() => setShowWalkInModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cio-modal-submit-btn"
                  disabled={savingWalkIn}
                >
                  {savingWalkIn ? "Processing..." : "Complete Check-In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}