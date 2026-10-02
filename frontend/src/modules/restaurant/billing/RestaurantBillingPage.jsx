import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BedDouble,
  CheckCircle,
  ClipboardList,
  CreditCard,
  ReceiptText,
  Search,
  Send,
  User,
  Wallet,
  Download,
  Calendar,
  Printer,
  X,
  Table2,
  ShoppingBag,
  Sparkles,
  QrCode,
  Check,
  AlertCircle,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import {
  PortalHeader,
  StatCard,
  ModuleWriternHeader,
} from "@components";
import "./restaurantBilling.css";

const paymentMethods = [
  { id: "cash", label: "Cash", icon: Wallet },
  { id: "upi", label: "UPI / QR", icon: QrCode },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "online", label: "Online", icon: Send },
];

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

export default function RestaurantBillingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const { user, hotelInfo } = useAuth();

  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [inHouseGuests, setInHouseGuests] = useState([]);

  const todayStr = getTodayDateStr();
  const [startDate, setStartDate] = useState(orderIdParam ? "" : todayStr);
  const [endDate, setEndDate] = useState(orderIdParam ? "" : todayStr);

  const [searchText, setSearchText] = useState(orderIdParam ? String(orderIdParam) : "");
  const [billingFilter, setBillingFilter] = useState(orderIdParam ? "all" : "need_action");

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  // Dedicated POS Checkout Modal State
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState("pos"); // 'pos' or 'folio'
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState("cash");
  const [checkoutDiscount, setCheckoutDiscount] = useState(0);
  const [checkoutCashReceived, setCheckoutCashReceived] = useState("");
  const [checkoutSelectedBooking, setCheckoutSelectedBooking] = useState("");

  // Printable Receipt Modal State
  const [receiptOrder, setReceiptOrder] = useState(null);

  // Quick Transfer to Room Modal State
  const [transferModalOrder, setTransferModalOrder] = useState(null);
  const [selectedBookingForTransfer, setSelectedBookingForTransfer] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
        .map((item) => `${Array.isArray(item.loc) ? item.loc.join(".") : ""}: ${item.msg}`)
        .join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    if (err.message) return err.message;
    return fallbackMessage;
  }

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id || 1;
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

  function getBookingById(bookingId) {
    return bookings.find((item) => Number(item.id) === Number(bookingId));
  }

  function getGuestName(guestId) {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || guest?.name || "-";
  }

  function getRoomNumber(roomId) {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || "-";
  }

  function getOrderStatus(order) {
    return String(order.order_status || order.status || "pending").toLowerCase();
  }

  function getOrderType(order) {
    return order.order_type || order.type || "dine-in";
  }

  function getBillingType(order) {
    if (order.billing_type) return order.billing_type;
    if (getOrderType(order) === "room-service") return "transfer_to_booking";
    if (order.payment_status === "paid") return "paid_at_restaurant";
    if (order.payment_status === "bill-to-room") return "transfer_to_booking";
    return "pending_billing";
  }

  function getPaymentStatus(order) {
    const status = order.payment_status || "unpaid";
    if (status === "bill-to-room") return "unpaid";
    if (status === "pending") return "unpaid";
    return status;
  }

  function getOrderAmount(order) {
    return Number(order.total_amount || 0);
  }

  function getOrderTax(order) {
    return Number(order.tax_amount || 0);
  }

  function getOrderBase(order) {
    return Number(order.subtotal || getOrderAmount(order) - getOrderTax(order));
  }

  function getOrderItems(order) {
    if (Array.isArray(order.items)) return order.items;
    return [];
  }

  function getOrderItemsText(order) {
    const items = getOrderItems(order);
    if (items.length === 0) return "-";
    return items
      .map((item) => {
        const name = item.item_name || item.name || `Item #${item.menu_item_id}`;
        const portion = item.portion === "half" ? " (Half)" : "";
        return `${name}${portion} x ${item.quantity}`;
      })
      .join(", ");
  }

  function isReadyForBilling(order) {
    const status = getOrderStatus(order);
    return ["served", "completed"].includes(status);
  }

  function isPaidAtRestaurant(order) {
    return getBillingType(order) === "paid_at_restaurant" && getPaymentStatus(order) === "paid";
  }

  function isTransferredToBooking(order) {
    return (
      getBillingType(order) === "transfer_to_booking" &&
      getPaymentStatus(order) === "unpaid" &&
      order.payment_method === "room_bill"
    );
  }

  function isBillingCompleted(order) {
    return (
      Boolean(order.is_added_to_invoice) ||
      isPaidAtRestaurant(order) ||
      isTransferredToBooking(order) ||
      getOrderType(order) === "room-service"
    );
  }

  function needsBillingAction(order) {
    return isReadyForBilling(order) && !isBillingCompleted(order) && getOrderType(order) !== "room-service";
  }

  const activeBookings = useMemo(() => {
    if (inHouseGuests && inHouseGuests.length > 0) return inHouseGuests;
    return bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "checked_in";
    });
  }, [inHouseGuests, bookings]);

  async function fetchData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      setError("");

      const [ordersResponse, bookingsResponse, guestsResponse, roomsResponse, inHouseResponse] =
        await Promise.all([
          api.get("/restaurant/orders").catch(() => ({ data: [] })),
          api.get("/bookings").catch(() => ({ data: [] })),
          api.get("/guests").catch(() => ({ data: [] })),
          api.get("/rooms").catch(() => ({ data: [] })),
          api.get("/restaurant/in-house-guests").catch(() => ({ data: [] })),
        ]);

      const allOrders = filterByHotel(normalizeList(ordersResponse.data, "orders"));

      setOrders(allOrders.filter((order) => getOrderStatus(order) !== "cancelled"));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
      setInHouseGuests(filterByHotel(normalizeList(inHouseResponse.data, "guests")));
    } catch (err) {
      console.error("Fetch restaurant billing error:", err);
      if (!isSilent) setError(getApiErrorMessage(err, "Failed to load restaurant billing."));
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  // Initial load and 30-second background polling
  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // When orderIdParam is present in URL, auto-target order
  useEffect(() => {
    if (orderIdParam && orders.length > 0) {
      const target = orders.find((o) => Number(o.id) === Number(orderIdParam));
      if (target) {
        setSearchText(String(orderIdParam));
        setBillingFilter("all");
        setStartDate("");
        setEndDate("");
      }
    }
  }, [orderIdParam, orders]);

  // Date Presets Handler
  const activePreset = useMemo(() => {
    if (!startDate && !endDate) return "all";
    if (startDate === todayStr && endDate === todayStr) return "today";
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const d7Str = d7.toISOString().split("T")[0];
    if (startDate === d7Str && endDate === todayStr) return "last7";
    return "custom";
  }, [startDate, endDate, todayStr]);

  function applyDatePreset(preset) {
    if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "last7") {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      setStartDate(d7.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  }

  const stats = useMemo(() => {
    const paidAtRestaurant = orders.filter((order) => isPaidAtRestaurant(order));
    const transferToBooking = orders.filter(
      (order) =>
        getBillingType(order) === "transfer_to_booking" &&
        getPaymentStatus(order) === "unpaid" &&
        !order.is_added_to_invoice
    );
    const needAction = orders.filter((order) => needsBillingAction(order));

    return {
      totalOrders: orders.length,
      paidAtRestaurantCount: paidAtRestaurant.length,
      paidAtRestaurantAmount: paidAtRestaurant.reduce((sum, order) => sum + getOrderAmount(order), 0),
      transferToBookingCount: transferToBooking.length,
      transferToBookingAmount: transferToBooking.reduce((sum, order) => sum + getOrderAmount(order), 0),
      needActionCount: needAction.length,
      needActionAmount: needAction.reduce((sum, order) => sum + getOrderAmount(order), 0),
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return orders.filter((order) => {
      // Date Range Filtering
      if (startDate || endDate) {
        const orderDateObj = new Date(order.created_at || order.date || Date.now());
        const orderDateOnly = orderDateObj.toISOString().split("T")[0];

        if (startDate && orderDateOnly < startDate) return false;
        if (endDate && orderDateOnly > endDate) return false;
      }

      const booking = getBookingById(order.booking_id);
      const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
      const orderType = getOrderType(order);
      const billingType = getBillingType(order);
      const paymentStatus = getPaymentStatus(order);
      const itemsText = getOrderItemsText(order);

      const rowText = [
        order.id,
        guestName,
        roomNumber,
        order.table_number,
        orderType,
        billingType,
        paymentStatus,
        itemsText,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || rowText.includes(search);

      const matchesFilter =
        billingFilter === "all" ||
        (billingFilter === "need_action" && needsBillingAction(order)) ||
        (billingFilter === "paid_at_restaurant" && isPaidAtRestaurant(order)) ||
        (billingFilter === "transfer_to_booking" &&
          (billingType === "transfer_to_booking" || orderType === "room-service")) ||
        (billingFilter === "added_to_invoice" && Boolean(order.is_added_to_invoice));

      return matchesSearch && matchesFilter;
    });
  }, [orders, bookings, guests, rooms, searchText, billingFilter, startDate, endDate]);

  const targetedOrder = useMemo(() => {
    if (!orderIdParam) return null;
    return orders.find((o) => Number(o.id) === Number(orderIdParam)) || null;
  }, [orderIdParam, orders]);

  // Open Checkout Modal
  function openCheckout(order) {
    setCheckoutOrder(order);
    setCheckoutDiscount(Number(order.discount || 0));
    setCheckoutPaymentMethod(order.payment_method || "cash");
    setCheckoutCashReceived("");
    setCheckoutMode(order.booking_id ? "folio" : "pos");
    setCheckoutSelectedBooking(order.booking_id ? String(order.booking_id) : "");
  }

  // Handle Checkout Submission (POS or Folio)
  async function handleCheckoutSubmit(e) {
    e.preventDefault();
    if (!checkoutOrder) return;

    try {
      setUpdatingId(checkoutOrder.id);
      setError("");
      setSuccess("");

      if (checkoutMode === "pos") {
        await api.put(`/restaurant/orders/${checkoutOrder.id}`, {
          order_status: "completed",
          billing_type: "paid_at_restaurant",
          payment_status: "paid",
          payment_method: checkoutPaymentMethod,
          discount: Number(checkoutDiscount || 0),
        });

        setSuccess(`Order #${checkoutOrder.id} settled successfully via ${checkoutPaymentMethod.toUpperCase()}.`);
      } else {
        // Transfer to Room Folio
        if (!checkoutSelectedBooking) {
          setError("Please select an active checked-in resident stay.");
          setUpdatingId(null);
          return;
        }

        const b = getBookingById(checkoutSelectedBooking);
        if (!b) {
          setError("Booking not found.");
          setUpdatingId(null);
          return;
        }

        await api.put(`/restaurant/orders/${checkoutOrder.id}`, {
          order_status: "completed",
          billing_type: "transfer_to_booking",
          payment_status: "unpaid",
          payment_method: "room_bill",
          booking_id: b.id,
          guest_id: b.guest_id,
          room_id: b.room_id,
          discount: Number(checkoutDiscount || 0),
        });

        setSuccess(`Order #${checkoutOrder.id} successfully charged to Room Folio (SAC 996331).`);
      }

      setCheckoutOrder(null);
      setTimeout(() => setSuccess(""), 4000);
      await fetchData(true);
    } catch (err) {
      console.error("Checkout settlement error:", err);
      setError(getApiErrorMessage(err, "Failed to complete settlement."));
    } finally {
      setUpdatingId(null);
    }
  }

  // Quick Direct Settlement in Table Row
  async function markPaidQuick(order, method = "cash") {
    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "completed",
        billing_type: "paid_at_restaurant",
        payment_status: "paid",
        payment_method: method,
      });

      setSuccess(`Order #${order.id} marked as paid via ${method.toUpperCase()}.`);
      setTimeout(() => setSuccess(""), 3000);
      await fetchData(true);
    } catch (err) {
      console.error("Quick pay error:", err);
      setError(getApiErrorMessage(err, "Failed to settle order."));
    } finally {
      setUpdatingId(null);
    }
  }

  function handleStartTransfer(order) {
    if (order.booking_id) {
      transferToBookingDirect(order, order.booking_id, order.guest_id, order.room_id);
    } else {
      setTransferModalOrder(order);
      setSelectedBookingForTransfer("");
    }
  }

  async function transferToBookingDirect(order, bookingId, guestId, roomId) {
    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "completed",
        billing_type: "transfer_to_booking",
        payment_status: "unpaid",
        payment_method: "room_bill",
        booking_id: bookingId,
        guest_id: guestId,
        room_id: roomId,
      });

      setSuccess(`Order #${order.id} posted directly to guest room folio.`);
      setTimeout(() => setSuccess(""), 3500);
      await fetchData(true);
    } catch (err) {
      console.error("Direct transfer error:", err);
      setError(getApiErrorMessage(err, "Failed to transfer order to room."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleTransferModalSubmit(e) {
    e.preventDefault();
    if (!transferModalOrder || !selectedBookingForTransfer) return;

    const booking = getBookingById(selectedBookingForTransfer);
    if (!booking) return;

    await transferToBookingDirect(
      transferModalOrder,
      booking.id,
      booking.guest_id,
      booking.room_id
    );
    setTransferModalOrder(null);
    setSelectedBookingForTransfer("");
  }

  function clearFilters() {
    setSearchText("");
    setBillingFilter("all");
    setStartDate("");
    setEndDate("");
    if (orderIdParam) {
      searchParams.delete("orderId");
      setSearchParams(searchParams);
    }
  }

  function downloadCSV() {
    if (filteredOrders.length === 0) {
      setError("No billing records available to export for the selected range.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const headers = [
      "Order ID",
      "Order Type",
      "Table/Room",
      "Guest Name",
      "Items Ordered",
      "Taxable Base (INR)",
      "GST (5%)",
      "Discount (INR)",
      "Total Amount (INR)",
      "Billing Type",
      "Payment Status",
      "Payment Method",
      "Date & Time",
    ];

    const rows = filteredOrders.map((order) => {
      const booking = getBookingById(order.booking_id);
      const loc =
        order.order_type === "dine-in"
          ? `Table ${order.table_number || "Counter"}`
          : order.order_type === "room-service"
          ? `Room ${getRoomNumber(order.room_id || booking?.room_id)}`
          : "Takeaway Parcel";

      return [
        order.id,
        order.order_type || "dine-in",
        `"${loc}"`,
        `"${order.guest_name || getGuestName(order.guest_id || booking?.guest_id)}"`,
        `"${getOrderItemsText(order).replace(/"/g, '""')}"`,
        getOrderBase(order).toFixed(2),
        getOrderTax(order).toFixed(2),
        Number(order.discount || 0).toFixed(2),
        getOrderAmount(order).toFixed(2),
        getBillingType(order),
        getPaymentStatus(order),
        order.payment_method || "-",
        `"${new Date(order.created_at || Date.now()).toLocaleString("en-IN")}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateTag = startDate && endDate ? `${startDate}_to_${endDate}` : "all_records";
    link.setAttribute("download", `restaurant_billing_report_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="restaurant-billing-page">
      {/* FLOATING TOASTS */}
      {(error || success) && (
        <div className="billing-toast-container">
          {error && <div className="billing-toast error-toast">{error}</div>}
          {success && <div className="billing-toast success-toast">{success}</div>}
        </div>
      )}

      {/* PORTAL HEADER - NO REFRESH BUTTON */}
      <PortalHeader
        title="Restaurant Billing & POS Settlement"
        kicker="F&B BILLING & INVOICING"
        description="Counter POS payment settlement, room folio billing (SAC 996331), and food receipt printing."
        icon={ReceiptText}
        backPath="/restaurant"
        rightAction={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="billing-live-badge">
              <span className="billing-live-dot" />
              <span>Live POS Sync</span>
            </div>

            <button type="button" className="billing-export-btn" onClick={downloadCSV}>
              <Download size={15} /> Export Report
            </button>
          </div>
        }
      />

      {/* STATS GRID */}
      <section className="billing-stats-grid">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Need Billing Action"
          value={stats.needActionCount}
          Icon={AlertCircle}
          colorTheme="orange"
        />
        <StatCard
          title="Collected at Counter"
          value={`₹${stats.paidAtRestaurantAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          Icon={Wallet}
          colorTheme="green"
        />
        <StatCard
          title="Room Folio Postings"
          value={`₹${stats.transferToBookingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          Icon={Send}
          colorTheme="purple"
        />
      </section>

      {/* TARGETED FOCUS BANNER */}
      {targetedOrder && (
        <div className="billing-focus-banner">
          <div className="billing-focus-text">
            <Sparkles size={16} color="#2563eb" />
            <span>
              Targeted Dining Order #{targetedOrder.id} (
              {targetedOrder.table_number ? `Table ${targetedOrder.table_number}` : "Takeaway / Counter"}) •{" "}
              <strong>₹{getOrderAmount(targetedOrder).toFixed(2)}</strong>
            </span>
          </div>

          <div className="billing-focus-actions">
            {!isBillingCompleted(targetedOrder) && (
              <button
                type="button"
                className="billing-btn-settle"
                onClick={() => openCheckout(targetedOrder)}
              >
                <CreditCard size={13} /> Settle Order #{targetedOrder.id}
              </button>
            )}
            <button
              type="button"
              className="billing-clear-btn"
              style={{ height: "32px", padding: "0 10px" }}
              onClick={() => {
                searchParams.delete("orderId");
                setSearchParams(searchParams);
                setSearchText("");
              }}
            >
              Clear Focus
            </button>
          </div>
        </div>
      )}

      {/* MODULE SECTION */}
      <section className="billing-modules-section">
        <ModuleWriternHeader
          title="Billing & Payment Queue"
          description="Settle payments and review active restaurant billing records."
          badgeCount={filteredOrders.length}
          badgeLabel="bills"
        />

        {/* TOOLBAR */}
        <div className="billing-toolbar-card">
          <div className="billing-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search order #, guest, table, room, or dishes..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="billing-filters-right-group">
            {/* DATE PRESETS */}
            <div className="billing-preset-strip">
              <button
                type="button"
                className={`billing-preset-chip ${activePreset === "today" ? "active" : ""}`}
                onClick={() => applyDatePreset("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`billing-preset-chip ${activePreset === "last7" ? "active" : ""}`}
                onClick={() => applyDatePreset("last7")}
              >
                Last 7d
              </button>
              <button
                type="button"
                className={`billing-preset-chip ${activePreset === "all" ? "active" : ""}`}
                onClick={() => applyDatePreset("all")}
              >
                All
              </button>
            </div>

            {/* DATE PICKERS */}
            <div className="billing-date-filter">
              <Calendar size={14} color="#64748b" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="End Date"
              />
            </div>

            <button
              type="button"
              className="billing-clear-btn"
              onClick={clearFilters}
              title="Reset search and filters"
            >
              Clear
            </button>
          </div>
        </div>

        {/* FILTER TABS STRIP */}
        <div className="billing-tabs-strip">
          <button
            type="button"
            className={`billing-tab-chip ${billingFilter === "need_action" ? "active" : ""}`}
            onClick={() => setBillingFilter("need_action")}
          >
            Needs Action <span className="billing-tab-badge">{stats.needActionCount}</span>
          </button>
          <button
            type="button"
            className={`billing-tab-chip ${billingFilter === "all" ? "active" : ""}`}
            onClick={() => setBillingFilter("all")}
          >
            All Bills <span className="billing-tab-badge">{stats.totalOrders}</span>
          </button>
          <button
            type="button"
            className={`billing-tab-chip ${billingFilter === "paid_at_restaurant" ? "active" : ""}`}
            onClick={() => setBillingFilter("paid_at_restaurant")}
          >
            Paid at Counter <span className="billing-tab-badge">{stats.paidAtRestaurantCount}</span>
          </button>
          <button
            type="button"
            className={`billing-tab-chip ${billingFilter === "transfer_to_booking" ? "active" : ""}`}
            onClick={() => setBillingFilter("transfer_to_booking")}
          >
            Room Folio (SAC 996331) <span className="billing-tab-badge">{stats.transferToBookingCount}</span>
          </button>
        </div>

        {/* DATA TABLE */}
        {loading && orders.length === 0 ? (
          <div className="billing-empty-state">
            <h4>Loading billing records...</h4>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="billing-empty-state">
            <h4>No restaurant bills found</h4>
            <p>Try switching to "All" dates or clear your search filters.</p>
          </div>
        ) : (
          <div className="billing-table-card">
            <table className="billing-table">
              <thead>
                <tr>
                  <th>Order # & Channel</th>
                  <th>Location & Guest</th>
                  <th>Items Ordered</th>
                  <th>Taxable Base</th>
                  <th>GST (5%)</th>
                  <th>Total Amount</th>
                  <th>Billing Status</th>
                  <th>Settlement / Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const booking = getBookingById(order.booking_id);
                  const orderType = getOrderType(order);
                  const billingType = getBillingType(order);
                  const paymentStatus = getPaymentStatus(order);
                  const addedToInvoice = Boolean(order.is_added_to_invoice);
                  const isPaid = isPaidAtRestaurant(order);
                  const isRoomBilled = isTransferredToBooking(order) || orderType === "room-service";
                  const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
                  const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
                  const isTarget = orderIdParam && Number(order.id) === Number(orderIdParam);

                  return (
                    <tr
                      key={order.id}
                      className={`billing-row ${isTarget ? "focused-row" : ""}`}
                    >
                      {/* ORDER COL */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <strong className="order-id-txt">#{order.id}</strong>
                          <span className={`billing-type-badge type-${orderType}`}>
                            {orderType === "dine-in" && <Table2 size={11} />}
                            {orderType === "room-service" && <BedDouble size={11} />}
                            {orderType === "takeaway" && <ShoppingBag size={11} />}
                            {orderType.replace("-", " ")}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {new Date(order.created_at || Date.now()).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* LOCATION & GUEST */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          {orderType === "dine-in" && (
                            <strong>
                              <Table2 size={13} style={{ display: "inline", marginRight: "3px" }} />
                              Table: {order.table_number || "Open"}
                            </strong>
                          )}
                          {orderType === "room-service" && (
                            <strong>
                              <BedDouble size={13} style={{ display: "inline", marginRight: "3px" }} />
                              Room {roomNumber}
                            </strong>
                          )}
                          {orderType === "takeaway" && (
                            <strong>
                              <ShoppingBag size={13} style={{ display: "inline", marginRight: "3px" }} />
                              Takeaway Parcel
                            </strong>
                          )}
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            <User size={11} style={{ display: "inline", marginRight: "3px" }} />
                            {guestName}
                          </span>
                        </div>
                      </td>

                      {/* ITEMS */}
                      <td>
                        <div style={{ maxWidth: "260px" }}>
                          <span
                            style={{ fontSize: "12px", color: "#334155", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                            title={getOrderItemsText(order)}
                          >
                            {getOrderItemsText(order)}
                          </span>
                        </div>
                      </td>

                      {/* BASE & TAX */}
                      <td>₹{getOrderBase(order).toFixed(2)}</td>
                      <td>₹{getOrderTax(order).toFixed(2)}</td>

                      {/* TOTAL */}
                      <td>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                          ₹{getOrderAmount(order).toFixed(2)}
                        </strong>
                      </td>

                      {/* BILLING STATUS */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {addedToInvoice ? (
                            <span className="billing-pill added">ADDED TO INVOICE</span>
                          ) : isPaid ? (
                            <span className="billing-pill paid">PAID AT POS</span>
                          ) : isRoomBilled ? (
                            <span className="billing-pill room-bill">ROOM FOLIO</span>
                          ) : (
                            <span className="billing-pill waiting">PENDING BILLING</span>
                          )}

                          <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
                            {paymentStatus} {order.payment_method ? `(${order.payment_method})` : ""}
                          </span>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {isPaid || isRoomBilled || addedToInvoice ? (
                            <>
                              <span className="billing-done-tag">
                                <CheckCircle size={14} /> Settled
                              </span>
                              <button
                                type="button"
                                className="billing-btn-receipt"
                                onClick={() => setReceiptOrder(order)}
                                title="Print Food Tax Receipt"
                              >
                                <Printer size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="billing-btn-settle"
                                onClick={() => openCheckout(order)}
                                title="Open counter checkout and payment settlement"
                              >
                                <CreditCard size={13} /> Settle
                              </button>

                              <button
                                type="button"
                                className="billing-btn-room"
                                onClick={() => handleStartTransfer(order)}
                                title="Transfer food charge to room folio"
                              >
                                <Send size={13} /> Room Bill
                              </button>

                              <button
                                type="button"
                                className="billing-btn-receipt"
                                onClick={() => setReceiptOrder(order)}
                                title="Print Pre-Bill KOT"
                              >
                                <Printer size={14} />
                              </button>
                            </>
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

      {/* DEDICATED POS CHECKOUT & SETTLE MODAL */}
      {checkoutOrder && (
        <div className="billing-modal-backdrop" onClick={() => setCheckoutOrder(null)}>
          <div className="billing-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <div>
                <h3>Settle Order #{checkoutOrder.id}</h3>
                <p className="billing-modal-kicker">
                  {getOrderType(checkoutOrder) === "dine-in" && `Table ${checkoutOrder.table_number || "Open"}`}
                  {getOrderType(checkoutOrder) === "room-service" && `Room Service`}
                  {getOrderType(checkoutOrder) === "takeaway" && `Takeaway`}
                  {" • "}
                  {checkoutOrder.guest_name || "Guest"}
                </p>
              </div>
              <button
                type="button"
                className="billing-close-btn"
                onClick={() => setCheckoutOrder(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="billing-modal-body">
              {/* SETTLEMENT MODE TABS */}
              <div className="billing-mode-tabs">
                <button
                  type="button"
                  className={`billing-mode-tab ${checkoutMode === "pos" ? "active" : ""}`}
                  onClick={() => setCheckoutMode("pos")}
                >
                  <Wallet size={14} /> Counter POS Payment
                </button>
                <button
                  type="button"
                  className={`billing-mode-tab ${checkoutMode === "folio" ? "active" : ""}`}
                  onClick={() => setCheckoutMode("folio")}
                >
                  <BedDouble size={14} /> Charge to Room Folio
                </button>
              </div>

              {/* BILL BREAKDOWN */}
              <div className="billing-bill-breakdown">
                <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {getOrderItems(checkoutOrder).map((item, idx) => (
                    <div key={idx} className="billing-line-item">
                      <span>
                        {item.item_name || `Item #${item.menu_item_id}`} {item.portion === "half" ? "(Half)" : ""} x {item.quantity}
                      </span>
                      <span>₹{(item.total || item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px", marginTop: "4px" }}>
                  <div className="billing-line-item">
                    <span>Taxable Subtotal:</span>
                    <span>₹{getOrderBase(checkoutOrder).toFixed(2)}</span>
                  </div>
                  <div className="billing-line-item">
                    <span>GST (SAC 996331):</span>
                    <span>₹{getOrderTax(checkoutOrder).toFixed(2)}</span>
                  </div>
                  {Number(checkoutDiscount) > 0 && (
                    <div className="billing-line-item" style={{ color: "#16a34a" }}>
                      <span>Discount:</span>
                      <span>-₹{Number(checkoutDiscount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="billing-line-item grand-total">
                    <span>Net Amount Payable:</span>
                    <span>
                      ₹{Math.max(0, getOrderAmount(checkoutOrder) - Number(checkoutDiscount || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* DISCOUNT INPUT */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569" }}>Discount (INR)</label>
                  <input
                    type="number"
                    min="0"
                    max={getOrderAmount(checkoutOrder)}
                    value={checkoutDiscount}
                    onChange={(e) => setCheckoutDiscount(Number(e.target.value || 0))}
                    className="billing-input"
                    placeholder="0.00"
                  />
                </div>

                {checkoutMode === "pos" && checkoutPaymentMethod === "cash" && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569" }}>Cash Received</label>
                    <input
                      type="number"
                      min="0"
                      value={checkoutCashReceived}
                      onChange={(e) => setCheckoutCashReceived(e.target.value)}
                      className="billing-input"
                      placeholder="e.g. 500"
                    />
                  </div>
                )}
              </div>

              {/* CHANGE DUE (CASH) */}
              {checkoutMode === "pos" && checkoutPaymentMethod === "cash" && Number(checkoutCashReceived) > 0 && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "#166534" }}>
                  Change to return:{" "}
                  <strong>
                    ₹{Math.max(0, Number(checkoutCashReceived) - (getOrderAmount(checkoutOrder) - Number(checkoutDiscount || 0))).toFixed(2)}
                  </strong>
                </div>
              )}

              {/* MODE 1: POS PAYMENT METHODS */}
              {checkoutMode === "pos" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", marginBottom: "6px", display: "block" }}>
                    Select Payment Method *
                  </label>
                  <div className="billing-methods-grid">
                    {paymentMethods.map((pm) => {
                      const Icon = pm.icon;
                      const isActive = checkoutPaymentMethod === pm.id;
                      return (
                        <div
                          key={pm.id}
                          className={`billing-method-card ${isActive ? "active" : ""}`}
                          onClick={() => setCheckoutPaymentMethod(pm.id)}
                        >
                          <Icon size={16} />
                          <span>{pm.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE 2: ROOM FOLIO ASSIGNMENT */}
              {checkoutMode === "folio" && (
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "bold", color: "#475569", marginBottom: "6px", display: "block" }}>
                    Select Checked-In Guest Stay *
                  </label>
                  <select
                    value={checkoutSelectedBooking}
                    onChange={(e) => setCheckoutSelectedBooking(e.target.value)}
                    className="billing-input"
                    required
                  >
                    <option value="">Select In-House Resident Room...</option>
                    {activeBookings.map((b) => {
                      const bId = b.booking_id || b.id;
                      const bName = b.guest_name || getGuestName(b.guest_id);
                      const bRoom = b.room_number || getRoomNumber(b.room_id);
                      return (
                        <option key={bId} value={bId}>
                          Stay #{bId} - {bName} (Room {bRoom})
                        </option>
                      );
                    })}
                  </select>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                    * Food & Beverage charge will be posted to the room invoice under SAC 996331.
                  </span>
                </div>
              )}

              {/* ACTIONS */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="billing-clear-btn"
                  onClick={() => setCheckoutOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="table-primary-btn"
                  disabled={updatingId === checkoutOrder.id}
                  style={{ background: "#166962", color: "#ffffff", padding: "10px 18px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer" }}
                >
                  {updatingId === checkoutOrder.id
                    ? "Settling..."
                    : checkoutMode === "pos"
                    ? `Confirm Payment (${checkoutPaymentMethod.toUpperCase()})`
                    : "Post to Room Folio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK TRANSFER TO ROOM MODAL */}
      {transferModalOrder && (
        <div className="billing-modal-backdrop" onClick={() => setTransferModalOrder(null)}>
          <div className="billing-modal-content" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <h3>Post to Room Folio (Order #{transferModalOrder.id})</h3>
              <button
                type="button"
                className="billing-close-btn"
                onClick={() => setTransferModalOrder(null)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransferModalSubmit} className="billing-modal-body">
              <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
                Transfer ₹{getOrderAmount(transferModalOrder).toFixed(2)} to an active checked-in guest room folio invoice (SAC 996331).
              </p>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>
                  Select Resident Stay *
                </label>
                <select
                  value={selectedBookingForTransfer}
                  onChange={(e) => setSelectedBookingForTransfer(e.target.value)}
                  className="billing-input"
                  required
                >
                  <option value="">Select In-House Resident Stay...</option>
                  {activeBookings.map((b) => {
                    const bId = b.booking_id || b.id;
                    const bName = b.guest_name || getGuestName(b.guest_id);
                    const bRoom = b.room_number || getRoomNumber(b.room_id);
                    return (
                      <option key={bId} value={bId}>
                        Stay #{bId} - {bName} (Room {bRoom})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="billing-clear-btn"
                  onClick={() => setTransferModalOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#166962", color: "#ffffff", padding: "9px 18px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer" }}
                  disabled={updatingId === transferModalOrder.id}
                >
                  Confirm Post to Folio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE FOOD & BEVERAGE TAX RECEIPT MODAL */}
      {receiptOrder && (
        <div className="billing-modal-backdrop" onClick={() => setReceiptOrder(null)}>
          <div className="billing-modal-content" style={{ maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>F&B Tax Invoice / Cash Memo</h3>
                <p className="billing-modal-kicker">Order #{receiptOrder.id} • SAC 996331</p>
              </div>
              <button
                type="button"
                className="billing-close-btn"
                onClick={() => setReceiptOrder(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="billing-modal-body">
              <div className="billing-receipt-paper" id="printable-pos-receipt">
                <div className="billing-receipt-header">
                  <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {hotelInfo?.name || user?.hotel_name || "HOTEL RESTAURANT"}
                  </div>
                  {hotelInfo?.address && (
                    <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>
                      {hotelInfo.address}{hotelInfo.city ? `, ${hotelInfo.city}` : ""}{hotelInfo.state ? `, ${hotelInfo.state}` : ""}
                    </div>
                  )}
                  {hotelInfo?.phone && (
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      Phone: {hotelInfo.phone}
                    </div>
                  )}
                  {hotelInfo?.tax_number && (
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      GSTIN / TAX: {hotelInfo.tax_number}
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px", fontWeight: "600" }}>
                    RESTAURANT & IN-ROOM DINING
                  </div>
                  <div style={{ fontSize: "11px", marginTop: "8px" }}>
                    <strong>CASH MEMO #{receiptOrder.id}</strong> •{" "}
                    {new Date(receiptOrder.created_at || Date.now()).toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ fontSize: "11.5px", padding: "6px 0", borderBottom: "1px dashed #cbd5e1" }}>
                  <div>
                    <strong>Type:</strong> {getOrderType(receiptOrder).toUpperCase()}{" "}
                    {receiptOrder.table_number && `• Table: ${receiptOrder.table_number}`}
                    {receiptOrder.room_id && `• Room: ${getRoomNumber(receiptOrder.room_id)}`}
                  </div>
                  <div>
                    <strong>Guest:</strong> {receiptOrder.guest_name || getGuestName(receiptOrder.guest_id) || "Walk-in Guest"}
                  </div>
                </div>

                <table className="billing-receipt-items">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th style={{ textAlign: "center" }}>QTY</th>
                      <th style={{ textAlign: "right" }}>RATE</th>
                      <th style={{ textAlign: "right" }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOrderItems(receiptOrder).map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {item.item_name || `Item #${item.menu_item_id}`} {item.portion === "half" ? "(Half)" : ""}
                        </td>
                        <td style={{ textAlign: "center" }}>x{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>₹{Number(item.price || 0).toFixed(2)}</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>
                          ₹{(item.total || item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="billing-receipt-totals">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                    <span>Taxable Value (Base):</span>
                    <span>₹{getOrderBase(receiptOrder).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                    <span>CGST (2.5%):</span>
                    <span>₹{(getOrderTax(receiptOrder) / 2).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px" }}>
                    <span>SGST (2.5%):</span>
                    <span>₹{(getOrderTax(receiptOrder) / 2).toFixed(2)}</span>
                  </div>
                  {Number(receiptOrder.discount || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#16a34a" }}>
                      <span>Discount:</span>
                      <span>-₹{Number(receiptOrder.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold", borderTop: "1px dashed #cbd5e1", paddingTop: "6px", marginTop: "4px" }}>
                    <span>Total Amount Paid:</span>
                    <span>₹{getOrderAmount(receiptOrder).toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ fontSize: "11px", color: "#475569", textAlign: "center", marginTop: "12px", borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }}>
                  <div>
                    Status:{" "}
                    <strong>
                      {receiptOrder.billing_type === "transfer_to_booking"
                        ? "CHARGED TO ROOM FOLIO (SAC 996331)"
                        : receiptOrder.payment_status === "paid"
                        ? `PAID VIA ${(receiptOrder.payment_method || "CASH").toUpperCase()}`
                        : "UNPAID"}
                    </strong>
                  </div>
                  <div style={{ marginTop: "4px", fontSize: "10.5px", color: "#64748b" }}>
                    Thank you for dining with us! Have a wonderful day.
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="billing-clear-btn"
                  onClick={() => setReceiptOrder(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="table-primary-btn"
                  style={{ background: "#166962", color: "#ffffff", padding: "9px 18px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}