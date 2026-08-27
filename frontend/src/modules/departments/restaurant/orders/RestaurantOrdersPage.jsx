import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  ClipboardList,
  Edit,
  Filter,
  IndianRupee,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  User,
  X,
  Utensils,
  Download,
  Calendar
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantOrders.css";

const GST_PERCENT = 5;

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

const initialForm = {
  booking_id: "",
  status: "pending",
  notes: "",
  order_date: getTodayDateStr(), // Default to today, editable for missing entries
};

const initialItemForm = {
  menu_item_id: "",
  portion: "full",
  quantity: 1,
};

const orderStatuses = ["pending", "preparing", "served", "completed", "cancelled"];

export default function RestaurantOrdersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Modal & Soft Delete States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [alertMessage, setAlertMessage] = useState(null);

  const [formData, setFormData] = useState(initialForm);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [cartItems, setCartItems] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Search States inside Modal
  const [bookingSearch, setBookingSearch] = useState("");
  const [isBookingDropdownOpen, setIsBookingDropdownOpen] = useState(false);

  const [menuSearch, setMenuSearch] = useState("");
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  const bookingRef = useRef(null);
  const menuRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Date Range Filters (Default to Today)
  const todayStr = getTodayDateStr();
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    function handleClickOutside(event) {
      if (bookingRef.current && !bookingRef.current.contains(event.target)) {
        setIsBookingDropdownOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  function getMenuItemFullPrice(item) {
    return Number(item?.full_price || item?.price || item?.rate || item?.selling_price || 0);
  }

  function getMenuItemHalfPrice(item) {
    return Number(item?.half_price || 0);
  }

  function getCartItemPrice(cartItem) {
    const menuItem = getMenuItemById(cartItem.menu_item_id);
    if (!menuItem) return 0;
    if (cartItem.portion === "half" && getMenuItemHalfPrice(menuItem) > 0) {
      return getMenuItemHalfPrice(menuItem);
    }
    return getMenuItemFullPrice(menuItem);
  }

  function getMenuItemAvailable(item) {
    if (typeof item?.is_available === "boolean") return item.is_available;
    if (typeof item?.available === "boolean") return item.available;
    const status = String(item?.status || "").toLowerCase();
    if (status === "unavailable" || status === "inactive") return false;
    return true;
  }

  function getOrderStatus(order) {
    return order.status || order.order_status || "pending";
  }

  function getOrderType(order) {
    return String(order.order_type || order.type || "dine-in").toLowerCase();
  }

  function getOrderItems(order) {
    if (Array.isArray(order?.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        menu_item_id: item.menu_item_id || item.item_id || item.restaurant_menu_item_id,
        portion: item.portion || "full",
        quantity: Number(item.quantity || item.qty || 1),
        price: Number(item.price || item.rate || 0),
        total_amount: Number(item.total_amount || item.amount || 0),
      }));
    }
    if (!order) return [];
    return [{
      menu_item_id: order.menu_item_id || order.item_id || order.restaurant_menu_item_id,
      portion: order.portion || "full",
      quantity: Number(order.quantity || order.qty || 1),
      price: Number(order.price || order.rate || 0),
      total_amount: Number(order.total_amount || order.amount || 0),
    }];
  }

  function getOrderAmount(order) {
    const directAmount = Number(order?.total_amount || order?.order_total || order?.amount || order?.total || 0);
    if (directAmount > 0) return directAmount;
    return getOrderItems(order).reduce((sum, orderItem) => {
      const menuItem = getMenuItemById(orderItem.menu_item_id);
      const price = orderItem.price || (orderItem.portion === "half" ? getMenuItemHalfPrice(menuItem) : getMenuItemFullPrice(menuItem));
      return sum + price * orderItem.quantity;
    }, 0);
  }

  function getOrderItemNames(order) {
    return getOrderItems(order).map((orderItem) => {
        const menuItem = getMenuItemById(orderItem.menu_item_id);
        const portionTag = orderItem.portion === "half" ? " (Half)" : "";
        return `${getMenuItemName(menuItem)}${portionTag} x ${orderItem.quantity}`;
      }).join(", ");
  }

  function getBookingLabel(booking) {
    if (!booking) return "";
    return `#${booking.id} - ${getGuestName(booking.guest_id)} - Room ${getRoomNumber(booking.room_id)}`;
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

      const fetchedOrders = filterByHotel(normalizeList(ordersResponse.data, "orders"));
      
      setOrders(prevOrders => {
        return fetchedOrders.map(newOrder => {
          const existing = prevOrders.find(o => o.id === newOrder.id);
          return {
            ...newOrder,
            isSoftDeleted: existing ? existing.isSoftDeleted : false,
            deleteReason: existing ? existing.deleteReason : "",
            isEdited: existing ? existing.isEdited : false,
          };
        });
      });

      setMenuItems(filterByHotel(normalizeList(menuResponse.data, "menu_items")));
      setBookings(filterByHotel(normalizeList(bookingsResponse.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsResponse.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsResponse.data, "rooms")));
    } catch (err) {
      console.error("Fetch restaurant orders error:", err);
      setError(getApiErrorMessage(err, "Failed to load restaurant orders."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const selectedBooking = useMemo(() => getBookingById(formData.booking_id), [bookings, formData.booking_id]);

  const filteredBookingsForDropdown = useMemo(() => {
    const query = bookingSearch.toLowerCase();
    return bookings.filter(b => {
      const label = getBookingLabel(b).toLowerCase();
      return !query || label.includes(query);
    });
  }, [bookings, bookingSearch, guests, rooms]);

  const filteredMenuItemsForDropdown = useMemo(() => {
    const query = menuSearch.toLowerCase();
    return menuItems.filter(item => {
      if (!getMenuItemAvailable(item)) return false;
      const name = getMenuItemName(item).toLowerCase();
      return !query || name.includes(query);
    });
  }, [menuItems, menuSearch]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, cartItem) => {
      return sum + getCartItemPrice(cartItem) * Number(cartItem.quantity || 1);
    }, 0);
  }, [cartItems, menuItems]);

  const gstBreakup = useMemo(() => {
    const totalAmount = Number(cartTotal || 0);
    const baseAmount = totalAmount / (1 + GST_PERCENT / 100);
    const gstAmount = totalAmount - baseAmount;
    return { baseAmount, gstAmount, totalAmount };
  }, [cartTotal]);

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase();

    return orders.filter((order) => {
      const orderType = getOrderType(order);
      if (orderType.includes("room") || orderType === "room-service") return false;

      if (startDate || endDate) {
        const orderDateObj = new Date(order.created_at || order.date || order.order_date || Date.now());
        const orderDateOnly = orderDateObj.toISOString().split("T")[0];

        if (startDate && orderDateOnly < startDate) return false;
        if (endDate && orderDateOnly > endDate) return false;
      }

      const booking = getBookingById(order.booking_id);
      const guestName = getGuestName(order.guest_id || booking?.guest_id).toLowerCase();
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id).toLowerCase();
      const status = String(getOrderStatus(order)).toLowerCase();

      const matchesSearch = !search || String(order.id).includes(search) || guestName.includes(search) || roomNumber.includes(search);
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, bookings, guests, rooms, searchText, statusFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const pending = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "pending").length;
    const preparing = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "preparing").length;
    const totalValue = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);

    return { total: filteredOrders.length, pending, preparing, totalValue };
  }, [filteredOrders]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleItemFormChange(e) {
    const { name, value } = e.target;
    setItemForm((prev) => ({ ...prev, [name]: value }));
  }

  function openAddModal() {
    setFormData({
      ...initialForm,
      order_date: getTodayDateStr(), // Reset to today on new entry
    });
    setItemForm(initialItemForm);
    setCartItems([]);
    setEditingOrder(null);
    setBookingSearch("");
    setMenuSearch("");
    setError("");
    setIsModalOpen(true);
  }

  function handleEdit(order) {
    if (String(getOrderStatus(order)).toLowerCase() === "completed") {
      setAlertMessage("Completed orders cannot be modified.");
      return;
    }

    setEditingOrder(order);
    setError("");
    setSuccess("");

    const existingDate = order.created_at ? order.created_at.split("T")[0] : getTodayDateStr();

    setFormData({
      booking_id: order.booking_id || "",
      status: getOrderStatus(order),
      notes: order.notes || "",
      order_date: existingDate,
    });

    const b = getBookingById(order.booking_id);
    if (b) setBookingSearch(getBookingLabel(b));

    setCartItems(getOrderItems(order).map((item) => ({
      menu_item_id: Number(item.menu_item_id),
      portion: item.portion || "full",
      quantity: Number(item.quantity || 1),
    })));

    setIsModalOpen(true);
  }

  function addItemToCart() {
    if (!itemForm.menu_item_id) return setError("Please select a menu item.");
    if (Number(itemForm.quantity || 0) <= 0) return setError("Quantity must be greater than 0.");
    setError("");

    setCartItems((prev) => {
      const existingItem = prev.find((item) => Number(item.menu_item_id) === Number(itemForm.menu_item_id) && item.portion === itemForm.portion);
      if (existingItem) {
        return prev.map((item) => Number(item.menu_item_id) === Number(itemForm.menu_item_id) && item.portion === itemForm.portion
            ? { ...item, quantity: Number(item.quantity || 0) + Number(itemForm.quantity || 1) } : item
        );
      }
      return [...prev, { menu_item_id: Number(itemForm.menu_item_id), portion: itemForm.portion, quantity: Number(itemForm.quantity || 1) }];
    });
    setItemForm(initialItemForm);
    setMenuSearch("");
  }

  function removeItemFromCart(menuItemId, portion) {
    setCartItems((prev) => prev.filter((item) => !(Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion)));
  }

  function updateCartQuantity(menuItemId, portion, quantity) {
    const qty = Number(quantity || 1);
    if (qty <= 0) return;
    setCartItems((prev) => prev.map((item) => Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion ? { ...item, quantity: qty } : item));
  }

  function resetForm() {
    setFormData(initialForm);
    setItemForm(initialItemForm);
    setCartItems([]);
    setEditingOrder(null);
    setBookingSearch("");
    setMenuSearch("");
    setError("");
  }

  function buildPayload() {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) throw new Error("Hotel ID not found. Please logout and login again.");
    if (!selectedBooking) throw new Error("Please select a valid booking.");
    if (cartItems.length === 0) throw new Error("Please add at least one menu item.");

    const items = cartItems.map((cartItem) => {
      const menuItem = getMenuItemById(cartItem.menu_item_id);
      const quantity = Number(cartItem.quantity || 1);
      const price = cartItem.portion === "half" && getMenuItemHalfPrice(menuItem) > 0 ? getMenuItemHalfPrice(menuItem) : getMenuItemFullPrice(menuItem);
      const totalAmount = price * quantity;
      const baseAmount = totalAmount / (1 + GST_PERCENT / 100);
      const gstAmount = totalAmount - baseAmount;

      return {
        menu_item_id: Number(cartItem.menu_item_id),
        item_id: Number(cartItem.menu_item_id),
        portion: cartItem.portion,
        quantity,
        qty: quantity,
        price,
        rate: price,
        base_amount: Number(baseAmount.toFixed(2)),
        gst_percent: GST_PERCENT,
        gst_amount: Number(gstAmount.toFixed(2)),
        amount: Number(totalAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
      };
    });

    return {
      hotel_id: Number(hotelId),
      booking_id: Number(formData.booking_id),
      guest_id: Number(selectedBooking.guest_id),
      room_id: Number(selectedBooking.room_id),

      order_type: "dine-in",
      billing_type: "pending_billing",
      payment_status: "unpaid",
      payment_method: null,
      items,

      base_amount: Number(gstBreakup.baseAmount.toFixed(2)),
      gst_percent: GST_PERCENT,
      gst_amount: Number(gstBreakup.gstAmount.toFixed(2)),
      amount: Number(gstBreakup.totalAmount.toFixed(2)),
      total_amount: Number(gstBreakup.totalAmount.toFixed(2)),
      order_total: Number(gstBreakup.totalAmount.toFixed(2)),

      status: formData.status || "pending",
      order_status: formData.status || "pending",
      notes: formData.notes.trim(),
      created_at: new Date(formData.order_date).toISOString(), // Include selected entry date
    };
  }

  async function saveWithFallback(payload, orderId = null) {
    const request = (data) => orderId ? api.put(`/restaurant/orders/${orderId}`, data) : api.post("/restaurant/orders", data);
    try {
      return await request(payload);
    } catch (err1) {
      if (err1.response?.status !== 422) throw err1;
      try {
        return await request({
          hotel_id: payload.hotel_id, booking_id: payload.booking_id, guest_id: payload.guest_id, room_id: payload.room_id,
          order_type: payload.order_type, items: payload.items, status: payload.status, notes: payload.notes, created_at: payload.created_at,
        });
      } catch (err2) {
        if (err2.response?.status !== 422) throw err2;
        return await request({
          hotel_id: payload.hotel_id, booking_id: payload.booking_id, order_type: payload.order_type,
          items: payload.items.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity })),
          status: payload.status, notes: payload.notes, created_at: payload.created_at,
        });
      }
    }
  }

  function checkItemsChanged(originalOrder, currentCart) {
    if (!originalOrder) return false;
    
    const oldItems = getOrderItems(originalOrder).map(i => ({
      id: Number(i.menu_item_id),
      p: i.portion || "full",
      q: Number(i.quantity)
    })).sort((a, b) => a.id - b.id || a.p.localeCompare(b.p));

    const newItems = currentCart.map(i => ({
      id: Number(i.menu_item_id),
      p: i.portion || "full",
      q: Number(i.quantity)
    })).sort((a, b) => a.id - b.id || a.p.localeCompare(b.p));

    return JSON.stringify(oldItems) !== JSON.stringify(newItems);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.booking_id) return setError("Please select booking.");
    if (cartItems.length === 0) return setError("Please add at least one menu item.");

    const itemsDidChange = editingOrder ? checkItemsChanged(editingOrder, cartItems) : false;
    const finalIsEdited = editingOrder ? (editingOrder.isEdited || itemsDidChange) : false;

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = buildPayload();

      if (editingOrder) {
        await saveWithFallback(payload, editingOrder.id);
        setSuccess("Order updated successfully.");
      } else {
        await saveWithFallback(payload);
        setSuccess("Restaurant order created successfully.");
      }

      setTimeout(() => setSuccess(""), 3000);
      setIsModalOpen(false);
      resetForm();
      await fetchData();

      if (editingOrder) {
        setOrders(prev => prev.map(o => o.id === editingOrder.id ? { ...o, isEdited: finalIsEdited } : o));
      }
    } catch (err) {
      console.error("Save restaurant order error:", err);
      setError(getApiErrorMessage(err, "Failed to save restaurant order."));
    } finally {
      setSaving(false);
    }
  }

  const handleSoftDeleteSubmit = (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) return;

    setOrders(prev => prev.map(o => {
      if (o.id === deleteModalOrder.id) {
        return {
          ...o,
          isSoftDeleted: true,
          deleteReason: deleteReason.trim(),
          status: "cancelled"
        };
      }
      return o;
    }));

    setDeleteModalOrder(null);
    setDeleteReason("");
  };

  // CSV Report Download Function
  function downloadCSV() {
    if (filteredOrders.length === 0) {
      setError("No orders available to export for the selected range.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const headers = ["Order ID", "Guest Name", "Room Number", "Status", "Items", "Total Amount (INR)", "Date"];
    const rows = filteredOrders.map(order => {
      const booking = getBookingById(order.booking_id);
      return [
        order.id,
        `"${getGuestName(order.guest_id || booking?.guest_id)}"`,
        getRoomNumber(order.room_id || booking?.room_id),
        getOrderStatus(order),
        `"${getOrderItemNames(order)}"`,
        getOrderAmount(order).toFixed(2),
        new Date(order.created_at || order.date || Date.now()).toLocaleDateString()
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `restaurant_orders_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="orders-page">
      {/* SHARED UNIFIED PORTAL HEADER WITH ACTIONS */}
      <PortalHeader 
        title="Restaurant Orders & History"
        kicker="RESTAURANT MANAGEMENT"
        description="Manage live restaurant orders, select custom date ranges, and export CSV reports."
        icon={ShoppingBag}
        backPath="/restaurant"
        rightAction={
          <div className="orders-header-actions">
            <button className="orders-export-btn" onClick={downloadCSV}>
              <Download size={15} /> Export Report
            </button>
            <button className="orders-add-btn" onClick={openAddModal}>
              <Plus size={16} /> Create Order
            </button>
          </div>
        }
      />

      {error && <div className="orders-error-box">{error}</div>}
      {success && <div className="orders-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <section className="orders-stats-grid">
        <StatCard
          title="Filtered Orders"
          value={stats.total}
          Icon={ShoppingBag}
          colorTheme="blue"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          Icon={ClipboardList}
          colorTheme="orange"
        />
        <StatCard
          title="Preparing"
          value={stats.preparing}
          Icon={Utensils}
          colorTheme="purple"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${stats.totalValue.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="green"
        />
      </section>

      {/* --- MODULE SECTION (Header + Toolbar + Grid) --- */}
      <section className="orders-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Orders Directory"
          description="Track, update, and export your restaurant guest orders."
          badgeCount={filteredOrders.length}
          badgeLabel="orders"
        />

        {/* TOOLBAR */}
        <div className="orders-toolbar-card">
          <div className="orders-search-box">
            <Search size={16}/>
            <input placeholder="Search ID, guest, or room..." value={searchText} onChange={e => setSearchText(e.target.value)}/>
          </div>

          <div className="orders-filters-right-group">
            {/* Date Range Selectors */}
            <div className="orders-date-filter">
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

            <div className="orders-filter-box">
              <Filter size={16}/>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                {orderStatuses.map((status) => (
                  <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ITEM CARDS GRID */}
        <div className="orders-cards-section">
          {loading ? (
            <div className="orders-empty">Loading orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-empty">No restaurant orders found for the selected date range.</div>
          ) : (
            <div className="orders-cards-grid">
              {filteredOrders.map(order => {
                const booking = getBookingById(order.booking_id);
                const isCompleted = String(getOrderStatus(order)).toLowerCase() === "completed";
                let cardClass = "";
                if (order.isSoftDeleted) cardClass = "orders-card-deleted";
                else if (order.isEdited) cardClass = "orders-card-edited";

                const orderDateFormatted = new Date(order.created_at || order.date || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' });

                return (
                  <div key={order.id} className={`orders-item-card ${cardClass}`}>
                    <div className="orders-item-header">
                      <span className="orders-id-pill">#{order.id} ({orderDateFormatted})</span>
                      <span className={`orders-status ${String(getOrderStatus(order)).toLowerCase()}`}>
                        {getOrderStatus(order)}
                      </span>
                    </div>
                    
                    <div className="orders-guest-meta">
                      <strong><User size={13} /> {getGuestName(order.guest_id || booking?.guest_id)}</strong>
                      <span><BedDouble size={13} /> Room {getRoomNumber(order.room_id || booking?.room_id)}</span>
                    </div>

                    <p className="orders-item-desc">{getOrderItemNames(order)}</p>
                    
                    {order.isSoftDeleted && <div className="orders-delete-reason">Reason: {order.deleteReason}</div>}
                    {order.isEdited && <div className="orders-edit-badge">Edited</div>}
                    
                    <div className="orders-item-footer">
                      <span className="orders-item-price">₹{getOrderAmount(order).toFixed(2)}</span>
                      
                      <div className="orders-action-btns">
                        <button 
                          className={`orders-action-btn edit ${isCompleted ? 'disabled-btn' : ''}`} 
                          title={isCompleted ? "Completed orders cannot be edited" : "Edit Order"} 
                          onClick={() => handleEdit(order)}
                        >
                          <Edit size={14} />
                        </button>
                        <button className="orders-action-btn delete" title="Delete / Flag Order" onClick={() => {
                          setDeleteModalOrder(order);
                          setDeleteReason("");
                        }} disabled={order.isSoftDeleted}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ADD/EDIT MODAL WITH DATE SELECTOR */}
      {isModalOpen && (
        <div className="orders-modal-backdrop">
          <div className="orders-modal form-modal">
            <div className="orders-modal-header">
              <h3>{editingOrder ? "Edit Order" : "Create Order"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18}/></button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="orders-form-row">
                <div className="orders-form-group" ref={bookingRef}>
                  <label>Booking *</label>
                  <div className="orders-searchable-select">
                    <input
                      type="text"
                      placeholder="Type to search booking (ID, guest, room)..."
                      value={bookingSearch}
                      onChange={(e) => {
                        setBookingSearch(e.target.value);
                        setIsBookingDropdownOpen(true);
                      }}
                      onFocus={() => setIsBookingDropdownOpen(true)}
                    />
                    {isBookingDropdownOpen && (
                      <div className="orders-dropdown-list">
                        {filteredBookingsForDropdown.length === 0 ? (
                          <div className="orders-dropdown-item empty">No matching bookings</div>
                        ) : (
                          filteredBookingsForDropdown.map((booking) => (
                            <div
                              key={booking.id}
                              className="orders-dropdown-item"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, booking_id: booking.id }));
                                setBookingSearch(getBookingLabel(booking));
                                setIsBookingDropdownOpen(false);
                              }}
                            >
                              {getBookingLabel(booking)}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="orders-form-group">
                  <label>Entry Date *</label>
                  <input
                    type="date"
                    name="order_date"
                    value={formData.order_date}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>

              {selectedBooking && (
                <div className="orders-booking-preview orders-full-width">
                  <div><span>Guest:</span> <strong>{getGuestName(selectedBooking.guest_id)}</strong></div>
                  <div><span>Room:</span> <strong>Room {getRoomNumber(selectedBooking.room_id)}</strong></div>
                </div>
              )}

              <div className="orders-form-row">
                <div className="orders-form-group" ref={menuRef}>
                  <label>Menu Item</label>
                  <input
                    type="text"
                    placeholder="Type to search menu item..."
                    value={menuSearch}
                    onChange={(e) => {
                      setMenuSearch(e.target.value);
                      setIsMenuDropdownOpen(true);
                    }}
                    onFocus={() => setIsMenuDropdownOpen(true)}
                  />
                  {isMenuDropdownOpen && (
                    <div className="orders-dropdown-list">
                      {filteredMenuItemsForDropdown.length === 0 ? (
                        <div className="orders-dropdown-item empty">No matching items</div>
                      ) : (
                        filteredMenuItemsForDropdown.map((item) => (
                          <div
                            key={item.id}
                            className="orders-dropdown-item"
                            onClick={() => {
                              setItemForm(prev => ({ ...prev, menu_item_id: item.id }));
                              setMenuSearch(getMenuItemName(item));
                              setIsMenuDropdownOpen(false);
                            }}
                          >
                            {getMenuItemName(item)} — Full: ₹{getMenuItemFullPrice(item)} {getMenuItemHalfPrice(item) > 0 ? `| Half: ₹${getMenuItemHalfPrice(item)}` : ""}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="orders-form-group">
                  <label>Portion</label>
                  <select name="portion" value={itemForm.portion} onChange={handleItemFormChange}>
                    <option value="full">Full Portion</option>
                    <option value="half">Half Portion</option>
                  </select>
                </div>
              </div>

              <div className="orders-form-row">
                <div className="orders-form-group">
                  <label>Quantity</label>
                  <input type="number" name="quantity" min="1" value={itemForm.quantity} onChange={handleItemFormChange} />
                </div>
                <div className="orders-form-group" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="orders-add-cart-btn" onClick={addItemToCart}>
                    <Plus size={16} /> Add Item
                  </button>
                </div>
              </div>

              <div className="orders-cart-box">
                <h4>Cart Items</h4>
                {cartItems.length === 0 ? (
                  <p className="orders-cart-empty">No items added yet.</p>
                ) : (
                  <div className="orders-cart-list">
                    {cartItems.map((cartItem) => {
                      const menuItem = getMenuItemById(cartItem.menu_item_id);
                      const price = getCartItemPrice(cartItem);
                      const itemTotal = price * Number(cartItem.quantity || 1);

                      return (
                        <div className="orders-cart-row" key={`${cartItem.menu_item_id}-${cartItem.portion}`}>
                          <div className="orders-cart-info">
                            <strong>{getMenuItemName(menuItem)}</strong>
                            <span>₹{price.toFixed(2)} each ({cartItem.portion.toUpperCase()})</span>
                          </div>
                          <input 
                            type="number" 
                            min="1" 
                            value={cartItem.quantity} 
                            onChange={(e) => updateCartQuantity(cartItem.menu_item_id, cartItem.portion, e.target.value)} 
                          />
                          <b>₹{itemTotal.toFixed(2)}</b>
                          <button type="button" className="orders-remove-btn" onClick={() => removeItemFromCart(cartItem.menu_item_id, cartItem.portion)}><X size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="orders-form-row">
                <div className="orders-form-group">
                  <label>Status *</label>
                  <select name="status" value={formData.status} onChange={handleFormChange} required>
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="orders-total-summary">
                  <span>Total (Inc. GST)</span>
                  <strong>₹{gstBreakup.totalAmount.toFixed(2)}</strong>
                </div>
              </div>

              <div className="orders-form-group">
                <label>Notes</label>
                <textarea name="notes" placeholder="Optional instructions..." rows="2" value={formData.notes} onChange={handleFormChange} />
              </div>

              <div className="orders-modal-actions">
                <button type="button" className="orders-btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="orders-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingOrder ? "Update Order" : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT MODAL */}
      {alertMessage && (
        <div className="orders-modal-backdrop">
          <div className="orders-modal alert-modal">
            <div className="orders-modal-header">
              <h3>Notice</h3>
              <button onClick={() => setAlertMessage(null)}><X size={18}/></button>
            </div>
            <p className="orders-modal-desc">{alertMessage}</p>
            <div className="orders-modal-actions">
              <button type="button" className="orders-btn-primary" onClick={() => setAlertMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* SOFT DELETE MODAL */}
      {deleteModalOrder && (
        <div className="orders-modal-backdrop">
          <div className="orders-modal">
            <div className="orders-modal-header">
              <h3>Reason for Cancellation</h3>
              <button onClick={() => setDeleteModalOrder(null)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSoftDeleteSubmit}>
              <p className="orders-modal-desc">This order will not be deleted but flagged in red with your specific reason.</p>
              <textarea 
                rows="3" 
                placeholder="Enter detailed reason here..." 
                value={deleteReason} 
                onChange={(e) => setDeleteReason(e.target.value)}
                required
                className="orders-full-width-textarea"
              />
              <div className="orders-modal-actions">
                <button type="button" className="orders-btn-secondary" onClick={() => setDeleteModalOrder(null)}>Cancel</button>
                <button type="submit" className="orders-btn-danger">Flag & Cancel Order</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}