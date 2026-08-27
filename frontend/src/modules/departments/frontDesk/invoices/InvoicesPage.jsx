import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Filter,
  IndianRupee,
  Plus,
  Printer,
  Search,
  User,
  X,
  ReceiptText
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; // <-- Imported reusable component
import "./invoices.css";

const initialFormData = {
  booking_id: "",
  issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10),
  tax_amount: 0,
  discount_amount: 0,
  paid_amount: 0,
  notes: "",
};

const invoiceStatuses = ["pending", "partial", "paid", "unpaid", "cancelled"];

export default function InvoicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [payments, setPayments] = useState([]);

  const [formData, setFormData] = useState(initialFormData);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.results)) return data.results;
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

  function filterByHotel(list) {
    const hotelId = getLoggedInHotelId();

    if (!hotelId) return list;

    const filteredList = list.filter((item) => {
      if (!item.hotel_id) return true;
      return Number(item.hotel_id) === Number(hotelId);
    });

    if (filteredList.length === 0 && list.length > 0) return list;

    return filteredList;
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
    return Number(
      invoice.total_amount ||
        invoice.grand_total ||
        invoice.invoice_amount ||
        invoice.amount ||
        0
    );
  }

  function getInvoiceDue(invoice) {
    const total = getInvoiceTotal(invoice);
    const paid = Number(invoice.paid_amount || invoice.amount_paid || 0);

    return Number(invoice.due_amount || invoice.balance_due || total - paid || 0);
  }

  function getInvoiceStatus(invoice) {
    return invoice.status || invoice.payment_status || "pending";
  }

  function getStatusClass(status) {
    return String(status || "pending")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function getInvoiceGuestId(invoice) {
    const booking = getBookingById(invoice.booking_id);
    return invoice.guest_id || booking?.guest_id;
  }

  function getInvoiceRoomId(invoice) {
    const booking = getBookingById(invoice.booking_id);
    return invoice.room_id || booking?.room_id;
  }

  function getInvoiceNumber(invoice) {
    return invoice.invoice_number || invoice.number || `INV-${invoice.id}`;
  }

  function getBookingLabel(booking) {
    return `#${booking.id} - ${getGuestName(
      booking.guest_id
    )} - Room ${getRoomNumber(booking.room_id)}`;
  }

  function getRestaurantOrderAmount(order) {
    return Number(order.total_amount || order.order_total || order.amount || 0);
  }

  function isTransferToBookingRestaurantOrder(order) {
    const billingType = order.billing_type || "";
    const paymentMethod = order.payment_method || "";
    const paymentStatus = order.payment_status || "";
    const orderStatus = String(order.order_status || order.status || "").toLowerCase();

    return (
      billingType === "transfer_to_booking" &&
      paymentMethod === "room_bill" &&
      paymentStatus !== "paid" &&
      orderStatus !== "cancelled" &&
      !order.is_added_to_invoice
    );
  }

  function getPaymentAmount(payment) {
    return Number(
      payment.amount ||
        payment.payment_amount ||
        payment.paid_amount ||
        payment.total_paid ||
        0
    );
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [
        invoicesResponse,
        bookingsResponse,
        guestsResponse,
        roomsResponse,
        extraChargesResponse,
        restaurantOrdersResponse,
        paymentsResponse,
      ] = await Promise.all([
        api.get("/invoices").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/extra-charges").catch(() => ({ data: [] })),
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/payments").catch(() => ({ data: [] })),
      ]);

      setInvoices(filterByHotel(normalizeList(invoicesResponse.data, "invoices")));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
      setExtraCharges(
        filterByHotel(normalizeList(extraChargesResponse.data, "extra_charges"))
      );
      setRestaurantOrders(
        filterByHotel(normalizeList(restaurantOrdersResponse.data, "orders"))
      );
      setPayments(filterByHotel(normalizeList(paymentsResponse.data, "payments")));
    } catch (err) {
      console.error("Fetch invoice data error:", err);
      setError(getApiErrorMessage(err, "Failed to load invoice data."));
      setInvoices([]);
      setBookings([]);
      setGuests([]);
      setRooms([]);
      setExtraCharges([]);
      setRestaurantOrders([]);
      setPayments([]);
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

  const selectedBookingExtraChargeTotal = useMemo(() => {
    if (!selectedBooking) return 0;

    return extraCharges
      .filter((item) => Number(item.booking_id) === Number(selectedBooking.id))
      .reduce((sum, item) => sum + Number(item.total_amount || item.amount || 0), 0);
  }, [extraCharges, selectedBooking]);

  const selectedBookingRestaurantTotal = useMemo(() => {
    if (!selectedBooking) return 0;

    return restaurantOrders
      .filter((order) => {
        return (
          Number(order.booking_id) === Number(selectedBooking.id) &&
          isTransferToBookingRestaurantOrder(order)
        );
      })
      .reduce((sum, order) => sum + getRestaurantOrderAmount(order), 0);
  }, [restaurantOrders, selectedBooking]);

  const selectedBookingAdvancePaid = useMemo(() => {
    if (!selectedBooking) return 0;

    return payments
      .filter((payment) => {
        const sameBooking =
          Number(payment.booking_id) === Number(selectedBooking.id);

        const noInvoice =
          !payment.invoice_id ||
          payment.invoice_id === null ||
          payment.invoice_id === "null";

        return sameBooking && noInvoice;
      })
      .reduce((sum, payment) => sum + getPaymentAmount(payment), 0);
  }, [payments, selectedBooking]);

  useEffect(() => {
    if (!selectedBooking) return;

    setFormData((prev) => ({
      ...prev,
      paid_amount: Number(selectedBookingAdvancePaid || 0).toFixed(2),
    }));
  }, [selectedBooking?.id, selectedBookingAdvancePaid]);

  const amountBreakdown = useMemo(() => {
    const bookingAmount = getBookingTotal(selectedBooking);
    const taxAmount = Number(formData.tax_amount || 0);
    const discountAmount = Number(formData.discount_amount || 0);
    const guestServiceCharges = Number(selectedBookingExtraChargeTotal || 0);
    const restaurantCharges = Number(selectedBookingRestaurantTotal || 0);
    const paidAmount = Number(formData.paid_amount || 0);

    const extraChargeAmount = guestServiceCharges + restaurantCharges;

    const totalAmount =
      bookingAmount + taxAmount + extraChargeAmount - discountAmount;

    const balanceDue = totalAmount - paidAmount;

    return {
      bookingAmount,
      taxAmount,
      discountAmount,
      guestServiceCharges,
      restaurantCharges,
      extraChargeAmount,
      paidAmount,
      totalAmount,
      balanceDue,
    };
  }, [
    selectedBooking,
    formData,
    selectedBookingExtraChargeTotal,
    selectedBookingRestaurantTotal,
  ]);

  const invoiceStats = useMemo(() => {
    const paidInvoices = invoices.filter(
      (invoice) => String(getInvoiceStatus(invoice)).toLowerCase() === "paid"
    ).length;

    const pendingInvoices = invoices.filter((invoice) => {
      const status = String(getInvoiceStatus(invoice)).toLowerCase();
      return status === "pending" || status === "unpaid" || status === "partial";
    }).length;

    const totalAmount = invoices.reduce((sum, invoice) => {
      return sum + getInvoiceTotal(invoice);
    }, 0);

    const paidAmount = invoices.reduce((sum, invoice) => {
      return sum + Number(invoice.paid_amount || invoice.amount_paid || 0);
    }, 0);

    return {
      total: invoices.length,
      paid: paidInvoices,
      pending: pendingInvoices,
      totalAmount,
      paidAmount,
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const search = searchText.toLowerCase();
      const status = String(getInvoiceStatus(invoice)).toLowerCase();

      const invoiceNumber = String(getInvoiceNumber(invoice)).toLowerCase();
      const bookingId = String(invoice.booking_id || "").toLowerCase();
      const guestName = getGuestName(getInvoiceGuestId(invoice)).toLowerCase();
      const roomNumber = getRoomNumber(getInvoiceRoomId(invoice)).toLowerCase();

      const matchesSearch =
        !search ||
        invoiceNumber.includes(search) ||
        bookingId.includes(search) ||
        guestName.includes(search) ||
        roomNumber.includes(search);

      const matchesStatus =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [invoices, bookings, guests, rooms, searchText, statusFilter]);

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

  function buildInvoicePayload() {
    return {
      issue_date: formData.issue_date,
      due_date: formData.due_date,

      tax_amount: Number(formData.tax_amount || 0),

      discount: Number(formData.discount_amount || 0),
      discount_amount: Number(formData.discount_amount || 0),

      extra_charges: Number(amountBreakdown.extraChargeAmount || 0),
      extra_charge_amount: Number(amountBreakdown.extraChargeAmount || 0),
      extra_charges_amount: Number(amountBreakdown.extraChargeAmount || 0),
      additional_charges: Number(amountBreakdown.extraChargeAmount || 0),

      paid_amount: Number(formData.paid_amount || 0),

      include_restaurant_bill_to_room: true,
      include_extra_charges: true,

      notes: formData.notes.trim(),
    };
  }

  async function handleGenerateInvoice(e) {
    e.preventDefault();

    if (!formData.booking_id) {
      setError("Please select a booking first.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setSuccess("");

      const payload = buildInvoicePayload();

      try {
        await api.post(`/bookings/${formData.booking_id}/generate-invoice`, payload);
      } catch (err1) {
        if (err1.response?.status !== 422) throw err1;

        try {
          await api.post(`/bookings/${formData.booking_id}/generate-invoice`, {
            include_restaurant_bill_to_room: true,
            extra_charges: Number(amountBreakdown.extraChargeAmount || 0),
            discount: Number(formData.discount_amount || 0),
            paid_amount: Number(formData.paid_amount || 0),
          });
        } catch (err2) {
          if (err2.response?.status !== 422) throw err2;

          await api.post(`/bookings/${formData.booking_id}/generate-invoice`, {
            tax_amount: Number(formData.tax_amount || 0),
            discount_amount: Number(formData.discount_amount || 0),
            additional_charges: Number(amountBreakdown.extraChargeAmount || 0),
            paid_amount: Number(formData.paid_amount || 0),
          });
        }
      }

      setSuccess("Final checkout invoice generated successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);

      resetForm();
      await fetchData();
    } catch (err) {
      console.error("Generate invoice error:", err);
      setError(getApiErrorMessage(err, "Failed to generate invoice."));
    } finally {
      setGenerating(false);
    }
  }

  function handlePrintInvoice(invoice) {
    const booking = getBookingById(invoice.booking_id);
    const guestName = getGuestName(getInvoiceGuestId(invoice));
    const roomNumber = getRoomNumber(getInvoiceRoomId(invoice));
    const invoiceNumber = getInvoiceNumber(invoice);
    const totalAmount = getInvoiceTotal(invoice);
    const paidAmount = Number(invoice.paid_amount || invoice.amount_paid || 0);
    const dueAmount = getInvoiceDue(invoice);
    const roomCharges = Number(invoice.room_charges || 0);
    const restaurantCharges = Number(invoice.restaurant_charges || 0);
    const guestServiceCharges = Number(invoice.extra_charges || 0);
    const taxAmount = Number(invoice.tax_amount || 0);
    const discount = Number(invoice.discount || invoice.discount_amount || 0);
    const status = getInvoiceStatus(invoice);

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print invoice.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${invoiceNumber}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 32px;
              color: #0f172a;
            }

            .top {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 18px;
              margin-bottom: 24px;
            }

            h1, h2, p {
              margin: 0;
            }

            h1 {
              font-size: 28px;
            }

            .muted {
              color: #64748b;
              font-size: 13px;
              margin-top: 6px;
            }

            .box {
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 16px;
              margin-bottom: 18px;
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 14px;
            }

            .row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e2e8f0;
            }

            .row:last-child {
              border-bottom: none;
            }

            .total {
              font-size: 20px;
              font-weight: 800;
            }

            .status {
              display: inline-block;
              padding: 7px 12px;
              border-radius: 999px;
              background: #eff6ff;
              color: #2563eb;
              font-weight: 800;
              text-transform: capitalize;
            }

            button {
              height: 42px;
              padding: 0 18px;
              border: none;
              border-radius: 10px;
              background: #2563eb;
              color: white;
              font-weight: 800;
              cursor: pointer;
            }

            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="top">
            <div>
              <h1>Aerostate Hotel ERP</h1>
              <p class="muted">Hotel Invoice</p>
            </div>

            <div>
              <h2>${invoiceNumber}</h2>
              <p class="muted">Booking #${invoice.booking_id || "-"}</p>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Guest Details</h3>
              <p><strong>Guest:</strong> ${guestName}</p>
              <p><strong>Room:</strong> Room ${roomNumber}</p>
              <p><strong>Booking Status:</strong> ${booking?.status || "-"}</p>
            </div>

            <div class="box">
              <h3>Invoice Details</h3>
              <p><strong>Invoice Date:</strong> ${
                invoice.issue_date || invoice.invoice_date || "-"
              }</p>
              <p><strong>Due Date:</strong> ${invoice.due_date || "-"}</p>
              <p><strong>Status:</strong> <span class="status">${status}</span></p>
            </div>
          </div>

          <div class="box">
            <h3>Amount Breakdown</h3>

          <div class="row">
            <span>Room / Booking Charges</span>
            <strong>₹${roomCharges.toFixed(2)}</strong>
          </div>

          <div class="row">
            <span>Guest Service Charges</span>
            <strong>₹${guestServiceCharges.toFixed(2)}</strong>
          </div>

          <div class="row">
            <span>Restaurant / Room Service Bill</span>
            <strong>₹${restaurantCharges.toFixed(2)}</strong>
          </div>

          <div class="row">
            <span>Tax Amount</span>
            <strong>₹${taxAmount.toFixed(2)}</strong>
           </div>

          <div class="row">
            <span>Discount</span>
            <strong>- ₹${discount.toFixed(2)}</strong>
          </div>

          <div class="row total">
            <span>Final Total</span>
            <strong>₹${totalAmount.toFixed(2)}</strong>
          </div>

          <div class="row">
            <span>Advance / Already Paid</span>
            <strong>₹${paidAmount.toFixed(2)}</strong>
          </div>

          <div class="row total">
            <span>Balance Due</span>
            <strong>₹${dueAmount.toFixed(2)}</strong>
          </div>
         </div>

          <button onclick="window.print()">Print Invoice</button>
         </body>
         </html>
         `);

    printWindow.document.close();
  }

  return (
    <div className="invoices-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Invoices"
        kicker="FRONT DESK"
        description="Generate final checkout invoices including booking, room bill, guest services, and advance payments."
        icon={ReceiptText}
        backPath="/front-desk"
      />

      {error && <div className="invoices-error-box">{error}</div>}
      {success && <div className="invoices-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <div className="invoices-stats-grid">
        <StatCard
          title="Total Invoices"
          value={invoiceStats.total}
          Icon={ReceiptText}
          colorTheme="blue"
        />
        <StatCard
          title="Pending"
          value={invoiceStats.pending}
          Icon={FileText}
          colorTheme="orange"
        />
        <StatCard
          title="Paid"
          value={invoiceStats.paid}
          Icon={CreditCard}
          colorTheme="green"
        />
        <StatCard
          title="Total Value"
          value={`₹${Number(invoiceStats.totalAmount || 0).toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="purple"
        />
      </div>
      {/* --------------------------- */}

      <section className="invoices-form-card">
        <div className="invoices-section-title">
          <div className="invoices-section-icon">
            <Plus size={18} />
          </div>

          <div>
            <h3>Generate Final Checkout Invoice</h3>
            <p>
              Select booking and generate final bill with all checkout charges.
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerateInvoice}>
          <div className="invoices-form-grid">
            <div className="invoices-form-group invoices-booking-field">
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

            <div className="invoices-form-group">
              <label>Invoice Date</label>
              <input
                type="date"
                name="issue_date"
                value={formData.issue_date}
                onChange={handleChange}
              />
            </div>

            <div className="invoices-form-group">
              <label>Due Date</label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
              />
            </div>

            {selectedBooking && (
              <div className="invoices-booking-preview">
                <div>
                  <span>Guest</span>
                  <strong>{getGuestName(selectedBooking.guest_id)}</strong>
                </div>

                <div>
                  <span>Room</span>
                  <strong>Room {getRoomNumber(selectedBooking.room_id)}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>{selectedBooking.status || "-"}</strong>
                </div>

                <div>
                  <span>Booking Amount</span>
                  <strong>₹{getBookingTotal(selectedBooking).toFixed(2)}</strong>
                </div>
              </div>
            )}

            <div className="invoices-form-group">
              <label>Guest Service Charges</label>
              <input
                type="number"
                value={amountBreakdown.guestServiceCharges.toFixed(2)}
                readOnly
                className="read-only-input"
              />
            </div>

            <div className="invoices-form-group">
              <label>Restaurant / Room Bill</label>
              <input
                type="number"
                value={amountBreakdown.restaurantCharges.toFixed(2)}
                readOnly
                className="read-only-input"
              />
            </div>

            <div className="invoices-form-group">
              <label>Discount</label>
              <input
                type="number"
                name="discount_amount"
                min="0"
                step="0.01"
                value={formData.discount_amount}
                onChange={handleChange}
              />
            </div>

            <div className="invoices-form-group">
              <label>Tax Amount</label>
              <input
                type="number"
                name="tax_amount"
                min="0"
                step="0.01"
                value={formData.tax_amount}
                onChange={handleChange}
              />
            </div>

            <div className="invoices-form-group">
              <label>Advance Already Paid</label>
              <input
                type="number"
                name="paid_amount"
                min="0"
                step="0.01"
                value={formData.paid_amount}
                onChange={handleChange}
              />
            </div>

            <div className="invoices-form-group invoices-notes-field">
              <label>Notes</label>
              <textarea
                name="notes"
                placeholder="Example: Final invoice generated during checkout"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <div className="invoices-total-breakdown">
            <div className="invoices-breakdown-header">
              <div>
                <span>Amount Breakdown</span>
                <p>Summary of all room, restaurant, and guest service charges</p>
              </div>
              <strong>₹{amountBreakdown.totalAmount.toFixed(2)}</strong>
            </div>

            <div className="invoices-breakdown-grid">
              <div>
                <p>Booking</p>
                <h4>₹{amountBreakdown.bookingAmount.toFixed(2)}</h4>
              </div>

              <div>
                <p>Guest Services</p>
                <h4>₹{amountBreakdown.guestServiceCharges.toFixed(2)}</h4>
              </div>

              <div>
                <p>Restaurant / Room Bill</p>
                <h4>₹{amountBreakdown.restaurantCharges.toFixed(2)}</h4>
              </div>

              <div>
                <p>Discount</p>
                <h4>₹{amountBreakdown.discountAmount.toFixed(2)}</h4>
              </div>

              <div>
                <p>Tax</p>
                <h4>₹{amountBreakdown.taxAmount.toFixed(2)}</h4>
              </div>

              <div>
                <p>Advance Paid</p>
                <h4>₹{amountBreakdown.paidAmount.toFixed(2)}</h4>
              </div>

              <div>
                <p>Final Total</p>
                <h4>₹{amountBreakdown.totalAmount.toFixed(2)}</h4>
              </div>

              <div>
                <p>Balance Due</p>
                <h4>₹{amountBreakdown.balanceDue.toFixed(2)}</h4>
              </div>
            </div>
          </div>

          <div className="invoices-form-actions">
            <button
              type="button"
              className="invoices-cancel-btn"
              onClick={resetForm}
            >
              <X size={16} />
              Reset
            </button>

            <button
              type="submit"
              className="invoices-save-btn"
              disabled={generating}
            >
              <Plus size={16} />
              {generating ? "Generating..." : "Generate Final Invoice"}
            </button>
          </div>
        </form>
      </section>

      <section className="invoices-table-card">
        <div className="invoices-table-header">
          <div className="invoices-section-title compact">
            <div className="invoices-section-icon">
              <CalendarDays size={18} />
            </div>

            <div>
              <h3>Recent Invoices</h3>
              <p>Latest invoices generated for this hotel.</p>
            </div>
          </div>

          <div className="invoices-filter-row">
            <div className="invoices-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search invoice..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="invoices-filter-box">
              <Filter size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                {invoiceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="invoices-empty-state">
            <h4>Loading invoices...</h4>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="invoices-empty-state">
            <h4>No invoices found</h4>
            <p>Generate your first invoice using the form above.</p>
          </div>
        ) : (
          <div className="invoices-table-scroll">
            <table className="invoices-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Invoice</th>
                  <th>Guest / Room</th>
                  <th>Booking</th>
                  <th>Total</th>
                  <th>Paid / Due</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><span className="inv-id-tag">#{invoice.id}</span></td>

                    <td>
                      <div className="inv-details-cell">
                        <strong>{getInvoiceNumber(invoice)}</strong>
                        <span>
                          <CalendarDays size={12} />
                          {invoice.issue_date || invoice.invoice_date || "-"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="inv-details-cell">
                        <strong>
                          <User size={12} />
                          {getGuestName(getInvoiceGuestId(invoice))}
                        </strong>
                        <span>Room {getRoomNumber(getInvoiceRoomId(invoice))}</span>
                      </div>
                    </td>

                    <td>
                      <strong>Booking #{invoice.booking_id || "-"}</strong>
                    </td>

                    <td>
                      <strong className="inv-price">₹{getInvoiceTotal(invoice).toFixed(2)}</strong>
                    </td>

                    <td>
                      <div className="inv-details-cell">
                        <strong>
                          Paid ₹
                          {Number(
                            invoice.paid_amount || invoice.amount_paid || 0
                          ).toFixed(2)}
                        </strong>
                        <span>Due ₹{getInvoiceDue(invoice).toFixed(2)}</span>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`inv-status-pill ${getStatusClass(
                          getInvoiceStatus(invoice)
                        )}`}
                      >
                        {getInvoiceStatus(invoice)}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="invoices-action-row">
                        <button
                          type="button"
                          className="invoices-print-btn"
                          onClick={() => handlePrintInvoice(invoice)}
                        >
                          <Printer size={15} />
                        </button>

                        <button
                          type="button"
                          className="invoices-download-btn"
                          onClick={() => handlePrintInvoice(invoice)}
                        >
                          <Download size={15} />
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
  );
}