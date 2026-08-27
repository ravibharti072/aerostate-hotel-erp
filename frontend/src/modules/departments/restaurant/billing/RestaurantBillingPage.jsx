import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Calendar
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantBilling.css";

const paymentMethods = ["cash", "upi", "card", "online"];

export default function RestaurantBillingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [paymentMethodMap, setPaymentMethodMap] = useState({});
  const [searchText, setSearchText] = useState("");
  const [billingFilter, setBillingFilter] = useState("need_action");

  // Date Range Filters (Default to Today)
  const todayStr = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

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
    return order.order_status || order.status || "pending";
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
    return Number(order.total_amount || order.order_total || order.amount || 0);
  }

  function getOrderTax(order) {
    return Number(order.tax_amount || order.gst_amount || 0);
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
        return `${name} x ${item.quantity}`;
      })
      .join(", ");
  }

  function isReadyForBilling(order) {
    const status = String(getOrderStatus(order)).toLowerCase();
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

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, bookingsResponse, guestsResponse, roomsResponse] =
        await Promise.all([
          api.get("/restaurant/orders").catch(() => ({ data: [] })),
          api.get("/bookings").catch(() => ({ data: [] })),
          api.get("/guests").catch(() => ({ data: [] })),
          api.get("/rooms").catch(() => ({ data: [] })),
        ]);

      const allOrders = filterByHotel(normalizeList(ordersResponse.data, "orders"));

      setOrders(allOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() !== "cancelled"));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
    } catch (err) {
      console.error("Fetch restaurant billing error:", err);
      setError(getApiErrorMessage(err, "Failed to load restaurant billing."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const paidAtRestaurant = orders.filter((order) => isPaidAtRestaurant(order));
    const transferToBooking = orders.filter(
      (order) => getBillingType(order) === "transfer_to_booking" && getPaymentStatus(order) === "unpaid" && !order.is_added_to_invoice
    );
    const addedToInvoice = orders.filter((order) => order.is_added_to_invoice);

    return {
      totalOrders: orders.length,
      paidAtRestaurantCount: paidAtRestaurant.length,
      paidAtRestaurantAmount: paidAtRestaurant.reduce((sum, order) => sum + getOrderAmount(order), 0),
      transferToBookingCount: transferToBooking.length,
      transferToBookingAmount: transferToBooking.reduce((sum, order) => sum + getOrderAmount(order), 0),
      addedToInvoiceCount: addedToInvoice.length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase();

    return orders.filter((order) => {
      // Date Range Filtering
      if (startDate || endDate) {
        const orderDateObj = new Date(order.created_at || order.date || Date.now());
        const orderDateOnly = orderDateObj.toISOString().split("T")[0];

        if (startDate && orderDateOnly < startDate) return false;
        if (endDate && orderDateOnly > endDate) return false;
      }

      const booking = getBookingById(order.booking_id);
      const guestName = getGuestName(order.guest_id || booking?.guest_id);
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
      const orderType = getOrderType(order);
      const billingType = getBillingType(order);
      const paymentStatus = getPaymentStatus(order);
      const itemsText = getOrderItemsText(order);

      const rowText = [order.id, guestName, roomNumber, orderType, billingType, paymentStatus, itemsText].join(" ").toLowerCase();

      const matchesSearch = !search || rowText.includes(search);

      const matchesFilter =
        billingFilter === "all" ||
        (billingFilter === "need_action" && needsBillingAction(order)) ||
        billingFilter === billingType ||
        billingFilter === paymentStatus ||
        (billingFilter === "added_to_invoice" && order.is_added_to_invoice);

      return matchesSearch && matchesFilter;
    });
  }, [orders, bookings, guests, rooms, searchText, billingFilter, startDate, endDate]);

  function handlePaymentMethodChange(orderId, method) {
    setPaymentMethodMap((prev) => ({ ...prev, [orderId]: method }));
  }

  async function markPaidAtRestaurant(order) {
    if (getOrderType(order) === "room-service") {
      setError("Room service always goes to final checkout billing.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!isReadyForBilling(order)) {
      setError("Only served or completed orders can be billed.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const method = paymentMethodMap[order.id] || order.payment_method || "";

    if (!method || method === "room_bill") {
      setError("Please select a valid payment method (Cash, Card, UPI).");
      setTimeout(() => setError(""), 3000);
      return;
    }

    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "completed",
        billing_type: "paid_at_restaurant",
        payment_status: "paid",
        payment_method: method,
        discount: Number(order.discount || 0),
      });

      setSuccess(`Order #${order.id} marked as paid at restaurant.`);
      setTimeout(() => setSuccess(""), 3000);

      await fetchData();
    } catch (err) {
      console.error("Paid at restaurant error:", err);
      setError(getApiErrorMessage(err, "Failed to mark paid at restaurant."));
    } finally {
      setUpdatingId(null);
    }
  }

  async function transferToBooking(order) {
    if (!isReadyForBilling(order)) {
      setError("Only served or completed orders can be transferred to booking.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const booking = getBookingById(order.booking_id);

    if (!order.booking_id || !order.guest_id || !order.room_id) {
      if (!booking) {
        setError("Booking, guest, and room are required for room bill transfer.");
        setTimeout(() => setError(""), 3000);
        return;
      }
    }

    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: "completed",
        billing_type: "transfer_to_booking",
        payment_status: "unpaid",
        payment_method: "room_bill",
        discount: Number(order.discount || 0),
      });

      setSuccess(`Order #${order.id} transferred to final checkout billing.`);
      setTimeout(() => setSuccess(""), 3000);

      await fetchData();
    } catch (err) {
      console.error("Transfer to booking error:", err);
      setError(getApiErrorMessage(err, "Failed to transfer order to booking."));
    } finally {
      setUpdatingId(null);
    }
  }

  // CSV Report Download Function
  function downloadCSV() {
    if (filteredOrders.length === 0) {
      setError("No billing records available to export for the selected range.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const headers = ["Order ID", "Guest Name", "Room Number", "Items", "Base (INR)", "Tax (INR)", "Total (INR)", "Billing Status", "Payment Status", "Date"];
    const rows = filteredOrders.map(order => {
      const booking = getBookingById(order.booking_id);
      return [
        order.id,
        `"${getGuestName(order.guest_id || booking?.guest_id)}"`,
        getRoomNumber(order.room_id || booking?.room_id),
        `"${getOrderItemsText(order)}"`,
        getOrderBase(order).toFixed(2),
        getOrderTax(order).toFixed(2),
        getOrderAmount(order).toFixed(2),
        getBillingType(order),
        getPaymentStatus(order),
        new Date(order.created_at || Date.now()).toLocaleDateString()
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `restaurant_billing_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="restaurant-billing-page">
      
      {/* --- FLOATING TOAST NOTIFICATIONS --- */}
      {(error || success) && (
        <div className="billing-toast-container">
          {error && <div className="billing-toast error-toast">{error}</div>}
          {success && <div className="billing-toast success-toast">{success}</div>}
        </div>
      )}

      {/* --- SHARED UNIFIED PORTAL HEADER WITH EXPORT ACTION --- */}
      <PortalHeader 
        title="Restaurant Billing"
        kicker="RESTAURANT BILLING"
        description="Settle dine-in restaurant orders or transfer food bills to guest final checkout invoice."
        icon={ReceiptText}
        backPath="/restaurant"
        rightAction={
          <button className="billing-export-btn" onClick={downloadCSV}>
            <Download size={15} /> Export Report
          </button>
        }
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="billing-stats-grid">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Paid at Restaurant"
          value={`₹${stats.paidAtRestaurantAmount.toFixed(2)}`}
          Icon={Wallet}
          colorTheme="green"
        />
        <StatCard
          title="Transfer to Booking"
          value={`₹${stats.transferToBookingAmount.toFixed(2)}`}
          Icon={Send}
          colorTheme="orange"
        />
        <StatCard
          title="Added to Invoice"
          value={stats.addedToInvoiceCount}
          Icon={ReceiptText}
          colorTheme="purple"
        />
      </section>

      {/* --- MODULE SECTION --- */}
      <section className="billing-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Billing Directory"
          description="Settle payments and review active restaurant billing records."
          badgeCount={filteredOrders.length}
          badgeLabel="bills"
        />

        {/* --- TOOLBAR WITH DATE RANGE & FILTERS --- */}
        <div className="billing-toolbar-card">
          <div className="billing-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search order, guest, room, item..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="billing-filters-right-group">
            {/* Date Range Selectors */}
            <div className="billing-date-filter">
              <Calendar size={15} />
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

            <select className="billing-filter" value={billingFilter} onChange={(e) => setBillingFilter(e.target.value)}>
              <option value="need_action">Need Action</option>
              <option value="all">All Orders</option>
              <option value="paid_at_restaurant">Paid at Restaurant</option>
              <option value="transfer_to_booking">Transfer to Booking</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="added_to_invoice">Added to Invoice</option>
            </select>
          </div>
        </div>

        {/* --- TABLE / GRID LAYOUT --- */}
        {loading ? (
          <div className="billing-empty-state">
            <h4>Loading restaurant billing...</h4>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="billing-empty-state">
            <h4>No restaurant bills found</h4>
            <p>Orders matching your date range and filters will appear here.</p>
          </div>
        ) : (
          <div className="billing-table-card">
            {/* HEADER ROW */}
            <div className="billing-grid-header">
              <div className="col-order">ORDER</div>
              <div className="col-guest">GUEST / ROOM</div>
              <div className="col-items">ITEMS</div>
              <div className="col-base">BASE</div>
              <div className="col-tax">TAX</div>
              <div className="col-total">TOTAL</div>
              <div className="col-billing">BILLING</div>
              <div className="col-action">ACTION</div>
            </div>

            {/* DATA ROWS */}
            <div className="billing-grid-body">
              {filteredOrders.map((order) => {
                const booking = getBookingById(order.booking_id);
                const orderType = getOrderType(order);
                const billingType = getBillingType(order);
                const paymentStatus = getPaymentStatus(order);
                const ready = isReadyForBilling(order);
                const addedToInvoice = Boolean(order.is_added_to_invoice);

                return (
                  <div className="billing-grid-row" key={order.id}>
                    {/* ORDER COL */}
                    <div className="col-order">
                      <div className="billing-col-stack">
                        <strong className="order-id-txt">#{order.id}</strong>
                        <span className="billing-type-text">{orderType}</span>
                        <span className={`billing-status ${String(getOrderStatus(order)).toLowerCase()}`}>
                          {getOrderStatus(order)}
                        </span>
                      </div>
                    </div>

                    {/* GUEST/ROOM COL */}
                    <div className="col-guest">
                      <div className="billing-col-stack">
                        <strong><User size={13} /> {getGuestName(order.guest_id || booking?.guest_id)}</strong>
                        <span><BedDouble size={13} /> Room {getRoomNumber(order.room_id || booking?.room_id)}</span>
                      </div>
                    </div>

                    {/* ITEMS COL */}
                    <div className="col-items">
                      <div className="billing-col-stack">
                        <strong>{getOrderItemsText(order)}</strong>
                        <span>Booking #{order.booking_id || "-"}</span>
                      </div>
                    </div>

                    {/* PRICE COLS */}
                    <div className="col-base">₹{getOrderBase(order).toFixed(2)}</div>
                    <div className="col-tax">₹{getOrderTax(order).toFixed(2)}</div>
                    <div className="col-total"><b className="billing-total-amt">₹{getOrderAmount(order).toFixed(2)}</b></div>

                    {/* BILLING STATUS COL */}
                    <div className="col-billing">
                      <div className="billing-col-stack">
                        {addedToInvoice ? (
                          <span className="billing-pill added">ADDED TO INVOICE</span>
                        ) : isPaidAtRestaurant(order) ? (
                          <span className="billing-pill paid">PAID AT RESTAURANT</span>
                        ) : billingType === "transfer_to_booking" || orderType === "room-service" ? (
                          <span className="billing-pill room-bill">FINAL CHECKOUT BILL</span>
                        ) : (
                          <span className="billing-pill waiting">BILLING PENDING</span>
                        )}

                        <span className={`billing-payment ${paymentStatus}`}>
                          {paymentStatus}
                        </span>
                      </div>
                    </div>

                    {/* ACTIONS COL */}
                    <div className="col-action">
                      {!ready ? (
                        <span className="billing-waiting">Waiting for kitchen</span>
                      ) : addedToInvoice ? (
                        <span className="billing-done"><CheckCircle size={15} /> Added to Invoice</span>
                      ) : isPaidAtRestaurant(order) ? (
                        <span className="billing-done"><CheckCircle size={15} /> Paid</span>
                      ) : isTransferredToBooking(order) || orderType === "room-service" ? (
                        <span className="billing-done"><CheckCircle size={15} /> Final Checkout</span>
                      ) : (
                        <div className="billing-actions compact">
                          <select
                            value={paymentMethodMap[order.id] || order.payment_method || ""}
                            onChange={(e) => handlePaymentMethodChange(order.id, e.target.value)}
                          >
                            <option value="">Payment Method</option>
                            {paymentMethods.map((method) => (
                              <option key={method} value={method}>{method}</option>
                            ))}
                          </select>

                          <div className="billing-action-buttons">
                            <button
                              type="button"
                              className="billing-paid-btn"
                              onClick={() => markPaidAtRestaurant(order)}
                              disabled={updatingId === order.id}
                            >
                              <CreditCard size={13} /> PAID
                            </button>

                            <button
                              type="button"
                              className="billing-transfer-btn"
                              onClick={() => transferToBooking(order)}
                              disabled={updatingId === order.id}
                            >
                              <Send size={13} /> ROOM BILL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}