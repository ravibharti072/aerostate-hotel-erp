import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  X,
  BedDouble,
  Receipt,
  CheckCircle,
  RotateCcw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Building2,
  Printer,
  Eye,
  Copy,
  FileText,
  Check,
  Calendar,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./payments.css";

function numberToWordsINR(num) {
  const n = Math.round(Number(num) || 0);
  if (n <= 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(val) {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + a[val % 10] : "");
    if (val < 1000) return a[Math.floor(val / 100)] + " Hundred" + (val % 100 !== 0 ? " and " + inWords(val % 100) : "");
    if (val < 100000) return inWords(Math.floor(val / 1000)) + " Thousand" + (val % 1000 !== 0 ? " " + inWords(val % 1000) : "");
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + " Lakh" + (val % 100000 !== 0 ? " " + inWords(val % 100000) : "");
    return inWords(Math.floor(val / 10000000)) + " Crore" + (val % 10000000 !== 0 ? " " + inWords(val % 10000000) : "");
  }

  return `Indian Rupees ${inWords(n)} Only`;
}

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
  "cheque",
  "other",
];

const paymentTypes = ["advance", "partial", "final", "refund"];

export default function PaymentsPage() {
  const { user, hotelInfo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  const [activeTab, setActiveTab] = useState("all"); // "all" | "advance" | "settlement" | "refund" | "unsettled"
  const [searchText, setSearchText] = useState("");
  const [unsettledSearch, setUnsettledSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");

  // Payment & Advance Collection Modal State (Issue 2)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [modalWorkflow, setModalWorkflow] = useState("advance"); // "advance" | "settlement"

  // Date Range Filters & Multi-Filter State (Issue 5)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Statutory Receipt Voucher Modal State (Issue 3)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [copiedReceiptId, setCopiedReceiptId] = useState(null);

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

  function getBookingAllocatedRooms(booking) {
    if (!booking) return "-";
    let raw = booking.assigned_room_ids;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = [];
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((id) => `Room ${getRoomNumber(id)}`).join(", ");
    }
    return `Room ${getRoomNumber(booking.room_id)}`;
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
      0
    );
  }

  function getInvoiceTotal(invoice) {
    if (!invoice) return 0;
    return Number(invoice.grand_total || invoice.total_amount || invoice.amount || 0);
  }

  function getInvoicePaid(invoice) {
    if (!invoice) return 0;
    return Number(invoice.paid_amount || invoice.amount_paid || 0);
  }

  function getInvoiceDue(invoice) {
    if (!invoice) return 0;
    return Number(invoice.due_amount ?? (getInvoiceTotal(invoice) - getInvoicePaid(invoice)));
  }

  function getPaymentAmount(payment) {
    return Number(
      payment.amount ||
      payment.payment_amount ||
      payment.paid_amount ||
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
    return payment.payment_date || payment.date || (payment.created_at ? payment.created_at.slice(0, 10) : "-");
  }

  function getPaymentDateTime(payment) {
    const raw = payment.created_at || payment.payment_date || payment.date;
    if (!raw) return { date: "-", time: "" };

    const rawStr = String(raw).trim();
    let datePart = rawStr.slice(0, 10);
    let timePart = "";

    if (rawStr.includes("T")) {
      const parts = rawStr.split("T");
      datePart = parts[0];
      timePart = parts[1] ? parts[1].slice(0, 8) : "";
    } else if (rawStr.includes(" ")) {
      const parts = rawStr.split(" ");
      datePart = parts[0];
      timePart = parts[1] ? parts[1].slice(0, 8) : "";
    }

    let formattedTime = "";
    if (timePart) {
      try {
        const [hh, mm] = timePart.split(":");
        let hour = parseInt(hh, 10);
        if (!isNaN(hour)) {
          const ampm = hour >= 12 ? "PM" : "AM";
          hour = hour % 12 || 12;
          formattedTime = `${hour}:${mm || "00"} ${ampm}`;
        }
      } catch {
        formattedTime = timePart.slice(0, 5);
      }
    }

    return { date: datePart, time: formattedTime };
  }

  function getPaymentGuestId(payment) {
    const booking = getBookingById(payment.booking_id);
    const invoice = getInvoiceById(payment.invoice_id);
    return payment.guest_id || booking?.guest_id || invoice?.guest_id;
  }

  function getBookingLabel(booking) {
    return `#${booking.id} - ${getGuestName(booking.guest_id)} (${getBookingAllocatedRooms(booking)})`;
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
        setPayments(paymentsList.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId)));
        setBookings(bookingsList.filter((item) => Number(item.hotel_id) === Number(hotelId)));
        setGuests(guestsList.filter((item) => Number(item.hotel_id) === Number(hotelId)));
        setRooms(roomsList.filter((item) => Number(item.hotel_id) === Number(hotelId)));
        setInvoices(invoicesList.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId)));
      } else {
        setPayments(paymentsList);
        setBookings(bookingsList);
        setGuests(guestsList);
        setRooms(roomsList);
        setInvoices(invoicesList);
      }
    } catch (err) {
      console.error("Fetch payments error:", err);
      setError(getApiErrorMessage(err, "Failed to load payments data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Handle incoming routing state (from CheckInOut or Bookings)
  useEffect(() => {
    if (location.state?.booking_id && bookings.length > 0) {
      const bId = String(location.state.booking_id);
      setFormData((prev) => ({
        ...prev,
        booking_id: bId,
      }));
      window.history.replaceState({}, document.title);
    }
  }, [location.state, bookings]);

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
      : (selectedBooking?.advance_paid ?? selectedBookingPaymentsTotal);

    const currentPayment = Number(formData.amount || 0);
    const balanceBeforePayment = selectedInvoice
      ? invoiceDue
      : Math.max(totalAmount - alreadyPaid, 0);

    const balanceAfterPayment = Math.max(balanceBeforePayment - currentPayment, 0);

    return {
      bookingAmount,
      invoiceAmount,
      totalAmount,
      alreadyPaid,
      currentPayment,
      balanceBeforePayment,
      balanceAfterPayment,
    };
  }, [selectedBooking, selectedInvoice, selectedBookingPaymentsTotal, formData.amount]);

  const unsettledBookings = useMemo(() => {
    return bookings.filter((b) => {
      const st = String(b.status || "").toLowerCase();
      // Checked in or confirmed stays
      const isLiveOrUpcoming = st === "checked_in" || st === "confirmed";
      if (!isLiveOrUpcoming) return false;

      const total = getBookingTotal(b);
      const paid = Number(b.advance_paid || 0);
      const due = total - paid;
      const pStatus = String(b.payment_status || "pending").toLowerCase();
      return pStatus !== "paid" && due > 0;
    });
  }, [bookings]);

  const filteredUnsettledBookings = useMemo(() => {
    return unsettledBookings.filter((b) => {
      const search = unsettledSearch.toLowerCase().trim();
      if (!search) return true;
      const bId = String(b.id || "").toLowerCase();
      const resCode = String(b.reservation_code || "").toLowerCase();
      const gName = String(getGuestName(b.guest_id) || b.guest_name || "").toLowerCase();
      const phone = String(b.guest_phone || "").toLowerCase();
      const roomsStr = String(getBookingAllocatedRooms(b)).toLowerCase();
      return (
        bId.includes(search) ||
        resCode.includes(search) ||
        gName.includes(search) ||
        phone.includes(search) ||
        roomsStr.includes(search)
      );
    });
  }, [unsettledBookings, unsettledSearch, guests, rooms]);

  const paymentStats = useMemo(() => {
    let totalCollected = 0;
    let advanceTotal = 0;
    let advanceCount = 0;
    let settlementTotal = 0;
    let settlementCount = 0;
    let refundTotal = 0;
    let refundCount = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let digitalTotal = 0;

    payments.forEach((payment) => {
      const amt = getPaymentAmount(payment);
      const method = getPaymentMethod(payment).toLowerCase();
      const pType = getPaymentType(payment).toLowerCase();

      if (pType === "refund") {
        refundTotal += amt;
        refundCount++;
      } else {
        totalCollected += amt;
      }

      if (pType === "advance") {
        advanceTotal += amt;
        advanceCount++;
      } else if (pType !== "refund") {
        settlementTotal += amt;
        settlementCount++;
      }

      if (method === "cash") {
        cashTotal += amt;
      } else if (method === "upi") {
        upiTotal += amt;
      } else if (["card", "bank_transfer", "online", "cheque"].includes(method)) {
        digitalTotal += amt;
      }
    });

    const unsettledTotal = unsettledBookings.reduce((sum, b) => {
      const tot = getBookingTotal(b);
      const adv = Number(b.advance_paid || 0);
      return sum + Math.max(tot - adv, 0);
    }, 0);

    return {
      total: payments.length,
      totalCollected,
      advanceTotal,
      advanceCount,
      settlementTotal,
      settlementCount,
      refundTotal,
      refundCount,
      cashTotal,
      upiTotal,
      digitalTotal,
      unsettledTotal,
      unsettledCount: unsettledBookings.length,
    };
  }, [payments, unsettledBookings]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const search = searchText.toLowerCase().trim();
      const method = getPaymentMethod(payment).toLowerCase();
      const pType = getPaymentType(payment).toLowerCase();
      const pDate = getPaymentDate(payment);

      const guestName = getGuestName(getPaymentGuestId(payment)).toLowerCase();
      const bookingId = String(payment.booking_id || "").toLowerCase();
      const invoiceId = String(payment.invoice_id || "").toLowerCase();
      const receiptNo = String(payment.receipt_number || "").toLowerCase();
      const reference = String(
        payment.reference_number || payment.transaction_id || ""
      ).toLowerCase();

      const bookingObj = getBookingById(payment.booking_id);
      const resCode = String(bookingObj?.reservation_code || "").toLowerCase();
      const roomStr = String(bookingObj ? getBookingAllocatedRooms(bookingObj) : "").toLowerCase();

      const matchesSearch =
        !search ||
        guestName.includes(search) ||
        bookingId.includes(search) ||
        invoiceId.includes(search) ||
        receiptNo.includes(search) ||
        reference.includes(search) ||
        resCode.includes(search) ||
        roomStr.includes(search);

      const matchesMethod =
        methodFilter === "all" || method === methodFilter.toLowerCase();

      const matchesFrom = !fromDate || (pDate && pDate !== "-" && pDate >= fromDate);
      const matchesTo = !toDate || (pDate && pDate !== "-" && pDate <= toDate);

      let matchesTab = true;
      if (activeTab === "advance") {
        matchesTab = pType === "advance";
      } else if (activeTab === "settlement") {
        matchesTab = pType === "final" || pType === "partial" || pType === "payment";
      } else if (activeTab === "refund") {
        matchesTab = pType === "refund";
      }

      return matchesSearch && matchesMethod && matchesFrom && matchesTo && matchesTab;
    });
  }, [payments, bookings, guests, rooms, searchText, methodFilter, fromDate, toDate, activeTab]);

  const hasActiveFilters = Boolean(
    searchText.trim() || methodFilter !== "all" || fromDate || toDate
  );

  const handleOpenPaymentModal = (booking = null, defaultWorkflow = "advance") => {
    setError("");
    setSuccess("");
    if (booking) {
      const bId = String(booking.id);
      const linkedInvoice = getInvoiceByBookingId(bId);
      const total = getBookingTotal(booking);
      const adv = Number(booking.advance_paid || 0);
      const due = Math.max(total - adv, 0);

      const workflow = defaultWorkflow || (adv > 0 ? "settlement" : "advance");
      setModalWorkflow(workflow);
      setFormData({
        booking_id: bId,
        invoice_id: linkedInvoice?.id ? String(linkedInvoice.id) : "",
        payment_date: new Date().toISOString().slice(0, 10),
        amount: due > 0 ? due.toFixed(2) : "",
        payment_method: "cash",
        payment_type: workflow === "advance" ? "advance" : "final",
        reference_number: "",
        notes: `${workflow === "advance" ? "Advance deposit" : "Stay settlement"} for Booking #${bId}`,
      });
    } else {
      setModalWorkflow(defaultWorkflow);
      setFormData(initialFormData);
    }
    setPaymentModalOpen(true);
  };

  const handleSelectUnsettledBooking = (b) => {
    handleOpenPaymentModal(b, "settlement");
  };

  // Autofill due balance when booking selection changes
  useEffect(() => {
    if (!selectedBooking) return;

    const linkedInvoice = getInvoiceByBookingId(selectedBooking.id);
    const due = linkedInvoice
      ? getInvoiceDue(linkedInvoice)
      : Math.max(getBookingTotal(selectedBooking) - (selectedBooking.advance_paid || 0), 0);

    setFormData((prev) => ({
      ...prev,
      invoice_id: linkedInvoice?.id || "",
      amount: due > 0 ? due.toFixed(2) : "",
      payment_type: modalWorkflow === "advance" ? "advance" : "final",
    }));
  }, [selectedBooking?.id, modalWorkflow, invoices.length]);

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

  async function handleSubmit(e) {
    e.preventDefault();

    if (!formData.booking_id) {
      setError("Please select a target reservation first.");
      return;
    }

    const payAmt = Number(formData.amount || 0);
    if (payAmt <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (modalWorkflow === "advance") {
        // Dual Workflow Tab A: Advance Deposit via POST /payments/advance
        const advancePayload = {
          booking_id: Number(formData.booking_id),
          amount: payAmt,
          payment_method: formData.payment_method,
          transaction_id: formData.reference_number.trim() || null,
          remarks: formData.notes.trim() || `Advance deposit for Booking #${formData.booking_id}`,
          customer_gstin: selectedBooking?.guest?.gstin || null,
          place_of_supply: selectedBooking?.guest?.state || null,
        };

        const res = await api.post("/payments/advance", advancePayload);
        const receiptNo = res.data?.receipt_number || `ADV-${formData.booking_id}`;
        setSuccess(`Advance payment of ₹${payAmt.toFixed(2)} recorded successfully. Generated Receipt Voucher: ${receiptNo}`);
      } else {
        // Dual Workflow Tab B: Stay Folio Settlement
        let activeInvoiceId = formData.invoice_id;

        if (!activeInvoiceId && selectedBooking) {
          // If no invoice generated yet for this booking, generate finalized stay invoice from folio
          try {
            const genRes = await api.post(`/invoices/generate/${selectedBooking.id}`);
            activeInvoiceId = genRes.data?.id;
          } catch (invErr) {
            console.warn("Invoice auto-generation note:", invErr);
          }
        }

        if (!activeInvoiceId) {
          throw new Error("Unable to link settlement: No active invoice found or generated for this reservation.");
        }

        const settlementPayload = {
          invoice_id: Number(activeInvoiceId),
          amount: payAmt,
          payment_method: formData.payment_method,
          transaction_id: formData.reference_number.trim() || null,
          received_by: user?.username || "Front Desk",
          remarks: formData.notes.trim() || `Settlement payment for Booking #${formData.booking_id}`,
        };

        await api.post("/payments", settlementPayload);
        setSuccess(`Settlement payment of ₹${payAmt.toFixed(2)} recorded successfully against Invoice #${activeInvoiceId}.`);
      }

      setPaymentModalOpen(false);
      resetForm();
      await fetchData();
    } catch (err) {
      console.error("Record payment error:", err);
      setError(getApiErrorMessage(err, "Failed to record payment transaction."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(payment) {
    const confirmed = window.confirm("Are you sure you want to delete this payment record?");
    if (!confirmed) return;

    try {
      setDeletingId(payment.id);
      setError("");
      setSuccess("");

      await api.delete(`/payments/${payment.id}`);
      setSuccess("Payment record deleted.");
      setTimeout(() => setSuccess(""), 3000);
      await fetchData();
    } catch (err) {
      console.error("Delete payment error:", err);
      setError(getApiErrorMessage(err, "Failed to delete payment."));
    } finally {
      setDeletingId(null);
    }
  }

  const handleResetFilters = () => {
    setSearchText("");
    setMethodFilter("all");
    setFromDate("");
    setToDate("");
  };

  const handleCopyReceiptNo = (receiptNo) => {
    if (!receiptNo) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(receiptNo);
    }
    setCopiedReceiptId(receiptNo);
    setTimeout(() => setCopiedReceiptId(null), 2000);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const getMethodIcon = (method) => {
    const m = (method || "").toLowerCase();
    if (m === "cash") return <Wallet size={12} />;
    if (m === "upi") return <Receipt size={12} />;
    if (m === "card") return <CreditCard size={12} />;
    if (m === "bank_transfer") return <Building2 size={12} />;
    return <CreditCard size={12} />;
  };

  const handleViewReceipt = async (payment) => {
    if (!payment) return;
    setLoadingReceipt(true);
    setError("");
    try {
      const isAdvance = (payment.payment_type || "").toLowerCase() === "advance" || Boolean(payment.receipt_number);
      let receiptData = null;

      if (isAdvance && payment.id) {
        try {
          const res = await api.get(`/payments/receipt/${payment.id}`);
          if (res.data) {
            receiptData = {
              ...res.data,
              isAdvance: true,
              receipt_date: res.data.receipt_date ? res.data.receipt_date.slice(0, 10) : getPaymentDate(payment),
            };
          }
        } catch (receiptErr) {
          console.warn("Backend advance receipt endpoint note:", receiptErr);
        }
      }

      if (!receiptData) {
        const bId = payment.booking_id || (payment.invoice_id ? getInvoiceById(payment.invoice_id)?.booking_id : null);
        const booking = getBookingById(bId);
        const guest = guests.find((g) => Number(g.id) === Number(getPaymentGuestId(payment)));
        const invoice = getInvoiceById(payment.invoice_id);
        const amt = getPaymentAmount(payment);
        const taxRate = payment.tax_rate ?? 12;
        const taxable = payment.taxable_amount ?? (taxRate > 0 ? amt / (1 + taxRate / 100) : amt);
        const taxAmt = amt - taxable;
        const isInter = Boolean(payment.igst && Number(payment.igst) > 0);
        const cgst = payment.cgst ?? (isInter ? 0 : taxAmt / 2);
        const sgst = payment.sgst ?? (isInter ? 0 : taxAmt / 2);
        const igst = payment.igst ?? (isInter ? taxAmt : 0);

        const hotelObj = hotelInfo || user?.hotel || {};
        const hotelAddr = [hotelObj.address, hotelObj.city, hotelObj.state].filter(Boolean).join(", ") || "Front Desk Operations";

        receiptData = {
          isAdvance: (payment.payment_type || "").toLowerCase() === "advance",
          receipt_number: payment.receipt_number || (payment.payment_type === "advance" ? `ADV-${payment.id}` : `REC-26-27-${String(payment.id).padStart(6, "0")}`),
          receipt_date: getPaymentDate(payment),
          hotel_name: hotelObj.name || user?.hotel_name || "Hotel Operations",
          hotel_address: hotelAddr,
          hotel_phone: hotelObj.phone || "",
          hotel_email: hotelObj.email || "",
          hotel_gstin: hotelObj.tax_number || hotelObj.gstin || "",
          guest_name: guest?.full_name || guest?.name || "Valued Guest",
          guest_phone: guest?.phone || "—",
          guest_email: guest?.email || "—",
          customer_gstin: payment.customer_gstin || guest?.gstin || "URP (Unregistered Person)",
          reservation_code: booking?.reservation_code || (booking?.id ? `#${booking.id}` : "—"),
          booking_id: booking?.id || bId,
          folio_number: booking?.folio_number || payment.folio_id || (invoice?.invoice_number ? `INV-${invoice.invoice_number}` : "—"),
          room_number: booking ? getBookingAllocatedRooms(booking) : "—",
          stay_label: booking ? `${booking.checkin_date || ""} to ${booking.checkout_date || ""}` : "Hotel Accommodation Services",
          advance_amount: amt,
          taxable_amount: taxable,
          tax_rate: taxRate,
          cgst,
          sgst,
          igst,
          payment_method: getPaymentMethod(payment),
          transaction_id: payment.reference_number || payment.transaction_id || "Direct Cash / Counter",
          place_of_supply: payment.place_of_supply || hotelObj.state || "Intra-State",
          is_reverse_charge: false,
          received_by: payment.received_by || user?.username || "Front Desk Cashier",
          remarks: payment.remarks || payment.notes || "Payment received with thanks.",
        };
      }

      setActiveReceipt(receiptData);
      setReceiptModalOpen(true);
    } catch (err) {
      console.error("View receipt error:", err);
      setError("Failed to generate receipt voucher preview.");
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleExportCashierCSV = () => {
    const headers = [
      "Voucher / Receipt #",
      "Payment Date",
      "Payment Time",
      "Payment Type",
      "Reservation Code",
      "Booking ID",
      "Invoice ID",
      "Guest Name",
      "Guest Phone",
      "Guest GSTIN",
      "Billing Type",
      "Room Allocation",
      "SAC Code",
      "Payment Method",
      "Reference / UTR",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Total Amount (INR)",
      "Received By / Cashier",
      "Remarks / Notes",
    ];

    const dataRows = filteredPayments.map((p) => {
      const bId = p.booking_id || (p.invoice_id ? getInvoiceById(p.invoice_id)?.booking_id : null);
      const booking = getBookingById(bId);
      const gId = getPaymentGuestId(p);
      const guest = guests.find((g) => Number(g.id) === Number(gId));
      const amt = getPaymentAmount(p);
      const taxRate = p.tax_rate ?? 12;
      const taxable = p.taxable_amount ?? (taxRate > 0 ? amt / (1 + taxRate / 100) : amt);
      const taxAmt = amt - taxable;
      const isInter = Boolean(p.igst && Number(p.igst) > 0);
      const cgst = p.cgst ?? (isInter ? 0 : taxAmt / 2);
      const sgst = p.sgst ?? (isInter ? 0 : taxAmt / 2);
      const igst = p.igst ?? (isInter ? taxAmt : 0);
      const guestGstin = p.customer_gstin || guest?.gstin || "";
      const billingType = guestGstin ? "B2B" : "B2C";
      const pType = getPaymentType(p);
      const pTypeLabel =
        pType === "advance"
          ? "Advance Deposit"
          : pType === "refund"
            ? "Refund / Reversal"
            : pType === "partial"
              ? "Partial Settlement"
              : "Final Settlement";

      return [
        p.receipt_number || (pType === "advance" ? `ADV-${p.id}` : `REC-${p.id}`),
        getPaymentDate(p),
        getPaymentDateTime(p).time || "-",
        pTypeLabel,

        booking?.reservation_code || "",
        bId || "",
        p.invoice_id || "",
        guest?.full_name || guest?.name || getGuestName(gId),
        guest?.phone || "",
        guestGstin,
        billingType,
        booking ? getBookingAllocatedRooms(booking) : "",
        "996311",
        getPaymentMethod(p).toUpperCase(),
        p.reference_number || p.transaction_id || "",
        taxable.toFixed(2),
        cgst.toFixed(2),
        sgst.toFixed(2),
        igst.toFixed(2),
        amt.toFixed(2),
        p.received_by || user?.username || "Front Desk",
        p.remarks || p.notes || "",
      ];
    });

    const csvContent =
      "\uFEFF" +
      [headers, ...dataRows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cashier_Payment_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="directory-page payments-page">
      {/* PORTAL HEADER */}
      <PortalHeader
        title="Payments Ledger"
        kicker="FINANCIAL & REVENUE MANAGEMENT"
        description="Record advance deposits, room settlements, and track payment transactions by booking."
        icon={Wallet}
        backPath="/front-desk"
        rightAction={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className="portal-header-badge">
              {unsettledBookings.length > 0
                ? `${unsettledBookings.length} stays pending settlement`
                : "All active stays settled"}
            </span>

            <button
              type="button"
              className="portal-action-btn"
              onClick={() => handleOpenPaymentModal(null, "advance")}
              title="Record new guest advance deposit or stay settlement"
            >
              <Plus size={16} /> Record Payment
            </button>
          </div>
        }
      />

      {error && <div className="payments-error-box no-print">{error}</div>}
      {success && <div className="payments-success-box no-print">{success}</div>}

      {/* 5-CARD FINANCIAL LIFECYCLE KPI STRIP */}
      <div className="dir-stats-grid cio-stats-five-grid no-print">
        <StatCard
          title="Total Collections"
          value={`₹${Number(paymentStats.totalCollected || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={IndianRupee}
          colorTheme="purple"
          onClick={() => setActiveTab("all")}
          isActive={activeTab === "all"}
        />
        <StatCard
          title="Advance Deposits"
          value={`₹${Number(paymentStats.advanceTotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={Clock}
          colorTheme="amber"
          onClick={() => setActiveTab("advance")}
          isActive={activeTab === "advance"}
        />
        <StatCard
          title="Stay Settlements"
          value={`₹${Number(paymentStats.settlementTotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => setActiveTab("settlement")}
          isActive={activeTab === "settlement"}
        />
        <StatCard
          title="UPI & Digital Intake"
          value={`₹${Number(paymentStats.upiTotal + paymentStats.digitalTotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={CreditCard}
          colorTheme="blue"
        />
        <StatCard
          title="Unsettled Folios"
          value={`₹${Number(paymentStats.unsettledTotal || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={AlertCircle}
          colorTheme="red"
          onClick={() => setActiveTab("unsettled")}
          isActive={activeTab === "unsettled"}
        />
      </div>

      {/* STANDARDIZED FRONT DESK QUEUE CONTROLS & TABS */}
      <div className="cio-queue-controls no-print">
        <div className="cio-queue-tabs">
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            <ReceiptText size={15} /> All Transactions
            <span className="cio-tab-count">{payments.length}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "advance" ? "active" : ""}`}
            onClick={() => setActiveTab("advance")}
          >
            <Clock size={15} /> Advance Deposits
            <span className="cio-tab-count">{paymentStats.advanceCount}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "settlement" ? "active" : ""}`}
            onClick={() => setActiveTab("settlement")}
          >
            <CheckCircle2 size={15} /> Stay Settlements
            <span className="cio-tab-count">{paymentStats.settlementCount}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "refund" ? "active" : ""}`}
            onClick={() => setActiveTab("refund")}
          >
            <RotateCcw size={15} /> Refunds & Reversals
            <span className="cio-tab-count">{paymentStats.refundCount}</span>
          </button>

          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "unsettled" ? "active" : ""}`}
            onClick={() => setActiveTab("unsettled")}
          >
            <AlertCircle size={15} /> Unsettled Bookings Queue
            <span className="cio-tab-count">{unsettledBookings.length}</span>
          </button>
        </div>
      </div>

      {/* RECORD PAYMENT & ADVANCE COLLECTION MODAL (ISSUE 2) */}
      {paymentModalOpen && (
        <div className="modal-overlay" onClick={() => setPaymentModalOpen(false)}>
          <div className="modal-content-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div>
                <h2>{modalWorkflow === "advance" ? "Record Advance Deposit" : "Record Stay Folio Settlement"}</h2>
                <div className="modal-kicker">
                  {modalWorkflow === "advance"
                    ? "Generate statutory Advance Receipt Voucher (ADV-...) for booking"
                    : "Collect partial or final settlement against guest stay folio"}
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPaymentModalOpen(false)}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {/* Dual Workflow Switcher */}
              <div className="pay-modal-tabs">
                <button
                  type="button"
                  className={`pay-modal-tab ${modalWorkflow === "advance" ? "active" : ""}`}
                  onClick={() => {
                    setModalWorkflow("advance");
                    setFormData((prev) => ({ ...prev, payment_type: "advance" }));
                  }}
                >
                  <Clock size={14} /> Advance Deposit
                </button>
                <button
                  type="button"
                  className={`pay-modal-tab ${modalWorkflow === "settlement" ? "active" : ""}`}
                  onClick={() => {
                    setModalWorkflow("settlement");
                    setFormData((prev) => ({ ...prev, payment_type: "final" }));
                  }}
                >
                  <CheckCircle2 size={14} /> Stay Folio Settlement
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Target Reservation Selector */}
                <div className="form-group">
                  <label>Target Reservation *</label>
                  <select
                    name="booking_id"
                    value={formData.booking_id}
                    onChange={handleChange}
                    className="dir-select-field"
                    required
                  >
                    <option value="">-- Choose Reservation --</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {getBookingLabel(booking)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Booking Info Card */}
                {selectedBooking && (
                  <div className="pay-selected-booking-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                      <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>
                        {getGuestName(selectedBooking.guest_id)}
                      </strong>
                      <span className="text-muted" style={{ fontSize: "12px", fontFamily: "monospace" }}>
                        {selectedBooking.reservation_code || `#${selectedBooking.id}`}
                      </span>
                    </div>

                    <div className="pay-booking-badges">
                      {(selectedBooking.is_vip || selectedBooking.guest?.is_vip) && (
                        <span className="pay-vip-tag">VIP</span>
                      )}
                      {(selectedBooking.company_name || selectedBooking.is_corporate) && (
                        <span className="pay-corp-badge">
                          <Building2 size={11} /> {selectedBooking.company_name || "Corporate"}
                        </span>
                      )}
                      {(selectedBooking.agent_name || selectedBooking.referral_type === "agent") && (
                        <span className="pay-agent-badge">
                          Agent: {selectedBooking.agent_name || "Referral"}
                        </span>
                      )}
                      <span className="text-muted" style={{ fontSize: "11.5px" }}>
                        {getBookingAllocatedRooms(selectedBooking)} &bull; {selectedBooking.checkin_date || selectedBooking.check_in_date || ""} &rarr; {selectedBooking.checkout_date || selectedBooking.check_out_date || ""}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Financial Breakdown Summary */}
                {selectedBooking && (
                  <div className="payments-breakdown-box" style={{ marginTop: 0 }}>
                    <div className="breakdown-stat">
                      <span>Total Stay Bill</span>
                      <strong>₹{amountBreakdown.totalAmount.toFixed(2)}</strong>
                    </div>
                    <div className="breakdown-stat">
                      <span>Already Paid</span>
                      <strong style={{ color: "#059669" }}>₹{amountBreakdown.alreadyPaid.toFixed(2)}</strong>
                    </div>
                    <div className="breakdown-stat">
                      <span>Remaining Due</span>
                      <strong style={{ color: amountBreakdown.balanceBeforePayment > 0 ? "#dc2626" : "#059669" }}>
                        ₹{amountBreakdown.balanceBeforePayment.toFixed(2)}
                      </strong>
                    </div>
                    <div className="breakdown-stat">
                      <span>Balance After Entry</span>
                      <strong style={{ color: amountBreakdown.balanceAfterPayment > 0 ? "#dc2626" : "#059669" }}>
                        ₹{amountBreakdown.balanceAfterPayment.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Payment Amount & Preset Quick-Fill Chips */}
                <div className="form-group">
                  <label>Payment Amount (₹) *</label>
                  <input
                    type="number"
                    name="amount"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                  />

                  {/* Preset Amount Chips */}
                  <div className="pay-preset-chips">
                    <span className="pay-preset-label">Quick Fill:</span>
                    {amountBreakdown.balanceBeforePayment > 0 && (
                      <>
                        <button
                          type="button"
                          className="pay-chip-btn pay-chip-full"
                          onClick={() => setFormData((prev) => ({ ...prev, amount: amountBreakdown.balanceBeforePayment.toFixed(2) }))}
                        >
                          Full Due (₹{amountBreakdown.balanceBeforePayment.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          className="pay-chip-btn"
                          onClick={() => setFormData((prev) => ({ ...prev, amount: (amountBreakdown.balanceBeforePayment / 2).toFixed(2) }))}
                        >
                          50% Due (₹{(amountBreakdown.balanceBeforePayment / 2).toFixed(2)})
                        </button>
                      </>
                    )}
                    {[500, 1000, 2000, 5000].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        className="pay-chip-btn"
                        onClick={() => setFormData((prev) => ({ ...prev, amount: String(preset) }))}
                      >
                        ₹{preset.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="form-group">
                    <label>Payment Date *</label>
                    <input
                      type="date"
                      name="payment_date"
                      value={formData.payment_date}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleChange}
                      className="dir-select-field"
                      required
                    >
                      {paymentMethods.map((m) => (
                        <option key={m} value={m}>
                          {m.replace("_", " ").toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Transaction ID / Reference #</label>
                  <input
                    type="text"
                    name="reference_number"
                    placeholder="UPI Ref, Card Auth Code, or Cheque #"
                    value={formData.reference_number}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Cashier Notes / Remarks</label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="e.g. Booking advance deposit via UPI"
                    value={formData.notes}
                    onChange={handleChange}
                  />
                </div>

                {/* Modal Footer Actions */}
                <div className="payments-form-actions" style={{ marginTop: "6px" }}>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => {
                      setPaymentModalOpen(false);
                      resetForm();
                    }}
                  >
                    <X size={15} /> Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-submit"
                    disabled={saving}
                  >
                    <Plus size={15} /> {saving ? "Processing..." : modalWorkflow === "advance" ? "Record Advance Deposit" : "Record Settlement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENTS HISTORY TABLE */}
      {activeTab === "unsettled" ? (
        <section className="dir-modules-section no-print">
          <ModuleWriternHeader
            title="Unsettled Bookings Queue"
            description="Active in-house and confirmed reservations with outstanding balances awaiting payment settlement."
            badgeCount={filteredUnsettledBookings.length}
            badgeLabel="unsettled stays"
          />

          <div className="dir-controls" style={{ marginTop: 0 }}>
            <div className="dir-search-box" style={{ flex: 1.5 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search unsettled stays by guest name, phone, room, RES-..., or booking #..."
                value={unsettledSearch}
                onChange={(e) => setUnsettledSearch(e.target.value)}
              />
            </div>
            {unsettledSearch && (
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setUnsettledSearch("")}
                style={{ height: "40px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <X size={14} /> Clear Search
              </button>
            )}
          </div>

          <div className="dir-table-container">
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "100px" }}>Booking #</th>
                  <th>Guest & Contact</th>
                  <th>Room Allocation</th>
                  <th>Stay Dates</th>
                  <th>Total Bill</th>
                  <th>Advance Paid</th>
                  <th>Balance Due</th>
                  <th style={{ textAlign: "right", width: "140px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnsettledBookings.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      No unsettled bookings found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUnsettledBookings.map((b) => {
                    const total = getBookingTotal(b);
                    const adv = Number(b.advance_paid || 0);
                    const due = Math.max(total - adv, 0);
                    const guest = guests.find((g) => Number(g.id) === Number(b.guest_id));

                    return (
                      <tr key={b.id} className="dir-table-row">
                        <td>
                          <span className="booking-id-tag">#{b.id}</span>
                          {b.reservation_code && (
                            <span className="text-muted" style={{ display: "block", fontSize: "11px", fontFamily: "monospace" }}>
                              {b.reservation_code}
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="customer-cell">
                            <div className="staff-avatar">
                              {String(guest?.full_name || b.guest_name || "G").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="customer-name">{guest?.full_name || b.guest_name || "Guest"}</span>
                              <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                                {guest?.phone || b.guest_phone || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600 }}>{getBookingAllocatedRooms(b)}</span>
                        </td>

                        <td>
                          <span className="bank-primary">
                            {b.checkin_date || b.check_in_date || "-"} &rarr; {b.checkout_date || b.check_out_date || "-"}
                          </span>
                          <span className="mono-pill pill-normal" style={{ display: "inline-block", marginTop: "3px", textTransform: "uppercase", fontSize: "10px" }}>
                            {String(b.status || "").replace("_", " ")}
                          </span>
                        </td>

                        <td>
                          <strong>₹{total.toFixed(2)}</strong>
                        </td>

                        <td>
                          <span style={{ color: "#059669", fontWeight: 600 }}>₹{adv.toFixed(2)}</span>
                        </td>

                        <td>
                          <strong style={{ color: due > 0 ? "#dc2626" : "#059669", fontSize: "14px" }}>
                            ₹{due.toFixed(2)}
                          </strong>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn-preview-outline"
                            style={{ background: "#2d5696", color: "#ffffff", borderColor: "#2d5696" }}
                            onClick={() => handleSelectUnsettledBooking(b)}
                            title="Collect payment settlement for this booking"
                          >
                            <IndianRupee size={13} /> Collect Due
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
      ) : (
        <section className="dir-modules-section">
          <ModuleWriternHeader
            title="Payment Transactions"
            description="Detailed journal of all advance, partial, and checkout settlements."
            badgeCount={filteredPayments.length}
            badgeLabel={
              activeTab === "all"
                ? "records"
                : activeTab === "advance"
                  ? "advance vouchers"
                  : activeTab === "settlement"
                    ? "settlements"
                    : "refunds"
            }
          />

          <div className="pay-table-toolbar no-print" style={{ marginBottom: "16px" }}>
            <div className="dir-search-box" style={{ flex: 1.5, minWidth: "260px" }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by guest, room, booking #, voucher #, UTR / reference..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="pay-filters-group">
              {/* Date Range Filter */}
              <div className="pay-date-range-filter">
                <div className="pay-date-field">
                  <span className="pay-field-label">From:</span>
                  <input
                    type="date"
                    className="pay-date-input"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    title="Filter payments from date"
                  />
                </div>
                <span style={{ color: "#94a3b8" }}>&ndash;</span>
                <div className="pay-date-field">
                  <span className="pay-field-label">To:</span>
                  <input
                    type="date"
                    className="pay-date-input"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    title="Filter payments to date"
                  />
                </div>
              </div>

              {/* Method Selector */}
              <select
                className="dir-filter-select"
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
              >
                <option value="all">All Payment Methods</option>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method.replace("_", " ").toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="pay-reset-btn"
                  onClick={handleResetFilters}
                  title="Reset all search and date filters"
                >
                  <RotateCcw size={13} /> Reset
                </button>
              )}

              {/* Statutory GSTR-1 & Cashier Register CSV */}
              <button
                type="button"
                className="pay-export-csv-btn"
                onClick={handleExportCashierCSV}
                title="Export Statutory Cashier & GSTR-1 Payments Register to CSV"
              >
                <Download size={14} /> Export Cashier Register
              </button>
            </div>
          </div>

          <div className="dir-table-container">
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "135px" }}>Voucher #</th>
                  <th style={{ width: "135px" }}>Date & Time</th>
                  <th>Guest & Room Allocation</th>
                  <th>Linked Stay</th>
                  <th style={{ width: "115px" }}>Type</th>
                  <th style={{ width: "115px" }}>Amount</th>
                  <th style={{ width: "120px" }}>Method</th>
                  <th>Reference / UTR</th>
                  <th style={{ textAlign: "right", width: "95px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      Loading payment records...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="empty-state">
                      No transactions recorded matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => {
                    const bId = payment.booking_id || (payment.invoice_id ? getInvoiceById(payment.invoice_id)?.booking_id : null);
                    const bookingObj = getBookingById(bId);
                    const gId = getPaymentGuestId(payment);
                    const guestObj = guests.find((g) => Number(g.id) === Number(gId));
                    const pType = getPaymentType(payment).toLowerCase();
                    const voucherCode = payment.receipt_number || (pType === "advance" ? `ADV-${payment.id}` : `REC-${payment.id}`);

                    return (
                      <tr key={payment.id} className="dir-table-row">
                        <td>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <button
                              type="button"
                              className="pay-voucher-link"
                              onClick={() => handleViewReceipt(payment)}
                              title="Click to view statutory receipt voucher"
                            >
                              {voucherCode}
                            </button>
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              onClick={() => handleCopyReceiptNo(voucherCode)}
                              title={copiedReceiptId === voucherCode ? "Copied!" : "Copy voucher number"}
                              style={{ padding: "2px 4px", minWidth: "22px", height: "22px" }}
                            >
                              {copiedReceiptId === voucherCode ? (
                                <Check size={12} color="#059669" />
                              ) : (
                                <Copy size={12} color="#64748b" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td>
                          {(() => {
                            const dt = getPaymentDateTime(payment);
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span className="bank-primary" style={{ fontWeight: 600, color: "#1e293b" }}>{dt.date}</span>
                                {dt.time && (
                                  <span style={{ fontSize: "11px", color: "#64748b", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <Clock size={11} color="#64748b" /> {dt.time}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>


                        <td>
                          <div className="customer-cell">
                            <div className="staff-avatar">
                              {String(getGuestName(gId) || "G").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span className="customer-name">{getGuestName(gId)}</span>
                                {(bookingObj?.is_vip || guestObj?.is_vip) && (
                                  <span className="pay-vip-tag">VIP</span>
                                )}
                                {(bookingObj?.company_name || bookingObj?.is_corporate) && (
                                  <span className="pay-corp-badge">
                                    <Building2 size={10} /> {bookingObj.company_name || "Corporate"}
                                  </span>
                                )}
                                {(bookingObj?.agent_name || bookingObj?.referral_type === "agent") && (
                                  <span className="pay-agent-badge">
                                    Agent: {bookingObj.agent_name || "Referral"}
                                  </span>
                                )}
                              </div>
                              <span className="text-muted" style={{ display: "block", fontSize: "11px", marginTop: "2px" }}>
                                {bookingObj ? getBookingAllocatedRooms(bookingObj) : "-"} &bull; {guestObj?.phone || "—"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="bank-cell">
                            <span className="bank-primary">
                              {bId ? `Booking #${bId}` : "-"}
                              {bookingObj?.reservation_code ? ` (${bookingObj.reservation_code})` : ""}
                            </span>
                            <span className="bank-sub">
                              {payment.invoice_id ? `Invoice #${payment.invoice_id}` : "Advance / Direct"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className={`pay-type-badge ${pType === "advance"
                              ? "badge-advance"
                              : pType === "refund"
                                ? "badge-refund"
                                : pType === "partial"
                                  ? "badge-partial"
                                  : "badge-settlement"
                            }`}>
                            {pType === "advance" ? (
                              <Clock size={11} />
                            ) : pType === "refund" ? (
                              <RotateCcw size={11} />
                            ) : (
                              <CheckCircle2 size={11} />
                            )}
                            {pType === "advance" ? "Advance" : pType === "refund" ? "Refund" : pType === "partial" ? "Partial" : "Settlement"}
                          </span>
                        </td>

                        <td>
                          <strong style={{ color: pType === "refund" ? "#dc2626" : "#166962", fontSize: "14px" }}>
                            {pType === "refund" ? "- " : ""}₹{getPaymentAmount(payment).toFixed(2)}
                          </strong>
                        </td>

                        <td>
                          <span className="mono-pill pill-normal" style={{ display: "inline-flex", alignItems: "center", gap: "4px", textTransform: "uppercase" }}>
                            {getMethodIcon(getPaymentMethod(payment))}
                            {getPaymentMethod(payment).replace("_", " ")}
                          </span>
                        </td>

                        <td>
                          <span className="text-muted" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                            {payment.reference_number || payment.transaction_id || "—"}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "4px", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="View / Print Statutory Receipt Voucher"
                              onClick={() => handleViewReceipt(payment)}
                            >
                              <Printer size={14} color="#2d5696" />
                            </button>
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="Delete Payment Record"
                              onClick={() => handleDelete(payment)}
                              disabled={deletingId === payment.id}
                            >
                              <Trash2 size={14} color="#dc2626" />
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
      )}

      {/* STATUTORY ADVANCE RECEIPT VOUCHER & SETTLEMENT RECEIPT MODAL (ISSUE 3) */}
      {receiptModalOpen && activeReceipt && (
        <div className="modal-overlay" onClick={() => setReceiptModalOpen(false)}>
          <div className="receipt-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header no-print">
              <div>
                <h2>{activeReceipt.isAdvance ? "Advance Receipt Voucher" : "Payment Settlement Receipt"}</h2>
                <div className="modal-kicker">
                  Statutory GST Document under Section 31(3)(d) of CGST Act 2017 & Rule 50
                </div>
              </div>
              <div className="receipt-modal-actions">
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handlePrintReceipt}
                  title="Print or Save as PDF"
                >
                  <Printer size={15} /> Print / Save PDF
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setReceiptModalOpen(false)}
                  title="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="receipt-sheet-scroll">
              <div className="receipt-sheet">
                {/* Brand Header */}
                <div className="receipt-header">
                  <div className="receipt-hotel-brand">
                    <h2>{activeReceipt.hotel_name || hotelInfo?.name || user?.hotel_name || "Hotel Front Desk"}</h2>
                    <p>{activeReceipt.hotel_address || "Front Desk Operations"}</p>
                    <p style={{ marginTop: "4px" }}>
                      {activeReceipt.hotel_gstin && <span><strong>GSTIN:</strong> {activeReceipt.hotel_gstin}</span>}
                      {activeReceipt.hotel_phone && ` | Phone: ${activeReceipt.hotel_phone}`}
                      {activeReceipt.hotel_email && ` | Email: ${activeReceipt.hotel_email}`}
                    </p>
                  </div>
                  <div className="receipt-doc-badge">
                    <span className="receipt-doc-tag">
                      {activeReceipt.isAdvance ? "Advance Receipt Voucher" : "Settlement Receipt"}
                    </span>
                    <div className="receipt-num-text">{activeReceipt.receipt_number}</div>
                    <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                      Date: {activeReceipt.receipt_date}
                    </div>
                  </div>
                </div>

                {/* 2-Column Meta Details Grid */}
                <div className="receipt-meta-grid">
                  <div className="receipt-meta-col">
                    <h4>Customer / Guest Details</h4>
                    <p><strong>Name:</strong> {activeReceipt.guest_name}</p>
                    <p><strong>Phone:</strong> {activeReceipt.guest_phone || "—"}</p>
                    {activeReceipt.guest_email && <p><strong>Email:</strong> {activeReceipt.guest_email}</p>}
                    <p><strong>GSTIN:</strong> {activeReceipt.customer_gstin || "URP (Unregistered Person)"}</p>
                    <p><strong>Place of Supply:</strong> {activeReceipt.place_of_supply || "Intra-State"}</p>
                  </div>
                  <div className="receipt-meta-col">
                    <h4>Booking & Payment Details</h4>
                    <p><strong>Reservation Code:</strong> {activeReceipt.reservation_code || `#${activeReceipt.booking_id}`}</p>
                    <p><strong>Allocated Room(s):</strong> {activeReceipt.room_number || "—"}</p>
                    <p><strong>Stay / Service:</strong> {activeReceipt.stay_label || "Hotel Accommodation"}</p>
                    <p><strong>Payment Mode:</strong> {String(activeReceipt.payment_method || "cash").toUpperCase()}</p>
                    <p><strong>Transaction / UTR:</strong> {activeReceipt.transaction_id || "Direct Counter / Front Desk"}</p>
                  </div>
                </div>

                {/* Statutory Line Items Breakdown */}
                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th>Description of Supply</th>
                      <th style={{ width: "90px" }}>SAC Code</th>
                      <th style={{ textAlign: "right", width: "110px" }}>Taxable (₹)</th>
                      <th style={{ textAlign: "right", width: "80px" }}>CGST (₹)</th>
                      <th style={{ textAlign: "right", width: "80px" }}>SGST (₹)</th>
                      <th style={{ textAlign: "right", width: "80px" }}>IGST (₹)</th>
                      <th style={{ textAlign: "right", width: "110px" }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>
                          {activeReceipt.isAdvance
                            ? "Advance Deposit towards Hotel Accommodation & Services"
                            : "Settlement of Room Charges & Hospitality Services"}
                        </strong>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          {activeReceipt.remarks || "Statutory voucher for reservation intake"}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>996311</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₹{Number(activeReceipt.taxable_amount || activeReceipt.advance_amount || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₹{Number(activeReceipt.cgst || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₹{Number(activeReceipt.sgst || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        ₹{Number(activeReceipt.igst || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        ₹{Number(activeReceipt.advance_amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Amount in Words & Grand Total Bar */}
                <div className="receipt-total-bar">
                  <div className="receipt-words-box">
                    <span>Amount in Words:</span>
                    <strong>{numberToWordsINR(activeReceipt.advance_amount || 0)}</strong>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#64748b", display: "block" }}>
                      Total Received
                    </span>
                    <span className="receipt-grand-amount">
                      ₹{Number(activeReceipt.advance_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Terms and Cashier Signatory */}
                <div className="receipt-footer-grid">
                  <div>
                    <strong>Terms & Statutory Notes:</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: "16px", lineHeight: "1.5" }}>
                      <li>This voucher acknowledges receipt of payment under GST Act Section 31(3)(d).</li>
                      <li>Advance deposits are adjusted against the final stay invoice upon checkout.</li>
                      <li>In case of cancellation, refunds are processed per hotel statutory cancellation policy.</li>
                      <li>Computer generated voucher, no physical signature required.</li>
                    </ul>
                  </div>
                  <div className="receipt-sign-box">
                    <div className="receipt-sign-line"></div>
                    <strong>Authorized Cashier</strong>
                    <span>Received by: {activeReceipt.received_by || "Front Desk"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}