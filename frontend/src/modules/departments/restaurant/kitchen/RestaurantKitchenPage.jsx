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
  Clock
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantKitchen.css";

// Kitchen UI tabs
const kitchenStatuses = [
  "all",
  "pending",
  "preparing",
  "prepared",
];

export default function RestaurantKitchenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

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
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
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

  function getOrderItems(order) {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        menu_item_id: item.menu_item_id || item.item_id || item.restaurant_menu_item_id,
        portion: item.portion || "full",
        quantity: Number(item.quantity || item.qty || 1),
        item_name: item.item_name || item.name || "",
      }));
    }

    if (order.menu_item_id || order.item_id || order.restaurant_menu_item_id) {
      return [{
        menu_item_id: order.menu_item_id || order.item_id || order.restaurant_menu_item_id,
        portion: order.portion || "full",
        quantity: Number(order.quantity || order.qty || 1),
        item_name: order.item_name || "",
      }];
    }
    return [];
  }

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, menuResponse, bookingsResponse, guestsResponse, roomsResponse] = await Promise.all([
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/restaurant/menu-items").catch(() => ({ data: [] })),
        api.get("/bookings").catch(() => ({ data: [] })),
        api.get("/guests").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
      ]);

      const allOrders = filterByHotel(normalizeList(ordersResponse.data, "orders"));
      const todayStr = new Date().toDateString();

      // Kitchen sees TODAY'S orders that are not cancelled
      const kitchenOrders = allOrders.filter((order) => {
        const orderDateStr = new Date(order.created_at || Date.now()).toDateString();
        if (orderDateStr !== todayStr) return false;

        const status = getOrderStatus(order);
        // Include completed & served so the kitchen sees them as "Prepared"
        return ["pending", "preparing", "served", "completed"].includes(status);
      });

      setOrders(kitchenOrders);
      setMenuItems(filterByHotel(normalizeList(menuResponse.data, "menu_items")));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
    } catch (err) {
      console.error("Fetch kitchen display error:", err);
      setError(getApiErrorMessage(err, "Failed to load kitchen orders."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((order) => getOrderStatus(order) === "pending").length;
    const preparing = orders.filter((order) => getOrderStatus(order) === "preparing").length;
    // Both served and completed count as "Prepared" for the kitchen's daily stats
    const prepared = orders.filter((order) => ["served", "completed"].includes(getOrderStatus(order))).length;

    return { total: orders.length, pending, preparing, prepared };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase();

    return orders.filter((order) => {
      const booking = getBookingById(order.booking_id);
      const guestName = getGuestName(order.guest_id || booking?.guest_id).toLowerCase();
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id).toLowerCase();
      const status = getOrderStatus(order);

      const matchesSearch = !search || String(order.id).includes(search) || guestName.includes(search) || roomNumber.includes(search);
      
      // Match UI filter tabs with backend statuses
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "prepared" ? ["served", "completed"].includes(status) : status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [orders, bookings, guests, rooms, searchText, statusFilter]);

  async function updateOrderStatus(order, nextStatus) {
    try {
      setUpdatingId(order.id);
      setError("");
      setSuccess("");

      try {
        await api.put(`/restaurant/orders/${order.id}`, { order_status: nextStatus });
      } catch (err1) {
        if (err1.response?.status !== 422) throw err1;
        await api.put(`/restaurant/orders/${order.id}`, { status: nextStatus, order_status: nextStatus });
      }

      setSuccess(`Order #${order.id} status updated.`);
      setTimeout(() => setSuccess(""), 3000);
      await fetchData();
    } catch (err) {
      console.error("Update kitchen order error:", err);
      setError(getApiErrorMessage(err, "Failed to update order status."));
    } finally {
      setUpdatingId(null);
    }
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
          Start Preparing
        </button>
      );
    }
    if (status === "preparing") {
      return (
        <button
          type="button"
          className="kit-action-btn kit-btn-prepared"
          onClick={() => updateOrderStatus(order, "served")} 
          disabled={updatingId === order.id}
        >
          Food Prepared
        </button>
      );
    }
    if (status === "served" || status === "completed") {
      return (
        <div className="kit-status-done">
          <CheckCircle size={16} /> Food Prepared
        </div>
      );
    }
    return null;
  }

  return (
    <div className="kit-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Kitchen Display"
        kicker="KITCHEN OPERATIONS"
        description="Manage today's active order flow: Pending → Preparing → Prepared."
        icon={ChefHat}
        backPath="/restaurant"
      />

      {error && <div className="kit-error-box">{error}</div>}
      {success && <div className="kit-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <section className="kit-stats-grid">
        <StatCard
          title="Today's Orders"
          value={stats.total}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="Preparing"
          value={stats.preparing}
          Icon={ChefHat}
          colorTheme="purple"
        />
        <StatCard
          title="Prepared"
          value={stats.prepared}
          Icon={CheckCircle}
          colorTheme="green"
        />
      </section>

      {/* --- MODULE SECTION --- */}
      <section className="kit-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Active Kitchen Queue"
          description="View and update food preparation statuses in real-time."
          badgeCount={filteredOrders.length}
          badgeLabel="orders"
        />

        {/* TOOLBAR */}
        <div className="kit-toolbar-card">
          <div className="kit-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search order ID, guest, room..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="kit-filter-tabs">
            {kitchenStatuses.map((status) => (
              <button
                key={status}
                type="button"
                className={statusFilter === status ? "active" : ""}
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ORDERS GRID */}
        {loading ? (
          <div className="kit-empty-state"><h4>Loading kitchen orders...</h4></div>
        ) : filteredOrders.length === 0 ? (
          <div className="kit-empty-state">
            <h4>No active kitchen orders</h4>
            <p>Orders sent to the kitchen will automatically appear here.</p>
          </div>
        ) : (
          <div className="kit-orders-grid">
            {filteredOrders.map((order) => {
              const booking = getBookingById(order.booking_id);
              const status = getOrderStatus(order);
              const displayStatus = ["served", "completed"].includes(status) ? "prepared" : status;

              return (
                <div className="kit-order-card" key={order.id}>
                  <div className="kit-order-top">
                    <div className="kit-order-title">
                      <span className="kit-order-id">#{order.id}</span>
                      <h3>{getOrderTypeLabel(getOrderType(order))}</h3>
                    </div>
                    <span className={`kit-status-badge ${displayStatus}`}>
                      {displayStatus}
                    </span>
                  </div>

                  <div className="kit-guest-info">
                    <span><User size={14} /> {getGuestName(order.guest_id || booking?.guest_id)}</span>
                    <span><BedDouble size={14} /> Room {getRoomNumber(order.room_id || booking?.room_id)}</span>
                  </div>

                  <div className="kit-items-container">
                    <h4>Items to Prepare</h4>
                    <div className="kit-items-list">
                      {getOrderItems(order).length === 0 ? (
                        <p className="kit-no-items">No items found.</p>
                      ) : (
                        getOrderItems(order).map((orderItem, index) => {
                          const menuItem = getMenuItemById(orderItem.menu_item_id);
                          const name = orderItem.item_name || getMenuItemName(menuItem);
                          const portionTag = orderItem.portion === "half" ? " (HALF)" : "";

                          return (
                            <div className="kit-item-row" key={index}>
                              <span>
                                <Utensils size={14} className="kit-item-icon" />
                                {name} <strong className="kit-portion-tag">{portionTag}</strong>
                              </span>
                              <strong className="kit-qty-badge">x {orderItem.quantity}</strong>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {order.notes && (
                    <div className="kit-notes-box">
                      <strong>Instructions:</strong> {order.notes}
                    </div>
                  )}

                  <div className="kit-card-footer">
                    {renderActionButtons(order, status)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}