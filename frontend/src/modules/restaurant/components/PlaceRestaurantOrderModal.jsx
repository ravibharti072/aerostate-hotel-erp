import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Users,
  Hotel,
  User,
  CheckCircle2,
  Save,
} from "lucide-react";
import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import "../orders/restaurantOrders.css";

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

function getDietaryIcon(item) {
  const dietary = item?.dietary_type || "veg";
  if (dietary === "non-veg") return "🔴";
  if (dietary === "egg") return "🟡";
  if (dietary === "vegan") return "🌱";
  return "🟢";
}

function getOrderItemsList(order) {
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

export default function PlaceRestaurantOrderModal({
  isOpen,
  onClose,
  onSuccess,
  onToast,
  editingOrder = null,
  tables = [],
  menuItems = [],
  bookings = [],
  guests = [],
  rooms = [],
  inHouseGuests = [],
  defaultOrderType = "dine-in",
  defaultTableNumber = "",
}) {
  const { user } = useAuth();

  const [formData, setFormData] = useState(initialForm);
  const [itemForm, setItemForm] = useState(initialItemForm);
  const [cartItems, setCartItems] = useState([]);
  const [bookingSearch, setBookingSearch] = useState("");
  const [isBookingDropdownOpen, setIsBookingDropdownOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalToast, setModalToast] = useState(null);

  const bookingRef = useRef(null);
  const menuRef = useRef(null);

  const notify = (msg, type = "success") => {
    if (onToast) {
      onToast(msg, type);
    } else {
      setModalToast({ message: msg, type });
      setTimeout(() => setModalToast(null), 3500);
    }
  };

  const getLoggedInHotelId = () => {
    return user?.hotel_id || user?.hotel?.id || user?.hotelId || user?.hotel?.hotel_id;
  };

  const getGuestName = (guestId) => {
    const guest = guests.find((item) => Number(item.id) === Number(guestId));
    return guest?.full_name || guest?.name || "-";
  };

  const getRoomNumber = (roomId) => {
    const room = rooms.find((item) => Number(item.id) === Number(roomId));
    return room?.room_number || "-";
  };

  const getBookingById = (bookingId) => {
    return bookings.find((item) => Number(item.id) === Number(bookingId));
  };

  const getBookingLabel = (booking) => {
    if (!booking) return "";
    return `#${booking.id} - ${getGuestName(booking.guest_id)} (Room ${getRoomNumber(booking.room_id)})`;
  };

  const getMenuItemById = (itemId) => {
    return menuItems.find((item) => Number(item.id) === Number(itemId));
  };

  const getMenuItemName = (item) => {
    return item?.name || item?.item_name || item?.title || "-";
  };

  const getMenuItemFullPrice = (item) => {
    return Number(item?.full_price || item?.price || item?.rate || 0);
  };

  const getMenuItemHalfPrice = (item) => {
    return Number(item?.half_price || 0);
  };

  const getCartItemPrice = (cartItem) => {
    const menuItem = getMenuItemById(cartItem.menu_item_id);
    if (!menuItem) return 0;
    if (cartItem.portion === "half" && getMenuItemHalfPrice(menuItem) > 0) {
      return getMenuItemHalfPrice(menuItem);
    }
    return getMenuItemFullPrice(menuItem);
  };

  // Close dropdowns on outside click
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

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingOrder) {
      const existingDate = editingOrder.created_at ? editingOrder.created_at.split("T")[0] : getTodayDateStr();
      const hasInHouseStay = Boolean(editingOrder.booking_id || editingOrder.room_id);

      setFormData({
        order_type: editingOrder.order_type || "dine-in",
        table_number: editingOrder.table_number || "",
        custom_table: "",
        guest_type: hasInHouseStay ? "in_house" : "outside",
        booking_id: editingOrder.booking_id || "",
        guest_name: editingOrder.guest_name || "",
        guest_phone: editingOrder.guest_phone || "",
        status: editingOrder.order_status || editingOrder.status || "pending",
        billing_type: editingOrder.billing_type || "pending_billing",
        payment_method: editingOrder.payment_method || "",
        notes: editingOrder.notes || "",
        order_date: existingDate,
      });

      const b = getBookingById(editingOrder.booking_id);
      if (b) {
        setBookingSearch(getBookingLabel(b));
      } else if (editingOrder.guest_name) {
        setBookingSearch(editingOrder.guest_name);
      }

      setCartItems(
        getOrderItemsList(editingOrder).map((item) => ({
          menu_item_id: Number(item.menu_item_id),
          portion: item.portion || "full",
          quantity: Number(item.quantity || 1),
        }))
      );
    } else {
      setFormData({
        ...initialForm,
        order_type: defaultOrderType || "dine-in",
        table_number: defaultTableNumber || "",
        guest_type: defaultOrderType === "room-service" ? "in_house" : "outside",
        order_date: getTodayDateStr(),
      });
      setCartItems([]);
      setBookingSearch("");
    }

    setItemForm(initialItemForm);
    setMenuSearch("");
  }, [isOpen, editingOrder, defaultOrderType, defaultTableNumber]);

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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemFormChange = (e) => {
    const { name, value } = e.target;
    setItemForm((prev) => ({ ...prev, [name]: value }));
  };

  const addItemToCart = () => {
    if (!itemForm.menu_item_id) return notify("Please select a menu item.", "error");
    if (Number(itemForm.quantity || 0) <= 0) return notify("Quantity must be greater than 0.", "error");

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
  };

  const removeItemFromCart = (menuItemId, portion) => {
    setCartItems((prev) =>
      prev.filter((item) => !(Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion))
    );
  };

  const updateCartQuantity = (menuItemId, portion, quantity) => {
    const qty = Number(quantity || 1);
    if (qty <= 0) return;
    setCartItems((prev) =>
      prev.map((item) =>
        Number(item.menu_item_id) === Number(menuItemId) && item.portion === portion ? { ...item, quantity: qty } : item
      )
    );
  };

  const buildPayload = () => {
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return notify("Please add at least one menu item.", "error");

    const isRoomService = formData.order_type === "room-service";
    const isInHouse = isRoomService || formData.guest_type === "in_house";

    if (isInHouse && !formData.booking_id && !editingOrder?.booking_id) {
      return notify("Please select an in-house guest from the list.", "error");
    }

    if (!isInHouse && !formData.guest_name.trim()) {
      return notify("Please enter the guest name.", "error");
    }

    if (formData.billing_type === "paid_at_restaurant" && !formData.payment_method) {
      return notify("Please select a payment method for counter settlement.", "error");
    }

    try {
      setSaving(true);
      const payload = buildPayload();

      if (editingOrder) {
        await api.put(`/restaurant/orders/${editingOrder.id}`, payload);
        notify("Order updated successfully.", "success");
      } else {
        await api.post("/restaurant/orders", payload);
        notify("Restaurant order placed successfully.", "success");
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Save order error:", err);
      const detail = err.response?.data?.detail;
      const errorMsg = typeof detail === "string" ? detail : err.message || "Failed to save restaurant order.";
      notify(errorMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      {modalToast && (
        <div className={`toast-notification ${modalToast.type}`}>
          {modalToast.message}
        </div>
      )}

      <div
        className="modal-content"
        style={{ maxWidth: "700px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2>{editingOrder ? `Edit Order #${editingOrder.id}` : "Place Restaurant Order"}</h2>
            <p className="modal-kicker">Multi-channel order creation: Dine-in, Takeaway, and In-room Dining.</p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* ORDER TYPE SELECTOR */}
          <div className="form-group-custom">
            <label>Order Type *</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {["dine-in", "takeaway", "room-service"].map((type) => (
                <button
                  key={type}
                  type="button"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: formData.order_type === type ? "2px solid #166962" : "1px solid #cbd5e1",
                    background: formData.order_type === type ? "#e6f3f0" : "#fff",
                    color: formData.order_type === type ? "#166962" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    fontSize: "13px",
                  }}
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      order_type: type,
                      guest_type: type === "room-service" ? "in_house" : p.guest_type,
                    }))
                  }
                >
                  {type.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* TABLE NUMBER (IF DINE-IN) */}
          {formData.order_type === "dine-in" && (
            <div className="form-row-2">
              <div className="form-group-custom">
                <label>Select Restaurant Table</label>
                <select
                  name="table_number"
                  value={formData.table_number}
                  onChange={handleFormChange}
                  className="form-input-custom"
                >
                  <option value="">Open / Counter Seating</option>
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.table_number}>
                      Table {tbl.table_number} ({tbl.section || "Main Hall"} - {tbl.capacity} Seats - {tbl.status})
                    </option>
                  ))}
                  <option value="CUSTOM">+ Custom Table Number...</option>
                </select>
              </div>

              {formData.table_number === "CUSTOM" && (
                <div className="form-group-custom">
                  <label>Enter Custom Table # *</label>
                  <input
                    type="text"
                    name="custom_table"
                    placeholder="E.g. T-12, Poolside-4"
                    value={formData.custom_table}
                    onChange={handleFormChange}
                    className="form-input-custom"
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* GUEST CATEGORY: IN-HOUSE GUEST VS OUTSIDE GUEST */}
          <div className="form-group-custom" style={{ marginTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
              <Users size={15} /> Guest Type *
            </label>
            {formData.order_type === "room-service" ? (
              <div
                style={{
                  background: "#e6f3f0",
                  border: "1px solid #166962",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  color: "#166962",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Hotel size={16} /> In-House Guest Stay (Room Service Delivery)
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: formData.guest_type === "in_house" ? "2px solid #166962" : "1px solid #cbd5e1",
                    background: formData.guest_type === "in_house" ? "#e6f3f0" : "#ffffff",
                    color: formData.guest_type === "in_house" ? "#166962" : "#475569",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      guest_type: "in_house",
                    }))
                  }
                >
                  <Hotel size={16} /> In-House Guest (Hotel Resident)
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: formData.guest_type === "outside" ? "2px solid #166962" : "1px solid #cbd5e1",
                    background: formData.guest_type === "outside" ? "#e6f3f0" : "#ffffff",
                    color: formData.guest_type === "outside" ? "#166962" : "#475569",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    transition: "all 0.15s ease",
                  }}
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      guest_type: "outside",
                      booking_id: "",
                      guest_name: prev.guest_type === "in_house" ? "" : prev.guest_name,
                      billing_type: prev.billing_type === "transfer_to_booking" ? "pending_billing" : prev.billing_type,
                    }));
                    setBookingSearch("");
                  }}
                >
                  <User size={16} /> Outside Guest (Walk-in / External)
                </button>
              </div>
            )}
          </div>

          {/* IF IN-HOUSE GUEST: SELECT HOTEL STAY */}
          {(formData.guest_type === "in_house" || formData.order_type === "room-service") ? (
            <div className="form-group-custom" ref={bookingRef}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Select In-House Guest / Room *</span>
                {formData.booking_id && (
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "#e11d48",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setFormData((p) => ({ ...p, booking_id: "", guest_name: "" }));
                      setBookingSearch("");
                    }}
                  >
                    Change Guest
                  </button>
                )}
              </label>

              {formData.booking_id && (selectedBooking || formData.guest_name) ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f0fdf4",
                    border: "1.5px solid #86efac",
                    borderRadius: "8px",
                    color: "#166534",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13.5px" }}>
                        {selectedBooking?.guest_name || getGuestName(selectedBooking?.guest_id) || formData.guest_name}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#15803d", marginTop: "2px" }}>
                        Room {selectedBooking?.room_number || getRoomNumber(selectedBooking?.room_id)} • Booking #{formData.booking_id}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      background: "#dcfce7",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    Checked-In Resident
                  </span>
                </div>
              ) : (
                <div className="dropdown-search-wrap">
                  <input
                    type="text"
                    placeholder="Search active guest name or room number..."
                    value={bookingSearch}
                    onChange={(e) => {
                      setBookingSearch(e.target.value);
                      setIsBookingDropdownOpen(true);
                    }}
                    onFocus={() => setIsBookingDropdownOpen(true)}
                    className="form-input-custom"
                    required={!editingOrder?.booking_id}
                  />
                  {isBookingDropdownOpen && (
                    <div className="dropdown-options-list">
                      {filteredBookingsForDropdown.length === 0 ? (
                        <div className="dropdown-option-empty">No active checked-in stays found</div>
                      ) : (
                        filteredBookingsForDropdown.map((b) => {
                          const bId = b.booking_id || b.id;
                          const bGuestName = b.guest_name || getGuestName(b.guest_id);
                          const bRoomNumber = b.room_number || getRoomNumber(b.room_id);
                          return (
                            <div
                              key={bId}
                              className="dropdown-option-item"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  booking_id: bId,
                                  guest_name: bGuestName,
                                }));
                                setBookingSearch(`#${bId} - ${bGuestName} (Room ${bRoomNumber})`);
                                setIsBookingDropdownOpen(false);
                              }}
                            >
                              <div>
                                <strong>#{bId}</strong> - {bGuestName}
                              </div>
                              <span style={{ fontSize: "11px", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                                Room {bRoomNumber}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* IF OUTSIDE GUEST: ONLY TAKE NAME AND PHONE */
            <div className="form-row-2">
              <div className="form-group-custom">
                <label>Customer Name *</label>
                <input
                  type="text"
                  name="guest_name"
                  placeholder="E.g. Priya Singh / Walk-in"
                  value={formData.guest_name}
                  onChange={handleFormChange}
                  className="form-input-custom"
                  required
                />
              </div>
              <div className="form-group-custom">
                <label>Phone Number (Optional)</label>
                <input
                  type="text"
                  name="guest_phone"
                  placeholder="E.g. 9876543210"
                  value={formData.guest_phone}
                  onChange={handleFormChange}
                  className="form-input-custom"
                />
              </div>
            </div>
          )}

          {/* PAYMENT & SETTLEMENT OPTION */}
          {formData.order_type !== "room-service" && (
            <div className="form-row-2" style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div className="form-group-custom">
                <label>Settlement Timing</label>
                <select
                  name="billing_type"
                  value={formData.billing_type}
                  onChange={handleFormChange}
                  className="form-input-custom"
                >
                  <option value="pending_billing">Pay Later (After Meal / KOT)</option>
                  <option value="paid_at_restaurant">Pay Now at Counter / POS</option>
                  {formData.booking_id && (
                    <option value="transfer_to_booking">Bill to Room Folio (SAC 996331)</option>
                  )}
                </select>
              </div>

              {formData.billing_type === "paid_at_restaurant" && (
                <div className="form-group-custom">
                  <label>Payment Method *</label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleFormChange}
                    className="form-input-custom"
                    required
                  >
                    <option value="">Select Method...</option>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI / QR Code</option>
                    <option value="card">Credit / Debit Card</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* MENU ITEMS SELECTION & CART */}
          <div className="cart-builder-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>Add Dishes &amp; Beverages</h4>
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>{menuItems.length} items catalog</span>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }} ref={menuRef}>
              <div style={{ flex: 2 }} className="dropdown-search-wrap">
                <label style={{ fontSize: "11px", fontWeight: "bold" }}>Search Menu Item</label>
                <input
                  type="text"
                  placeholder="Type dish name or category..."
                  value={menuSearch}
                  onChange={(e) => {
                    setMenuSearch(e.target.value);
                    setIsMenuDropdownOpen(true);
                  }}
                  onFocus={() => setIsMenuDropdownOpen(true)}
                  className="form-input-custom"
                />
                {isMenuDropdownOpen && (
                  <div className="dropdown-options-list">
                    {filteredMenuItemsForDropdown.length === 0 ? (
                      <div className="dropdown-option-empty">No menu items found</div>
                    ) : (
                      filteredMenuItemsForDropdown.map((item) => {
                        const icon = getDietaryIcon(item);
                        return (
                          <div
                            key={item.id}
                            className="dropdown-option-item"
                            onClick={() => {
                              setItemForm((p) => ({ ...p, menu_item_id: item.id, portion: "full" }));
                              setMenuSearch(`${icon} ${getMenuItemName(item)} (₹${getMenuItemFullPrice(item)})`);
                              setIsMenuDropdownOpen(false);
                            }}
                          >
                            <div>
                              <span style={{ marginRight: "4px" }}>{icon}</span>
                              <strong>{getMenuItemName(item)}</strong> - ₹{getMenuItemFullPrice(item)}
                              {item.half_price ? ` / Half ₹${item.half_price}` : ""}
                            </div>
                            <span style={{ fontSize: "10.5px", color: "#64748b", background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>
                              {item.category || "Food"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div style={{ width: "130px" }}>
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
                      className="form-input-custom"
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
                  className="form-input-custom"
                />
              </div>

              <button
                type="button"
                className="portal-action-btn"
                style={{ height: "40px" }}
                onClick={addItemToCart}
              >
                Add
              </button>
            </div>

            {/* CART ITEMS LIST */}
            {cartItems.length > 0 && (
              <div className="cart-items-table-wrap">
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Item Name</th>
                      <th style={{ padding: "8px 10px" }}>Portion</th>
                      <th style={{ padding: "8px 10px", width: "70px" }}>Qty</th>
                      <th style={{ padding: "8px 10px" }}>Rate</th>
                      <th style={{ padding: "8px 10px" }}>Total</th>
                      <th style={{ padding: "8px 10px", width: "30px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartItems.map((cartItem) => {
                      const menuItem = getMenuItemById(cartItem.menu_item_id);
                      const price = getCartItemPrice(cartItem);
                      const total = price * Number(cartItem.quantity || 1);
                      const icon = getDietaryIcon(menuItem);

                      return (
                        <tr key={`${cartItem.menu_item_id}-${cartItem.portion}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                            <span style={{ marginRight: "4px" }}>{icon}</span> {getMenuItemName(menuItem)}
                          </td>
                          <td style={{ padding: "8px 10px", textTransform: "capitalize" }}>{cartItem.portion}</td>
                          <td style={{ padding: "8px 10px" }}>
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
                          <td style={{ padding: "8px 10px" }}>₹{price.toFixed(2)}</td>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>₹{total.toFixed(2)}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <button
                              type="button"
                              onClick={() => removeItemFromCart(cartItem.menu_item_id, cartItem.portion)}
                              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center" }}
                              title="Remove item"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div style={{ padding: "10px 14px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ textAlign: "right", fontSize: "12px", color: "#475569", display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div>Taxable Base: <strong>₹{cartSummary.subtotal.toFixed(2)}</strong></div>
                    <div>Estimated GST: <strong>₹{cartSummary.taxAmount.toFixed(2)}</strong></div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                      Total Bill: ₹{cartSummary.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SPECIAL INSTRUCTIONS & NOTES */}
          <div className="form-group-custom">
            <label>Chef &amp; Kitchen Preparation Notes</label>
            <textarea
              name="notes"
              rows="2"
              placeholder="E.g. Extra spicy, less oil, deliver hot to poolside"
              value={formData.notes}
              onChange={handleFormChange}
              className="form-input-custom"
              style={{ height: "auto", minHeight: "50px", padding: "8px 12px" }}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="portal-action-btn" disabled={saving}>
              <Save size={14} /> {saving ? "Saving..." : editingOrder ? "Update Order" : "Place Order (Print KOT)"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
