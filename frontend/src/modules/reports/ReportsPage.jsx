import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Printer,
  Download,
  Search,
  Filter,
  CalendarDays,
  User,
  Users,
  CreditCard,
  Wallet,
  IndianRupee,
  BedDouble,
  ReceiptText,
  X,
  RotateCcw,
  LayoutList,
  LayoutGrid,
  Building2,
  UtensilsCrossed,
  Sparkles,
  Briefcase,
  Package,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import {
  PortalHeader,
  StatCard,
  ModuleWriternHeader,
  Pagination,
} from "@components";
import {
  extractTaskAuditEvents,
  formatLogDateTime,
  parseServerDate,
} from "../housekeeping/staff/HousekeepingStaffDashboard";
import "./reports.css";

export const REPORT_CATEGORIES = [
  { id: "all", label: "All Modules" },
  { id: "frontdesk", label: "Front Desk & Rooms", icon: BedDouble },
  { id: "finance", label: "Finance & Accounts", icon: IndianRupee },
  { id: "restaurant", label: "Restaurant & F&B", icon: UtensilsCrossed },
  { id: "housekeeping", label: "Housekeeping", icon: Sparkles },
  { id: "staff", label: "Staff & HR", icon: Briefcase },
  { id: "procurement", label: "Inventory & POs", icon: Package },
];

