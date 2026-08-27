import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  Download,
  Filter,
  IndianRupee,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  User,
  Wallet,
  X
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import "./payments.css";

const initialFormData = {
  booking_id: "",
  invoice_id: "",
  payment_date: new Date().toISOString().slice(0, 10),
  amount: "",
  payment_method: "cash",
  payment_type: "advance",
  reference_number: "",
  notes: "",
};

const paymentMethods = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "online",
  "other",
];

const paymentTypes = ["advance", "partial", "final", "refund"];

export default function PaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  function getApiErrorMessage(err, fallbackMessage) {
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
  }

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    return [];
  }

  function getLoggedInHotelId() {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  }

  function getGuestName(guestId) {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || guest?.name || "-";
  }

  function getRoomNumber(roomId) {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || "-";
  }

  function getBookingById(bookingId) {
    return bookings.find((item) => Number(item.id) === Number(bookingId));
  }

  function getInvoiceById(invoiceId) {
    return invoices.find((item) => Number(item.id) === Number(invoiceId));
  }

  function getInvoiceByBookingId(bookingId) {
    return invoices.find((item) => Number(item.booking_id) === Number(bookingId));
  }

  function getBookingTotal(booking) {
    if (!booking) return 0;

    return Number(
      booking.total_amount ||
        booking.grand_total ||
        booking.total_price ||
        booking.net_amount ||
        booking.room_rate ||
        booking.base_price ||
        0
    );
  }

  function getInvoiceTotal(invoice) {
    if (!invoice) return 0;

    return Number(
      invoice.total_amount ||
        invoice.grand_total ||
        invoice.invoice_amount ||
        invoice.amount ||
        0
    );
  }

  function getInvoicePaid(invoice) {
    if (!invoice) return 0;

    return Number(invoice.paid_amount || invoice.amount_paid || 0);
  }

  function getInvoiceDue(invoice) {
    if (!invoice) return 0;

    const total = getInvoiceTotal(invoice);
    const paid = getInvoicePaid(invoice);

    return Number(invoice.due_amount || invoice.balance_due || total - paid || 0);
  }

  function getPaymentAmount(payment) {
    return Number(
      payment.amount ||
        payment.payment_amount ||
        payment.paid_amount ||
        payment.amount_paid ||
        0
    );
  }

  function getPaymentMethod(payment) {
    return payment.payment_method || payment.method || "cash";
  }

  function getPaymentType(payment) {
    return payment.payment_type || payment.type || "payment";
  }

  function getPaymentDate(payment) {
    return payment.payment_date || payment.date || payment.created_at || "-";
  }

  function getPaymentGuestId(payment) {
    const booking = getBookingById(payment.booking_id);
    const invoice = getInvoiceById(payment.invoice_id);

    return payment.guest_id || booking?.guest_id || invoice?.guest_id;
  }

  function getPaymentRoomId(payment) {
    const booking = getBookingById(payment.booking_id);
    return payment.room_id || booking?.room_id;
  }

  function getBookingLabel(booking) {
    return `#${booking.id} - ${getGuestName(
      booking.guest_id
    )} - Room ${getRoomNumber(booking.room_id)}`;
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [
        paymentsResponse,
        bookingsResponse,
        guestsResponse,
        roomsResponse,
        invoicesResponse,
      ] = await Promise.all([
        api.get("/payments"),
        api.get("/bookings"),
        api.get("/guests"),
        api.get("/rooms"),
        api.get("/invoices").catch(() => ({ data: [] })),
      ]);

      const hotelId = getLoggedInHotelId();

      const paymentsList = normalizeList(paymentsResponse.data, "payments");
      const bookingsList = normalizeList(bookingsResponse.data, "bookings");
      const guestsList = normalizeList(guestsResponse.data, "guests");
      const roomsList = normalizeList(roomsResponse.data, "rooms");
      const invoicesList = normalizeList(invoicesResponse.data, "invoices");

      if (hotelId) {
        setPayments(
          paymentsList.filter((item) => {
            if (!item.hotel_id) return true;
            return Number(item.hotel_id) === Number(hotelId);
          })
        );

        setBookings(
          bookingsList.filter((item) => Number(item.hotel_id) === Number(hotelId))
        );

        setGuests(
          guestsList.filter((item) => Number(item.hotel_id) === Number(hotelId))
        );

        setRooms(
          roomsList.filter((item) => Number(item.hotel_id) === Number(hotelId))
        );

        setInvoices(
          invoicesList.filter((item) => {
            if (!item.hotel_id) return true;
            return Number(item.hotel_id) === Number(hotelId);
          })
        );
      } else {
        setPayments(paymentsList);
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
        setInvoices(invoicesList);
      }
    } catch (err) {
      console.error("Fetch payments data error:", err);
      setError(getApiErrorMessage(err, "Failed to load payments data."));
      setPayments([]);
      setBookings([]);
      setGuests([]);
      setRooms([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const selectedBooking = useMemo(() => {
    return getBookingById(formData.booking_id);
  }, [bookings, formData.booking_id]);

  const selectedInvoice = useMemo(() => {
    if (formData.invoice_id) return getInvoiceById(formData.invoice_id);
    if (formData.booking_id) return getInvoiceByBookingId(formData.booking_id);
    return null;
  }, [invoices, formData.invoice_id, formData.booking_id]);

  const selectedBookingPaymentsTotal = useMemo(() => {
    if (!selectedBooking) return 0;

    return payments
      .filter((payment) => Number(payment.booking_id) === Number(selectedBooking.id))
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);
  }, [payments, selectedBooking]);

  const amountBreakdown = useMemo(() => {
    const bookingAmount = getBookingTotal(selectedBooking);
    const invoiceAmount = getInvoiceTotal(selectedInvoice);
    const invoiceDue = getInvoiceDue(selectedInvoice);

    const totalAmount = invoiceAmount || bookingAmount;
    const alreadyPaid = selectedInvoice
      ? getInvoicePaid(selectedInvoice)
      : selectedBookingPaymentsTotal;

    const currentPayment = Number(formData.amount || 0);
    const balanceBeforePayment = selectedInvoice
      ? invoiceDue
      : totalAmount - alreadyPaid;

    const balanceAfterPayment = balanceBeforePayment - currentPayment;

    return {
      bookingAmount,
      invoiceAmount,
      totalAmount,
      alreadyPaid,
      currentPayment,
      balanceBeforePayment,
      balanceAfterPayment,
    };
  }, [selectedBooking, selectedInvoice, selectedBookingPaymentsTotal, formData]);

  const paymentStats = useMemo(() => {
    const totalCollected = payments.reduce(
      (sum, payment) => sum + getPaymentAmount(payment),
      0
    );

    const cashTotal = payments
      .filter((payment) => getPaymentMethod(payment).toLowerCase() === "cash")
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

    const upiTotal = payments
      .filter((payment) => getPaymentMethod(payment).toLowerCase() === "upi")
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

    const onlineTotal = payments
      .filter((payment) =>
        ["card", "bank_transfer", "online"].includes(
          getPaymentMethod(payment).toLowerCase()
        )
      )
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);

    return {
      total: payments.length,
      totalCollected,
      cashTotal,
      upiTotal,
      onlineTotal,
    };
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const search = searchText.toLowerCase();
      const method = getPaymentMethod(payment).toLowerCase();

      const guestName = getGuestName(getPaymentGuestId(payment)).toLowerCase();
      const roomNumber = getRoomNumber(getPaymentRoomId(payment)).toLowerCase();
      const bookingId = String(payment.booking_id || "").toLowerCase();
      const invoiceId = String(payment.invoice_id || "").toLowerCase();
      const reference = String(
        payment.reference_number || payment.transaction_id || ""
      ).toLowerCase();

      const matchesSearch =
        !search ||
        guestName.includes(search) ||
        roomNumber.includes(search) ||
        bookingId.includes(search) ||
        invoiceId.includes(search) ||
        reference.includes(search);

      const matchesMethod =
        methodFilter === "all" || method === methodFilter.toLowerCase();

      return matchesSearch && matchesMethod;
    });
  }, [payments, bookings, guests, rooms, searchText, methodFilter]);

  useEffect(() => {
    if (!selectedBooking) return;

    const linkedInvoice = getInvoiceByBookingId(selectedBooking.id);

    setFormData((prev) => ({
      ...prev,
      invoice_id: linkedInvoice?.id || "",
      amount:
        prev.amount ||
        Number(
          linkedInvoice
            ? getInvoiceDue(linkedInvoice)
            : getBookingTotal(selectedBooking) - selectedBookingPaymentsTotal
        ).toFixed(2),
    }));
  }, [selectedBooking?.id, invoices.length]);

  function handleChange(e) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData(initialFormData);
    setError("");
  }

  function buildFullPayload() {
    const hotelId = getLoggedInHotelId();

    if (!hotelId) {
      throw new Error("Hotel ID not found. Please logout and login again.");
    }

    return {
      hotel_id: Number(hotelId),
      booking_id: Number(formData.booking_id),
      invoice_id: formData.invoice_id ? Number(formData.invoice_id) : null,
      guest_id: selectedBooking?.guest_id ? Number(selectedBooking.guest_id) : null,
      amount: Number(formData.amount || 0),
      payment_amount: Number(formData.amount || 0),
      paid_amount: Number(formData.amount || 0),
      payment_method: formData.payment_method,
      method: formData.payment_method,
      payment_type: formData.payment_type,
      payment_date: formData.payment_date,
      date: formData.payment_date,
      reference_number: formData.reference_number.trim(),
      transaction_id: formData.reference_number.trim(),
      notes: formData.notes.trim(),
      status: "paid",
      payment_status: "paid",
    };
  }

  async function createPaymentWithFallback(payload) {
    try {
      return await api.post("/payments", payload);
    } catch (err1) {
      if (err1.response?.status !== 422) throw err1;

      try {
        return await api.post("/payments", {
          hotel_id: payload.hotel_id,
          invoice_id: payload.invoice_id,
          booking_id: payload.booking_id,
          guest_id: payload.guest_id,
          amount: payload.amount,
          payment_method: payload.payment_method,
          payment_date: payload.payment_date,
          status: "paid",
        });
      } catch (err2) {
        if (err2.response?.status !== 422) throw err2;

        try {
          return await api.post("/payments", {
            hotel_id: payload.hotel_id,
            invoice_id: payload.invoice_id,
            amount: payload.amount,
            payment_method: payload.payment_method,
            payment_date: payload.payment_date,
            status: "paid",
          });
        } catch (err3) {
          if (err3.response?.status !== 422) throw err3;

          return await api.post("/payments", {
            hotel_id: payload.hotel_id,
            booking_id: payload.booking_id,
            guest_id: payload.guest_id,
            amount: payload.amount,
            payment_method: payload.payment_method,
            payment_date: payload.payment_date,
          });
        }
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.booking_id) {
      setError("Please select a booking first.");
      return;
    }

    if (Number(formData.amount || 0) <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = buildFullPayload();

      await createPaymentWithFallback(payload);

      setSuccess("Payment recorded successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      resetForm();
      await fetchData();
    } catch (err) {
      console.error("Create payment error:", err);
      setError(getApiErrorMessage(err, "Failed to record payment."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(payment) {
    const confirmed = window.confirm("Are you sure you want to delete this payment?");
    if (!confirmed) return;

    try {
      setDeletingId(payment.id);
      setError("");
      setSuccess("");

      await api.delete(`/payments/${payment.id}`);

      setSuccess("Payment deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      await fetchData();
    } catch (err) {
      console.error("Delete payment error:", err);
      setError(getApiErrorMessage(err, "Failed to delete payment."));
    } finally {
      setDeletingId(null);
    }
  }

  function exportPaymentsCsv() {
    const rows = [
      [
        "ID",
        "Date",
        "Booking ID",
        "Invoice ID",
        "Guest",
        "Room",
        "Amount",
        "Method",
        "Type",
        "Reference",
      ],
      ...filteredPayments.map((payment) => [
        payment.id,
        getPaymentDate(payment),
        payment.booking_id || "",
        payment.invoice_id || "",
        getGuestName(getPaymentGuestId(payment)),
        getRoomNumber(getPaymentRoomId(payment)),
        getPaymentAmount(payment).toFixed(2),
        getPaymentMethod(payment),
        getPaymentType(payment),
        payment.reference_number || payment.transaction_id || "",
      ]),
    ];

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "payments.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="payments-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Payments"
        kicker="FRONT DESK"
        description="Record advance, partial, and final checkout payments against guest bookings and invoices."
        icon={Wallet}
        backPath="/front-desk"
      />

      {error && <div className="payments-error-box">{error}</div>}
      {success && <div className="payments-success-box">{success}</div>}

      {/* Stats Grid */}
      <div className="payments-stats-grid">
        <div className="payments-stat-card">
          <div className="payments-stat-icon-wrapper bg-light-blue">
            <ReceiptText size={22} className="color-blue" />
          </div>
          <div className="payments-stat-info">
            <p>Total Payments</p>
            <h2>{paymentStats.total}</h2>
            <span>All recorded payments</span>
          </div>
        </div>

        <div className="payments-stat-card">
          <div className="payments-stat-icon-wrapper bg-light-green">
            <IndianRupee size={22} className="color-green" />
          </div>
          <div className="payments-stat-info">
            <p>Total Collected</p>
            <h2>₹{paymentStats.totalCollected.toFixed(2)}</h2>
            <span>Overall payment value</span>
          </div>
        </div>

        <div className="payments-stat-card">
          <div className="payments-stat-icon-wrapper bg-light-orange">
            <Wallet size={22} className="color-orange" />
          </div>
          <div className="payments-stat-info">
            <p>Cash</p>
            <h2>₹{paymentStats.cashTotal.toFixed(2)}</h2>
            <span>Cash collection</span>
          </div>
        </div>

        <div className="payments-stat-card">
          <div className="payments-stat-icon-wrapper bg-light-purple">
            <CreditCard size={22} className="color-purple" />
          </div>
          <div className="payments-stat-info">
            <p>Online / Card</p>
            <h2>₹{paymentStats.onlineTotal.toFixed(2)}</h2>
            <span>Card, bank, online</span>
          </div>
        </div>
      </div>

      <section className="payments-form-card">
        <div className="payments-section-title">
          <div className="payments-section-icon">
            <Plus size={18} />
          </div>

          <div>
            <h3>Record Payment</h3>
            <p>Select booking, enter amount, and save payment details.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="payments-form-grid">
            <div className="payments-form-group payments-booking-field">
              <label>Booking</label>
              <select
                name="booking_id"
                value={formData.booking_id}
                onChange={handleChange}
                required
              >
                <option value="">Select booking</option>
                {bookings.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {getBookingLabel(booking)}
                  </option>
                ))}
              </select>
            </div>

            <div className="payments-form-group">
              <label>Invoice</label>
              <select
                name="invoice_id"
                value={formData.invoice_id}
                onChange={handleChange}
              >
                <option value="">No invoice / Advance payment</option>
                {invoices
                  .filter((invoice) => {
                    if (!formData.booking_id) return true;
                    return Number(invoice.booking_id) === Number(formData.booking_id);
                  })
                  .map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      INV-{invoice.id} - Booking #{invoice.booking_id}
                    </option>
                  ))}
              </select>
            </div>

            <div className="payments-form-group">
              <label>Payment Date</label>
              <input
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="payments-form-group">
              <label>Amount</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                placeholder="Example: 5000"
                value={formData.amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="payments-form-group">
              <label>Payment Method</label>
              <select
                name="payment_method"
                value={formData.payment_method}
                onChange={handleChange}
                required
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="payments-form-group">
              <label>Payment Type</label>
              <select
                name="payment_type"
                value={formData.payment_type}
                onChange={handleChange}
                required
              >
                {paymentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="payments-form-group">
              <label>Reference / Transaction ID</label>
              <input
                type="text"
                name="reference_number"
                placeholder="UPI ID, card ref, bank ref"
                value={formData.reference_number}
                onChange={handleChange}
              />
            </div>

            <div className="payments-form-group payments-notes-field">
              <label>Notes</label>
              <textarea
                name="notes"
                placeholder="Example: Advance paid during check-in"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="payments-breakdown-box">
            <div>
              <span>Total Amount</span>
              <strong>₹{amountBreakdown.totalAmount.toFixed(2)}</strong>
            </div>

            <div>
              <span>Already Paid</span>
              <strong>₹{amountBreakdown.alreadyPaid.toFixed(2)}</strong>
            </div>

            <div>
              <span>Current Payment</span>
              <strong>₹{amountBreakdown.currentPayment.toFixed(2)}</strong>
            </div>

            <div>
              <span>Balance After Payment</span>
              <strong>₹{amountBreakdown.balanceAfterPayment.toFixed(2)}</strong>
            </div>
          </div>

          <div className="payments-form-actions">
            <button
              type="button"
              className="payments-cancel-btn"
              onClick={resetForm}
            >
              <X size={16} />
              Reset
            </button>

            <button type="submit" className="payments-save-btn" disabled={saving}>
              <Plus size={16} />
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </section>

      <section className="payments-table-card">
        <div className="payments-table-header">
          <div className="payments-section-title compact">
            <div className="payments-section-icon">
              <CalendarDays size={18} />
            </div>

            <div>
              <h3>Recent Payments</h3>
              <p>Latest guest payments recorded for this hotel.</p>
            </div>
          </div>

          <div className="payments-filter-row">
            <div className="payments-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search payment..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="payments-filter-box">
              <Filter size={16} />
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
              >
                <option value="all">All Methods</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="payments-export-btn"
              onClick={exportPaymentsCsv}
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="payments-empty-state">
            <h4>Loading payments...</h4>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="payments-empty-state">
            <h4>No payments found</h4>
            <p>Record your first payment using the form above.</p>
          </div>
        ) : (
          <div className="payments-table-scroll">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Guest / Room</th>
                  <th>Booking / Invoice</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Type</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td><span className="pay-id-tag">#{payment.id}</span></td>

                    <td>
                      <div className="pay-details-cell">
                        <strong>
                          {getPaymentDate(payment)}
                        </strong>
                      </div>
                    </td>

                    <td>
                      <div className="pay-details-cell">
                        <strong>
                          <User size={13} />
                          {getGuestName(getPaymentGuestId(payment))}
                        </strong>
                        <span>Room {getRoomNumber(getPaymentRoomId(payment))}</span>
                      </div>
                    </td>

                    <td>
                      <div className="pay-details-cell">
                        <strong>Booking #{payment.booking_id || "-"}</strong>
                        <span>
                          {payment.invoice_id ? `INV-${payment.invoice_id}` : "No Invoice"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <strong className="pay-price">₹{getPaymentAmount(payment).toFixed(2)}</strong>
                    </td>

                    <td>
                      <span className={`payments-method-pill ${getPaymentMethod(payment)}`}>
                        {getPaymentMethod(payment).replace("_", " ")}
                      </span>
                    </td>

                    <td>
                      <span className="payments-type-pill">
                        {getPaymentType(payment)}
                      </span>
                    </td>

                    <td>
                      <span className="pay-reference">
                        {payment.reference_number ||
                          payment.transaction_id ||
                          "-"}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="payments-delete-btn"
                        onClick={() => handleDelete(payment)}
                        disabled={deletingId === payment.id}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}