// frontend/src/modules/invoices/InvoicesPage.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  FileText,
  IndianRupee,
  Printer,
  Search,
  ReceiptText,
  Receipt,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  BedDouble,
  Plus,
  RotateCcw,
  X,
  AlertCircle,
  Phone,
  Building2,
  User,
  Users,
  Ban,
  History,
  CreditCard,
  Calendar,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./invoices.css";

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

const invoiceStatuses = ["all", "unpaid", "partially_paid", "paid", "overpaid", "refunded", "cancelled"];

const invoicePaymentMethods = [
  { value: "all", label: "ALL PAYMENT MODES" },
  { value: "cash", label: "CASH" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "CREDIT / DEBIT CARD" },
  { value: "bank_transfer", label: "BANK TRANSFER / NEFT" },
  { value: "cheque", label: "CHEQUE" },
  { value: "online", label: "ONLINE GATEWAY" },
];

export default function InvoicesPage() {
  const { user, hotelInfo } = useAuth();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("unbilled"); // "unbilled" | "generated"

  const [unbilledBookings, setUnbilledBookings] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeFolio, setActiveFolio] = useState(null);

  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [unbilledSearch, setUnbilledSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const printSheetRef = useRef(null);

  // Record Payment Modal State (Phase 4 & 5)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "cash",
    transaction_id: "",
    remarks: "Settlement payment",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Refund Modal State (Phase 6)
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedInvoiceForRefund, setSelectedInvoiceForRefund] = useState(null);
  const [refundForm, setRefundForm] = useState({
    amount: "",
    payment_method: "cash",
    transaction_id: "",
    reason: "Surplus overpayment refund",
  });
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Payment Installment History Ledger Modal State (Issue 4)
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedInvoiceForHistory, setSelectedInvoiceForHistory] = useState(null);

  // Auditor Void / Cancel Invoice Modal State (Issue 4)
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [selectedInvoiceForVoid, setSelectedInvoiceForVoid] = useState(null);
  const [voidReason, setVoidReason] = useState("");
  const [submittingVoid, setSubmittingVoid] = useState(false);

  function getApiErrorMessage(err, fallbackMessage) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => `${item.loc?.join(".") || ""}: ${item.msg}`)
        .join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  }

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
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
    return list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [unbilledResponse, invoicesResponse, roomsResponse] = await Promise.all([
        api.get("/invoices/unbilled-bookings").catch(() => ({ data: [] })),
        api.get("/invoices").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
      ]);

      setUnbilledBookings(filterByHotel(normalizeList(unbilledResponse.data, "bookings")));
      setInvoices(filterByHotel(normalizeList(invoicesResponse.data, "invoices")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
    } catch (err) {
      console.error("Fetch invoice data error:", err);
      setError(getApiErrorMessage(err, "Failed to load unbilled reservations or invoices."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (location.state?.booking_id) {
      handleGenerateBill(location.state.booking_id);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  async function handleGenerateBill(bookingId) {
    try {
      setGeneratingId(bookingId);
      setError("");
      setSuccess("");

      await api.post(`/invoices/generate/${bookingId}`);

      const res = await api.get(`/invoices/guest-folio/${bookingId}`);
      setActiveFolio(res.data);
      setShowInvoiceModal(true);
      setSuccess("Bill generated successfully. Removed from pending queue.");

      await fetchData();
    } catch (err) {
      console.error("Generate invoice error:", err);
      setError(getApiErrorMessage(err, "Failed to generate bill for this booking."));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleViewBill(bookingId) {
    try {
      setLoading(true);
      const res = await api.get(`/invoices/guest-folio/${bookingId}`);
      setActiveFolio(res.data);
      setShowInvoiceModal(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load invoice layout."));
    } finally {
      setLoading(false);
    }
  }

  function handleDirectPrint() {
    window.print();
  }

  function handleDownloadPDF() {
    window.print();
  }

  // Payment Recording Handlers
  const openPaymentModal = (invoice, e) => {
    if (e) e.stopPropagation();
    setSelectedInvoiceForPayment(invoice);
    setSelectedBookingForPayment(null);
    setPaymentForm({
      amount: invoice.due_amount > 0 ? invoice.due_amount : "",
      payment_method: "cash",
      transaction_id: "",
      remarks: `Settlement for ${invoice.invoice_number}`,
    });
    setPaymentModalOpen(true);
  };

  const openPaymentModalForFolio = (folio) => {
    const f = folio || activeFolio;
    if (!f) return;
    const due = Number(f.financials?.due_balance || 0);
    const bookingId = f.booking?.id;
    const inv = invoices.find((i) => Number(i.booking_id) === Number(bookingId));

    if (inv) {
      setSelectedInvoiceForPayment(inv);
      setSelectedBookingForPayment(null);
    } else {
      setSelectedInvoiceForPayment(null);
      setSelectedBookingForPayment({
        id: bookingId,
        reservation_code: f.booking?.reservation_code || `#${bookingId}`,
        guest_name: f.guest?.full_name || f.guest?.name || f.booking?.guest_name || "Valued Guest",
        due_amount: due,
        due_balance: due,
      });
    }

    setPaymentForm({
      amount: due > 0 ? due.toFixed(2) : "",
      payment_method: f.booking?.payment_method || "cash",
      transaction_id: "",
      remarks: `Settlement payment for ${f.booking?.reservation_code || `Booking #${bookingId}`}`,
    });
    setPaymentModalOpen(true);
  };

  const openPaymentModalForUnbilledBooking = (b, e) => {
    if (e) e.stopPropagation();
    const totalAmt = Number(b.total_amount || b.room_rate || 0);
    const advanceAmt = Number(b.advance_paid || 0);
    const dueAmt = Math.max(totalAmt - advanceAmt, 0);

    setSelectedInvoiceForPayment(null);
    setSelectedBookingForPayment({
      id: b.id,
      reservation_code: b.reservation_code || `#${b.id}`,
      guest_name: b.guest_name || "Valued Guest",
      due_amount: dueAmt,
      due_balance: dueAmt,
      payment_method: b.payment_method,
    });
    setPaymentForm({
      amount: dueAmt > 0 ? dueAmt.toFixed(2) : "",
      payment_method: b.payment_method || "cash",
      transaction_id: "",
      remarks: `Settlement payment for ${b.reservation_code || `Booking #${b.id}`}`,
    });
    setPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment && !selectedBookingForPayment) return;
    const payAmt = Number(paymentForm.amount);
    if (!payAmt || payAmt <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    try {
      setSubmittingPayment(true);
      let targetInvoiceId = selectedInvoiceForPayment?.id;

      // If settling from an unbilled booking folio, first ensure the invoice is generated!
      if (!targetInvoiceId && selectedBookingForPayment?.id) {
        try {
          const genRes = await api.post(`/invoices/generate/${selectedBookingForPayment.id}`);
          targetInvoiceId = genRes.data?.id;
        } catch (genErr) {
          const existingRes = await api.get(`/invoices?booking_id=${selectedBookingForPayment.id}`);
          const invList = normalizeList(existingRes.data, "invoices");
          if (invList.length > 0) {
            targetInvoiceId = invList[0].id;
          } else {
            throw genErr;
          }
        }
      }

      if (!targetInvoiceId) {
        throw new Error("Could not find or generate invoice for this payment settlement.");
      }

      await api.post("/payments", {
        invoice_id: targetInvoiceId,
        amount: payAmt,
        payment_method: paymentForm.payment_method,
        transaction_id: paymentForm.transaction_id.trim() || null,
        remarks: paymentForm.remarks.trim(),
      });

      setSuccess(`Payment of ₹${payAmt.toFixed(2)} recorded successfully! Outstanding settled.`);
      setPaymentModalOpen(false);
      setSelectedInvoiceForPayment(null);
      setSelectedBookingForPayment(null);

      // Refresh activeFolio if the bill modal is currently open
      const bookingIdToRefresh = activeFolio?.booking?.id || selectedBookingForPayment?.id;
      if (bookingIdToRefresh) {
        try {
          const updatedFolioRes = await api.get(`/invoices/guest-folio/${bookingIdToRefresh}`);
          setActiveFolio(updatedFolioRes.data);
        } catch (fErr) {
          console.warn("Could not refresh active folio:", fErr);
        }
      }

      await fetchData();
    } catch (err) {
      console.error("Payment recording failed:", err);
      setError(getApiErrorMessage(err, "Payment submission failed."));
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Refund Handlers (Phase 6)
  const openRefundModal = (invoice, e) => {
    if (e) e.stopPropagation();
    setSelectedInvoiceForRefund(invoice);
    const paid = Number(invoice.paid_amount || 0);
    const total = Number(invoice.grand_total || 0);
    const surplus = Math.max(paid - total, 0);

    setRefundForm({
      amount: surplus > 0 ? surplus : "",
      payment_method: "cash",
      transaction_id: "",
      reason: "Surplus advance refund disbursement",
    });
    setRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceForRefund) return;
    const refAmt = Number(refundForm.amount);
    if (!refAmt || refAmt <= 0) {
      setError("Enter a valid refund disbursement amount.");
      return;
    }

    try {
      setSubmittingRefund(true);
      await api.post("/payments/refund", {
        invoice_id: selectedInvoiceForRefund.id,
        amount: refAmt,
        payment_method: refundForm.payment_method,
        transaction_id: refundForm.transaction_id.trim() || null,
        reason: refundForm.reason.trim(),
      });
      setSuccess(`Refund of ₹${refAmt.toFixed(2)} disbursed successfully!`);
      setRefundModalOpen(false);
      setSelectedInvoiceForRefund(null);
      await fetchData();
    } catch (err) {
      console.error("Refund disbursement failed:", err);
      setError(getApiErrorMessage(err, "Refund disbursement failed."));
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Payment Installment Ledger Handlers (Issue 4)
  const openPaymentHistoryModal = (invoice, e) => {
    if (e) e.stopPropagation();
    setSelectedInvoiceForHistory(invoice);
    setHistoryModalOpen(true);
  };

  // Auditor Void / Cancel Invoice Handlers (Issue 4)
  const openVoidModal = (invoice, e) => {
    if (e) e.stopPropagation();
    const st = String(invoice.payment_status || "").toLowerCase();
    if (st === "paid" || (Number(invoice.due_amount || 0) <= 0 && Number(invoice.paid_amount || 0) > 0)) {
      setError("Fully settled invoices cannot be voided directly without issuing an approved Credit Note as per GST audit guidelines.");
      return;
    }
    setSelectedInvoiceForVoid(invoice);
    setVoidReason("");
    setVoidModalOpen(true);
  };

  const handleVoidSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoiceForVoid) return;
    if (!voidReason || voidReason.trim().length < 5) {
      setError("A valid auditor cancellation reason (minimum 5 characters) is required.");
      return;
    }

    try {
      setSubmittingVoid(true);
      setError("");
      setSuccess("");
      await api.post(`/invoices/${selectedInvoiceForVoid.id}/void`, {
        reason: voidReason.trim(),
      });
      setSuccess(`Invoice ${selectedInvoiceForVoid.invoice_number} has been cancelled and archived as VOID in the statutory audit register.`);
      setVoidModalOpen(false);
      setSelectedInvoiceForVoid(null);
      setVoidReason("");
      await fetchData();
    } catch (err) {
      console.error("Void invoice failed:", err);
      setError(getApiErrorMessage(err, "Failed to void/cancel invoice."));
    } finally {
      setSubmittingVoid(false);
    }
  };

  // Statutory GSTR-1 Sales Register CSV Export & Reset Handlers (Issue 5)
  const handleResetFilters = () => {
    setInvoiceSearch("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setPaymentMethodFilter("all");
  };

  const hasActiveFilters = Boolean(
    invoiceSearch ||
    statusFilter !== "all" ||
    fromDate ||
    toDate ||
    paymentMethodFilter !== "all"
  );

  const handleExportGSTR1CSV = () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      setError("No invoices available to export for the selected filter criteria.");
      return;
    }

    const headers = [
      "Invoice Number",
      "Invoice Date",
      "Reservation Reference",
      "Customer Name",
      "Customer Phone",
      "Billing Type",
      "Customer GSTIN",
      "Place of Supply",
      "Reverse Charge",
      "Taxable Value (INR)",
      "CGST (INR)",
      "SGST (INR)",
      "IGST (INR)",
      "Total GST Tax (INR)",
      "Total Invoice Value (INR)",
      "Paid Amount (INR)",
      "Balance Due (INR)",
      "Payment Status",
      "Document State",
      "Cancellation Reason",
    ];

    const rows = filteredInvoices.map((inv) => {
      const gstin = inv.guest?.gstin || inv.gstin || "";
      const isB2B = Boolean(gstin && gstin.trim().length >= 10);
      const guestName = inv.guest?.full_name || inv.guest_name || "Valued Guest";
      const phone = inv.guest?.phone || "";
      const pos = inv.place_of_supply || (inv.hotel?.place_of_supply || inv.hotel?.state || "Hotel State");
      const invDate = inv.created_at ? new Date(inv.created_at).toISOString().split("T")[0] : "";
      const taxableVal = Number(inv.taxable_value || (Number(inv.grand_total || 0) - Number(inv.tax_amount || 0))).toFixed(2);
      const cgstVal = Number(inv.cgst || 0).toFixed(2);
      const sgstVal = Number(inv.sgst || 0).toFixed(2);
      const igstVal = Number(inv.igst || 0).toFixed(2);
      const taxAmt = Number(inv.tax_amount || 0).toFixed(2);
      const grandTotal = Number(inv.grand_total || 0).toFixed(2);
      const paidAmt = Number(inv.paid_amount || 0).toFixed(2);
      const dueAmt = Number(inv.due_amount || 0).toFixed(2);
      const pmtStatus = String(inv.payment_status || "pending").toUpperCase();
      const docState = String(inv.invoice_status || "issued").toUpperCase();
      const cancelReason = inv.cancellation_reason || "";

      return [
        inv.invoice_number,
        invDate,
        inv.reservation_code || `#${inv.booking_id}`,
        `"${guestName.replace(/"/g, '""')}"`,
        `"${phone}"`,
        isB2B ? "B2B (Registered)" : "B2C (Retail)",
        gstin || "N/A",
        `"${String(pos).replace(/"/g, '""')}"`,
        "No",
        taxableVal,
        cgstVal,
        sgstVal,
        igstVal,
        taxAmt,
        grandTotal,
        paidAmt,
        dueAmt,
        pmtStatus,
        docState,
        `"${String(cancelReason).replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `GSTR1_Sales_Register_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setSuccess(`GSTR-1 Sales Register exported successfully (${filteredInvoices.length} invoices).`);
  };

  // Helper: extract all room IDs associated with a booking
  const getBookingRoomIds = (b) => {
    if (!b) return [];
    const ids = new Set();
    if (b.room_id) ids.add(Number(b.room_id));
    if (Array.isArray(b.assigned_room_ids)) {
      b.assigned_room_ids.forEach((id) => id && ids.add(Number(id)));
    } else if (typeof b.assigned_room_ids === "string" && b.assigned_room_ids.trim()) {
      try {
        const parsed = JSON.parse(b.assigned_room_ids);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => id && ids.add(Number(id)));
        }
      } catch {
        b.assigned_room_ids.split(",").forEach((s) => {
          const n = Number(s.trim());
          if (!isNaN(n) && n > 0) ids.add(n);
        });
      }
    }
    return Array.from(ids);
  };

  // Helper: format room numbers for display (e.g. Room 101 or Rooms 101, 102)
  const formatBookingRooms = (b, roomList = rooms) => {
    if (!b) return null;
    if (Array.isArray(b.assigned_room_numbers) && b.assigned_room_numbers.length > 0) {
      return b.assigned_room_numbers.length === 1
        ? `Room ${b.assigned_room_numbers[0]}`
        : `Rooms ${b.assigned_room_numbers.join(", ")}`;
    }
    const roomIds = getBookingRoomIds(b);
    if (roomIds.length === 0) {
      if (b.room_number) return `Room ${b.room_number}`;
      if (b.room?.room_number) return `Room ${b.room.room_number}`;
      return null;
    }
    const roomNums = roomIds
      .map((id) => {
        const r = (roomList || []).find((rm) => Number(rm.id) === Number(id));
        return r ? r.room_number : `#${id}`;
      })
      .filter(Boolean);
    if (roomNums.length === 0) return null;
    return roomNums.length === 1 ? `Room ${roomNums[0]}` : `Rooms ${roomNums.join(", ")}`;
  };

  const filteredUnbilled = useMemo(() => {
    const search = unbilledSearch.toLowerCase().trim();
    return unbilledBookings.filter((b) => {
      const code = String(b.reservation_code || "").toLowerCase();
      const idStr = String(b.id || "").toLowerCase();
      const room = String(b.room_number || b.room_id || "").toLowerCase();
      const roomNums = Array.isArray(b.assigned_room_numbers)
        ? b.assigned_room_numbers.join(" ").toLowerCase()
        : "";
      const guestName = String(b.guest_name || "").toLowerCase();
      const guestPhone = String(b.guest_phone || "").toLowerCase();
      const company = String(b.company_name || "").toLowerCase();
      const status = String(b.status || "").toLowerCase();
      const source = String(b.booking_source || "").toLowerCase();

      return (
        !search ||
        code.includes(search) ||
        idStr.includes(search) ||
        room.includes(search) ||
        roomNums.includes(search) ||
        guestName.includes(search) ||
        guestPhone.includes(search) ||
        company.includes(search) ||
        status.includes(search) ||
        source.includes(search)
      );
    });
  }, [unbilledBookings, unbilledSearch, rooms]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const search = invoiceSearch.toLowerCase().trim();
      const status = String(inv.payment_status || "pending").toLowerCase();

      const invNo = String(inv.invoice_number || "").toLowerCase();
      const resCode = String(inv.reservation_code || "").toLowerCase();
      const bookingId = String(inv.booking_id || "").toLowerCase();
      const guestName = String(inv.guest?.full_name || inv.guest_name || "").toLowerCase();

      const matchesSearch =
        !search ||
        invNo.includes(search) ||
        resCode.includes(search) ||
        bookingId.includes(search) ||
        guestName.includes(search);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "unpaid" && (status === "unpaid" || status === "pending")) ||
        (statusFilter === "partially_paid" && (status === "partial" || status === "partially_paid")) ||
        (statusFilter === "paid" && status === "paid") ||
        (statusFilter === "overpaid" && (status === "overpaid" || status === "refunded")) ||
        (statusFilter === "refunded" && status === "refunded") ||
        status === statusFilter.toLowerCase();

      // Date range filtering (From Date to To Date)
      let invDate = "";
      if (inv.created_at) {
        invDate = typeof inv.created_at === "string" ? inv.created_at.slice(0, 10) : new Date(inv.created_at).toISOString().slice(0, 10);
      }
      const matchesFrom = !fromDate || (invDate && invDate >= fromDate);
      const matchesTo = !toDate || (invDate && invDate <= toDate);
      const matchesDate = matchesFrom && matchesTo;

      // Payment method filtering
      let matchesPaymentMethod = true;
      if (paymentMethodFilter !== "all") {
        const filterVal = paymentMethodFilter.toLowerCase();
        const hasInPayments = Array.isArray(inv.payments) && inv.payments.some((p) => String(p.payment_method || "").toLowerCase() === filterVal);
        const hasInInvoice = String(inv.payment_method || "").toLowerCase() === filterVal;
        const hasInBooking = String(inv.booking?.payment_method || "").toLowerCase() === filterVal;
        matchesPaymentMethod = hasInPayments || hasInInvoice || hasInBooking;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesPaymentMethod;
    });
  }, [invoices, invoiceSearch, statusFilter, fromDate, toDate, paymentMethodFilter]);

  const invoiceStats = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    let refundDueAmount = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let partialCount = 0;
    let overpaidCount = 0;
    let refundedCount = 0;

    invoices.forEach((inv) => {
      const gt = Number(inv.grand_total || 0);
      const paid = Number(inv.paid_amount || 0);
      const due = Number(inv.due_amount || 0);
      const st = String(inv.payment_status || "").toLowerCase();

      totalAmount += gt;
      paidAmount += paid;
      if (due > 0) {
        dueAmount += due;
      }

      if (paid > gt) {
        refundDueAmount += paid - gt;
      }

      if (st === "paid") {
        paidCount++;
      } else if (st === "partial" || st === "partially_paid") {
        partialCount++;
        pendingCount++;
      } else if (st === "unpaid" || st === "pending") {
        pendingCount++;
      } else if (st === "overpaid") {
        overpaidCount++;
      } else if (st === "refunded") {
        refundedCount++;
      }
    });

    const unbilledTotalAmount = unbilledBookings.reduce(
      (acc, b) => acc + Number(b.total_amount || b.room_rate || 0),
      0
    );

    return {
      total: invoices.length,
      paid: paidCount,
      pending: pendingCount,
      partial: partialCount,
      overpaid: overpaidCount + refundedCount,
      refunded: refundedCount,
      totalAmount,
      paidAmount,
      dueAmount,
      refundDueAmount,
      unbilledCount: unbilledBookings.length,
      unbilledTotalAmount,
    };
  }, [invoices, unbilledBookings]);

  return (
    <div className="directory-page invoices-page">
      <PortalHeader
        title="Invoices & Billing"
        kicker="FINANCIAL MANAGEMENT"
        description="Review real-time guest folios, generate checkout bills, record payments, and issue refunds."
        icon={ReceiptText}
        backPath="/front-desk"
      />

      {error && <div className="invoices-error-box no-print">{error}</div>}
      {success && <div className="invoices-success-box no-print">{success}</div>}

      {/* 5-CARD FINANCIAL KPI STRIP */}
      <div className="dir-stats-grid inv-stats-five-grid no-print">
        <StatCard
          title="Unbilled Queue"
          value={invoiceStats.unbilledCount}
          Icon={Clock}
          colorTheme="amber"
          onClick={() => {
            setActiveTab("unbilled");
          }}
          isActive={activeTab === "unbilled"}
        />
        <StatCard
          title="Total Invoiced"
          value={`₹${Number(invoiceStats.totalAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={IndianRupee}
          colorTheme="purple"
          onClick={() => {
            setActiveTab("generated");
            setStatusFilter("all");
          }}
          isActive={activeTab === "generated" && statusFilter === "all"}
        />
        <StatCard
          title="Total Collected"
          value={`₹${Number(invoiceStats.paidAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={CheckCircle2}
          colorTheme="green"
          onClick={() => {
            setActiveTab("generated");
            setStatusFilter("paid");
          }}
          isActive={activeTab === "generated" && statusFilter === "paid"}
        />
        <StatCard
          title="Outstanding Due"
          value={`₹${Number(invoiceStats.dueAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={AlertCircle}
          colorTheme="red"
          onClick={() => {
            setActiveTab("generated");
            setStatusFilter("unpaid");
          }}
          isActive={activeTab === "generated" && (statusFilter === "unpaid" || statusFilter === "partially_paid")}
        />
        <StatCard
          title="Refunds & Surplus"
          value={`₹${Number(invoiceStats.refundDueAmount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          Icon={RotateCcw}
          colorTheme="blue"
          onClick={() => {
            setActiveTab("generated");
            setStatusFilter("overpaid");
          }}
          isActive={activeTab === "generated" && (statusFilter === "overpaid" || statusFilter === "refunded")}
        />
      </div>

      {/* UNIFIED QUEUE TABS CONTROLS */}
      <div className="cio-queue-controls no-print">
        <div className="cio-queue-tabs">
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "unbilled" ? "active" : ""}`}
            onClick={() => setActiveTab("unbilled")}
          >
            Pending Folios (Unbilled)
            <span className="cio-tab-count">{invoiceStats.unbilledCount}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "generated" && statusFilter === "all" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("generated");
              setStatusFilter("all");
            }}
          >
            All Invoices
            <span className="cio-tab-count">{invoices.length}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "generated" && statusFilter === "unpaid" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("generated");
              setStatusFilter("unpaid");
            }}
          >
            Unpaid / Due
            <span className="cio-tab-count">{invoiceStats.pending}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "generated" && statusFilter === "paid" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("generated");
              setStatusFilter("paid");
            }}
          >
            Settled / Paid
            <span className="cio-tab-count">{invoiceStats.paid}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "generated" && statusFilter === "partially_paid" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("generated");
              setStatusFilter("partially_paid");
            }}
          >
            Partially Paid
            <span className="cio-tab-count">{invoiceStats.partial}</span>
          </button>
          <button
            type="button"
            className={`cio-queue-tab ${activeTab === "generated" && (statusFilter === "overpaid" || statusFilter === "refunded") ? "active" : ""}`}
            onClick={() => {
              setActiveTab("generated");
              setStatusFilter("overpaid");
            }}
          >
            Refunds & Surplus
            <span className="cio-tab-count">{invoiceStats.overpaid}</span>
          </button>
        </div>
      </div>

      {activeTab === "unbilled" ? (
        <section className="dir-modules-section no-print">
          <ModuleWriternHeader
            title="Unbilled Bookings Queue"
            description="Active & checked-out stays with pending folios. Generating a bill finalizes charges and removes it from this list."
            badgeCount={filteredUnbilled.length}
            badgeLabel="pending"
          />

          <div className="dir-controls" style={{ marginTop: 0 }}>
            <div className="dir-search-box" style={{ flex: 1.5 }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search unbilled by reference (RES-...), guest name, phone, room, company..."
                value={unbilledSearch}
                onChange={(e) => setUnbilledSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="dir-table-container">
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "150px" }}>Reservation</th>
                  <th style={{ width: "220px" }}>Guest & Contact</th>
                  <th>Allocated Room(s)</th>
                  <th>Stay & Timing</th>
                  <th>Tariff & Advance</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: "190px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      Loading pending reservations...
                    </td>
                  </tr>
                ) : filteredUnbilled.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      All checked-in/out bookings have been billed. No pending folios in queue.
                    </td>
                  </tr>
                ) : (
                  filteredUnbilled.map((b) => {
                    const roomIds = getBookingRoomIds(b);
                    const roomLabel = formatBookingRooms(b) || (b.room_number ? `Room ${b.room_number}` : `Room ${b.room_id}`);
                    const totalAmt = Number(b.total_amount || b.room_rate || 0);
                    const advanceAmt = Number(b.advance_paid || 0);
                    const dueAmt = Math.max(totalAmt - advanceAmt, 0);

                    return (
                      <tr key={b.id} className="dir-table-row">
                        <td style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <span className="booking-id-tag">
                              {b.reservation_code || `#${b.id}`}
                            </span>
                            {b.booking_source && (
                              <span className="inv-badge-source">
                                {b.booking_source === "agent"
                                  ? "Agent Referral"
                                  : b.booking_source === "ota"
                                    ? "OTA Booking"
                                    : b.booking_source}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ verticalAlign: "middle" }}>
                          <div className="inv-guest-cell">
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                                {b.guest_name || "Guest"}
                              </strong>
                              {(b.guest_vip_status === "vip" || b.guest_vip_status === "vvip") && (
                                <span className="inv-vip-tag">VIP</span>
                              )}
                            </div>
                            {b.guest_phone && (
                              <span className="text-muted" style={{ fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Phone size={10} /> {b.guest_phone}
                              </span>
                            )}
                            {b.company_name && (
                              <span className="inv-corp-badge" title={b.gstin ? `GSTIN: ${b.gstin}` : "Corporate Stay"}>
                                <Building2 size={10} /> {b.company_name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <BedDouble size={14} color="#2d5696" />
                              <strong style={{ fontSize: "13px", color: "#1e293b" }}>
                                {roomLabel}
                              </strong>
                              {(b.rooms_count > 1 || roomIds.length > 1) && (
                                <span className="inv-multi-badge">
                                  {b.rooms_count || roomIds.length} Rooms
                                </span>
                              )}
                            </div>
                            {b.room_type && (
                              <span className="text-muted" style={{ fontSize: "11px", paddingLeft: "20px" }}>
                                {b.room_type}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ verticalAlign: "middle" }}>
                          <div className="bank-cell">
                            <span className="bank-primary">
                              {b.stay_label || `${b.nights_count || 1} Night(s)`}
                            </span>
                            <span className="bank-sub">
                              {b.checkin_date ? new Date(b.checkin_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "-"} to{" "}
                              {b.checkout_date ? new Date(b.checkout_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                            </span>
                          </div>
                        </td>

                        <td style={{ verticalAlign: "middle" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                              ₹{totalAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "2px" }}>
                              {advanceAmt > 0 && (
                                <span className="inv-advance-tag">
                                  Adv: ₹{advanceAmt.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              )}
                              <span className="inv-due-tag">
                                Due: ₹{dueAmt.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={{ verticalAlign: "middle" }}>
                          <span
                            className={`mono-pill ${b.status === "checked-in"
                                ? "pill-normal"
                                : b.status === "checked-out"
                                  ? "pill-warning"
                                  : "pill-info"
                              }`}
                            style={{ textTransform: "uppercase", fontSize: "11px", fontWeight: 700 }}
                          >
                            {b.status === "checked-in" ? "IN-HOUSE" : b.status === "checked-out" ? "CHECKED-OUT" : b.status}
                          </span>
                        </td>

                        <td style={{ textAlign: "right", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                            {dueAmt > 0 && (
                              <button
                                type="button"
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  border: "1px solid #fca5a5",
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  fontWeight: 600,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                                onClick={(e) => openPaymentModalForUnbilledBooking(b, e)}
                                title="Record payment directly to settle remaining balance"
                              >
                                <CreditCard size={13} /> Settle (₹{dueAmt.toLocaleString("en-IN", { maximumFractionDigits: 0 })})
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-preview-outline"
                              onClick={() => handleViewBill(b.id)}
                              title="Preview live charges and departmental breakdown"
                            >
                              <Eye size={13} /> Review
                            </button>
                            <button
                              type="button"
                              className="btn-generate-direct"
                              disabled={generatingId === b.id}
                              onClick={() => handleGenerateBill(b.id)}
                              title="Generate final bill and lock folio"
                            >
                              <Receipt size={14} /> {generatingId === b.id ? "Generating..." : "Generate Bill"}
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
      ) : (
        <section className="dir-modules-section no-print">
          <ModuleWriternHeader
            title="Generated Invoices Ledger"
            description="Catalog of finalized stay receipts, GST bills, decoupled payment status, and refunds."
            badgeCount={filteredInvoices.length}
            badgeLabel={statusFilter === "all" ? "invoices" : `${statusFilter.replace("_", " ")}`}
          />

          <div className="dir-controls inv-ledger-toolbar" style={{ marginTop: 0 }}>
            <div className="dir-search-box inv-search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by invoice #, guest name, reservation code (RES-...), or booking ID..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
              {invoiceSearch && (
                <button
                  type="button"
                  className="inv-search-clear-btn"
                  onClick={() => setInvoiceSearch("")}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="inv-controls-filters">
              {/* Date Range Filters */}
              <div className="inv-date-range-filter">
                <div className="inv-date-field" title="From Issue Date">
                  <span className="inv-field-label">From</span>
                  <input
                    type="date"
                    className="inv-date-input"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div className="inv-date-field" title="To Issue Date">
                  <span className="inv-field-label">To</span>
                  <input
                    type="date"
                    className="inv-date-input"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Payment Method Filter */}
              <select
                className="dir-filter-select inv-filter-select"
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                title="Filter by Payment Mode"
              >
                {invoicePaymentMethods.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                className="dir-filter-select inv-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                title="Filter by Invoice Status"
              >
                {invoiceStatuses.map((st) => (
                  <option key={st} value={st}>
                    {st === "all" ? "ALL STATUSES" : st.replace("_", " ").toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Reset All Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-cancel inv-reset-filter-btn"
                  onClick={handleResetFilters}
                  title="Reset all active search and filter criteria"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}

              {/* GSTR-1 Sales Register CSV Export Button */}
              <button
                type="button"
                className="inv-export-csv-btn"
                onClick={handleExportGSTR1CSV}
                title="Export statutory GSTR-1 Sales Register in CSV format"
              >
                <Download size={15} /> Export GSTR-1 CSV
              </button>
            </div>
          </div>

          <div className="dir-table-container">
            <table className="dir-table">
              <thead>
                <tr>
                  <th style={{ width: "160px" }}>Invoice #</th>
                  <th>Reservation Ref</th>
                  <th>Document State</th>
                  <th>Grand Total</th>
                  <th>Paid Amount</th>
                  <th>Balance Due / Surplus</th>
                  <th>Payment Status</th>
                  <th style={{ textAlign: "right", width: "190px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading invoice records...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      No invoices matching current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const status = String(invoice.payment_status || "pending").toLowerCase();
                    const docStatus = String(invoice.invoice_status || "issued").toLowerCase();
                    const gt = Number(invoice.grand_total || 0);
                    const paid = Number(invoice.paid_amount || 0);
                    const due = Number(invoice.due_amount || 0);
                    const surplus = Math.max(paid - gt, 0);

                    return (
                      <tr key={invoice.id} className="dir-table-row">
                        <td>
                          <strong style={{ color: "#0f172a", fontSize: "13px" }}>
                            {invoice.invoice_number}
                          </strong>
                          <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                            {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : "-"}
                          </span>
                        </td>

                        <td>
                          <span className="booking-id-tag">
                            {invoice.reservation_code || `#${invoice.booking_id}`}
                          </span>
                        </td>

                        <td>
                          {docStatus === "cancelled" ? (
                            <span
                              className="mono-pill pill-urgent"
                              title={invoice.cancellation_reason ? `Auditor Reason: ${invoice.cancellation_reason}` : "Cancelled Invoice"}
                            >
                              CANCELLED (VOID)
                            </span>
                          ) : (
                            <span className="mono-pill pill-normal">
                              {docStatus.toUpperCase()}
                            </span>
                          )}
                        </td>

                        <td>
                          <strong style={{ color: "#0f172a" }}>
                            ₹{gt.toFixed(2)}
                          </strong>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ color: "#059669", fontWeight: 700 }}>
                              ₹{paid.toFixed(2)}
                            </span>
                            <button
                              type="button"
                              className="inv-installments-pill"
                              onClick={(e) => openPaymentHistoryModal(invoice, e)}
                              title="View itemized payment installment ledger"
                            >
                              <History size={10} />
                              {Array.isArray(invoice.payments) && invoice.payments.length > 0
                                ? `${invoice.payments.length} Txn`
                                : paid > 0
                                  ? "1 Record"
                                  : "No Txn"}
                            </button>
                          </div>
                        </td>

                        <td>
                          {surplus > 0 ? (
                            <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                              Refund Due: ₹{surplus.toFixed(2)}
                            </span>
                          ) : due > 0 ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>
                              Due: ₹{due.toFixed(2)}
                            </span>
                          ) : (
                            <span style={{ color: "#059669", fontWeight: 600 }}>₹0.00</span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`mono-pill ${docStatus === "cancelled"
                                ? "pill-urgent"
                                : status === "paid"
                                  ? "pill-normal"
                                  : status === "overpaid"
                                    ? "pill-purple"
                                    : status === "partially_paid" || status === "partial"
                                      ? "pill-warning"
                                      : "pill-urgent"
                              }`}
                            style={{ textTransform: "uppercase" }}
                          >
                            {docStatus === "cancelled"
                              ? "VOID / CANCELLED"
                              : status === "overpaid"
                                ? "OVERPAID (REFUND DUE)"
                                : status.replace("_", " ")}
                          </span>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                            {docStatus !== "cancelled" && due > 0 && (
                              <button
                                type="button"
                                className="cio-action-btn checkin"
                                onClick={(e) => openPaymentModal(invoice, e)}
                                title="Record Installment Payment"
                              >
                                <Plus size={12} /> Pay
                              </button>
                            )}

                            {docStatus !== "cancelled" && surplus > 0 && (
                              <button
                                type="button"
                                className="cio-action-btn btn-refund-action"
                                onClick={(e) => openRefundModal(invoice, e)}
                                title="Disburse Refund"
                              >
                                <RotateCcw size={12} /> Refund
                              </button>
                            )}

                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="View Payment Installment Ledger"
                              onClick={(e) => openPaymentHistoryModal(invoice, e)}
                            >
                              <History size={14} color="#059669" />
                            </button>

                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="View & Direct Print"
                              onClick={() => handleViewBill(invoice.booking_id)}
                            >
                              <Printer size={14} color="#2d5696" />
                            </button>
                            <button
                              type="button"
                              className="dir-action-inline-btn"
                              title="Download PDF"
                              onClick={() => handleViewBill(invoice.booking_id)}
                            >
                              <Download size={14} color="#166962" />
                            </button>

                            {docStatus !== "cancelled" && (
                              <button
                                type="button"
                                className={`dir-action-inline-btn btn-void-trigger ${status === "paid" ? "disabled-guard" : ""}`}
                                title={
                                  status === "paid"
                                    ? "Settled invoices cannot be voided directly without issuing an approved Credit Note as per GST audit guidelines."
                                    : "Void / Cancel Invoice (Auditor Compliance Guard)"
                                }
                                onClick={(e) => openVoidModal(invoice, e)}
                              >
                                <Ban size={14} color={status === "paid" ? "#94a3b8" : "#dc2626"} />
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
          </div>
        </section>
      )}

      {/* RECORD INSTALLMENT / SETTLEMENT PAYMENT MODAL */}
      {paymentModalOpen && (selectedInvoiceForPayment || selectedBookingForPayment) && (
        <div className="modal-backdrop" onClick={() => !submittingPayment && setPaymentModalOpen(false)}>
          <div className="modal-content-dialog" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div>
                <h2>
                  {selectedInvoiceForPayment
                    ? `Record Payment \u2022 ${selectedInvoiceForPayment.invoice_number}`
                    : `Settle Folio \u2022 ${selectedBookingForPayment?.reservation_code || `Booking #${selectedBookingForPayment?.id}`}`}
                </h2>
                <p className="modal-kicker">
                  {selectedInvoiceForPayment
                    ? "Record installment against outstanding balance."
                    : `Settle remaining balance for ${selectedBookingForPayment?.guest_name || "Guest"} and finalize invoice.`}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setPaymentModalOpen(false)}
                disabled={submittingPayment}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-dialog-body">
                {(() => {
                  const targetDue = Number(
                    selectedInvoiceForPayment
                      ? selectedInvoiceForPayment.due_amount
                      : (selectedBookingForPayment?.due_amount ?? selectedBookingForPayment?.due_balance ?? 0)
                  );
                  return (
                    <>
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "#991b1b", fontWeight: 600 }}>Balance Outstanding:</span>
                        <strong style={{ fontSize: "15px", color: "#dc2626" }}>₹{targetDue.toFixed(2)}</strong>
                      </div>

                      <div className="form-group">
                        <label>Amount to Pay (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          required
                          disabled={submittingPayment}
                          placeholder="0.00"
                        />
                        {targetDue > 0 && (
                          <div className="inv-presets-strip">
                            <button
                              type="button"
                              className="inv-preset-btn"
                              onClick={() => setPaymentForm({ ...paymentForm, amount: targetDue.toFixed(2) })}
                            >
                              Full Due (₹{targetDue.toFixed(2)})
                            </button>
                            <button
                              type="button"
                              className="inv-preset-btn"
                              onClick={() => setPaymentForm({ ...paymentForm, amount: (targetDue / 2).toFixed(2) })}
                            >
                              50% (₹{(targetDue / 2).toFixed(2)})
                            </button>
                          </div>
                        )}
                        {paymentForm.amount > 0 && (
                          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                            Remaining balance after payment: ₹{Math.max(targetDue - Number(paymentForm.amount || 0), 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div className="form-group">
                  <label>Payment Method *</label>
                  <select
                    className="dir-select-field"
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    disabled={submittingPayment}
                  >
                    <option value="cash">CASH</option>
                    <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="card">CREDIT / DEBIT CARD</option>
                    <option value="bank_transfer">BANK TRANSFER / NEFT / IMPS</option>
                    <option value="cheque">CHEQUE</option>
                    <option value="online">ONLINE GATEWAY</option>
                  </select>
                </div>

                {paymentForm.payment_method !== "cash" && (
                  <div className="form-group">
                    <label>
                      {paymentForm.payment_method === "upi"
                        ? "UPI Transaction Reference / UTR Number"
                        : paymentForm.payment_method === "card"
                          ? "Card Auth Code / Last 4 Digits"
                          : paymentForm.payment_method === "bank_transfer"
                            ? "Bank UTR / Transaction Ref Number"
                            : paymentForm.payment_method === "cheque"
                              ? "Cheque Number & Issuing Bank"
                              : "Transaction / Reference #"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        paymentForm.payment_method === "upi"
                          ? "e.g. 425912345678"
                          : paymentForm.payment_method === "card"
                            ? "e.g. AUTH-9812 or **** 4321"
                            : paymentForm.payment_method === "bank_transfer"
                              ? "e.g. HDFC2026092401"
                              : paymentForm.payment_method === "cheque"
                                ? "e.g. CHQ-440212 - SBI"
                                : "Transaction reference or authorization ID"
                      }
                      value={paymentForm.transaction_id}
                      onChange={(e) => setPaymentForm({ ...paymentForm, transaction_id: e.target.value })}
                      disabled={submittingPayment}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Remarks</label>
                  <input
                    type="text"
                    value={paymentForm.remarks}
                    onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                    disabled={submittingPayment}
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setPaymentModalOpen(false)}
                  disabled={submittingPayment}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-generate-direct" disabled={submittingPayment}>
                  {submittingPayment ? "Processing..." : (selectedBookingForPayment ? "Settle & Finalize Bill" : "Record Payment")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBURSE REFUND MODAL (PHASE 6) */}
      {refundModalOpen && selectedInvoiceForRefund && (
        <div className="modal-backdrop" onClick={() => !submittingRefund && setRefundModalOpen(false)}>
          <div className="modal-content-dialog" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div>
                <h2>Disburse Refund &bull; {selectedInvoiceForRefund.invoice_number}</h2>
                <p className="modal-kicker">Reconcile surplus overpayment back to zero balance.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRefundModalOpen(false)}
                disabled={submittingRefund}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRefundSubmit}>
              <div className="modal-dialog-body">
                <div className="refund-surplus-badge">
                  Refundable surplus: ₹
                  {Math.max(
                    Number(selectedInvoiceForRefund.paid_amount || 0) -
                    Number(selectedInvoiceForRefund.grand_total || 0),
                    0
                  ).toFixed(2)}
                </div>

                <div className="form-group">
                  <label>Refund Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                    required
                    disabled={submittingRefund}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>Disbursement Method *</label>
                  <select
                    className="dir-select-field"
                    value={refundForm.payment_method}
                    onChange={(e) => setRefundForm({ ...refundForm, payment_method: e.target.value })}
                    disabled={submittingRefund}
                  >
                    <option value="cash">CASH</option>
                    <option value="upi">UPI REFUND</option>
                    <option value="bank_transfer">BANK TRANSFER</option>
                    <option value="card">CARD REVERSAL</option>
                  </select>
                </div>

                {refundForm.payment_method !== "cash" && (
                  <div className="form-group">
                    <label>Bank Reference / UTR # (Optional)</label>
                    <input
                      type="text"
                      placeholder="Bank UTR or Transfer Reference ID"
                      value={refundForm.transaction_id}
                      onChange={(e) => setRefundForm({ ...refundForm, transaction_id: e.target.value })}
                      disabled={submittingRefund}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>Audit Reason</label>
                  <input
                    type="text"
                    value={refundForm.reason}
                    onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                    disabled={submittingRefund}
                  />
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setRefundModalOpen(false)}
                  disabled={submittingRefund}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-generate-direct"
                  style={{ background: "#7c3aed" }}
                  disabled={submittingRefund}
                >
                  {submittingRefund ? "Disbursing..." : "Disburse Refund"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT INSTALLMENT HISTORY LEDGER MODAL (ISSUE 4) */}
      {historyModalOpen && selectedInvoiceForHistory && (
        <div className="modal-backdrop" onClick={() => setHistoryModalOpen(false)}>
          <div className="modal-content-dialog" style={{ maxWidth: "760px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div>
                <h2>Payment Installment Ledger &bull; {selectedInvoiceForHistory.invoice_number}</h2>
                <p className="modal-kicker">
                  Audit-compliant payment transaction history for {selectedInvoiceForHistory.reservation_code || `#${selectedInvoiceForHistory.booking_id}`}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setHistoryModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-dialog-body">
              {/* FINANCIAL SUMMARY STRIP */}
              <div className="inv-history-summary-strip">
                <div className="inv-hist-stat">
                  <span className="lbl">Grand Total</span>
                  <span className="val">₹{Number(selectedInvoiceForHistory.grand_total || 0).toFixed(2)}</span>
                </div>
                <div className="inv-hist-stat success">
                  <span className="lbl">Total Collected</span>
                  <span className="val">₹{Number(selectedInvoiceForHistory.paid_amount || 0).toFixed(2)}</span>
                </div>
                <div className="inv-hist-stat danger">
                  <span className="lbl">Balance Due</span>
                  <span className="val">₹{Number(selectedInvoiceForHistory.due_amount || 0).toFixed(2)}</span>
                </div>
                <div className="inv-hist-stat info">
                  <span className="lbl">Payment State</span>
                  <span className="val" style={{ textTransform: "uppercase" }}>
                    {selectedInvoiceForHistory.payment_status?.replace("_", " ") || "PENDING"}
                  </span>
                </div>
              </div>

              {/* INSTALLMENTS TABLE */}
              <div style={{ marginTop: "16px", maxHeight: "300px", overflowY: "auto" }}>
                <table className="inv-tax-schedule-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "35px", textAlign: "center" }}>#</th>
                      <th style={{ width: "140px" }}>Date & Time</th>
                      <th style={{ width: "130px" }}>Receipt / Ref #</th>
                      <th style={{ width: "110px", textAlign: "center" }}>Mode</th>
                      <th>Transaction / UTR ID</th>
                      <th style={{ width: "95px" }}>Received By</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedInvoiceForHistory.payments || selectedInvoiceForHistory.payments.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                          {Number(selectedInvoiceForHistory.paid_amount || 0) > 0
                            ? `Advance payment recorded at booking: ₹${Number(selectedInvoiceForHistory.paid_amount).toFixed(2)}`
                            : "No payment transactions recorded for this invoice yet."}
                        </td>
                      </tr>
                    ) : (
                      selectedInvoiceForHistory.payments.map((pmt, idx) => (
                        <tr key={pmt.id || idx}>
                          <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                          <td style={{ fontSize: "11.5px", whiteSpace: "nowrap" }}>
                            {pmt.created_at
                              ? new Date(pmt.created_at).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "—"}
                          </td>
                          <td>
                            <strong style={{ fontSize: "12px", color: "#0f172a" }}>
                              {pmt.receipt_number || (pmt.payment_type === "advance" ? `ADV-${pmt.id}` : `REC-${pmt.id}`)}
                            </strong>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="inv-pmt-mode-tag">
                              {(pmt.payment_method || "cash").toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#334155" }}>
                              {pmt.transaction_id || "Counter Cash"}
                            </span>
                          </td>
                          <td style={{ fontSize: "11.5px", color: "#64748b" }}>
                            {pmt.received_by || "Front Desk"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            ₹{Number(pmt.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-dialog-footer" style={{ justifyContent: "space-between" }}>
              <div>
                {selectedInvoiceForHistory.invoice_status !== "cancelled" && Number(selectedInvoiceForHistory.due_amount || 0) > 0 && (
                  <button
                    type="button"
                    className="btn-generate-direct"
                    onClick={() => {
                      setHistoryModalOpen(false);
                      openPaymentModal(selectedInvoiceForHistory);
                    }}
                  >
                    <Plus size={14} /> Record Installment Payment
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setHistoryModalOpen(false)}
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDITOR VOID / CANCEL INVOICE GUARD MODAL (ISSUE 4) */}
      {voidModalOpen && selectedInvoiceForVoid && (
        <div className="modal-backdrop" onClick={() => !submittingVoid && setVoidModalOpen(false)}>
          <div className="modal-content-dialog" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-dialog-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="inv-void-icon-wrap">
                  <Ban size={22} color="#dc2626" />
                </div>
                <div>
                  <h2>Void / Cancel Tax Invoice &bull; {selectedInvoiceForVoid.invoice_number}</h2>
                  <p className="modal-kicker">Statutory Auditor Compliance Guard</p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setVoidModalOpen(false)}
                disabled={submittingVoid}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleVoidSubmit}>
              <div className="modal-dialog-body">
                {/* STATUTORY AUDITOR WARNING ALERT */}
                <div className="modal-statutory-alert">
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px", color: "#dc2626" }} />
                  <div>
                    <strong style={{ fontSize: "12.5px", color: "#991b1b" }}>Statutory Accounting & Auditor Warning:</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "11.5px", lineHeight: 1.45, color: "#991b1b" }}>
                      Under Section 31 of CGST Act and standard hotel audit compliance, cancelling an issued invoice archives it as <strong>VOID</strong> in the GST sales register. The serial number remains reserved, and this action cannot be undone.
                    </p>
                  </div>
                </div>

                {/* INVOICE PARTICULARS SUMMARY */}
                <div className="inv-void-summary-card">
                  <div className="row">
                    <span className="lbl">Reservation Code:</span>
                    <span className="val">{selectedInvoiceForVoid.reservation_code || `#${selectedInvoiceForVoid.booking_id}`}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Guest Name:</span>
                    <span className="val">{selectedInvoiceForVoid.guest?.full_name || selectedInvoiceForVoid.guest_name || "Valued Guest"}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Invoice Grand Total:</span>
                    <span className="val">₹{Number(selectedInvoiceForVoid.grand_total || 0).toFixed(2)}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Amount Collected:</span>
                    <span className="val" style={{ color: "#059669" }}>₹{Number(selectedInvoiceForVoid.paid_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Current Balance Due:</span>
                    <span className="val" style={{ color: "#dc2626" }}>₹{Number(selectedInvoiceForVoid.due_amount || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* REASON PROMPT */}
                <div className="form-group" style={{ marginTop: "14px" }}>
                  <label style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Audit Cancellation Reason *</span>
                    <span style={{ fontSize: "11px", color: voidReason.length < 5 ? "#dc2626" : "#059669" }}>
                      {voidReason.length}/5 min chars
                    </span>
                  </label>
                  <textarea
                    className="dir-textarea-field"
                    rows={3}
                    placeholder="State clear auditor reason: e.g. Tariff rate dispute, duplicate entry, reservation cancelled prior to check-in..."
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    disabled={submittingVoid}
                    required
                  />
                </div>

                {/* QUICK REASON CHIPS */}
                <div style={{ marginTop: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Quick Reason Presets:
                  </span>
                  <div className="inv-reason-chips">
                    {[
                      "Tariff / Rate correction",
                      "Duplicate invoice issued",
                      "Reservation cancelled prior to check-in",
                      "Stay dates modified by guest",
                      "Billing dispute resolved",
                    ].map((reasonText) => (
                      <button
                        key={reasonText}
                        type="button"
                        className="inv-chip-btn"
                        onClick={() => setVoidReason(reasonText)}
                        disabled={submittingVoid}
                      >
                        {reasonText}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-dialog-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setVoidModalOpen(false)}
                  disabled={submittingVoid}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-void-confirm"
                  disabled={submittingVoid || voidReason.trim().length < 5}
                >
                  {submittingVoid ? "Archiving as VOID..." : "Confirm Void & Cancel Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STANDARD A4 PRINT & DOWNLOAD INVOICE MODAL */}
      {showInvoiceModal && activeFolio && (
        <div className="modal-backdrop">
          <div className="modal-window">
            <div className="no-print modal-action-bar">
              {Number(activeFolio.financials?.due_balance || 0) > 0 && (
                <button
                  type="button"
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    marginRight: "auto"
                  }}
                  onClick={() => openPaymentModalForFolio(activeFolio)}
                  title="Settle outstanding balance"
                >
                  <CreditCard size={15} /> Settle Outstanding (₹{Number(activeFolio.financials.due_balance).toFixed(2)})
                </button>
              )}
              <button className="btn-download-action" onClick={handleDownloadPDF}>
                <Download size={15} /> Download PDF
              </button>
              <button className="btn-print-action" onClick={handleDirectPrint}>
                <Printer size={15} /> Direct Print
              </button>
              <button className="btn-close" onClick={() => setShowInvoiceModal(false)}>
                Close Preview
              </button>
            </div>

            {/* A4 STATUTORY GST TAX INVOICE CONTAINER */}
            <div className="a4-invoice-sheet" ref={printSheetRef}>
              {/* INVOICE HEADER */}
              <div className="inv-header">
                <div>
                  <h1 className="hotel-title">{activeFolio.hotel?.name || hotelInfo?.name || user?.hotel_name || "Hotel"}</h1>
                  {activeFolio.hotel.address && (
                    <p className="hotel-meta">{activeFolio.hotel.address}</p>
                  )}
                  <p className="hotel-meta">
                    Tel: {activeFolio.hotel.phone || "—"} | Email: {activeFolio.hotel.email || "—"}
                  </p>
                  <p className="hotel-meta">
                    <strong>GSTIN / Tax ID:</strong> {activeFolio.hotel.tax_number || "UNREGISTERED"}
                    {activeFolio.hotel.state_code && ` (State Code: ${activeFolio.hotel.state_code})`}
                  </p>
                </div>
                <div className="inv-badge-block">
                  <h2>TAX INVOICE</h2>
                  <p className="text-muted" style={{ fontSize: "10.5px", marginBottom: "4px" }}>
                    (Under Section 31 of CGST Act, 2017)
                  </p>
                  <p><strong>Invoice #:</strong> {activeFolio.invoice_number || `DRAFT-${activeFolio.booking.id}`}</p>
                  <p><strong>Reservation:</strong> {activeFolio.booking.reservation_code || `#${activeFolio.booking.id}`}</p>
                  <p><strong>Invoice Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  <p><strong>Place of Supply:</strong> {activeFolio.hotel.place_of_supply || activeFolio.hotel.state || "Hotel State"}</p>
                  <p><strong>Reverse Charge:</strong> No</p>
                </div>
              </div>

              <hr className="inv-divider" />

              {/* CUSTOMER (B2B / B2C) & STAY META GRID */}
              <div className="inv-meta-grid">
                <div>
                  <h4>Billed To (Customer Details):</h4>
                  <div>
                    {activeFolio.booking.gstin ? (
                      <span className="inv-b2b-pill">B2B INVOICE (GST CREDIT ELIGIBLE)</span>
                    ) : (
                      <span className="inv-b2c-pill">B2C INVOICE (RETAIL CONSUMER)</span>
                    )}
                  </div>
                  <p className="lead-name" style={{ marginTop: "6px" }}>
                    <strong>{activeFolio.guest.name}</strong>
                  </p>
                  <p>Phone: {activeFolio.guest.phone || "N/A"}</p>
                  {activeFolio.guest.email && <p>Email: {activeFolio.guest.email}</p>}
                  {activeFolio.guest.address && <p>Address: {activeFolio.guest.address}</p>}

                  {(activeFolio.booking.company_name || activeFolio.booking.gstin) && (
                    <div className="corp-box">
                      {activeFolio.booking.company_name && (
                        <p><strong>Company:</strong> {activeFolio.booking.company_name}</p>
                      )}
                      {activeFolio.booking.gstin && (
                        <p>
                          <strong>Buyer GSTIN:</strong> {activeFolio.booking.gstin}
                          {activeFolio.booking.client_state_code && ` (State Code: ${activeFolio.booking.client_state_code})`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h4>Stay & Accommodation Particulars:</h4>
                  <p>
                    <strong>Room Allocated:</strong> Room {activeFolio.booking.room_number}{" "}
                    ({activeFolio.booking.room_type || "Standard"})
                  </p>
                  <p>
                    <strong>Check-In:</strong>{" "}
                    {activeFolio.booking.checkin_date
                      ? new Date(activeFolio.booking.checkin_date).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "N/A"}
                  </p>
                  <p>
                    <strong>Check-Out:</strong>{" "}
                    {activeFolio.booking.checkout_date
                      ? new Date(activeFolio.booking.checkout_date).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "N/A"}
                  </p>
                  <p><strong>Stay Plan:</strong> {activeFolio.booking.stay_label || `${activeFolio.booking.nights_count || 1} Night(s)`}</p>
                  <p><strong>Payment Mode:</strong> {(activeFolio.booking.payment_method || "cash").toUpperCase()}</p>
                </div>
              </div>

              {/* DYNAMIC ITEMIZED LINE ITEMS WITH SAC CODES */}
              <table className="inv-line-items-table">
                <thead>
                  <tr>
                    <th style={{ width: "35px", textAlign: "center" }}>#</th>
                    <th style={{ width: "120px" }}>Department</th>
                    <th>Service Description</th>
                    <th style={{ width: "85px", textAlign: "center" }}>SAC Code</th>
                    <th style={{ width: "45px", textAlign: "center" }}>Qty</th>
                    <th style={{ width: "95px", textAlign: "right" }}>Rate (₹)</th>
                    <th style={{ width: "105px", textAlign: "right" }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeFolio.line_items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                      <td>
                        <span className={`dept-tag dept-${item.category?.toLowerCase().replace(/\s+/g, "-")}`}>
                          {item.category}
                        </span>
                      </td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: "center" }}>
                        <span className="sac-code-badge">
                          {item.sac_code ||
                            (item.category === "Accommodation"
                              ? "996311"
                              : item.category === "Restaurant" || item.category === "Minibar"
                                ? "996331"
                                : "999799")}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>{Number(item.unit_price).toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* STATUTORY GST TAX SCHEDULE */}
              {Array.isArray(activeFolio.financials?.tax_schedule) && activeFolio.financials.tax_schedule.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 6px", fontSize: "11px", textTransform: "uppercase", color: "#475569", letterSpacing: "0.04em" }}>
                    GST Tax Computation Schedule
                  </h4>
                  <table className="inv-tax-schedule-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "center", width: "80px" }}>SAC Code</th>
                        <th>Taxable Service Description</th>
                        <th style={{ textAlign: "right", width: "95px" }}>Taxable (₹)</th>
                        {activeFolio.financials.is_inter_state ? (
                          <>
                            <th style={{ textAlign: "center", width: "70px" }}>IGST Rate</th>
                            <th style={{ textAlign: "right", width: "85px" }}>IGST (₹)</th>
                          </>
                        ) : (
                          <>
                            <th style={{ textAlign: "center", width: "65px" }}>CGST %</th>
                            <th style={{ textAlign: "right", width: "75px" }}>CGST (₹)</th>
                            <th style={{ textAlign: "center", width: "65px" }}>SGST %</th>
                            <th style={{ textAlign: "right", width: "75px" }}>SGST (₹)</th>
                          </>
                        )}
                        <th style={{ textAlign: "right", width: "95px" }}>Total Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeFolio.financials.tax_schedule.map((ts, i) => (
                        <tr key={i}>
                          <td style={{ textAlign: "center", fontWeight: 700 }}>{ts.sac_code}</td>
                          <td>{ts.description}</td>
                          <td style={{ textAlign: "right" }}>₹{Number(ts.taxable_amount).toFixed(2)}</td>
                          {activeFolio.financials.is_inter_state ? (
                            <>
                              <td style={{ textAlign: "center" }}>{ts.igst_rate}%</td>
                              <td style={{ textAlign: "right" }}>₹{Number(ts.igst_amount).toFixed(2)}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ textAlign: "center" }}>{ts.cgst_rate}%</td>
                              <td style={{ textAlign: "right" }}>₹{Number(ts.cgst_amount).toFixed(2)}</td>
                              <td style={{ textAlign: "center" }}>{ts.sgst_rate}%</td>
                              <td style={{ textAlign: "right" }}>₹{Number(ts.sgst_amount).toFixed(2)}</td>
                            </>
                          )}
                          <td style={{ textAlign: "right", fontWeight: 600 }}>₹{Number(ts.total_tax).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2" style={{ textAlign: "right" }}>Total Tax Schedule:</td>
                        <td style={{ textAlign: "right" }}>₹{Number(activeFolio.financials.subtotal).toFixed(2)}</td>
                        {activeFolio.financials.is_inter_state ? (
                          <>
                            <td style={{ textAlign: "center" }}>—</td>
                            <td style={{ textAlign: "right" }}>₹{Number(activeFolio.financials.igst || activeFolio.financials.tax_amount).toFixed(2)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: "center" }}>—</td>
                            <td style={{ textAlign: "right" }}>₹{Number(activeFolio.financials.cgst).toFixed(2)}</td>
                            <td style={{ textAlign: "center" }}>—</td>
                            <td style={{ textAlign: "right" }}>₹{Number(activeFolio.financials.sgst).toFixed(2)}</td>
                          </>
                        )}
                        <td style={{ textAlign: "right" }}>₹{Number(activeFolio.financials.tax_amount).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* AMOUNT IN WORDS */}
              <div className="inv-amount-words">
                <strong>Amount in Words:</strong> {numberToWordsINR(activeFolio.financials.grand_total)}
              </div>

              {/* FINANCIAL SUMMARY & DECLARATION */}
              <div className="inv-summary-container">
                <div className="inv-notes">
                  <p><strong>Terms & Conditions:</strong></p>
                  <p>1. Room accommodation services charged under SAC 996311 as per Indian GST slabs.</p>
                  <p>2. Restaurant dining and food orders charged under SAC 996331.</p>
                  <p>3. Laundry, dry cleaning, and extra hotel services charged under SAC 999799.</p>
                  <p>4. This is a computer-generated statutory tax invoice and requires no physical seal.</p>

                  <div className="inv-statutory-declaration">
                    <p>
                      <strong>Declaration:</strong> Certified that all particulars given above are true and correct, and the amount indicated represents the price actually charged. All claims and disputes are subject to the exclusive jurisdiction of local courts.
                    </p>
                  </div>
                </div>

                <div className="inv-totals-box">
                  <div className="tot-row">
                    <span>Taxable Value (Excl. Tax):</span>
                    <span>₹{Number(activeFolio.financials.subtotal).toFixed(2)}</span>
                  </div>

                  {activeFolio.financials.is_inter_state ? (
                    <div className="tot-row">
                      <span>IGST ({activeFolio.financials.tax_percent}%):</span>
                      <span>₹{Number(activeFolio.financials.igst || activeFolio.financials.tax_amount).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="tot-row">
                        <span>CGST ({activeFolio.financials.cgst_rate || (activeFolio.financials.tax_percent / 2)}%):</span>
                        <span>₹{Number(activeFolio.financials.cgst).toFixed(2)}</span>
                      </div>
                      <div className="tot-row">
                        <span>SGST ({activeFolio.financials.sgst_rate || (activeFolio.financials.tax_percent / 2)}%):</span>
                        <span>₹{Number(activeFolio.financials.sgst).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  {activeFolio.financials.discount > 0 && (
                    <div className="tot-row">
                      <span>Special Discount:</span>
                      <span>-₹{Number(activeFolio.financials.discount).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="tot-row grand">
                    <span>Grand Total (GST Incl.):</span>
                    <span>₹{Number(activeFolio.financials.grand_total).toFixed(2)}</span>
                  </div>

                  <div className="tot-row">
                    <span>
                      {Number(activeFolio.financials.due_balance || 0) <= 0
                        ? "Total Paid / Settled:"
                        : "Advance / Paid Amount:"}
                    </span>
                    <span style={{ fontWeight: 600, color: "#059669" }}>
                      ₹{Number(activeFolio.financials.advance_paid).toFixed(2)}
                      {activeFolio.booking?.payment_method && (
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#475569", marginLeft: "6px" }}>
                          ({String(activeFolio.booking.payment_method).toUpperCase()})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className={`tot-row ${activeFolio.financials.due_balance > 0 ? "due" : "settled"}`}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {activeFolio.financials.advance_paid > activeFolio.financials.grand_total
                        ? "Refund Surplus Due:"
                        : "Balance Outstanding:"}
                      {activeFolio.financials.due_balance > 0 && (
                        <button
                          type="button"
                          className="no-print"
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer"
                          }}
                          onClick={() => openPaymentModalForFolio(activeFolio)}
                        >
                          Settle Now
                        </button>
                      )}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      {activeFolio.financials.advance_paid > activeFolio.financials.grand_total
                        ? `₹${Number(activeFolio.financials.advance_paid - activeFolio.financials.grand_total).toFixed(2)}`
                        : activeFolio.financials.due_balance > 0
                          ? `₹${Number(activeFolio.financials.due_balance).toFixed(2)}`
                          : "₹0.00 (PAID IN FULL)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIGNATURES */}
              <div className="inv-footer-signatures">
                <div className="sig-block">
                  <hr />
                  <p>Guest Signature</p>
                </div>
                <div className="sig-block">
                  <hr />
                  <p>Authorized Signatory ({activeFolio.hotel?.name || hotelInfo?.name || user?.hotel_name || "Hotel"})</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}