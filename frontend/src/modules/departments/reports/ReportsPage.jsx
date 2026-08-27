import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Filter,
  IndianRupee,
  Printer,
  ReceiptText,
  Search,
  User,
  Wallet,
  BarChart3,
  X
} from "lucide-react";
import api from "../../../api/api";
import { useAuth } from "../../../context/AuthContext";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import "./reports.css";

const reportTabs = [
  { key: "guests", label: "Guests" },
  { key: "bookings", label: "Bookings" },
  { key: "checkInOut", label: "Check-in / Checkout" },
  { key: "guestServices", label: "Guest Services" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
  { key: "rooms", label: "Rooms" },
  { key: "finance", label: "Finance Summary" },
];

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("guests");

  const [guests, setGuests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);

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

  function filterByHotel(list) {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;

    const filteredList = list.filter((item) => {
      if (item.hotel_id === undefined || item.hotel_id === null) return true;
      return Number(item.hotel_id) === Number(hotelId);
    });

    return filteredList.length > 0 ? filteredList : list;
  }

  function formatDate(value) {
    if (!value) return "-";
    return String(value).slice(0, 10);
  }

  function formatCurrency(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
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
      .replace(/\s+/g, "-")
      .replace("_", "-");
  }

  function rowMatchesDate(rowDate) {
    if (!fromDate && !toDate) return true;
    if (!rowDate || rowDate === "-") return false;
    const dateValue = String(rowDate).slice(0, 10);
    if (fromDate && dateValue < fromDate) return false;
    if (toDate && dateValue > toDate) return false;
    return true;
  }

  async function fetchReportsData() {
    try {
      setLoading(true);
      setError("");

      const [
        guestsResponse,
        bookingsResponse,
        roomsResponse,
        extraChargesResponse,
        invoicesResponse,
        paymentsResponse,
        financeResponse,
      ] = await Promise.all([
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/extra-charges").catch(() => ({ data: [] })),
        api.get("/invoices").catch(() => ({ data: [] })),
        api.get("/payments").catch(() => ({ data: [] })),
        api.get("/reports/finance-summary").catch(() => ({ data: null })),
      ]);

      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
      setExtraCharges(
        filterByHotel(normalizeList(extraChargesResponse.data, "extra_charges"))
      );
      setInvoices(filterByHotel(normalizeList(invoicesResponse.data, "invoices")));
      setPayments(filterByHotel(normalizeList(paymentsResponse.data, "payments")));
      setFinanceSummary(financeResponse.data || null);
    } catch (err) {
      console.error("Fetch reports error:", err);
      setError(getApiErrorMessage(err, "Failed to load reports data."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReportsData();
  }, []);

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

  const reportRows = useMemo(() => {
    if (activeTab === "guests") {
      return guests.map((guest) => ({
        id: guest.id,
        date: guest.created_at || guest.created_date || "-",
        name: guest.full_name || guest.name || "-",
        phone: guest.phone || "-",
        email: guest.email || "-",
        status: guest.status || "active",
      }));
    }

    if (activeTab === "bookings") {
      return bookings.map((booking) => ({
        id: booking.id,
        date: booking.checkin_date || booking.check_in_date || booking.created_at,
        guest: getGuestName(booking.guest_id),
        room: getRoomNumber(booking.room_id),
        checkin: booking.checkin_date || booking.check_in_date || "-",
        checkout: booking.checkout_date || booking.check_out_date || "-",
        total: getBookingTotal(booking),
        status: booking.status || "pending",
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
          guest: getGuestName(booking.guest_id),
          room: getRoomNumber(booking.room_id),
          checkin: booking.checkin_date || booking.check_in_date || "-",
          checkout: booking.checkout_date || booking.check_out_date || "-",
          status: booking.status || "-",
        }));
    }

    if (activeTab === "guestServices") {
      return extraCharges.map((charge) => {
        const booking = getBookingById(charge.booking_id);
        return {
          id: charge.id,
          date: charge.created_at || charge.date || "-",
          booking: charge.booking_id || "-",
          guest: getGuestName(charge.guest_id || booking?.guest_id),
          room: getRoomNumber(charge.room_id || booking?.room_id),
          charge: charge.charge_name || "-",
          amount: Number(charge.total_amount || 0),
          status: charge.status || "pending",
        };
      });
    }

    if (activeTab === "invoices") {
      return invoices.map((invoice) => {
        const booking = getBookingById(invoice.booking_id);
        return {
          id: invoice.id,
          date: invoice.issue_date || invoice.invoice_date || invoice.created_at,
          invoice: invoice.invoice_number || `INV-${invoice.id}`,
          booking: invoice.booking_id || "-",
          guest: getGuestName(invoice.guest_id || booking?.guest_id),
          room: getRoomNumber(invoice.room_id || booking?.room_id),
          total: getInvoiceTotal(invoice),
          paid: getInvoicePaid(invoice),
          due: getInvoiceDue(invoice),
          status: invoice.status || invoice.payment_status || "pending",
        };
      });
    }

    if (activeTab === "payments") {
      return payments.map((payment) => {
        const booking = getBookingById(payment.booking_id);
        return {
          id: payment.id,
          date: payment.payment_date || payment.date || payment.created_at,
          booking: payment.booking_id || "-",
          invoice: payment.invoice_id ? `INV-${payment.invoice_id}` : "-",
          guest: getGuestName(payment.guest_id || booking?.guest_id),
          room: getRoomNumber(payment.room_id || booking?.room_id),
          amount: getPaymentAmount(payment),
          method: payment.payment_method || payment.method || "cash",
          status: payment.status || payment.payment_status || "paid",
        };
      });
    }

    if (activeTab === "rooms") {
      return rooms.map((room) => ({
        id: room.id,
        room: room.room_number || "-",
        type: room.room_type || "-",
        floor: room.floor || "-",
        bed: room.bed_type || "-",
        price: Number(room.base_price || 0),
        status: room.status || "available",
      }));
    }

    return [
      { title: "Booking Revenue", value: computedFinance.bookingRevenue },
      { title: "Extra Charges", value: computedFinance.extraChargeAmount },
      { title: "Invoice Revenue", value: computedFinance.invoiceRevenue },
      { title: "Paid Amount", value: computedFinance.paidAmount },
      { title: "Due Amount", value: computedFinance.dueAmount },
      { title: "Total Revenue", value: computedFinance.totalRevenue },
    ];
  }, [
    activeTab,
    guests,
    bookings,
    rooms,
    extraCharges,
    invoices,
    payments,
    computedFinance,
  ]);

  const filteredRows = useMemo(() => {
    const search = searchText.toLowerCase();

    return reportRows.filter((row) => {
      const rowText = Object.values(row).join(" ").toLowerCase();
      const rowStatus = String(row.status || "").toLowerCase();

      const matchesSearch = !search || rowText.includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        rowStatus === statusFilter.toLowerCase() ||
        rowStatus.replace("_", "-") === statusFilter.toLowerCase();

      const matchesDate =
        activeTab === "finance" || activeTab === "rooms"
          ? true
          : rowMatchesDate(row.date);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [reportRows, searchText, statusFilter, fromDate, toDate, activeTab]);

  function getColumns() {
    if (activeTab === "guests") return ["ID", "Name", "Phone", "Email", "Status"];
    if (activeTab === "bookings") return ["ID", "Guest", "Room", "Check-in", "Checkout", "Total", "Status"];
    if (activeTab === "checkInOut") return ["ID", "Guest", "Room", "Check-in", "Checkout", "Status"];
    if (activeTab === "guestServices") return ["ID", "Booking", "Guest", "Room", "Charge", "Amount", "Status"];
    if (activeTab === "invoices") return ["ID", "Invoice", "Booking", "Guest", "Room", "Total", "Paid", "Due", "Status"];
    if (activeTab === "payments") return ["ID", "Date", "Booking", "Invoice", "Guest", "Room", "Amount", "Method", "Status"];
    if (activeTab === "rooms") return ["ID", "Room", "Type", "Floor", "Bed", "Price", "Status"];
    return ["Title", "Value"];
  }

  function getRowCells(row) {
    if (activeTab === "guests") {
      return [
        `#${row.id}`,
        row.name,
        row.phone,
        row.email,
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "bookings") {
      return [
        `#${row.id}`,
        row.guest,
        `Room ${row.room}`,
        formatDate(row.checkin),
        formatDate(row.checkout),
        formatCurrency(row.total),
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "checkInOut") {
      return [
        `#${row.id}`,
        row.guest,
        `Room ${row.room}`,
        formatDate(row.checkin),
        formatDate(row.checkout),
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "guestServices") {
      return [
        `#${row.id}`,
        `Booking #${row.booking}`,
        row.guest,
        `Room ${row.room}`,
        row.charge,
        formatCurrency(row.amount),
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "invoices") {
      return [
        `#${row.id}`,
        row.invoice,
        `Booking #${row.booking}`,
        row.guest,
        `Room ${row.room}`,
        formatCurrency(row.total),
        formatCurrency(row.paid),
        formatCurrency(row.due),
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "payments") {
      return [
        `#${row.id}`,
        formatDate(row.date),
        `Booking #${row.booking}`,
        row.invoice,
        row.guest,
        `Room ${row.room}`,
        formatCurrency(row.amount),
        row.method,
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    if (activeTab === "rooms") {
      return [
        `#${row.id}`,
        `Room ${row.room}`,
        row.type,
        row.floor,
        row.bed,
        formatCurrency(row.price),
        <span key="status" className={`reports-status ${getStatusClass(row.status)}`}>{row.status}</span>,
      ];
    }
    return [row.title, formatCurrency(row.value)];
  }

  function getExportCellValue(value) {
    if (typeof value === "string" || typeof value === "number") return value;
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
    link.download = `${activeTab}-report.csv`;
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
      reportTabs.find((tab) => tab.key === activeTab)?.label || "Report";

    printWindow.document.write(`
      <html>
        <head>
          <title>${activeLabel}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
            h1 { margin: 0 0 6px; font-size: 26px; }
            p { margin: 0 0 20px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
            th { background: #f8fafc; color: #475569; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>${activeLabel}</h1>
          <p>Aerostate Hotel ERP Report</p>
          <table>
            <thead>
              <tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
          <br /><button onclick="window.print()">Print</button>
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
        title="Reports Portal"
        kicker="HOTEL OPERATIONS"
        description="View guest, booking, invoice, payment, room, and finance reports for your hotel."
        icon={BarChart3}
        backPath="/dashboard"
        rightAction={
          <div className="reports-header-actions">
            <button type="button" className="reports-action-btn print" onClick={printReport}>
              <Printer size={15} /> Print
            </button>
            <button type="button" className="reports-action-btn export" onClick={exportCsv} disabled={filteredRows.length === 0}>
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {error && <div className="reports-error-box">{error}</div>}

      {/* --- REUSABLE STATS GRID (4 Columns) --- */}
      <div className="reports-stats-grid">
        <StatCard
          title="Total Guests"
          value={summaryCards.guests}
          Icon={User}
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
          title="Total Paid"
          value={formatCurrency(summaryCards.paid)}
          Icon={Wallet}
          colorTheme="orange"
        />
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="reports-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title={`${reportTabs.find((tab) => tab.key === activeTab)?.label} Analytics`}
          description="Filter, search, and export data records seamlessly."
          badgeCount={filteredRows.length}
          badgeLabel="records"
        />

        {/* TABS & TOOLBAR SECTION */}
        <div className="reports-card">
          <div className="reports-tabs">
            {reportTabs.map((tab) => (
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

          <div className="reports-toolbar">
            <div className="reports-filter-row">
              <div className="reports-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder={`Search ${reportTabs.find((tab) => tab.key === activeTab)?.label.toLowerCase()}...`}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

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

              <div className="reports-date-filter-group">
                <input
                  className="reports-date-input"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  autoComplete="off"
                  title="From Date"
                />
                <span className="date-separator">to</span>
                <input
                  className="reports-date-input"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  autoComplete="off"
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
            </div>
          </div>

          {/* TABLE DATA */}
          {loading ? (
            <div className="reports-empty-state">
              <h4>Loading reports...</h4>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="reports-empty-state">
              <h4>No report data found</h4>
              <p>Try changing filters or clearing dates.</p>
            </div>
          ) : (
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
                  {filteredRows.map((row, index) => (
                    <tr key={`${activeTab}-${row.id || row.title || index}`}>
                      {getRowCells(row).map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}