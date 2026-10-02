import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CheckCircle,
  ChefHat,
  ClipboardList,
  Search,
  User,
  Utensils,
  Clock,
  Table2,
  ShoppingBag,
  Printer,
  X,
  RotateCcw,
  Check,
  Flame,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import {
  PortalHeader,
  StatCard,
  ModuleWriternHeader,
} from "@components";
import "./restaurantKitchen.css";

const kitchenTabs = [
  { id: "active", label: "Active Queue" },
  { id: "pending", label: "Pending (New)" },
  { id: "preparing", label: "Preparing (Cooking)" },
  { id: "served", label: "Served / Ready" },
  { id: "completed", label: "Completed (Today)" },
];

export default function RestaurantKitchenPage() {
  const navigate = useNavigate();
  const { user, hotelInfo } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [statusTab, setStatusTab] = useState("active");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [checkedItems, setCheckedItems] = useState({});
  const [viewKotOrder, setViewKotOrder] = useState(null);

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
      return detail.map((item) => `${Array.isArray(item.loc) ? item.loc.join(".") : ""}: ${item.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  }

  function getLoggedInHotelId() {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id || 1;
  }

  function filterByHotel(list) {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) return list;
    const filteredList = list.filter((item) => !item.hotel_id || Number(item.hotel_id) === Number(hotelId));
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

  function getMenuItemById(itemId) {
    return menuItems.find((item) => Number(item.id) === Number(itemId));
  }

  function getMenuItemName(item) {
    return item?.name || item?.item_name || item?.title || "-";
  }

  function getOrderStatus(order) {
    return String(order.order_status || order.status || "pending").toLowerCase();
  }

  function getOrderType(order) {
    return order.order_type || order.type || "dine-in";
  }

  function getOrderTypeLabel(type) {
    if (type === "dine-in") return "Dine-In";
    if (type === "room-service") return "Room Service";
    if (type === "takeaway") return "Takeaway";
    return type || "-";
  }

  function getDietaryBadge(dietaryType) {
    switch (dietaryType) {
      case "non-veg":
        return { icon: "🔴", label: "Non-Veg" };
      case "egg":
        return { icon: "🟡", label: "Egg" };
      case "vegan":
        return { icon: "🌱", label: "Vegan" };
      case "veg":
      default:
        return { icon: "🟢", label: "Veg" };
    }
  }

  // Calculate order wait urgency
  function getOrderUrgency(dateStr) {
    if (!dateStr) return { label: "Just now", level: "normal", mins: 0 };
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMins < 10) {
      return {
        label: diffMins < 1 ? "Just now" : `${diffMins}m ago`,
        level: "normal",
        mins: diffMins,
      };
    } else if (diffMins < 20) {
      return {
        label: `${diffMins}m ago`,
        level: "warning",
        mins: diffMins,
      };
    } else {
      const hours = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;
      const label = hours > 0 ? `${hours}h ${remMins}m ago` : `${diffMins}m ago`;
      return {
        label,
        level: "danger",
        mins: diffMins,
      };
    }
  }

  function getOrderItems(order) {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        menu_item_id: item.menu_item_id || item.item_id,
        portion: item.portion || "full",
        quantity: Number(item.quantity || 1),
        item_name: item.item_name || item.name || "",
      }));
    }
    return [];
  }

  async function fetchData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      setError("");

      const [ordersResponse, menuResponse, bookingsResponse, guestsResponse, roomsResponse] = await Promise.all([
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/restaurant/menu-items").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
      ]);

      const allOrders = filterByHotel(normalizeList(ordersResponse.data, "orders"));

      // Kitchen displays active orders that are not cancelled
      const todayStr = new Date().toISOString().split("T")[0];
      const kitchenOrders = allOrders.filter((order) => {
        const status = getOrderStatus(order);
        if (status === "cancelled") return false;
        // If completed, only include today's completed orders
        if (status === "completed") {
          const orderDate = (order.created_at || "").split("T")[0];
          return orderDate === todayStr;
        }
        return ["pending", "preparing", "served"].includes(status);
      });

      setOrders(kitchenOrders);
      setMenuItems(filterByHotel(normalizeList(menuResponse.data, "menu_items")));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
    } catch (err) {
      console.error("Fetch kitchen display error:", err);
      if (!isSilent) setError(getApiErrorMessage(err, "Failed to load kitchen orders."));
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  // 15-second background auto-polling for high responsiveness
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((order) => getOrderStatus(order) === "pending").length;
    const preparing = orders.filter((order) => getOrderStatus(order) === "preparing").length;
    const served = orders.filter((order) => getOrderStatus(order) === "served").length;
    const completed = orders.filter((order) => getOrderStatus(order) === "completed").length;

    return { total: orders.length, pending, preparing, served, completed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return orders.filter((order) => {
      const booking = getBookingById(order.booking_id);
      const guestName = (order.guest_name || getGuestName(order.guest_id || booking?.guest_id)).toLowerCase();
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id).toLowerCase();
      const tableNumber = String(order.table_number || "").toLowerCase();
      const status = getOrderStatus(order);
      const orderType = getOrderType(order);

      const matchesSearch =
        !search ||
        String(order.id).includes(search) ||
        guestName.includes(search) ||
        roomNumber.includes(search) ||
        tableNumber.includes(search);

      const matchesChannel =
        channelFilter === "all" || orderType === channelFilter;

      let matchesStatus = true;
      if (statusTab === "active") {
        matchesStatus = ["pending", "preparing"].includes(status);
      } else if (statusTab === "pending") {
        matchesStatus = status === "pending";
      } else if (statusTab === "preparing") {
        matchesStatus = status === "preparing";
      } else if (statusTab === "served") {
        matchesStatus = status === "served";
      } else if (statusTab === "completed") {
        matchesStatus = status === "completed";
      }

      return matchesSearch && matchesChannel && matchesStatus;
    });
  }, [orders, bookings, guests, rooms, searchText, channelFilter, statusTab]);

  async function updateOrderStatus(order, nextStatus) {
    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      await api.put(`/restaurant/orders/${order.id}`, { order_status: nextStatus });

      setSuccess(`Order #${order.id} status updated to ${nextStatus.toUpperCase()}.`);
      setTimeout(() => setSuccess(""), 3000);
      await fetchData(true);
    } catch (err) {
      console.error("Update kitchen order error:", err);
      setError(getApiErrorMessage(err, "Failed to update order status."));
    } finally {
      setUpdatingId(null);
    }
  }

  // Toggle strikethrough checkmark on individual dish items
  function toggleItemChecked(orderId, itemIndex) {
    const key = `${orderId}-${itemIndex}`;
    setCheckedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function renderActionButtons(order, status) {
    if (status === "pending") {
      return (
        <button
          type="button"
          className="kit-action-btn kit-btn-preparing"
          onClick={() => updateOrderStatus(order, "preparing")}
          disabled={updatingId === order.id}
        >
          <Utensils size={15} /> Start Preparing
        </button>
      );
    }
    if (status === "preparing") {
      return (
        <div style={{ display: "flex", gap: "6px", width: "100%" }}>
          <button
            type="button"
            className="kit-action-btn kit-btn-prepared"
            onClick={() => updateOrderStatus(order, "served")}
            disabled={updatingId === order.id}
          >
            <CheckCircle size={15} /> Food Ready / Served
          </button>
          <button
            type="button"
            className="kit-btn-revert"
            onClick={() => updateOrderStatus(order, "pending")}
            disabled={updatingId === order.id}
            title="Move back to Pending"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      );
    }
    if (status === "served") {
      return (
        <div style={{ display: "flex", gap: "6px", width: "100%" }}>
          <button
            type="button"
            className="kit-action-btn kit-btn-completed"
            onClick={() => updateOrderStatus(order, "completed")}
            disabled={updatingId === order.id}
          >
            <CheckCircle size={15} /> Mark Completed
          </button>
          <button
            type="button"
            className="kit-btn-revert"
            onClick={() => updateOrderStatus(order, "preparing")}
            disabled={updatingId === order.id}
            title="Move back to Preparing"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      );
    }
    if (status === "completed") {
      return (
        <div className="kit-status-done">
          <CheckCircle size={16} /> Completed
        </div>
      );
    }
    return null;
  }

  return (
    <div className="kit-page">
      {/* TOASTS */}
      {(error || success) && (
        <div className="kit-toast-container">
          {error && <div className="kit-toast kit-error">{error}</div>}
          {success && <div className="kit-toast kit-success">{success}</div>}
        </div>
      )}

      {/* PORTAL HEADER - NO REFRESH BUTTON */}
      <PortalHeader
        title="Kitchen Display System (KDS)"
        kicker="KITCHEN & CULINARY OPERATIONS"
        description="Real-time Kitchen Order Ticket (KOT) workflow: Pending → Preparing → Food Ready / Served."
        icon={ChefHat}
        backPath="/restaurant"
        rightAction={
          <div className="kit-live-badge">
            <span className="kit-live-dot" />
            <span>Live KDS</span>
          </div>
        }
      />

      {/* STATS GRID */}
      <section className="kit-stats-grid">
        <StatCard
          title="Active Tickets"
          value={stats.pending + stats.preparing}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Pending (New KOT)"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="On Stove / Preparing"
          value={stats.preparing}
          Icon={ChefHat}
          colorTheme="purple"
        />
        <StatCard
          title="Ready / Served Today"
          value={stats.served + stats.completed}
          Icon={CheckCircle}
          colorTheme="green"
        />
      </section>

      {/* MODULE SECTION */}
      <section className="kit-modules-section">
        <ModuleWriternHeader
          title="Live Kitchen Queue"
          description="View and transition food preparation statuses in real-time."
          badgeCount={filteredOrders.length}
          badgeLabel="orders"
        />

        {/* TOOLBAR */}
        <div className="kit-toolbar-card">
          <div className="kit-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search ticket #, table, room, or guest..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="kit-filter-strip">
            <div className="kit-filter-tabs">
              {kitchenTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={statusTab === tab.id ? "active" : ""}
                  onClick={() => setStatusTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              className="kit-type-select"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              title="Filter by Order Channel"
            >
              <option value="all">All Channels</option>
              <option value="dine-in">Dine-In Tables</option>
              <option value="room-service">Room Service</option>
              <option value="takeaway">Takeaway Parcels</option>
            </select>
          </div>
        </div>

        {/* ORDERS GRID */}
        {loading && orders.length === 0 ? (
          <div className="kit-empty-state">
            <h4>Loading kitchen orders...</h4>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="kit-empty-state">
            <h4>No active orders in this queue</h4>
            <p>Orders sent from restaurant dining tables or room service will automatically appear here.</p>
          </div>
        ) : (
          <div className="kit-orders-grid">
            {filteredOrders.map((order) => {
              const booking = getBookingById(order.booking_id);
              const status = getOrderStatus(order);
              const orderType = getOrderType(order);
              const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
              const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
              const urgency = getOrderUrgency(order.created_at);

              return (
                <div
                  className={`kit-order-card urgency-${urgency.level}`}
                  key={order.id}
                >
                  {/* CARD HEADER */}
                  <div className="kit-order-top">
                    <div className="kit-order-title">
                      <span className="kit-order-id">#{order.id}</span>
                      <span className={`kit-order-type-chip type-${orderType}`}>
                        {orderType === "dine-in" && <Table2 size={12} />}
                        {orderType === "room-service" && <BedDouble size={12} />}
                        {orderType === "takeaway" && <ShoppingBag size={12} />}
                        {getOrderTypeLabel(orderType)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className={`kit-timer-badge timer-${urgency.level}`}>
                        {urgency.level === "danger" ? <Flame size={12} /> : <Clock size={12} />}
                        {urgency.label}
                      </span>
                      <button
                        type="button"
                        className="kit-btn-print"
                        onClick={() => setViewKotOrder(order)}
                        title="View / Print KOT Slip"
                      >
                        <Printer size={13} />
                      </button>
                    </div>
                  </div>

                  {/* DESTINATION / GUEST INFO */}
                  <div className="kit-guest-info">
                    <div className="kit-dest-label">
                      {orderType === "dine-in" && (
                        <span>
                          <Table2 size={14} style={{ display: "inline", marginRight: "4px" }} />
                          Table: {order.table_number || "Counter"}
                        </span>
                      )}
                      {orderType === "room-service" && (
                        <span>
                          <BedDouble size={14} style={{ display: "inline", marginRight: "4px" }} />
                          Room: {roomNumber}
                        </span>
                      )}
                      {orderType === "takeaway" && (
                        <span>
                          <ShoppingBag size={14} style={{ display: "inline", marginRight: "4px" }} />
                          Takeaway
                        </span>
                      )}
                    </div>

                    <span className="kit-guest-label" title={guestName}>
                      <User size={12} style={{ display: "inline", marginRight: "3px" }} />
                      {guestName}
                    </span>
                  </div>

                  {/* ITEMS LIST WITH INTERACTIVE CHECKLIST */}
                  <div className="kit-items-container">
                    <div className="kit-items-header">
                      <h4>Items to Prepare</h4>
                      <span>Click item to check-off</span>
                    </div>

                    <div className="kit-items-list">
                      {getOrderItems(order).length === 0 ? (
                        <p className="kit-no-items">No items found.</p>
                      ) : (
                        getOrderItems(order).map((orderItem, index) => {
                          const menuItem = getMenuItemById(orderItem.menu_item_id);
                          const name = orderItem.item_name || getMenuItemName(menuItem);
                          const portionTag = orderItem.portion === "half" ? "HALF" : "";
                          const dietary = menuItem?.dietary_type || "veg";
                          const diet = getDietaryBadge(dietary);
                          const isChecked = Boolean(checkedItems[`${order.id}-${index}`]);

                          return (
                            <div
                              className={`kit-item-row ${isChecked ? "is-checked" : ""}`}
                              key={index}
                              onClick={() => toggleItemChecked(order.id, index)}
                              title={isChecked ? "Mark as un-plated" : "Mark as plated"}
                            >
                              <div className="kit-item-content">
                                <span className="kit-check-box">
                                  {isChecked && <Check size={12} />}
                                </span>
                                <span title={diet.label}>{diet.icon}</span>
                                <span className="kit-item-name">{name}</span>
                                {portionTag && (
                                  <span className="kit-portion-tag">{portionTag}</span>
                                )}
                              </div>
                              <strong className="kit-qty-badge">x {orderItem.quantity}</strong>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SPECIAL INSTRUCTIONS */}
                  {order.notes && (
                    <div className="kit-notes-box">
                      <strong>Chef Note:</strong> {order.notes}
                    </div>
                  )}

                  {/* ACTION FOOTER */}
                  <div className="kit-card-footer">
                    {renderActionButtons(order, status)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KOT PRINT MODAL */}
      {viewKotOrder && (
        <div className="kit-modal-overlay" onClick={() => setViewKotOrder(null)}>
          <div className="kit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="kit-modal-header">
              <h3>Kitchen Order Ticket (KOT)</h3>
              <button
                type="button"
                className="kit-btn-revert"
                style={{ padding: "4px" }}
                onClick={() => setViewKotOrder(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="kit-modal-body">
              <div className="kit-kot-slip">
                <div className="kit-kot-header">
                  <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                    {hotelInfo?.name || user?.hotel_name || "HOTEL KITCHEN"}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                    KITCHEN ORDER TICKET (KOT)
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>
                    TICKET #{viewKotOrder.id} • {getOrderTypeLabel(getOrderType(viewKotOrder)).toUpperCase()}
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px" }}>
                    {new Date(viewKotOrder.created_at || Date.now()).toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0", fontSize: "12px", fontWeight: "bold" }}>
                  <span>
                    {getOrderType(viewKotOrder) === "room-service" && `ROOM: ${getRoomNumber(viewKotOrder.room_id || getBookingById(viewKotOrder.booking_id)?.room_id)}`}
                    {getOrderType(viewKotOrder) === "dine-in" && `TABLE: ${viewKotOrder.table_number || "Counter"}`}
                    {getOrderType(viewKotOrder) === "takeaway" && "TAKEAWAY PARCEL"}
                  </span>
                  <span>{viewKotOrder.guest_name || getGuestName(viewKotOrder.guest_id || getBookingById(viewKotOrder.booking_id)?.guest_id)}</span>
                </div>

                <table className="kit-kot-items-table">
                  <thead>
                    <tr>
                      <th>QTY</th>
                      <th>ITEM DESCRIPTION</th>
                      <th style={{ textAlign: "right" }}>PORTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOrderItems(viewKotOrder).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: "bold", width: "40px" }}>{item.quantity} x</td>
                        <td style={{ fontWeight: "600" }}>{item.item_name || getMenuItemName(getMenuItemById(item.menu_item_id))}</td>
                        <td style={{ textAlign: "right", textTransform: "uppercase", fontSize: "11px" }}>{item.portion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {viewKotOrder.notes && (
                  <div style={{ marginTop: "8px", borderTop: "1px dashed #cbd5e1", paddingTop: "6px", fontSize: "11px", color: "#92400e" }}>
                    <strong>SPECIAL INSTRUCTIONS:</strong> {viewKotOrder.notes}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="kit-action-btn kit-btn-preparing"
                  style={{ background: "#475569" }}
                  onClick={() => setViewKotOrder(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="kit-action-btn kit-btn-prepared"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Print Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}