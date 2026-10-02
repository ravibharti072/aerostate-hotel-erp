import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  ClipboardList,
  Edit,
  IndianRupee,
  Plus,
  Search,
  Trash2,
  User,
  X,
  Utensils,
  Download,
  Calendar,
  CheckCircle2,
  Coffee,
  ReceiptText,
  Printer,
  Clock,
  Sparkles,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import {
  PortalHeader,
  StatCard,
  ModuleWriternHeader,
} from "@components";
import "./restaurantRoomService.css";

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

const initialForm = {
  booking_id: "",
  status: "pending",
  notes: "",
  order_date: getTodayDateStr(),
};

const initialItemForm = {
  menu_item_id: "",
  portion: "full",
  quantity: 1,
};

const orderStatuses = ["pending", "preparing", "served", "completed", "cancelled"];

export default function RestaurantRoomServicePage() {
  const navigate = useNavigate();
  const { user, hotelInfo } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Modal & Cancel States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [alertMessage, setAlertMessage] = useState(null);
  const [viewSlipOrder, setViewSlipOrder] = useState(null);

  const [formData, setFormData] = useState(initialForm);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [cartItems, setCartItems] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Search inside modal
  const [bookingSearch, setBookingSearch] = useState("");
  const [isBookingDropdownOpen, setIsBookingDropdownOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  const bookingRef = useRef(null);
  const menuRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      return detail
        .map((item) => `${Array.isArray(item.loc) ? item.loc.join(".") : ""}: ${item.msg}`)
        .join(" | ");
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
    return Number(item?.full_price || item?.price || item?.rate || 0);
  }

  function getMenuItemHalfPrice(item) {
    return Number(item?.half_price || 0);
  }

  function getDietaryBadge(dietaryType) {
    switch (dietaryType) {
      case "non-veg":
        return { icon: "🔴", label: "Non-Veg", color: "#dc2626" };
      case "egg":
        return { icon: "🟡", label: "Egg", color: "#d97706" };
      case "vegan":
        return { icon: "🌱", label: "Vegan", color: "#16a34a" };
      case "veg":
      default:
        return { icon: "🟢", label: "Veg", color: "#16a34a" };
    }
  }

  function getCartItemPrice(cartItem) {
    const menuItem = getMenuItemById(cartItem.menu_item_id);
    if (!menuItem) return 0;
    if (cartItem.portion === "half" && getMenuItemHalfPrice(menuItem) > 0) {
      return getMenuItemHalfPrice(menuItem);
    }
    return getMenuItemFullPrice(menuItem);
  }

  function getOrderStatus(order) {
    return order.order_status || order.status || "pending";
  }

  function getOrderItems(order) {
    if (Array.isArray(order?.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        menu_item_id: item.menu_item_id || item.item_id,
        item_name: item.item_name || "",
        portion: item.portion || "full",
        quantity: Number(item.quantity || 1),
        price: Number(item.price || 0),
        tax_percent: Number(item.tax_percent ?? 5),
        total_amount: Number(item.total || item.total_amount || 0),
      }));
    }
    return [];
  }

  function getOrderAmount(order) {
    const directAmount = Number(order?.total_amount || 0);
    if (directAmount > 0) return directAmount;
    return getOrderItems(order).reduce((sum, orderItem) => {
      const menuItem = getMenuItemById(orderItem.menu_item_id);
      const price =
        orderItem.price ||
        (orderItem.portion === "half" ? getMenuItemHalfPrice(menuItem) : getMenuItemFullPrice(menuItem));
      return sum + price * orderItem.quantity;
    }, 0);
  }

  function getOrderItemNames(order) {
    const items = getOrderItems(order);
    if (items.length === 0) return "-";
    return items
      .map((orderItem) => {
        const menuItem = getMenuItemById(orderItem.menu_item_id);
        const name = orderItem.item_name || getMenuItemName(menuItem);
        const portionTag = orderItem.portion === "half" ? " (Half)" : "";
        return `${name}${portionTag} x ${orderItem.quantity}`;
      })
      .join(", ");
  }

  function getBookingLabel(booking) {
    if (!booking) return "";
    return `#${booking.id} - ${getGuestName(booking.guest_id)} (Room ${getRoomNumber(booking.room_id)})`;
  }

  // Active / checked-in bookings specifically for Room Service
  const checkedInBookings = useMemo(() => {
    return bookings.filter(
      (b) =>
        String(b.status || "").toLowerCase() === "checked_in" ||
        String(b.status || "").toLowerCase() === "confirmed"
    );
  }, [bookings]);

  async function fetchData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      setIsRefreshing(true);
      setError("");

      const [ordersRes, menuRes, bookingsRes, guestsRes, roomsRes] = await Promise.all([
        api.get("/restaurant/orders?order_type=room-service").catch(() => ({ data: [] })),
        api.get("/restaurant/menu-items").catch(() => ({ data: [] })),
        api.get("/bookings/").catch(() => ({ data: [] })),
        api.get("/guests/").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
      ]);

      const allOrders = filterByHotel(normalizeList(ordersRes.data, "orders"));
      setOrders(allOrders.filter((o) => (o.order_type || "room-service") === "room-service"));
      setMenuItems(filterByHotel(normalizeList(menuRes.data, "menu_items")));
      setBookings(filterByHotel(normalizeList(bookingsRes.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsRes.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsRes.data, "rooms")));
      setLastSyncedTime(new Date());
    } catch (err) {
      console.error("Fetch room service error:", err);
      if (!isSilent) {
        setError(getApiErrorMessage(err, "Failed to load room service data."));
      }
    } finally {
      if (!isSilent) setLoading(false);
      setIsRefreshing(false);
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

  const selectedBooking = useMemo(
    () => getBookingById(formData.booking_id),
    [bookings, formData.booking_id]
  );

  const filteredBookingsForDropdown = useMemo(() => {
    const query = bookingSearch.toLowerCase().trim();
    const baseList = checkedInBookings.length > 0 ? checkedInBookings : bookings;
    // Include existing order's booking if editing a past stay
    const listToSearch =
      editingOrder && !baseList.some((b) => Number(b.id) === Number(editingOrder.booking_id))
        ? [...baseList, ...bookings.filter((b) => Number(b.id) === Number(editingOrder.booking_id))]
        : baseList;

    return listToSearch.filter((b) => {
      const label = getBookingLabel(b).toLowerCase();
      return !query || label.includes(query);
    });
  }, [checkedInBookings, bookings, bookingSearch, guests, rooms, editingOrder]);

  const filteredMenuItemsForDropdown = useMemo(() => {
    const query = menuSearch.toLowerCase().trim();
    return menuItems.filter((item) => {
      const name = getMenuItemName(item).toLowerCase();
      const isAvailable = item.is_available !== false;
      return isAvailable && (!query || name.includes(query));
    });
  }, [menuItems, menuSearch]);

  // Dynamic Itemized GST & Total Calculation
  const cartCalculations = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let total = 0;

    cartItems.forEach((cartItem) => {
      const menuItem = getMenuItemById(cartItem.menu_item_id);
      const price = getCartItemPrice(cartItem);
      const qty = Number(cartItem.quantity || 1);
      const lineTotal = price * qty;
      const taxRate =
        menuItem?.tax_percent !== undefined && menuItem?.tax_percent !== null
          ? Number(menuItem.tax_percent)
          : 5.0;
      const lineSubtotal = lineTotal / (1 + taxRate / 100);
      const lineTax = lineTotal - lineSubtotal;

      subtotal += lineSubtotal;
      taxAmount += lineTax;
      total += lineTotal;
    });

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }, [cartItems, menuItems]);

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

  const filteredOrders = useMemo(() => {
    const search = searchText.toLowerCase().trim();

    return orders.filter((order) => {
      if (startDate || endDate) {
        const orderDateObj = new Date(order.created_at || order.date || Date.now());
        const orderDateOnly = orderDateObj.toISOString().split("T")[0];

        if (startDate && orderDateOnly < startDate) return false;
        if (endDate && orderDateOnly > endDate) return false;
      }

      const booking = getBookingById(order.booking_id);
      const guestName = (order.guest_name || getGuestName(order.guest_id || booking?.guest_id)).toLowerCase();
      const roomNumber = getRoomNumber(order.room_id || booking?.room_id).toLowerCase();
      const status = String(getOrderStatus(order)).toLowerCase();

      const matchesSearch =
        !search ||
        String(order.id).includes(search) ||
        guestName.includes(search) ||
        roomNumber.includes(search);
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, bookings, guests, rooms, searchText, statusFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const pending = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "pending").length;
    const preparing = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "preparing").length;
    const served = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "served").length;
    const totalValue = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);

    return { total: filteredOrders.length, pending, preparing, served, totalValue };
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
      order_date: getTodayDateStr(),
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
      setAlertMessage("Completed orders have already been finalized and billed to the room folio.");
      return;
    }

    setEditingOrder(order);
    const existingDate = order.created_at ? order.created_at.split("T")[0] : getTodayDateStr();

    setFormData({
      booking_id: order.booking_id || "",
      status: getOrderStatus(order),
      notes: order.notes || "",
      order_date: existingDate,
    });

    const b = getBookingById(order.booking_id);
    if (b) {
      setBookingSearch(getBookingLabel(b));
    } else {
      setBookingSearch(`Stay #${order.booking_id} - ${order.guest_name || getGuestName(order.guest_id)} (Room ${getRoomNumber(order.room_id)})`);
    }

    setCartItems(
      getOrderItems(order).map((item) => ({
        menu_item_id: Number(item.menu_item_id),
        portion: item.portion || "full",
        quantity: Number(item.quantity || 1),
      }))
    );

    setIsModalOpen(true);
  }

  function addItemToCart() {
    if (!itemForm.menu_item_id) return setError("Please select a menu item.");
    if (Number(itemForm.quantity || 0) <= 0) return setError("Quantity must be greater than 0.");
    setError("");

    setCartItems((prev) => {
      const existingItem = prev.find(
        (item) =>
          Number(item.menu_item_id) === Number(itemForm.menu_item_id) && item.portion === itemForm.portion
      );
      if (existingItem) {
        return prev.map((item) =>
          Number(item.menu_item_id) === Number(itemForm.menu_item_id) && item.portion === itemForm.portion
            ? { ...item, quantity: Number(item.quantity || 0) + Number(itemForm.quantity || 1) }
            : item
        );
      }
      return [
        ...prev,
        {
          menu_item_id: Number(itemForm.menu_item_id),
          portion: itemForm.portion,
          quantity: Number(itemForm.quantity || 1),
        },
      ];
    });
    setItemForm(initialItemForm);
    setMenuSearch("");
  }

  function removeItemFromCart(menuItemId, portion) {
    setCartItems((prev) =>
      prev.filter((item) => !(Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion))
    );
  }

  function updateCartQuantity(menuItemId, portion, quantity) {
    const qty = Number(quantity || 1);
    if (qty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion ? { ...item, quantity: qty } : item
      )
    );
  }

  function buildPayload() {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) throw new Error("Hotel ID missing. Please log in again.");

    const bookingId = selectedBooking?.id || editingOrder?.booking_id || formData.booking_id;
    const guestId = selectedBooking?.guest_id || editingOrder?.guest_id;
    const roomId = selectedBooking?.room_id || editingOrder?.room_id;
    const guestName = selectedBooking
      ? getGuestName(selectedBooking.guest_id)
      : editingOrder?.guest_name || getGuestName(guestId);

    if (!bookingId || !roomId || !guestId) {
      throw new Error("Please select an active checked-in room / stay.");
    }
    if (cartItems.length === 0) {
      throw new Error("Please add at least one menu item to the order.");
    }

    const items = cartItems.map((cartItem) => {
      const menuItem = getMenuItemById(cartItem.menu_item_id);
      const quantity = Number(cartItem.quantity || 1);
      const price =
        cartItem.portion === "half" && getMenuItemHalfPrice(menuItem) > 0
          ? getMenuItemHalfPrice(menuItem)
          : getMenuItemFullPrice(menuItem);

      return {
        menu_item_id: Number(cartItem.menu_item_id),
        portion: cartItem.portion,
        quantity,
        price,
      };
    });

    return {
      hotel_id: Number(hotelId),
      order_type: "room-service",
      table_number: null,
      booking_id: Number(bookingId),
      guest_id: Number(guestId),
      room_id: Number(roomId),
      guest_name: guestName,
      order_status: formData.status || "pending",
      billing_type: "transfer_to_booking",
      payment_method: "room_bill",
      payment_status: "unpaid",
      notes: formData.notes.trim() || null,
      items,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.booking_id && !editingOrder?.booking_id) {
      return setError("Please select an active room.");
    }
    if (cartItems.length === 0) {
      return setError("Please add at least one menu item.");
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = buildPayload();

      if (editingOrder) {
        await api.put(`/restaurant/orders/${editingOrder.id}`, payload);
        setSuccess("Room service order updated successfully.");
      } else {
        await api.post("/restaurant/orders", payload);
        setSuccess("Room service order created & posted to room folio (SAC 996331) successfully.");
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccess(""), 4000);
      await fetchData();
    } catch (err) {
      console.error("Save room service error:", err);
      setError(getApiErrorMessage(err, "Failed to save room service order."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelOrderSubmit(e) {
    e.preventDefault();
    if (!deleteModalOrder) return;
    const reason = deleteReason.trim() || "Cancelled by guest";

    try {
      await api.put(`/restaurant/orders/${deleteModalOrder.id}`, {
        order_status: "cancelled",
        notes: deleteModalOrder.notes
          ? `${deleteModalOrder.notes} | Cancelled: ${reason}`
          : `Cancelled: ${reason}`,
      });

      setSuccess(`Room service order #${deleteModalOrder.id} cancelled & folio charge reversed.`);
      setDeleteModalOrder(null);
      setDeleteReason("");
      setTimeout(() => setSuccess(""), 4000);
      await fetchData();
    } catch (err) {
      console.error("Cancel room service error:", err);
      setError(getApiErrorMessage(err, "Failed to cancel order."));
    }
  }

  async function handleQuickStatusChange(order, nextStatus) {
    if (nextStatus === "cancelled") {
      setDeleteModalOrder(order);
      setDeleteReason("");
      return;
    }

    try {
      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: nextStatus,
      });
      setSuccess(`Order #${order.id} status updated to ${nextStatus.toUpperCase()}.`);
      setTimeout(() => setSuccess(""), 3000);
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, order_status: nextStatus } : o))
      );
    } catch (err) {
      console.error("Status update error:", err);
      setError(getApiErrorMessage(err, "Failed to update order status."));
    }
  }

  function downloadCSV() {
    if (filteredOrders.length === 0) {
      setError("No room service orders available to export for the selected range.");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const headers = [
      "Order ID",
      "Room Number",
      "Guest Name",
      "Stay ID",
      "Status",
      "Items Ordered",
      "Total Amount (INR)",
      "Folio SAC Code",
      "Order Date & Time",
      "Delivery Notes",
    ];

    const rows = filteredOrders.map((order) => {
      const booking = getBookingById(order.booking_id);
      const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
      const roomNum = getRoomNumber(order.room_id || booking?.room_id);
      const orderDate = new Date(order.created_at || Date.now()).toLocaleString("en-IN");

      return [
        order.id,
        `"${roomNum}"`,
        `"${guestName}"`,
        order.booking_id || booking?.id || "-",
        getOrderStatus(order),
        `"${getOrderItemNames(order).replace(/"/g, '""')}"`,
        getOrderAmount(order).toFixed(2),
        "SAC 996331",
        `"${orderDate}"`,
        `"${(order.notes || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const rangeTag = startDate && endDate ? `${startDate}_to_${endDate}` : "all_records";
    link.setAttribute("download", `room_service_orders_${rangeTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="rs-page">
      {/* TOASTS */}
      {(error || success) && (
        <div className="rs-toast-container">
          {error && <div className="rs-toast rs-error">{error}</div>}
          {success && <div className="rs-toast rs-success">{success}</div>}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Room Service (In-Room Dining)"
        kicker="HOTEL & F&B OPERATIONS"
        description="Deliver freshly prepared food and beverages directly to checked-in guest rooms, synced automatically to room folios with SAC 996331."
        icon={Coffee}
        backPath="/restaurant"
        rightAction={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="rs-live-indicator">
              <span className="rs-live-dot" />
              <span>Live Sync</span>
            </div>

            <button type="button" className="rs-export-btn" onClick={downloadCSV}>
              <Download size={15} /> Export CSV
            </button>

            <button type="button" className="rs-primary-btn" onClick={openAddModal}>
              <Plus size={16} /> New Room Service
            </button>
          </div>
        }
      />

      {/* STAT CARDS */}
      <section className="rs-stats-grid">
        <StatCard
          title="Total Deliveries"
          value={stats.total}
          Icon={Coffee}
          colorTheme="blue"
        />
        <StatCard
          title="Kitchen Pending"
          value={stats.pending}
          Icon={ClipboardList}
          colorTheme="orange"
        />
        <StatCard
          title="Being Prepared"
          value={stats.preparing}
          Icon={Utensils}
          colorTheme="purple"
        />
        <StatCard
          title="Total Room Spends"
          value={`₹${stats.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          Icon={IndianRupee}
          colorTheme="green"
        />
      </section>

      {/* MAIN CONTENT SECTION */}
      <section className="rs-modules-section">
        <ModuleWriternHeader
          title="In-Room Dining Orders"
          description="Track active preparation, delivery to guest rooms, and room folio posting."
          badgeCount={filteredOrders.length}
          badgeLabel="orders"
        />

        {/* TOOLBAR */}
        <div className="rs-toolbar-card">
          <div className="rs-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search room number, guest name, or order ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div className="rs-filters-group">
            {/* DATE PRESETS */}
            <div className="rs-preset-strip">
              <button
                type="button"
                className={`rs-preset-chip ${activePreset === "today" ? "active" : ""}`}
                onClick={() => applyDatePreset("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`rs-preset-chip ${activePreset === "last7" ? "active" : ""}`}
                onClick={() => applyDatePreset("last7")}
              >
                Last 7d
              </button>
              <button
                type="button"
                className={`rs-preset-chip ${activePreset === "all" ? "active" : ""}`}
                onClick={() => applyDatePreset("all")}
              >
                All
              </button>
            </div>

            <div className="rs-date-wrap">
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

            <select
              className="rs-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {orderStatuses.map((st) => (
                <option key={st} value={st}>
                  {st.charAt(0).toUpperCase() + st.slice(1)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="rs-secondary-btn"
              onClick={clearFilters}
              title="Reset all search filters and show all deliveries"
            >
              Clear
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div className="rs-table-container">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Order # & Time</th>
                <th>Room & Guest</th>
                <th>Items Ordered</th>
                <th>Delivery Status</th>
                <th>Amount</th>
                <th>Folio Link</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="rs-empty">Loading room service orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="rs-empty">No room service orders found.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const booking = getBookingById(order.booking_id);
                  const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
                  const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
                  const status = String(getOrderStatus(order)).toLowerCase();
                  const isCompleted = status === "completed";
                  const isCancelled = status === "cancelled";
                  const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={order.id} className="rs-row">
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ background: "#fef3c7", color: "#92400e", fontWeight: "bold", padding: "4px 8px", borderRadius: "6px" }}>
                            #{order.id}
                          </div>
                          <div>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>{orderDate}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>
                            <BedDouble size={13} style={{ display: "inline", marginRight: "4px" }} />
                            Room {roomNumber}
                          </span>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            <User size={11} style={{ display: "inline", marginRight: "4px" }} />
                            {guestName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", color: "#334155" }} title={getOrderItemNames(order)}>
                          {getOrderItemNames(order)}
                        </span>
                      </td>

                      <td>
                        <select
                          className={`rs-status-pill ${
                            status === "completed"
                              ? "pill-green"
                              : status === "cancelled"
                              ? "pill-red"
                              : status === "preparing"
                              ? "pill-purple"
                              : status === "served"
                              ? "pill-blue"
                              : "pill-amber"
                          }`}
                          value={status}
                          disabled={isCompleted || isCancelled}
                          onChange={(e) => handleQuickStatusChange(order, e.target.value)}
                          style={{ cursor: "pointer", border: "none", outline: "none" }}
                        >
                          <option value="pending">PENDING</option>
                          <option value="preparing">PREPARING</option>
                          <option value="served">DELIVERED</option>
                          <option value="completed">COMPLETED</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                      </td>

                      <td>
                        <strong style={{ color: "#0f172a" }}>
                          ₹{getOrderAmount(order).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </strong>
                      </td>

                      <td>
                        <span style={{ fontSize: "11px", background: "#f1f5f9", color: "#475569", padding: "3px 8px", borderRadius: "4px", fontWeight: "600" }}>
                          Folio SAC 996331
                        </span>
                      </td>

                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            className="rs-icon-btn"
                            onClick={() => setViewSlipOrder(order)}
                            title="View Room Delivery Ticket / KOT Slip"
                          >
                            <ReceiptText size={15} />
                          </button>
                          <button
                            type="button"
                            className="rs-icon-btn"
                            onClick={() => handleEdit(order)}
                            title="Edit Order"
                            disabled={isCompleted || isCancelled}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            className="rs-icon-btn rs-del-btn"
                            onClick={() => {
                              setDeleteModalOrder(order);
                              setDeleteReason("");
                            }}
                            title="Cancel Order"
                            disabled={isCompleted || isCancelled}
                          >
                            <Trash2 size={14} />
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

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="rs-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="rs-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-header">
              <div>
                <h3>{editingOrder ? `Edit Room Service #${editingOrder.id}` : "New Room Service Order"}</h3>
                <p className="rs-modal-kicker">In-Room Dining • Auto-Charged to Guest Folio (SAC 996331)</p>
              </div>
              <button type="button" className="rs-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="rs-modal-body">
              {/* SELECT CHECKED-IN STAY */}
              <div className="rs-form-group" ref={bookingRef}>
                <label>Select Active In-House Guest / Room *</label>
                <div className="rs-dropdown-wrap">
                  <input
                    type="text"
                    placeholder="Search active guest name or room number..."
                    value={bookingSearch}
                    onChange={(e) => {
                      setBookingSearch(e.target.value);
                      setIsBookingDropdownOpen(true);
                    }}
                    onFocus={() => setIsBookingDropdownOpen(true)}
                    className="rs-input"
                    required
                  />
                  {isBookingDropdownOpen && (
                    <div className="rs-dropdown-list">
                      {filteredBookingsForDropdown.length === 0 ? (
                        <div className="rs-dropdown-empty">No checked-in rooms found</div>
                      ) : (
                        filteredBookingsForDropdown.map((b) => (
                          <div
                            key={b.id}
                            className="rs-dropdown-item"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                booking_id: b.id,
                              }));
                              setBookingSearch(getBookingLabel(b));
                              setIsBookingDropdownOpen(false);
                            }}
                          >
                            <span>
                              <strong>Room {getRoomNumber(b.room_id)}</strong> - {getGuestName(b.guest_id)} (Stay #{b.id})
                            </span>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {String(b.status).toUpperCase()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* MENU SELECTION */}
              <div className="rs-cart-builder">
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "700" }}>Add Food & Beverages</h4>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} ref={menuRef}>
                  <div style={{ flex: 2 }} className="rs-dropdown-wrap">
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Search Menu Item</label>
                    <input
                      type="text"
                      placeholder="Type dish or beverage name..."
                      value={menuSearch}
                      onChange={(e) => {
                        setMenuSearch(e.target.value);
                        setIsMenuDropdownOpen(true);
                      }}
                      onFocus={() => setIsMenuDropdownOpen(true)}
                      className="rs-input"
                    />
                    {isMenuDropdownOpen && (
                      <div className="rs-dropdown-list">
                        {filteredMenuItemsForDropdown.length === 0 ? (
                          <div className="rs-dropdown-empty">No menu items found</div>
                        ) : (
                          filteredMenuItemsForDropdown.map((item) => {
                            const diet = getDietaryBadge(item.dietary_type);
                            return (
                              <div
                                key={item.id}
                                className="rs-dropdown-item"
                                onClick={() => {
                                  setItemForm((p) => ({ ...p, menu_item_id: item.id, portion: "full" }));
                                  setMenuSearch(`${diet.icon} ${getMenuItemName(item)} (₹${getMenuItemFullPrice(item)})`);
                                  setIsMenuDropdownOpen(false);
                                }}
                              >
                                <div>
                                  <span style={{ marginRight: "6px" }}>{diet.icon}</span>
                                  <strong>{getMenuItemName(item)}</strong> - ₹{getMenuItemFullPrice(item)}
                                  {item.half_price ? ` / Half ₹${item.half_price}` : ""}
                                </div>
                                <span style={{ fontSize: "11px", color: "#64748b" }}>{item.category || "Food"}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ width: "120px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Portion</label>
                    {(() => {
                      const selectedItem = getMenuItemById(itemForm.menu_item_id);
                      const hasHalf = Boolean(selectedItem && getMenuItemHalfPrice(selectedItem) > 0);
                      return (
                        <select
                          name="portion"
                          value={hasHalf ? itemForm.portion : "full"}
                          disabled={!hasHalf}
                          onChange={handleItemFormChange}
                          className="rs-input"
                          title={!hasHalf ? "Only Full portion available for this item" : "Select portion"}
                        >
                          <option value="full">Full</option>
                          {hasHalf && <option value="half">Half (₹{getMenuItemHalfPrice(selectedItem)})</option>}
                        </select>
                      );
                    })()}
                  </div>

                  <div style={{ width: "75px" }}>
                    <label style={{ fontSize: "11px", fontWeight: "bold" }}>Qty</label>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      value={itemForm.quantity}
                      onChange={handleItemFormChange}
                      className="rs-input"
                    />
                  </div>

                  <button
                    type="button"
                    className="rs-primary-btn"
                    style={{ height: "40px" }}
                    onClick={addItemToCart}
                  >
                    Add
                  </button>
                </div>

                {/* CART TABLE */}
                {cartItems.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                          <th style={{ padding: "6px 8px" }}>Item</th>
                          <th style={{ padding: "6px 8px" }}>Portion</th>
                          <th style={{ padding: "6px 8px" }}>Qty</th>
                          <th style={{ padding: "6px 8px" }}>Price</th>
                          <th style={{ padding: "6px 8px" }}>Total</th>
                          <th style={{ padding: "6px 8px", width: "30px" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cartItems.map((cartItem) => {
                          const menuItem = getMenuItemById(cartItem.menu_item_id);
                          const price = getCartItemPrice(cartItem);
                          const total = price * Number(cartItem.quantity || 1);
                          const diet = getDietaryBadge(menuItem?.dietary_type);

                          return (
                            <tr key={`${cartItem.menu_item_id}-${cartItem.portion}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "6px 8px", fontWeight: 600 }}>
                                <span style={{ marginRight: "4px" }}>{diet.icon}</span>
                                {getMenuItemName(menuItem)}
                              </td>
                              <td style={{ padding: "6px 8px", textTransform: "capitalize" }}>{cartItem.portion}</td>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="number"
                                  min="1"
                                  value={cartItem.quantity}
                                  onChange={(e) =>
                                    updateCartQuantity(cartItem.menu_item_id, cartItem.portion, e.target.value)
                                  }
                                  style={{ width: "50px", padding: "2px 4px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>₹{price.toFixed(2)}</td>
                              <td style={{ padding: "6px 8px", fontWeight: 600 }}>₹{total.toFixed(2)}</td>
                              <td style={{ padding: "6px 8px" }}>
                                <button
                                  type="button"
                                  onClick={() => removeItemFromCart(cartItem.menu_item_id, cartItem.portion)}
                                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center" }}
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div style={{ marginTop: "10px", textAlign: "right", fontSize: "12px", color: "#475569" }}>
                      <div>Subtotal: <strong>₹{cartCalculations.subtotal.toFixed(2)}</strong></div>
                      <div>Itemized GST: <strong>₹{cartCalculations.taxAmount.toFixed(2)}</strong></div>
                      <div style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a", marginTop: "4px" }}>
                        Billed to Room Folio: ₹{cartCalculations.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SPECIAL DELIVERY NOTES */}
              <div className="rs-form-group" style={{ marginTop: "10px" }}>
                <label>Special Instructions / Diet / Room Delivery Note</label>
                <textarea
                  name="notes"
                  rows="2"
                  placeholder="E.g. Call room before delivery, extra cutlery for 2, warm drinking water"
                  value={formData.notes}
                  onChange={handleFormChange}
                  className="rs-input"
                />
              </div>

              <div className="rs-modal-actions">
                <button
                  type="button"
                  className="rs-secondary-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="rs-primary-btn" disabled={saving}>
                  {saving ? "Saving..." : editingOrder ? "Update Order" : "Place Room Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROOM DELIVERY TICKET / KOT SLIP MODAL */}
      {viewSlipOrder && (
        <div className="rs-modal-overlay" onClick={() => setViewSlipOrder(null)}>
          <div className="rs-modal-content" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Room Delivery Ticket</h3>
                <p className="rs-modal-kicker">Order #{viewSlipOrder.id} • In-Room Dining KOT</p>
              </div>
              <button type="button" className="rs-close-btn" onClick={() => setViewSlipOrder(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="rs-modal-body">
              <div className="rs-slip-paper" id="printable-delivery-slip">
                <div className="rs-slip-header">
                  <div style={{ fontSize: "14px", fontWeight: "bold", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {hotelInfo?.name || user?.hotel_name || "HOTEL IN-ROOM DINING"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    IN-ROOM DINING TICKET
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "11px" }}>
                    <strong>ORDER #{viewSlipOrder.id}</strong> •{" "}
                    {new Date(viewSlipOrder.created_at || Date.now()).toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ margin: "10px 0", padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "bold", color: "#0f172a" }}>
                        ROOM: {getRoomNumber(viewSlipOrder.room_id || getBookingById(viewSlipOrder.booking_id)?.room_id)}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#475569" }}>
                        Guest: {viewSlipOrder.guest_name || getGuestName(viewSlipOrder.guest_id || getBookingById(viewSlipOrder.booking_id)?.guest_id)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span className={`rs-status-pill ${
                        getOrderStatus(viewSlipOrder) === "completed" ? "pill-green" :
                        getOrderStatus(viewSlipOrder) === "cancelled" ? "pill-red" :
                        getOrderStatus(viewSlipOrder) === "preparing" ? "pill-purple" :
                        getOrderStatus(viewSlipOrder) === "served" ? "pill-blue" : "pill-amber"
                      }`}>
                        {String(getOrderStatus(viewSlipOrder)).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {viewSlipOrder.notes && (
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "#b45309", background: "#fef3c7", padding: "4px 8px", borderRadius: "4px" }}>
                      <strong>Note:</strong> {viewSlipOrder.notes}
                    </div>
                  )}
                </div>

                <table className="rs-slip-items">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th style={{ textAlign: "center" }}>PORTION</th>
                      <th style={{ textAlign: "center" }}>QTY</th>
                      <th style={{ textAlign: "right" }}>PRICE</th>
                      <th style={{ textAlign: "right" }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOrderItems(viewSlipOrder).map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.item_name || getMenuItemName(getMenuItemById(item.menu_item_id))}</td>
                        <td style={{ textAlign: "center", textTransform: "capitalize" }}>{item.portion}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>₹{item.price.toFixed(2)}</td>
                        <td style={{ textAlign: "right", fontWeight: "bold" }}>
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="rs-slip-totals">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span>Subtotal:</span>
                    <span>₹{(Number(viewSlipOrder.subtotal) || getOrderAmount(viewSlipOrder) * 0.952).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span>GST (SAC 996331):</span>
                    <span>₹{(Number(viewSlipOrder.tax_amount) || getOrderAmount(viewSlipOrder) * 0.048).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "bold", marginTop: "4px", borderTop: "1px dashed #cbd5e1", paddingTop: "4px" }}>
                    <span>Total Billed to Room:</span>
                    <span>₹{getOrderAmount(viewSlipOrder).toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ marginTop: "12px", fontSize: "10.5px", color: "#64748b", textAlign: "center", fontStyle: "italic" }}>
                  * Amount automatically charged to Room Folio Bill under SAC Code 996331 *
                </div>

                <div className="rs-signature-line">
                  <div>Guest Signature: _______________</div>
                  <div>Delivered By: _______________</div>
                </div>
              </div>

              <div className="rs-modal-actions" style={{ marginTop: "14px" }}>
                <button
                  type="button"
                  className="rs-secondary-btn"
                  onClick={() => setViewSlipOrder(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="rs-primary-btn"
                  onClick={() => window.print()}
                >
                  <Printer size={15} /> Print Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {deleteModalOrder && (
        <div className="rs-modal-overlay" onClick={() => setDeleteModalOrder(null)}>
          <div className="rs-modal-content" style={{ maxWidth: "450px" }} onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-header">
              <h3>Cancel Room Service #{deleteModalOrder.id}</h3>
              <button type="button" className="rs-close-btn" onClick={() => setDeleteModalOrder(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCancelOrderSubmit} className="rs-modal-body">
              <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
                Cancelling this order will stop kitchen preparation and immediately reverse the food & beverage charge on the guest's folio invoice (SAC 996331).
              </p>
              <div className="rs-form-group">
                <label>Reason for Cancellation *</label>
                <input
                  type="text"
                  placeholder="E.g. Guest cancelled order, wrong room specified"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="rs-input"
                  required
                />
              </div>
              <div className="rs-modal-actions">
                <button type="button" className="rs-secondary-btn" onClick={() => setDeleteModalOrder(null)}>
                  Keep Order
                </button>
                <button type="submit" style={{ background: "#dc2626", color: "#fff", padding: "9px 18px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT MODAL */}
      {alertMessage && (
        <div className="rs-modal-overlay" onClick={() => setAlertMessage(null)}>
          <div className="rs-modal-content" style={{ maxWidth: "400px" }} onClick={(e) => e.stopPropagation()}>
            <div className="rs-modal-header">
              <h3>Notice</h3>
              <button type="button" className="rs-close-btn" onClick={() => setAlertMessage(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="rs-modal-body">
              <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>{alertMessage}</p>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button type="button" className="rs-primary-btn" onClick={() => setAlertMessage(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}