export const REPORT_TABS = [
  // Front Desk
  { key: "guests", label: "Guests Directory", category: "frontdesk" },
  { key: "bookings", label: "All Bookings", category: "frontdesk" },
  { key: "checkInOut", label: "Check-in / Checkout", category: "frontdesk" },
  { key: "rooms", label: "Rooms Roster", category: "frontdesk" },
  { key: "guestServices", label: "Guest Services", category: "frontdesk" },

  // Finance
  { key: "invoices", label: "Invoices Ledger", category: "finance" },
  { key: "payments", label: "Payments Collected", category: "finance" },
  { key: "shiftReconciliation", label: "Cashier Shift", category: "finance" },
  { key: "dailyClosing", label: "Daily Closing Audit", category: "finance" },
  { key: "finance", label: "P&L Summary", category: "finance" },
  { key: "auditTrail", label: "Audit Trail", category: "finance" },

  // Restaurant
  { key: "restaurantOrders", label: "Restaurant Orders", category: "restaurant" },

  // Housekeeping
  { key: "housekeepingTasks", label: "Cleaning Tasks", category: "housekeeping" },
  { key: "housekeepingLogs", label: "Housekeeping Logs", category: "housekeeping" },
  { key: "reportedIssues", label: "Reported Issues History", category: "housekeeping" },

  // Staff
  { key: "staffDirectory", label: "Staff Directory", category: "staff" },

  // Procurement
  { key: "procurementOrders", label: "Purchase Orders", category: "procurement" },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user, hotelInfo } = useAuth();

  const isAdmin = user?.role === "hotel-admin" || user?.role === "super-admin";
  const isHOD = user?.role_level === "department_head";
  const userDept = (user?.department || "").toLowerCase().trim();

  const getDepartmentCategory = (deptStr) => {
    const d = (deptStr || "").toLowerCase();
    if (d.includes("housekeep")) return "housekeeping";
    if (d.includes("restaur") || d.includes("food") || d.includes("kitchen")) return "restaurant";
    if (d.includes("front") || d.includes("recep")) return "frontdesk";
    if (d.includes("account") || d.includes("financ")) return "finance";
    if (d.includes("staff") || d.includes("hr")) return "staff";
    if (d.includes("invent") || d.includes("procur")) return "procurement";
    if (d.includes("maint") || d.includes("engin")) return "housekeeping";
    return "housekeeping";
  };

  const defaultCategory = isAdmin ? "all" : getDepartmentCategory(userDept);
  const defaultTab = isAdmin
    ? "guests"
    : (REPORT_TABS.find((t) => t.category === defaultCategory)?.key || "housekeepingTasks");

  const [activeCategory, setActiveCategory] = useState(defaultCategory);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [viewMode, setViewMode] = useState("table"); // "table" or "cards"

  // Master Data States
  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [dailyClosing, setDailyClosing] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [procurementOrders, setProcurementOrders] = useState([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState([]);

  // Pagination states (20 per page by default, selectable 20, 50, 100)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // Super Admin Multi-Property Support
  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  }

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

  function getLoggedInHotelId() {
    return (
      user?.hotel_id ||
      user?.hotel?.id ||
      user?.hotelId ||
      user?.hotel?.hotel_id
    );
  }

  function filterByHotel(list, targetHotelId) {
    if (!targetHotelId) return list;
    return list.filter((item) => {
      if (item.hotel_id === undefined || item.hotel_id === null) return true;
      return Number(item.hotel_id) === Number(targetHotelId);
    });
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatCurrency(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getGuestName(guestId) {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || guest?.name || "-";
  }

  function getRoomNumber(roomId) {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || roomId || "-";
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

  function getInvoicePaid(invoice) {
    return Number(invoice.paid_amount || invoice.amount_paid || 0);
  }

  function getInvoiceDue(invoice) {
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

  function getStatusClass(status) {
    return String(status || "pending")
      .toLowerCase()
      .replace(/&/g, "")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-");
  }

  function rowMatchesDate(rowDate) {
    if (!fromDate && !toDate) return true;
    if (!rowDate || rowDate === "-") return false;
    const dateValue = String(rowDate).slice(0, 10);
    if (fromDate && dateValue < fromDate) return false;
    if (toDate && dateValue > toDate) return false;
    return true;
  }

  function setDatePreset(preset) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "today") {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "week") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFromDate(past.toISOString().split("T")[0]);
      setToDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(firstDay.toISOString().split("T")[0]);
      setToDate(todayStr);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  }

  async function fetchReportsData() {
    try {
      setLoading(true);
      setError("");

      const effectiveHotelId = selectedHotelId || getLoggedInHotelId();
      const hotelQuery = effectiveHotelId ? `?hotel_id=${effectiveHotelId}` : "";

      const promises = [
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/extra-charges").catch(() => ({ data: [] })),
        api.get("/invoices").catch(() => ({ data: [] })),
        api.get("/payments").catch(() => ({ data: [] })),
        api.get(`/reports/finance-summary${hotelQuery}`).catch(() => ({ data: null })),
        api.get(`/reports/cashier-shift-summary${hotelQuery}`).catch(() => ({ data: null })),
        api.get(`/reports/daily-closing${hotelQuery}`).catch(() => ({ data: null })),
        api.get(`/reports/audit-trail${hotelQuery}`).catch(() => ({ data: { audit_trail: [] } })),
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/housekeeping/tasks").catch(() => ({ data: [] })),
        api.get("/staff").catch(() => ({ data: [] })),
        api.get("/procurement/purchase-orders").catch(() => ({ data: [] })),
        api.get("/maintenance-requests/").catch(() => ({ data: [] })),
      ];

      if (user?.role === "super-admin") {
        promises.push(api.get("/hotels").catch(() => ({ data: [] })));
      }

      const results = await Promise.all(promises);
      const [
        guestsRes,
        bookingsRes,
        roomsRes,
        extraChargesRes,
        invoicesRes,
        paymentsRes,
        financeRes,
        shiftRes,
        closingRes,
        auditRes,
        restaurantRes,
        hkRes,
        staffRes,
        procurementRes,
        maintRes,
        hotelsRes,
      ] = results;

      setGuests(filterByHotel(normalizeList(guestsRes.data, "guests"), effectiveHotelId));
      setBookings(filterByHotel(normalizeList(bookingsRes.data, "bookings"), effectiveHotelId));
      setRooms(filterByHotel(normalizeList(roomsRes.data, "rooms"), effectiveHotelId));
      setExtraCharges(filterByHotel(normalizeList(extraChargesRes.data, "extra_charges"), effectiveHotelId));
      setInvoices(filterByHotel(normalizeList(invoicesRes.data, "invoices"), effectiveHotelId));
      setPayments(filterByHotel(normalizeList(paymentsRes.data, "payments"), effectiveHotelId));
      setFinanceSummary(financeRes.data || null);
      setShiftSummary(shiftRes.data || null);
      setDailyClosing(closingRes.data || null);
      setAuditTrail(normalizeList(auditRes.data, "audit_trail"));
      setRestaurantOrders(filterByHotel(normalizeList(restaurantRes.data, "orders"), effectiveHotelId));
      setHousekeepingTasks(filterByHotel(normalizeList(hkRes.data, "tasks"), effectiveHotelId));
      setStaffList(filterByHotel(normalizeList(staffRes.data, "staff"), effectiveHotelId));
      setProcurementOrders(filterByHotel(normalizeList(procurementRes.data, "orders"), effectiveHotelId));
      setMaintenanceRequests(filterByHotel(normalizeList(maintRes?.data, "requests"), effectiveHotelId));

      if (hotelsRes && Array.isArray(hotelsRes.data)) {
        setHotels(hotelsRes.data);
      }
    } catch (err) {
      console.error("Fetch reports error:", err);
      setError(getApiErrorMessage(err, "Failed to load reports data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReportsData();
  }, [selectedHotelId]);

  // Department-scoped visible categories:
  // - Admin: all categories
  // - HOD: only their own department category
  // - Staff: only their own department category
  const visibleCategories = useMemo(() => {
    if (isAdmin) return REPORT_CATEGORIES;
    return REPORT_CATEGORIES.filter((cat) => cat.id === defaultCategory);
  }, [isAdmin, defaultCategory]);

  // Synchronize category/tab on login or user load
  useEffect(() => {
    if (!isAdmin && defaultCategory) {
      setActiveCategory(defaultCategory);
      const categoryTabs = REPORT_TABS.filter((t) => t.category === defaultCategory);
      if (!categoryTabs.some((t) => t.key === activeTab)) {
        if (categoryTabs.length > 0) {
          setActiveTab(categoryTabs[0].key);
        }
      }
    }
  }, [isAdmin, defaultCategory]);

  // Sync activeTab if current category changes
  const visibleTabs = useMemo(() => {
    if (activeCategory === "all") return REPORT_TABS;
    return REPORT_TABS.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab)) {
      if (visibleTabs.length > 0) {
        setActiveTab(visibleTabs[0].key);
      }
    }
  }, [activeCategory, visibleTabs, activeTab]);

  // Department-aware housekeeping stats
  const housekeepingStats = useMemo(() => {
    let tasks = housekeepingTasks;
    if (!isAdmin && !isHOD) {
      const staffName = (user?.full_name || "").toLowerCase().trim();
      const staffUsername = (user?.username || "").toLowerCase().trim();
      const staffId = user?.staff_id || user?.user_id || user?.id;
      tasks = tasks.filter((task) => {
        const assignedTo = String(task.assigned_to || "").toLowerCase();
        const completedBy = String(task.completed_by || "").toLowerCase();
        const createdBy = String(task.created_by || "").toLowerCase();
        const staffIdMatch = staffId && String(task.assigned_staff_id) === String(staffId);
        return (
          staffIdMatch ||
          (staffName && (assignedTo.includes(staffName) || completedBy.includes(staffName) || createdBy.includes(staffName))) ||
          (staffUsername && (assignedTo.includes(staffUsername) || completedBy.includes(staffUsername)))
        );
      });
    }
    const total = tasks.length;
    const completed = tasks.filter((t) => ["completed", "approved"].includes(String(t.status || "").toLowerCase())).length;
    const inProgress = tasks.filter((t) => ["in-progress", "cleaning"].includes(String(t.status || "").toLowerCase())).length;
    const pending = tasks.filter((t) => ["pending", "assigned"].includes(String(t.status || "").toLowerCase())).length;
    return { total, completed, inProgress, pending };
  }, [housekeepingTasks, isAdmin, isHOD, user]);

  const computedFinance = useMemo(() => {
    const bookingRevenue = bookings.reduce(
      (sum, booking) => sum + getBookingTotal(booking),
      0
    );
    const invoiceRevenue = invoices.reduce(
      (sum, invoice) => sum + getInvoiceTotal(invoice),
      0
    );
    const paidAmount = payments.reduce(
      (sum, payment) => sum + getPaymentAmount(payment),
      0
    );
    const extraChargeAmount = extraCharges.reduce(
      (sum, charge) => sum + Number(charge.total_amount || 0),
      0
    );
    const dueAmount = invoices.reduce(
      (sum, invoice) => sum + getInvoiceDue(invoice),
      0
    );

    return {
      bookingRevenue,
      invoiceRevenue,
      paidAmount,
      extraChargeAmount,
      dueAmount,
      totalRevenue: invoiceRevenue || bookingRevenue + extraChargeAmount,
    };
  }, [bookings, invoices, payments, extraCharges]);

  const summaryCards = useMemo(() => {
    return {
      guests: guests.length,
      bookings: bookings.length,
      revenue:
        Number(financeSummary?.total_invoice_revenue || 0) ||
        computedFinance.totalRevenue,
      paid:
        Number(financeSummary?.total_paid_amount || 0) ||
        Number(financeSummary?.total_payments_received || 0) ||
        computedFinance.paidAmount,
    };
  }, [guests, bookings, financeSummary, computedFinance]);

  // Table & Card Rows
  const reportRows = useMemo(() => {
    if (activeTab === "guests") {
      return guests.map((guest) => ({
        id: guest.id,
        date: guest.created_at || guest.created_date || "-",
        title: guest.full_name || guest.name || "-",
        subtitle: guest.phone || "-",
        badge: guest.status || "active",
        details: [
          { label: "Phone", value: guest.phone || "-" },
          { label: "Email", value: guest.email || "-" },
          { label: "Joined", value: formatDate(guest.created_at) },
        ],
        amount: null,
      }));
    }

    if (activeTab === "bookings") {
      return bookings.map((booking) => ({
        id: booking.id,
        date: booking.checkin_date || booking.check_in_date || booking.created_at,
        title: getGuestName(booking.guest_id),
        subtitle: `Room ${getRoomNumber(booking.room_id)}`,
        badge: booking.status || "pending",
        details: [
          { label: "Check-in", value: formatDate(booking.checkin_date || booking.check_in_date) },
          { label: "Checkout", value: formatDate(booking.checkout_date || booking.check_out_date) },
          { label: "Room", value: `Room ${getRoomNumber(booking.room_id)}` },
        ],
        amount: getBookingTotal(booking),
      }));
    }

    if (activeTab === "checkInOut") {
      return bookings
        .filter((booking) =>
          ["checked-in", "checked_in", "checked-out", "checked_out"].includes(
            String(booking.status || "").toLowerCase()
          )
        )
        .map((booking) => ({
          id: booking.id,
          date: booking.checkin_date || booking.check_in_date || booking.created_at,
          title: getGuestName(booking.guest_id),
          subtitle: `Room ${getRoomNumber(booking.room_id)}`,
          badge: booking.status || "-",
          details: [
            { label: "Check-in", value: formatDate(booking.checkin_date || booking.check_in_date) },
            { label: "Checkout", value: formatDate(booking.checkout_date || booking.check_out_date) },
          ],
          amount: getBookingTotal(booking),
        }));
    }

    if (activeTab === "guestServices") {
      return extraCharges.map((charge) => {
        const booking = getBookingById(charge.booking_id);
        return {
          id: charge.id,
          date: charge.created_at || charge.date || "-",
          title: charge.charge_name || "Service Charge",
          subtitle: `Booking #${charge.booking_id || "-"} - ${getGuestName(charge.guest_id || booking?.guest_id)}`,
          badge: charge.status || "pending",
          details: [
            { label: "Guest", value: getGuestName(charge.guest_id || booking?.guest_id) },
            { label: "Room", value: `Room ${getRoomNumber(charge.room_id || booking?.room_id)}` },
            { label: "Date", value: formatDate(charge.created_at || charge.date) },
          ],
          amount: Number(charge.total_amount || 0),
        };
      });
    }

    if (activeTab === "invoices") {
      return invoices.map((invoice) => {
        const booking = getBookingById(invoice.booking_id);
        return {
          id: invoice.id,
          date: invoice.issue_date || invoice.invoice_date || invoice.created_at,
          title: invoice.invoice_number || `INV-${invoice.id}`,
          subtitle: `Guest: ${getGuestName(invoice.guest_id || booking?.guest_id)}`,
          badge: invoice.status || invoice.payment_status || "pending",
          details: [
            { label: "Booking", value: `#${invoice.booking_id || "-"}` },
            { label: "Paid", value: formatCurrency(getInvoicePaid(invoice)) },
            { label: "Due", value: formatCurrency(getInvoiceDue(invoice)) },
          ],
          amount: getInvoiceTotal(invoice),
        };
      });
    }

    if (activeTab === "payments") {
      return payments.map((payment) => {
        const booking = getBookingById(payment.booking_id);
        return {
          id: payment.id,
          date: payment.payment_date || payment.date || payment.created_at,
          title: `Receipt #${payment.receipt_number || payment.id}`,
          subtitle: `Guest: ${getGuestName(payment.guest_id || booking?.guest_id)}`,
          badge: payment.payment_status || payment.status || "paid",
          details: [
            { label: "Method", value: (payment.payment_method || "Cash").toUpperCase() },
            { label: "Type", value: (payment.payment_type || "settlement").toUpperCase() },
            { label: "Booking", value: `#${payment.booking_id || "-"}` },
          ],
          amount: getPaymentAmount(payment),
        };
      });
    }

    if (activeTab === "rooms") {
      return rooms.map((room) => ({
        id: room.id,
        date: room.created_at || "-",
        title: `Room ${room.room_number || "-"}`,
        subtitle: `${room.room_type || "-"} (Floor ${room.floor || "1"})`,
        badge: room.status || "available",
        details: [
          { label: "Type", value: room.room_type || "-" },
          { label: "Bed", value: room.bed_type || "-" },
          { label: "Floor", value: room.floor || "1" },
        ],
        amount: Number(room.base_price || 0),
      }));
    }

    if (activeTab === "shiftReconciliation") {
      const breakdown = shiftSummary?.method_breakdown || {};
      return Object.entries(breakdown).map(([method, amount], idx) => ({
        id: idx + 1,
        date: shiftSummary?.date || new Date().toISOString(),
        title: `${method.toUpperCase()} Reconciliation`,
        subtitle: `Cashier Shift Record`,
        badge: "reconciled",
        details: [
          { label: "Date", value: shiftSummary?.date || formatDate(new Date()) },
          { label: "Channel", value: method.toUpperCase() },
        ],
        amount: Number(amount || 0),
      }));
    }

    if (activeTab === "dailyClosing") {
      const tax = dailyClosing?.tax_breakdown || {};
      return [
        { id: 1, title: "Gross Billed", value: dailyClosing?.gross_billed || 0, tag: "Revenue" },
        { id: 2, title: "Taxable Value", value: tax.taxable_value || 0, tag: "Taxable" },
        { id: 3, title: "CGST (Central Tax)", value: tax.cgst || 0, tag: "Tax" },
        { id: 4, title: "SGST (State Tax)", value: tax.sgst || 0, tag: "Tax" },
        { id: 5, title: "Gross Collections Inflow", value: dailyClosing?.collections_summary?.gross_inflow || 0, tag: "Inflow" },
        { id: 6, title: "Refunds Outflow", value: dailyClosing?.collections_summary?.refunds_outflow || 0, tag: "Outflow" },
        { id: 7, title: "Net Cash Drawer", value: dailyClosing?.cash_drawer?.net_cash_collected || 0, tag: "Cash" },
        { id: 8, title: "Operational Expenses Paid", value: dailyClosing?.operational_expenses_paid || 0, tag: "Expense" },
        { id: 9, title: "Net Daily Position", value: dailyClosing?.net_daily_position || 0, tag: "Net Position" },
      ];
    }

    if (activeTab === "finance") {
      return [
        { id: 1, title: "Total Room Booking Revenue", value: computedFinance.bookingRevenue, tag: "Revenue" },
        { id: 2, title: "Extra Guest Services & Add-ons", value: computedFinance.extraChargeAmount, tag: "Add-on" },
        { id: 3, title: "Total Invoiced Revenue", value: computedFinance.invoiceRevenue, tag: "Invoices" },
        { id: 4, title: "Total Payments Collected", value: computedFinance.paidAmount, tag: "Inflow" },
        { id: 5, title: "Outstanding Balance Due", value: computedFinance.dueAmount, tag: "Receivable" },
        { id: 6, title: "Net Operating Position", value: computedFinance.totalRevenue, tag: "Operating Net" },
      ];
    }

    if (activeTab === "auditTrail") {
      return auditTrail.map((audit) => ({
        id: audit.payment_id,
        date: audit.created_at,
        title: `Payment #${audit.payment_id}`,
        subtitle: audit.receipt_number ? `Receipt ${audit.receipt_number}` : `Trans #${audit.transaction_id || "-"}`,
        badge: audit.payment_status || "success",
        details: [
          { label: "Type", value: (audit.payment_type || "settlement").toUpperCase() },
          { label: "Method", value: (audit.payment_method || "cash").toUpperCase() },
          { label: "Cashier", value: audit.received_by || "System" },
        ],
        amount: Number(audit.amount || 0),
      }));
    }

    if (activeTab === "restaurantOrders") {
      return restaurantOrders.map((order) => ({
        id: order.id,
        date: order.created_at || order.order_date || "-",
        title: order.order_number || `ORD-${order.id}`,
        subtitle: order.table_number ? `Table ${order.table_number}` : (order.room_id ? `Room ${getRoomNumber(order.room_id)}` : "Takeaway"),
        badge: order.order_status || order.status || "pending",
        details: [
          { label: "Type", value: order.order_type || "dine-in" },
          { label: "Guest", value: order.guest_name || "-" },
          { label: "Payment", value: (order.payment_status || "unpaid").toUpperCase() },
        ],
        amount: Number(order.total_amount || 0),
      }));
    }

    if (activeTab === "housekeepingTasks") {
      let tasks = housekeepingTasks;
      if (!isAdmin && !isHOD) {
        // Staff member sees ONLY their own assigned/performed tasks
        const staffName = (user?.full_name || "").toLowerCase().trim();
        const staffUsername = (user?.username || "").toLowerCase().trim();
        const staffId = user?.staff_id || user?.user_id || user?.id;

        tasks = tasks.filter((task) => {
          const assignedTo = String(task.assigned_to || "").toLowerCase();
          const completedBy = String(task.completed_by || "").toLowerCase();
          const createdBy = String(task.created_by || "").toLowerCase();
          const staffIdMatch = staffId && String(task.assigned_staff_id) === String(staffId);

          return (
            staffIdMatch ||
            (staffName && (assignedTo.includes(staffName) || completedBy.includes(staffName) || createdBy.includes(staffName))) ||
            (staffUsername && (assignedTo.includes(staffUsername) || completedBy.includes(staffUsername)))
          );
        });
      }

      return tasks.map((task) => ({
        id: task.id,
        date: task.created_at || "-",
        title: `Task #${task.id} - Room ${getRoomNumber(task.room_id)}`,
        subtitle: task.task_type || "checkout-cleaning",
        badge: task.status || "pending",
        details: [
          { label: "Room", value: `Room ${getRoomNumber(task.room_id)}` },
          { label: "Assigned To", value: task.assigned_to || (task.assigned_staff_id ? `Staff #${task.assigned_staff_id}` : "Unassigned") },
          { label: "Priority", value: (task.priority || "normal").toUpperCase() },
        ],
        amount: null,
      }));
    }

    if (activeTab === "housekeepingLogs") {
      let tasks = housekeepingTasks;
      if (!isAdmin && !isHOD) {
        const staffName = (user?.full_name || "").toLowerCase().trim();
        const staffUsername = (user?.username || "").toLowerCase().trim();
        const staffId = user?.staff_id || user?.user_id || user?.id;

        tasks = tasks.filter((task) => {
          const assignedTo = String(task.assigned_to || "").toLowerCase();
          const completedBy = String(task.completed_by || "").toLowerCase();
          const createdBy = String(task.created_by || "").toLowerCase();
          const staffIdMatch = staffId && String(task.assigned_staff_id) === String(staffId);

          return (
            staffIdMatch ||
            (staffName && (assignedTo.includes(staffName) || completedBy.includes(staffName) || createdBy.includes(staffName))) ||
            (staffUsername && (assignedTo.includes(staffUsername) || completedBy.includes(staffUsername)))
          );
        });
      }

      const allEvents = [];
      tasks.forEach((task) => {
        const matchedRoom = rooms.find((r) => Number(r.id) === Number(task.room_id));
        const evs = extractTaskAuditEvents(task, matchedRoom);
        allEvents.push(...evs);
      });

      // Sort newest events first
      allEvents.sort((a, b) => {
        const timeA = parseServerDate(a.timestamp)?.getTime() || 0;
        const timeB = parseServerDate(b.timestamp)?.getTime() || 0;
        return timeB - timeA;
      });

      return allEvents.map((ev) => ({
        id: ev.id,
        logId: `#HK-LOG-${ev.taskId}`,
        date: ev.timestamp || "-",
        title: ev.title,
        subtitle: `${ev.actor} (${ev.role || "Staff"})`,
        badge: ev.stageLabel,
        details: [
          { label: "Room", value: `Room ${ev.roomNumber}` },
          { label: "Attendant", value: ev.actor },
          { label: "Stage", value: ev.stageLabel },
          { label: "Timestamp", value: formatLogDateTime(ev.timestamp) },
          { label: "Actor", value: ev.actor },
          { label: "Details", value: ev.details },
        ],
        amount: null,
      }));
    }

    if (activeTab === "reportedIssues") {
      // Staff see only the issues they reported themselves; admins and HODs see the whole hotel log.
      const myUserId = user?.id ?? user?.user_id;
      const myNames = [user?.full_name, user?.username]
        .filter(Boolean)
        .map((n) => String(n).toLowerCase().trim());

      const visibleIssues =
        isAdmin || isHOD
          ? maintenanceRequests
          : maintenanceRequests.filter((req) => {
              if (myUserId != null && req.created_by_user_id != null) {
                return Number(req.created_by_user_id) === Number(myUserId);
              }
              // Older requests have no creator id — fall back to matching the reporter name
              const reportedBy = String(req.reported_by || "").toLowerCase().trim();
              return !!reportedBy && myNames.includes(reportedBy);
            });

      const list = [...visibleIssues].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });

      return list.map((req) => {
        const matchedRoom = rooms.find((r) => Number(r.id) === Number(req.room_id));
        const roomNum = matchedRoom?.room_number || req.room_number || req.room_id || "-";
        const dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString() : "-";
        const pr = String(req.priority || "normal").toUpperCase();
        const st = String(req.status || "open").toUpperCase();

        return {
          id: req.id,
          date: req.created_at || "-",
          title: req.issue_title || `Issue #${req.id}`,
          subtitle: `Room ${roomNum} • ${req.category || "General"}`,
          badge: st,
          priority: pr,
          details: [
            { label: "Ref", value: `#${req.id}` },
            { label: "Room", value: `Room ${roomNum}` },
            { label: "Category", value: req.category || "General" },
            { label: "Priority", value: pr },
            { label: "Reported By", value: req.reported_by || "Staff" },
            { label: "Reported Date", value: dateStr },
            { label: "Description", value: req.issue_description || "-" },
          ],
          amount: req.actual_cost ? Number(req.actual_cost) : null,
        };
      });
    }

    if (activeTab === "staffDirectory") {
      let list = staffList;
      if (!isAdmin && !isHOD) {
        const staffId = user?.staff_id || user?.user_id || user?.id;
        const staffName = (user?.full_name || "").toLowerCase().trim();
        list = list.filter((staff) => {
          return (
            (staffId && String(staff.id) === String(staffId)) ||
            (staffName && String(staff.full_name || "").toLowerCase().includes(staffName))
          );
        });
      }

      return list.map((staff) => ({
        id: staff.id,
        date: staff.created_at || "-",
        title: staff.full_name || `Staff #${staff.id}`,
        subtitle: `${staff.designation || "-"} (${staff.department || "-"})`,
        badge: staff.status || "active",
        details: [
          { label: "Phone", value: staff.phone || "-" },
          { label: "Department", value: staff.department || "-" },
          { label: "Type", value: (staff.employee_type || "permanent").toUpperCase() },
        ],
        amount: null,
      }));
    }

    if (activeTab === "procurementOrders") {
      return procurementOrders.map((po) => ({
        id: po.id,
        date: po.order_date || po.created_at || "-",
        title: po.po_number || `PO-${po.id}`,
        subtitle: po.vendor_name || (po.vendor ? po.vendor.name : `Vendor #${po.vendor_id}`),
        badge: po.status || "draft",
        details: [
          { label: "Items", value: `${po.items?.length || 0} line item(s)` },
          { label: "Payment", value: (po.payment_status || "pending").toUpperCase() },
          { label: "Date", value: formatDate(po.order_date || po.created_at) },
        ],
        amount: Number(po.total_amount || 0),
      }));
    }

    return [];
  }, [
    activeTab,
    guests,
    bookings,
    rooms,
    extraCharges,
    invoices,
    payments,
    computedFinance,
    shiftSummary,
    dailyClosing,
    auditTrail,
    restaurantOrders,
    housekeepingTasks,
    staffList,
    procurementOrders,
    maintenanceRequests,
    isAdmin,
    isHOD,
    user,
  ]);

  const filteredRows = useMemo(() => {
    const search = searchText.toLowerCase();

    return reportRows.filter((row) => {
      const rowText = [
        row.id,
        row.title,
        row.subtitle,
        row.badge,
        row.tag,
        ...(row.details ? row.details.map((d) => `${d.label} ${d.value}`) : []),
      ].join(" ").toLowerCase();

      const rowStatus = String(row.badge || "").toLowerCase();

      const matchesSearch = !search || rowText.includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        rowStatus === statusFilter.toLowerCase() ||
        rowStatus.replace("_", "-") === statusFilter.toLowerCase();

      const matchesDate =
        ["finance", "rooms", "dailyClosing"].includes(activeTab)
          ? true
          : rowMatchesDate(row.date);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reportRows, searchText, statusFilter, fromDate, toDate, activeTab]);

  // Reset pagination to page 1 on tab, category, search, or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeCategory, searchText, statusFilter, fromDate, toDate, selectedHotelId, pageSize]);

  // Paginated records (20 per page by default, selectable 20, 50, 100)
  const paginatedRows = useMemo(() => {
    const isAll = pageSize === "all" || Number(pageSize) >= 999999;
    if (isAll) return filteredRows;
    const size = Number(pageSize) || 20;
    const start = (currentPage - 1) * size;
    return filteredRows.slice(start, start + size);
  }, [filteredRows, currentPage, pageSize]);

  function getColumns() {
    if (activeTab === "guests") return ["ID", "Name", "Phone", "Email", "Status"];
    if (activeTab === "bookings") return ["ID", "Guest", "Room", "Check-in", "Checkout", "Total", "Status"];
    if (activeTab === "checkInOut") return ["ID", "Guest", "Room", "Check-in", "Checkout", "Status"];
    if (activeTab === "guestServices") return ["ID", "Booking", "Guest", "Room", "Charge", "Amount", "Status"];
    if (activeTab === "invoices") return ["ID", "Invoice #", "Guest", "Total", "Paid", "Due", "Status"];
    if (activeTab === "payments") return ["ID", "Date", "Receipt / Invoice", "Method", "Amount", "Status"];
    if (activeTab === "rooms") return ["Room #", "Type", "Floor", "Bed", "Price", "Status"];
    if (activeTab === "shiftReconciliation") return ["#", "Date", "Payment Channel", "Collected Amount", "Status"];
    if (activeTab === "auditTrail") return ["Payment ID", "Timestamp", "Type", "Receipt #", "Amount", "Method", "Cashier", "Status"];
    if (activeTab === "dailyClosing") return ["Closing Metric", "Category", "Amount"];
    if (activeTab === "finance") return ["Revenue Stream", "Classification", "Amount"];
    if (activeTab === "restaurantOrders") return ["Order #", "Destination", "Type", "Guest", "Total", "Status"];
    if (activeTab === "housekeepingTasks") return ["Task #", "Room", "Task Type", "Assigned To", "Priority", "Status"];
    if (activeTab === "housekeepingLogs") return ["Log #", "Room", "Attendant", "Lifecycle Stage", "Event Timestamp", "HOD / Inspector", "Audit Details / Remarks"];
    if (activeTab === "reportedIssues") return ["Ref #", "Room", "Issue Details", "Category", "Priority", "Status", "Reported By", "Reported Date"];
    if (activeTab === "staffDirectory") return ["Staff ID", "Full Name", "Department", "Designation", "Phone", "Status"];
    if (activeTab === "procurementOrders") return ["PO #", "Date", "Supplier / Vendor", "Items", "Total Amount", "Status"];
    return ["Title", "Value"];
  }

  function getRowCells(row) {
    if (activeTab === "guests") {
      return [
        `#${row.id}`,
        row.title,
        row.details?.find((d) => d.label === "Phone")?.value || "-",
        row.details?.find((d) => d.label === "Email")?.value || "-",
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "bookings") {
      return [
        `#${row.id}`,
        row.title,
        row.subtitle,
        row.details?.find((d) => d.label === "Check-in")?.value || "-",
        row.details?.find((d) => d.label === "Checkout")?.value || "-",
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "checkInOut") {
      return [
        `#${row.id}`,
        row.title,
        row.subtitle,
        row.details?.find((d) => d.label === "Check-in")?.value || "-",
        row.details?.find((d) => d.label === "Checkout")?.value || "-",
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "guestServices") {
      return [
        `#${row.id}`,
        row.subtitle,
        row.details?.find((d) => d.label === "Guest")?.value || "-",
        row.details?.find((d) => d.label === "Room")?.value || "-",
        row.title,
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "invoices") {
      return [
        `#${row.id}`,
        row.title,
        row.subtitle.replace("Guest: ", ""),
        formatCurrency(row.amount),
        row.details?.find((d) => d.label === "Paid")?.value || "₹0.00",
        row.details?.find((d) => d.label === "Due")?.value || "₹0.00",
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "payments") {
      return [
        `#${row.id}`,
        formatDate(row.date),
        row.title,
        row.details?.find((d) => d.label === "Method")?.value || "Cash",
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "rooms") {
      return [
        row.title,
        row.details?.find((d) => d.label === "Type")?.value || "-",
        row.details?.find((d) => d.label === "Floor")?.value || "-",
        row.details?.find((d) => d.label === "Bed")?.value || "-",
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "shiftReconciliation") {
      return [
        `#${row.id}`,
        formatDate(row.date),
        row.title,
        formatCurrency(row.amount),
        <span key="status" className="reports-status paid">{row.badge}</span>,
      ];
    }
    if (activeTab === "auditTrail") {
      return [
        `#${row.id}`,
        new Date(row.date).toLocaleString(),
        row.details?.find((d) => d.label === "Type")?.value || "SETTLEMENT",
        row.subtitle,
        formatCurrency(row.amount),
        row.details?.find((d) => d.label === "Method")?.value || "CASH",
        row.details?.find((d) => d.label === "Cashier")?.value || "System",
        <span key="status" className="reports-status paid">{row.badge}</span>,
      ];
    }
    if (activeTab === "dailyClosing" || activeTab === "finance") {
      return [
        row.title,
        <span key="tag" className="reports-category-chip">{row.tag}</span>,
        <span key="amount" className="reports-numeric-bold">{formatCurrency(row.value)}</span>,
      ];
    }
    if (activeTab === "restaurantOrders") {
      return [
        row.title,
        row.subtitle,
        row.details?.find((d) => d.label === "Type")?.value || "dine-in",
        row.details?.find((d) => d.label === "Guest")?.value || "-",
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "housekeepingTasks") {
      return [
        `#${row.id}`,
        row.details?.find((d) => d.label === "Room")?.value || "-",
        row.subtitle,
        row.details?.find((d) => d.label === "Assigned To")?.value || "-",
        row.details?.find((d) => d.label === "Priority")?.value || "NORMAL",
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "housekeepingLogs") {
      return [
        row.logId || `#${row.id}`,
        row.details?.find((d) => d.label === "Room")?.value || "-",
        row.details?.find((d) => d.label === "Attendant")?.value || "-",
        <span key="stage" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
        row.details?.find((d) => d.label === "Timestamp")?.value || "-",
        row.details?.find((d) => d.label === "Actor")?.value || "-",
        <span key="desc" style={{ fontSize: "12px", color: "#334155" }}>{row.details?.find((d) => d.label === "Details")?.value || "-"}</span>,
      ];
    }
    if (activeTab === "reportedIssues") {
      return [
        `#${row.id}`,
        row.details?.find((d) => d.label === "Room")?.value || "-",
        <div key="issue">
          <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>{row.title}</strong>
          {row.details?.find((d) => d.label === "Description")?.value !== "-" && (
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              {row.details?.find((d) => d.label === "Description")?.value}
            </span>
          )}
        </div>,
        <span key="cat" className="reports-category-chip">{row.details?.find((d) => d.label === "Category")?.value || "General"}</span>,
        <span key="priority" className={`reports-status ${getStatusClass(row.priority)}`}>{row.priority}</span>,
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
        row.details?.find((d) => d.label === "Reported By")?.value || "-",
        row.details?.find((d) => d.label === "Reported Date")?.value || "-",
      ];
    }
    if (activeTab === "staffDirectory") {
      return [
        `EMP-${String(row.id).padStart(4, "0")}`,
        row.title,
        row.details?.find((d) => d.label === "Department")?.value || "-",
        row.subtitle,
        row.details?.find((d) => d.label === "Phone")?.value || "-",
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }
    if (activeTab === "procurementOrders") {
      return [
        row.title,
        formatDate(row.date),
        row.subtitle,
        row.details?.find((d) => d.label === "Items")?.value || "0 items",
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.badge)}`}>{row.badge}</span>,
      ];
    }

    return [row.title, formatCurrency(row.value || row.amount || 0)];
  }

  function getExportCellValue(value) {
    if (typeof value === "string" || typeof value === "number") return value;
    if (value && typeof value === "object" && value.props?.children) {
      return String(value.props.children);
    }
    return "";
  }

  function exportCsv() {
    const columns = getColumns();
    const rows = filteredRows.map((row) =>
      getRowCells(row).map((cell) => getExportCellValue(cell))
    );
    const csvContent = [columns, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTab}-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const columns = getColumns();
    const rows = filteredRows.map((row) =>
      getRowCells(row).map((cell) => getExportCellValue(cell))
    );
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("Popup blocked. Please allow popups to print report.");
      return;
    }
    const activeLabel =
      REPORT_TABS.find((tab) => tab.key === activeTab)?.label || "Report";

    printWindow.document.write(`
      <html>
        <head>
          <title>${activeLabel} - Aerostate Hotel ERP</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; padding: 28px; color: #0f172a; margin: 0; }
            h1 { margin: 0 0 6px; font-size: 24px; font-weight: 700; color: #1e293b; }
            p { margin: 0 0 20px; color: #64748b; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 12px; }
            th { background: #f8fafc; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            .print-footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: right; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${activeLabel}</h1>
          <p>Generated on ${new Date().toLocaleString()} | ${hotelInfo?.name || "Hotel ERP"} Consolidated Report</p>
          <table>
            <thead>
              <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
          <div class="print-footer">${hotelInfo?.name || "Hotel ERP"} &copy; ${new Date().getFullYear()}</div>
          <br /><button onclick="window.print()">Print Report</button>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  function resetFilters() {
    setSearchText("");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
  }

  function handleTabChange(tabKey) {
    setActiveTab(tabKey);
    resetFilters();
  }

  return (
    <div className="reports-page">
      {/* SHARED UNIFIED PORTAL HEADER WITH ACTIONS */}
      <PortalHeader 
        title="Operations & Reports Portal"
        kicker="ENTERPRISE INTELLIGENCE"
        description="Comprehensive analytical reports across front desk, cashier reconciliations, restaurant POS, housekeeping, and payroll."
        icon={BarChart3}
        backPath="/dashboard"
        rightAction={
          <div className="reports-header-actions">
            {user?.role === "super-admin" && hotels.length > 0 && (
              <div className="reports-hotel-select-wrap">
                <Building2 size={15} className="hotel-icon" />
                <select
                  className="reports-hotel-select"
                  value={selectedHotelId}
                  onChange={(e) => setSelectedHotelId(e.target.value)}
                >
                  <option value="">All Hotels (Consolidated)</option>
                  {hotels.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className="reports-action-btn print" onClick={printReport}>
              <Printer size={15} /> Print
            </button>
            <button
              type="button"
              className="reports-action-btn export"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {error && <div className="reports-error-box">{error}</div>}

      {/* --- STATS GRID (4 Columns) --- */}
      <div className="reports-stats-grid">
        {activeCategory === "housekeeping" ? (
          <>
            <StatCard
              title="Total Tasks"
              value={housekeepingStats.total}
              Icon={Sparkles}
              colorTheme="blue"
            />
            <StatCard
              title="Completed / Cleaned"
              value={housekeepingStats.completed}
              Icon={CheckCircle2}
              colorTheme="green"
            />
            <StatCard
              title="Cleaning In-Progress"
              value={housekeepingStats.inProgress}
              Icon={Clock}
              colorTheme="orange"
            />
            <StatCard
              title="Pending Turnover"
              value={housekeepingStats.pending}
              Icon={BedDouble}
              colorTheme="purple"
            />
          </>
        ) : (
          <>
            <StatCard
              title="Total Guests"
              value={summaryCards.guests}
              Icon={Users}
              colorTheme="blue"
            />
            <StatCard
              title="Total Bookings"
              value={summaryCards.bookings}
              Icon={CalendarDays}
              colorTheme="purple"
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(summaryCards.revenue)}
              Icon={IndianRupee}
              colorTheme="green"
            />
            <StatCard
              title="Total Collected"
              value={formatCurrency(summaryCards.paid)}
              Icon={Wallet}
              colorTheme="orange"
            />
          </>
        )}
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="reports-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title={`${REPORT_TABS.find((tab) => tab.key === activeTab)?.label || "Report"} Overview`}
          description={
            isAdmin 
              ? "Filter, search, inspect records, or export consolidated data seamlessly."
              : isHOD
              ? "Department reports, task history, and operational cleaning records."
              : "Your personal activity log, assigned tasks, and completed records."
          }
          badgeCount={filteredRows.length}
          badgeLabel="records"
        />

        {/* DEPARTMENT CATEGORY PILLS (SCOPED TO USER DEPARTMENT) */}
        <div className="reports-category-pills">
          {visibleCategories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`category-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {Icon && <Icon size={14} className="category-pill-icon" />}
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* MAIN CARD CONTAINER */}
        <div className="reports-card">
          {/* TABS STRIP */}
          <div className="reports-tabs">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tab-btn ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TOOLBAR */}
          <div className="reports-toolbar">
            <div className="reports-filter-row">
              {/* SEARCH */}
              <div className="reports-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder={`Search in ${REPORT_TABS.find((tab) => tab.key === activeTab)?.label.toLowerCase()}...`}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && (
                  <button type="button" className="reports-clear-search-btn" onClick={() => setSearchText("")}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* STATUS FILTER */}
              <div className="reports-filter-box">
                <Filter size={16} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked-in</option>
                  <option value="checked-out">Checked-out</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* DATE RANGE FILTERS */}
              <div className="reports-date-filter-group">
                <CalendarDays size={15} className="date-icon" />
                <input
                  className="reports-date-input"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  title="From Date"
                />
                <span className="date-separator">to</span>
                <input
                  className="reports-date-input"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  title="To Date"
                />
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    className="reports-clear-dates-btn"
                    onClick={() => { setFromDate(""); setToDate(""); }}
                    title="Clear Dates"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* DATE PRESETS */}
              <div className="reports-presets-group">
                <button type="button" className="date-preset-btn" onClick={() => setDatePreset("today")}>
                  Today
                </button>
                <button type="button" className="date-preset-btn" onClick={() => setDatePreset("week")}>
                  7 Days
                </button>
                <button type="button" className="date-preset-btn" onClick={() => setDatePreset("month")}>
                  This Month
                </button>
              </div>

              {/* VIEW SWITCHER */}
              <div className="reports-view-switcher">
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table List View"
                >
                  <LayoutList size={16} />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  className={`view-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
                  onClick={() => setViewMode("cards")}
                  title="Cards Grid View"
                >
                  <LayoutGrid size={16} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* CONTENT SECTION */}
          {loading ? (
            <div className="reports-empty-state">
              <div className="reports-spinner" />
              <h4>Loading report data...</h4>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="reports-empty-state">
              <h4>No report data found</h4>
              <p>Try adjusting filters, clearing search criteria, or selecting a different date range.</p>
              {(searchText || statusFilter !== "all" || fromDate || toDate) && (
                <button type="button" className="reports-reset-btn" onClick={resetFilters}>
                  <RotateCcw size={14} /> Reset Filters
                </button>
              )}
            </div>
          ) : viewMode === "cards" || ["dailyClosing", "finance"].includes(activeTab) ? (
            /* --- CARDS VIEW / EXECUTIVE KPI TILES --- */
            <div className="reports-card-content-area">
              {["dailyClosing", "finance"].includes(activeTab) ? (
                <div className="finance-kpi-grid">
                  {filteredRows.map((item, idx) => (
                    <div key={idx} className="finance-kpi-card">
                      <div className="kpi-card-header">
                        <span className="kpi-card-title">{item.title}</span>
                        <span className="kpi-card-tag">{item.tag}</span>
                      </div>
                      <div className="kpi-card-amount">{formatCurrency(item.value)}</div>
                      <div className="kpi-card-footer">
                        <CheckCircle2 size={14} className="kpi-check-icon" />
                        <span>System Reconciled</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="reports-record-cards-grid">
                  {paginatedRows.map((row, index) => (
                    <div key={`${activeTab}-${row.id || index}`} className="report-record-card">
                      <div className="record-card-header">
                        <div className="record-header-left">
                          <span className="record-id">#{row.id}</span>
                          <h4 className="record-title">{row.title}</h4>
                        </div>
                        {row.badge && (
                          <span className={`reports-status ${getStatusClass(row.badge)}`}>
                            {row.badge}
                          </span>
                        )}
                      </div>

                      {row.subtitle && <div className="record-subtitle">{row.subtitle}</div>}

                      {row.details && row.details.length > 0 && (
                        <div className="record-details-grid">
                          {row.details.map((d, dIdx) => (
                            <div key={dIdx} className="record-detail-item">
                              <span className="detail-label">{d.label}</span>
                              <span className="detail-value">{d.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {row.amount !== null && row.amount !== undefined && (
                        <div className="record-card-footer">
                          <span className="amount-label">Amount</span>
                          <span className="amount-value">{formatCurrency(row.amount)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* --- TABLE LIST VIEW --- */
            <div className="reports-table-scroll">
              <table className="reports-table">
                <thead>
                  <tr>
                    {getColumns().map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((row, index) => (
                    <tr key={`${activeTab}-${row.id || index}`}>
                      {getRowCells(row).map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION BAR */}
          {filteredRows.length > 0 && !["dailyClosing", "finance"].includes(activeTab) && (
            <div style={{ marginTop: "18px", paddingBottom: "10px" }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredRows.length}
                pageSize={pageSize}
                pageSizeOptions={[20, 50, 100]}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(sz) => {
                  setPageSize(sz);
                  setCurrentPage(1);
                }}
                itemLabel="records"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}