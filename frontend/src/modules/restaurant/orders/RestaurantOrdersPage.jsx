import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  ClipboardList,
  Utensils,
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  X,
  User,
  Users,
  Hotel,
  BedDouble,
  Calendar,
  Save,
  CheckCircle2,
  Coffee,
  Table2,
  ReceiptText,
  Eye,
  Printer,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import PlaceRestaurantOrderModal from "../components/PlaceRestaurantOrderModal";
import "./restaurantOrders.css";

const getTodayDateStr = () => new Date().toISOString().split("T")[0];

const initialForm = {
  order_type: "dine-in",
  table_number: "",
  custom_table: "",
  guest_type: "outside",
  booking_id: "",
  guest_name: "",
  guest_phone: "",
  status: "pending",
  billing_type: "pending_billing",
  payment_method: "",
  notes: "",
  order_date: getTodayDateStr(),
};

const initialItemForm = {
  menu_item_id: "",
  portion: "full",
  quantity: 1,
};

const orderStatuses = ["pending", "preparing", "served", "completed", "cancelled"];

export default function RestaurantOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, hotelInfo } = useAuth();

  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [guests, setGuests] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tables, setTables] = useState([]);
  const [inHouseGuests, setInHouseGuests] = useState([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewKotOrder, setViewKotOrder] = useState(null);
  const [deleteModalOrder, setDeleteModalOrder] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [alertMessage, setAlertMessage] = useState(null);

  const [formData, setFormData] = useState(initialForm);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [cartItems, setCartItems] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  // Dropdowns inside modal
  const [bookingSearch, setBookingSearch] = useState("");
  const [isBookingDropdownOpen, setIsBookingDropdownOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);

  const bookingRef = useRef(null);
  const menuRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [toast, setToast] = useState(null);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [datePreset, setDatePreset] = useState("today");
  const [startDate, setStartDate] = useState(getTodayDateStr());
  const [endDate, setEndDate] = useState(getTodayDateStr());

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  useEffect(() => {
    const tableParam = searchParams.get("table");
    const newOrderParam = searchParams.get("newOrder");
    const searchParam = searchParams.get("search");

    if (searchParam) {
      setSearchText(searchParam);
      setDatePreset("all");
      setStartDate("");
      setEndDate("");
    }

    if (newOrderParam || tableParam) {
      setFormData((prev) => ({
        ...prev,
        order_type: "dine-in",
        table_number: tableParam || prev.table_number,
      }));
      setIsModalOpen(true);
    }
  }, [searchParams]);

  function normalizeList(data, key) {
    if (!data) return [];
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

  function getDietaryIcon(item) {
    const dietary = item?.dietary_type || "veg";
    if (dietary === "non-veg") return "🔴";
    if (dietary === "egg") return "🟡";
    if (dietary === "vegan") return "🌱";
    return "🟢";
  }

  async function fetchData(isBackground = false) {
    try {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);

      const [ordersRes, menuRes, bookingsRes, guestsRes, roomsRes, tablesRes, inHouseRes] = await Promise.all([
        api.get("/restaurant/orders").catch(() => ({ data: [] })),
        api.get("/restaurant/menu-items").catch(() => ({ data: [] })),
        api.get("/bookings/").catch(() => ({ data: [] })),
        api.get("/guests/").catch(() => ({ data: [] })),
        api.get("/rooms").catch(() => ({ data: [] })),
        api.get("/restaurant/tables").catch(() => ({ data: [] })),
        api.get("/restaurant/in-house-guests").catch(() => ({ data: [] })),
      ]);

      setOrders(filterByHotel(normalizeList(ordersRes.data, "orders")));
      setMenuItems(filterByHotel(normalizeList(menuRes.data, "menu_items")));
      setBookings(filterByHotel(normalizeList(bookingsRes.data, "bookings")));
      setGuests(filterByHotel(normalizeList(guestsRes.data, "guests")));
      setRooms(filterByHotel(normalizeList(roomsRes.data, "rooms")));
      setTables(filterByHotel(normalizeList(tablesRes.data, "tables")));
      setInHouseGuests(filterByHotel(normalizeList(inHouseRes.data, "guests")));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Fetch orders error:", err);
      if (!isBackground) showToast(getApiErrorMessage(err, "Failed to load orders."), "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
    // Real-time polling every 30s
    const pollInterval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(pollInterval);
  }, []);

  const selectedBooking = useMemo(() => {
    if (!formData.booking_id) return null;
    const inHouse = inHouseGuests.find((g) => Number(g.booking_id) === Number(formData.booking_id));
    if (inHouse) return inHouse;
    return getBookingById(formData.booking_id);
  }, [inHouseGuests, bookings, formData.booking_id]);

  const filteredBookingsForDropdown = useMemo(() => {
    const query = bookingSearch.toLowerCase().trim();
    if (inHouseGuests && inHouseGuests.length > 0) {
      return inHouseGuests.filter((g) => {
        const name = String(g.guest_name || "").toLowerCase();
        const room = String(g.room_number || "").toLowerCase();
        const id = String(g.booking_id || "");
        return !query || name.includes(query) || room.includes(query) || id.includes(query);
      });
    }

    // Fallback: strictly checked-in stays
    const checkedInOnly = bookings.filter((b) => {
      const s = String(b.status || "").toLowerCase();
      return s === "checked-in" || s === "checked_in";
    });

    return checkedInOnly.filter((b) => {
      const label = getBookingLabel(b).toLowerCase();
      return !query || label.includes(query);
    });
  }, [inHouseGuests, bookings, bookingSearch, guests, rooms]);

  const filteredMenuItemsForDropdown = useMemo(() => {
    const query = menuSearch.toLowerCase();
    return menuItems.filter((item) => {
      const name = getMenuItemName(item).toLowerCase();
      const category = (item?.category || "").toLowerCase();
      const isAvailable = item.is_available !== false;
      return isAvailable && (!query || name.includes(query) || category.includes(query));
    });
  }, [menuItems, menuSearch]);

  // Accurate Cart Subtotal & GST Calculation based on per-item tax
  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;
    let total = 0;

    cartItems.forEach((cartItem) => {
      const menuItem = getMenuItemById(cartItem.menu_item_id);
      const unitPrice = getCartItemPrice(cartItem);
      const qty = Number(cartItem.quantity || 1);
      const itemTotal = unitPrice * qty;
      const taxPercent = menuItem?.tax_percent !== undefined && menuItem?.tax_percent !== null ? Number(menuItem.tax_percent) : 5.0;
      const itemSubtotal = itemTotal / (1 + taxPercent / 100);
      const itemTax = itemTotal - itemSubtotal;

      subtotal += itemSubtotal;
      taxAmount += itemTax;
      total += itemTotal;
    });

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  }, [cartItems, menuItems]);

  // Date Preset Switcher
  function applyDatePreset(preset) {
    setDatePreset(preset);
    const today = getTodayDateStr();
    if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split("T")[0]);
      setEndDate(today);
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
      const tableNumber = String(order.table_number || "").toLowerCase();
      const status = String(getOrderStatus(order)).toLowerCase();
      const orderType = String(order.order_type || "dine-in").toLowerCase();

      const matchesSearch =
        !search ||
        String(order.id).includes(search) ||
        guestName.includes(search) ||
        roomNumber.includes(search) ||
        tableNumber.includes(search);
      const matchesStatus = statusFilter === "all" || status === statusFilter.toLowerCase();
      const matchesType = typeFilter === "all" || orderType === typeFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [orders, bookings, guests, rooms, searchText, statusFilter, typeFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const pending = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "pending").length;
    const preparing = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "preparing").length;
    const served = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "served").length;
    const completed = filteredOrders.filter((order) => String(getOrderStatus(order)).toLowerCase() === "completed").length;
    const totalValue = filteredOrders.reduce((sum, order) => sum + getOrderAmount(order), 0);

    return { total: filteredOrders.length, pending, preparing, served, completed, totalValue };
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
      guest_type: "outside",
      order_date: getTodayDateStr(),
    });
    setItemForm(initialItemForm);
    setCartItems([]);
    setEditingOrder(null);
    setBookingSearch("");
    setMenuSearch("");
    setIsModalOpen(true);
  }

  function handleEdit(order) {
    if (String(getOrderStatus(order)).toLowerCase() === "completed") {
      setAlertMessage("Completed orders are settled. You can view or print the receipt in Billing.");
      return;
    }

    setEditingOrder(order);
    const existingDate = order.created_at ? order.created_at.split("T")[0] : getTodayDateStr();
    const hasInHouseStay = Boolean(order.booking_id || order.room_id);

    setFormData({
      order_type: order.order_type || "dine-in",
      table_number: order.table_number || "",
      custom_table: "",
      guest_type: hasInHouseStay ? "in_house" : "outside",
      booking_id: order.booking_id || "",
      guest_name: order.guest_name || "",
      guest_phone: order.guest_phone || "",
      status: getOrderStatus(order),
      billing_type: order.billing_type || "pending_billing",
      payment_method: order.payment_method || "",
      notes: order.notes || "",
      order_date: existingDate,
    });

    const b = getBookingById(order.booking_id);
    if (b) setBookingSearch(getBookingLabel(b));

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
    if (!itemForm.menu_item_id) return showToast("Please select a menu item.", "error");
    if (Number(itemForm.quantity || 0) <= 0) return showToast("Quantity must be greater than 0.", "error");

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
    if (cartItems.length === 0) throw new Error("Please add at least one menu item.");

    if (formData.order_type === "room-service" && !selectedBooking && !editingOrder?.booking_id) {
      throw new Error("Room service orders require an active hotel booking.");
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

    const isRoomService = formData.order_type === "room-service";
    const isInHouse = isRoomService || formData.guest_type === "in_house";
    let billingType = formData.billing_type || "pending_billing";
    if (isRoomService) {
      billingType = "transfer_to_booking";
    }

    const bookingId = isInHouse && selectedBooking
      ? Number(selectedBooking.booking_id || selectedBooking.id)
      : isInHouse && formData.booking_id
      ? Number(formData.booking_id)
      : isInHouse && editingOrder?.booking_id
      ? Number(editingOrder.booking_id)
      : null;

    const guestId = isInHouse && selectedBooking
      ? Number(selectedBooking.guest_id)
      : isInHouse && editingOrder?.guest_id
      ? Number(editingOrder.guest_id)
      : null;

    const roomId = isInHouse && selectedBooking
      ? Number(selectedBooking.room_id)
      : isInHouse && editingOrder?.room_id
      ? Number(editingOrder.room_id)
      : null;

    let finalTableNumber = null;
    if (formData.order_type === "dine-in") {
      finalTableNumber = formData.table_number === "CUSTOM"
        ? formData.custom_table.trim() || "Open Table"
        : formData.table_number || null;
    }

    const isPaidAtPOS = billingType === "paid_at_restaurant";

    const resolvedGuestName = isInHouse
      ? (selectedBooking?.guest_name || (selectedBooking ? getGuestName(selectedBooking.guest_id) : formData.guest_name.trim() || "In-House Guest"))
      : (formData.guest_name.trim() || "Walk-in Guest");

    return {
      hotel_id: Number(hotelId),
      order_type: formData.order_type,
      table_number: finalTableNumber,
      booking_id: bookingId,
      guest_id: guestId,
      room_id: roomId,
      guest_name: resolvedGuestName,
      guest_phone: formData.guest_phone?.trim() || null,
      order_status: formData.status || "pending",
      billing_type: billingType,
      payment_method: isRoomService ? "room_bill" : isPaidAtPOS ? formData.payment_method || "cash" : null,
      payment_status: isRoomService ? "unpaid" : isPaidAtPOS ? "paid" : "unpaid",
      notes: formData.notes.trim() || null,
      items,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (cartItems.length === 0) return showToast("Please add at least one menu item.", "error");

    const isRoomService = formData.order_type === "room-service";
    const isInHouse = isRoomService || formData.guest_type === "in_house";

    if (isInHouse && !formData.booking_id && !editingOrder?.booking_id) {
      return showToast("Please select an in-house guest from the list.", "error");
    }

    if (!isInHouse && !formData.guest_name.trim()) {
      return showToast("Please enter the guest name.", "error");
    }

    if (formData.billing_type === "paid_at_restaurant" && !formData.payment_method) {
      return showToast("Please select a payment method for counter settlement.", "error");
    }

    try {
      setSaving(true);
      const payload = buildPayload();

      if (editingOrder) {
        await api.put(`/restaurant/orders/${editingOrder.id}`, payload);
        showToast("Order updated successfully.", "success");
      } else {
        await api.post("/restaurant/orders", payload);
        showToast("Restaurant order placed successfully.", "success");
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      console.error("Save order error:", err);
      showToast(getApiErrorMessage(err, "Failed to save restaurant order."), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleStatusDropdownChange(order, nextStatus) {
    if (nextStatus === "cancelled") {
      setDeleteModalOrder(order);
      setDeleteReason("");
    } else {
      handleQuickStatusChange(order, nextStatus);
    }
  }

  async function handleQuickStatusChange(order, nextStatus) {
    try {
      await api.put(`/restaurant/orders/${order.id}`, {
        order_status: nextStatus,
      });
      showToast(`Order #${order.id} status changed to ${nextStatus.toUpperCase()}.`, "success");
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, order_status: nextStatus } : o))
      );
    } catch (err) {
      console.error("Status update error:", err);
      showToast(getApiErrorMessage(err, "Failed to update order status."), "error");
    }
  }

  async function handleCancelOrderSubmit(e) {
    e.preventDefault();
    if (!deleteModalOrder) return;
    const reason = deleteReason.trim() || "Cancelled by user";

    try {
      await api.put(`/restaurant/orders/${deleteModalOrder.id}`, {
        order_status: "cancelled",
        notes: deleteModalOrder.notes
          ? `${deleteModalOrder.notes} | Cancelled: ${reason}`
          : `Cancelled: ${reason}`,
      });

      showToast(`Order #${deleteModalOrder.id} marked as Cancelled.`, "success");
      setDeleteModalOrder(null);
      setDeleteReason("");
      await fetchData();
    } catch (err) {
      console.error("Cancel order error:", err);
      showToast(getApiErrorMessage(err, "Failed to cancel order."), "error");
    }
  }

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setTypeFilter("all");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  function printKotSlip(order) {
    window.print();
  }

  return (
    <div className="directory-page">
      {toast && (
        <div className={`toast-notification ${toast.type === "error" ? "error" : "success"}`}>
          {toast.message}
        </div>
      )}

      {/* PORTAL HEADER */}
      <PortalHeader
        title="Restaurant Orders & Live KOT"
        kicker="RESTAURANT MANAGEMENT"
        description="Live dine-in, takeaway, and room dining orders. Manage kitchen tickets, table seatings, and direct POS settlement."
        icon={ShoppingBag}
        backPath="/restaurant"
        rightAction={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="portal-action-btn"
              onClick={openAddModal}
            >
              <Plus size={16} /> Place Order
            </button>
          </div>
        }
      />

      {/* 4 STAT CARDS */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Orders"
          value={stats.total}
          Icon={ShoppingBag}
          colorTheme="blue"
        />
        <StatCard
          title="Pending (KOT)"
          value={stats.pending}
          Icon={ClipboardList}
          colorTheme="orange"
        />
        <StatCard
          title="Preparing on Stove"
          value={stats.preparing}
          Icon={Utensils}
          colorTheme="purple"
        />
        <StatCard
          title="Total Sales Value"
          value={`₹${stats.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          Icon={IndianRupee}
          colorTheme="green"
        />
      </div>

      <section className="dir-modules-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <ModuleWriternHeader
            title="Live Orders Queue"
            description="Manage preparation stages, seatings, and guest billing."
            badgeCount={filteredOrders.length}
            badgeLabel="orders shown"
          />

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="orders-live-indicator">
              <span className="orders-live-dot" />
              <span>LIVE POLLING (30s)</span>
            </div>
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              Last sync: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>

        {/* TOOLBAR CONTROLS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              placeholder="Search Order ID, guest, table, or room..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            {/* Quick Date Presets */}
            <div className="orders-preset-strip">
              <button
                type="button"
                className={`preset-chip ${datePreset === "today" ? "active" : ""}`}
                onClick={() => applyDatePreset("today")}
              >
                Today
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "7days" ? "active" : ""}`}
                onClick={() => applyDatePreset("7days")}
              >
                Last 7d
              </button>
              <button
                type="button"
                className={`preset-chip ${datePreset === "all" ? "active" : ""}`}
                onClick={() => applyDatePreset("all")}
              >
                All
              </button>
            </div>

            {/* Custom Date Range Selectors */}
            <div className="orders-date-wrap">
              <Calendar size={14} color="#64748b" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                title="End Date"
              />
            </div>

            <select
              className="dir-filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="dine-in">Dine-In</option>
              <option value="takeaway">Takeaway</option>
              <option value="room-service">Room Service</option>
            </select>

            <select
              className="dir-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              {orderStatuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn-cancel"
              style={{ height: "40px", padding: "0 14px" }}
              onClick={clearFilters}
              title="Reset search and filters"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ORDERS DATA TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr>
                <th className="th-customer">Order & Date</th>
                <th className="th-phone">Type & Location</th>
                <th className="th-phone">Guest Details</th>
                <th className="th-address">Items Ordered</th>
                <th className="th-identity">Order Status</th>
                <th className="th-bank">Amount & Bill</th>
                <th className="th-action" style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Loading restaurant orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No restaurant orders found for the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const booking = getBookingById(order.booking_id);
                  const guestName = order.guest_name || getGuestName(order.guest_id || booking?.guest_id);
                  const roomNumber = getRoomNumber(order.room_id || booking?.room_id);
                  const status = String(getOrderStatus(order)).toLowerCase();
                  const isCompleted = status === "completed";
                  const orderDate = new Date(order.created_at || order.date || Date.now()).toLocaleDateString(
                    "en-IN",
                    { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
                  );

                  const orderType = order.order_type || "dine-in";

                  return (
                    <tr
                      key={order.id}
                      className="dir-table-row"
                      onClick={() => setViewKotOrder(order)}
                      title="Click to view itemized KOT slip"
                    >
                      <td className="th-customer">
                        <div className="customer-cell">
                          <div className="staff-avatar">
                            #{order.id}
                          </div>
                          <div>
                            <span className="customer-name">Order #{order.id}</span>
                            <span className="text-muted" style={{ display: "block", fontSize: "11px" }}>
                              {orderDate}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="th-phone">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            {orderType === "dine-in" && <Table2 size={12} style={{ display: "inline", marginRight: "4px" }} />}
                            {orderType === "room-service" && <Coffee size={12} style={{ display: "inline", marginRight: "4px" }} />}
                            {orderType === "takeaway" && <ShoppingBag size={12} style={{ display: "inline", marginRight: "4px" }} />}
                            {orderType === "dine-in" ? `Table: ${order.table_number || "Open"}` : orderType === "room-service" ? `Room: ${roomNumber}` : "Takeaway"}
                          </span>
                          <span className="bank-sub" style={{ textTransform: "capitalize" }}>
                            {orderType.replace("-", " ")}
                          </span>
                        </div>
                      </td>

                      <td className="th-phone">
                        <div className="bank-cell">
                          <span className="bank-primary">
                            <User size={12} style={{ display: "inline", marginRight: "4px" }} />
                            {guestName}
                          </span>
                          {booking && (
                            <span className="bank-sub">
                              Stay #{booking.id}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="th-address">
                        <span className="truncate-cell text-muted" title={getOrderItemNames(order)}>
                          {getOrderItemNames(order)}
                        </span>
                      </td>

                      <td className="th-identity" onClick={(e) => e.stopPropagation()}>
                        <select
                          className={`mono-pill ${
                            status === "completed"
                              ? "pill-normal"
                              : status === "cancelled"
                              ? "pill-urgent"
                              : status === "preparing"
                              ? "pill-warning"
                              : status === "served"
                              ? "pill-normal"
                              : "pill-pending"
                          }`}
                          value={status}
                          disabled={isCompleted || status === "cancelled"}
                          onChange={(e) => handleStatusDropdownChange(order, e.target.value)}
                          style={{ cursor: "pointer", border: "none", outline: "none" }}
                          title="Change kitchen preparation status"
                        >
                          <option value="pending">PENDING</option>
                          <option value="preparing">PREPARING</option>
                          <option value="served">SERVED</option>
                          <option value="completed">COMPLETED</option>
                          <option value="cancelled">CANCELLED</option>
                        </select>
                      </td>

                      <td className="th-bank">
                        <div className="bank-cell">
                          <span className="bank-primary" style={{ color: "#0f172a" }}>
                            ₹{getOrderAmount(order).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          <span className="bank-sub">
                            {order.billing_type === "transfer_to_booking" ? "Folio SAC 996331" : order.payment_status === "paid" ? `Paid (${order.payment_method || "POS"})` : "Pending Bill"}
                          </span>
                        </div>
                      </td>

                      <td
                        className="th-action"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            onClick={() => setViewKotOrder(order)}
                            title="View KOT Slip"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            onClick={() => navigate(`/restaurant/billing?orderId=${order.id}`)}
                            title="Settle in POS Billing"
                          >
                            <ReceiptText size={13} />
                          </button>
                          <button
                            type="button"
                            className="dir-row-edit-btn"
                            onClick={() => handleEdit(order)}
                            title={isCompleted ? "Completed order" : "Edit Order"}
                            disabled={isCompleted || status === "cancelled"}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="dir-row-edit-btn btn-del"
                            onClick={() => {
                              setDeleteModalOrder(order);
                              setDeleteReason("");
                            }}
                            title="Cancel Order"
                            disabled={isCompleted || status === "cancelled"}
                          >
                            <Trash2 size={13} />
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

      {/* CREATE / EDIT ORDER MODAL */}
      {/* PLACE / EDIT RESTAURANT ORDER MODAL */}
      <PlaceRestaurantOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchData}
        onToast={showToast}
        editingOrder={editingOrder}
        tables={tables}
        menuItems={menuItems}
        bookings={bookings}
        guests={guests}
        rooms={rooms}
        inHouseGuests={inHouseGuests}
      />

      {/* VIEW KOT DETAILS MODAL */}
      {viewKotOrder && (
        <div className="modal-overlay" onClick={() => setViewKotOrder(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Kitchen Order Ticket (KOT) #{viewKotOrder.id}</h2>
                <p className="modal-kicker">
                  {new Date(viewKotOrder.created_at || viewKotOrder.date || Date.now()).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <button type="button" className="btn-close" onClick={() => setViewKotOrder(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="kot-slip-paper">
                <div className="kot-slip-header">
                  <h3 style={{ margin: "0 0 4px", fontSize: "16px", textTransform: "uppercase" }}>
                    {hotelInfo?.name || user?.hotel_name || "HOTEL RESTAURANT & BAR"}
                  </h3>
                  <div style={{ fontSize: "12px", fontWeight: "bold" }}>KOT #{viewKotOrder.id}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Service: <strong>{String(viewKotOrder.order_type || "dine-in").toUpperCase()}</strong> | Status: <strong>{String(getOrderStatus(viewKotOrder)).toUpperCase()}</strong>
                  </div>
                  {viewKotOrder.order_type === "dine-in" && (
                    <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: "bold" }}>
                      TABLE: {viewKotOrder.table_number || "Open"}
                    </div>
                  )}
                  {viewKotOrder.order_type === "room-service" && (
                    <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: "bold" }}>
                      ROOM: {getRoomNumber(viewKotOrder.room_id)} (Stay #{viewKotOrder.booking_id})
                    </div>
                  )}
                  <div style={{ fontSize: "11px", marginTop: "2px" }}>
                    Guest: {viewKotOrder.guest_name || "-"}
                  </div>
                </div>

                <table className="kot-slip-items">
                  <thead>
                    <tr>
                      <th>QTY</th>
                      <th>ITEM DESCRIPTION</th>
                      <th style={{ textAlign: "right" }}>RATE</th>
                      <th style={{ textAlign: "right" }}>AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getOrderItems(viewKotOrder).map((item, idx) => {
                      const menuItem = getMenuItemById(item.menu_item_id);
                      const name = item.item_name || getMenuItemName(menuItem);
                      const portion = item.portion === "half" ? " [HALF]" : "";
                      return (
                        <tr key={idx}>
                          <td style={{ fontWeight: "bold" }}>{item.quantity}</td>
                          <td>{name}{portion}</td>
                          <td style={{ textAlign: "right" }}>₹{item.price.toFixed(2)}</td>
                          <td style={{ textAlign: "right", fontWeight: "bold" }}>₹{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="kot-slip-totals">
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "bold" }}>
                    <span>TOTAL BILL:</span>
                    <span>₹{getOrderAmount(viewKotOrder).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                    Billing Type: {viewKotOrder.billing_type === "transfer_to_booking" ? "Folio Charge (SAC 996331)" : viewKotOrder.payment_status === "paid" ? `Paid (${viewKotOrder.payment_method})` : "Pending Settlement"}
                  </div>
                </div>

                {viewKotOrder.notes && (
                  <div style={{ marginTop: "10px", padding: "6px 8px", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "4px", fontSize: "11px" }}>
                    <strong>Kitchen Notes:</strong> {viewKotOrder.notes}
                  </div>
                )}
              </div>

              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => printKotSlip(viewKotOrder)}
                >
                  <Printer size={14} /> Print KOT Slip
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="portal-action-btn"
                    onClick={() => {
                      setViewKotOrder(null);
                      navigate(`/restaurant/billing?orderId=${viewKotOrder.id}`);
                    }}
                  >
                    <ReceiptText size={14} /> Settle Bill
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setViewKotOrder(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {deleteModalOrder && (
        <div className="modal-overlay" onClick={() => setDeleteModalOrder(null)}>
          <div className="modal-content delete-confirm-modal" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: "16px", color: "#dc2626" }}>Cancel Order #{deleteModalOrder.id}</h2>
              <button type="button" className="btn-close" onClick={() => setDeleteModalOrder(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCancelOrderSubmit} className="modal-body">
              <p style={{ fontSize: "13px", color: "#475569", margin: 0, lineHeight: "1.4" }}>
                Cancelling this order will remove it from the kitchen preparation queue and automatically reverse any
                associated room folio billing charges (SAC 996331).
              </p>
              <div className="form-group-custom">
                <label>Reason for Cancellation *</label>
                <input
                  type="text"
                  placeholder="E.g. Guest changed mind, kitchen ingredient out of stock"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="form-input-custom"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setDeleteModalOrder(null)}>
                  Keep Order
                </button>
                <button type="submit" className="btn-danger">
                  <Trash2 size={14} /> Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTICE ALERT MODAL */}
      {alertMessage && (
        <div className="modal-overlay" onClick={() => setAlertMessage(null)}>
          <div className="modal-content" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Notice</h2>
              <button type="button" className="btn-close" onClick={() => setAlertMessage(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>{alertMessage}</p>
              <div className="modal-actions">
                <button type="button" className="portal-action-btn" onClick={() => setAlertMessage(null)}>
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