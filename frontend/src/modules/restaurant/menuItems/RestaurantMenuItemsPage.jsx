import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Utensils,
  ChefHat,
  X,
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  XCircle,
  Briefcase,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  Filter,
} from "lucide-react";

import api from "@api/api";
import { useAuth } from "@context/AuthContext";
import { PortalHeader, StatCard, ModuleWriternHeader } from "@components";
import "./restaurantMenuItems.css";

const defaultCategories = [
  "Starters & Appetizers",
  "Main Course",
  "Breads & Rice",
  "Soups & Salads",
  "Beverages & Water",
  "Snacks & Packaged",
  "Desserts & Sweets",
  "Breakfast Specials",
  "Room Service Specials",
  "Food",
  "Other",
];

const dietaryTypes = [
  {
    value: "veg",
    label: "Pure Veg",
    iconClass: "dietary-icon-veg",
    className: "dietary-badge-veg",
    activeClass: "active-veg",
  },
  {
    value: "non-veg",
    label: "Non-Veg",
    iconClass: "dietary-icon-nonveg",
    className: "dietary-badge-nonveg",
    activeClass: "active-nonveg",
  },
  {
    value: "egg",
    label: "Egg",
    iconClass: "dietary-icon-egg",
    className: "dietary-badge-egg",
    activeClass: "active-egg",
  },
  {
    value: "vegan",
    label: "Vegan",
    iconClass: "dietary-icon-vegan",
    className: "dietary-badge-vegan",
    activeClass: "active-vegan",
  },
];

const gstTaxOptions = [
  { value: 5, label: "5% (Standard Restaurant GST)" },
  { value: 0, label: "0% (Exempt / Nil-Rated)" },
  { value: 12, label: "12% (Packaged / Standard Goods)" },
  { value: 18, label: "18% (Luxury Dining / Outdoor Catering)" },
];

const initialForm = {
  name: "",
  category: "Starters & Appetizers",
  customCategory: "",
  dietary_type: "veg",
  has_half_portion: false,
  half_price: "",
  full_price: "",
  tax_percent: 5,
  description: "",
  is_available: true,
};

export default function RestaurantMenuItemsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingItem, setEditingItem] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteBlockedError, setDeleteBlockedError] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dietaryFilter, setDietaryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

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

  function getApiErrorMessage(err, fallbackMessage) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => `${Array.isArray(item.loc) ? item.loc.join(".") : ""}: ${item.msg}`).join(" | ");
    }
    if (detail && typeof detail === "object") return JSON.stringify(detail);
    return err.message || fallbackMessage;
  }

  function getItemName(item) { return item?.name || item?.item_name || item?.title || "-"; }
  function getItemFullPrice(item) { return Number(item?.full_price || item?.price || item?.rate || item?.selling_price || 0); }
  function getItemHalfPrice(item) { return Number(item?.half_price || 0); }
  function getItemCategory(item) { return item?.category || item?.item_category || "Main Course"; }
  function getItemDietary(item) { return item?.dietary_type || "veg"; }
  function getItemTax(item) { return item?.tax_percent !== undefined && item?.tax_percent !== null ? Number(item.tax_percent) : 5; }

  function getItemAvailable(item) {
    if (typeof item?.is_available === "boolean") return item.is_available;
    if (typeof item?.available === "boolean") return item.available;
    const status = String(item?.status || "").toLowerCase();
    if (status === "unavailable" || status === "inactive") return false;
    return true;
  }

  async function fetchMenuItems() {
    try {
      setLoading(true);
      const response = await api.get("/restaurant/menu-items");
      const list = normalizeList(response.data, "menu_items");
      setMenuItems(filterByHotel(list));
    } catch (err) {
      console.error("Fetch menu items error:", err);
      showToast(getApiErrorMessage(err, "Failed to load menu items."), "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMenuItems();
  }, []);

  const stats = useMemo(() => {
    const available = menuItems.filter((item) => getItemAvailable(item)).length;
    const unavailable = menuItems.length - available;
    const totalValue = menuItems.reduce((sum, item) => sum + getItemFullPrice(item), 0);
    const vegCount = menuItems.filter((item) => getItemDietary(item) === "veg").length;
    return { total: menuItems.length, available, unavailable, totalValue, vegCount };
  }, [menuItems]);

  // Dynamic Categories from existing items combined with standard categories
  const allCategories = useMemo(() => {
    const categorySet = new Set(defaultCategories);
    menuItems.forEach((item) => {
      const cat = getItemCategory(item);
      if (cat && cat.trim()) categorySet.add(cat.trim());
    });
    return Array.from(categorySet);
  }, [menuItems]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    let result = menuItems.filter((item) => {
      const name = getItemName(item).toLowerCase();
      const category = getItemCategory(item).toLowerCase();
      const dietary = getItemDietary(item).toLowerCase();
      const available = getItemAvailable(item);

      const matchesSearch = !search || name.includes(search) || category.includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "available" && available) ||
        (statusFilter === "unavailable" && !available);
      const matchesCategory =
        categoryFilter === "all" || category === categoryFilter.toLowerCase();
      const matchesDietary =
        dietaryFilter === "all" || dietary === dietaryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory && matchesDietary;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name-asc") {
        return getItemName(a).localeCompare(getItemName(b));
      } else if (sortBy === "name-desc") {
        return getItemName(b).localeCompare(getItemName(a));
      } else if (sortBy === "price-low") {
        return getItemFullPrice(a) - getItemFullPrice(b);
      } else if (sortBy === "price-high") {
        return getItemFullPrice(b) - getItemFullPrice(a);
      } else if (sortBy === "status") {
        return (getItemAvailable(b) ? 1 : 0) - (getItemAvailable(a) ? 1 : 0);
      }
      return 0;
    });

    return result;
  }, [menuItems, searchText, statusFilter, categoryFilter, dietaryFilter, sortBy]);

  // Grouped by Category
  const itemsByCategory = useMemo(() => {
    const grouped = {};
    filteredItems.forEach((item) => {
      const cat = getItemCategory(item) || "Other";
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((cat) => ({
        category: cat,
        items: grouped[cat],
      }));
  }, [filteredItems]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function handleDietarySelect(val) {
    setFormData((prev) => ({ ...prev, dietary_type: val }));
  }

  function openAddModal() {
    setFormData(initialForm);
    setEditingItem(null);
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    const half = getItemHalfPrice(item);
    const existingCategory = getItemCategory(item);
    const isStandardCat = defaultCategories.includes(existingCategory);

    setFormData({
      name: getItemName(item),
      category: isStandardCat ? existingCategory : "Custom",
      customCategory: isStandardCat ? "" : existingCategory,
      dietary_type: getItemDietary(item),
      has_half_portion: half > 0,
      half_price: half > 0 ? String(half) : "",
      full_price: String(getItemFullPrice(item)),
      tax_percent: getItemTax(item),
      description: item.description || "",
      is_available: getItemAvailable(item),
    });
    setIsModalOpen(true);
  }

  function buildPayload() {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) throw new Error("Hotel ID not found. Please log in again.");

    const finalCategory =
      formData.category === "Custom"
        ? formData.customCategory.trim() || "Other"
        : formData.category;

    const fullPriceNum = Number(formData.full_price || 0);
    const halfPriceNum =
      formData.has_half_portion && formData.half_price !== "" && Number(formData.half_price) > 0
        ? Number(formData.half_price)
        : null;

    return {
      hotel_id: Number(hotelId),
      name: formData.name.trim(),
      category: finalCategory,
      dietary_type: formData.dietary_type || "veg",
      half_price: halfPriceNum,
      full_price: fullPriceNum,
      price: fullPriceNum,
      tax_percent: Number(formData.tax_percent !== undefined ? formData.tax_percent : 5),
      description: formData.description?.trim() || null,
      is_available: Boolean(formData.is_available),
    };
  }

  async function toggleAvailability(item) {
    const nextStatus = !getItemAvailable(item);
    try {
      await api.put(`/restaurant/menu-items/${item.id}`, {
        is_available: nextStatus,
      });
      showToast(`${getItemName(item)} marked as ${nextStatus ? "Available" : "Unavailable"}.`, "success");
      setMenuItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: nextStatus } : i))
      );
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to update availability."), "error");
    }
  }

  async function saveWithFallback(payload, itemId = null) {
    const request = (data) =>
      itemId
        ? api.put(`/restaurant/menu-items/${itemId}`, data)
        : api.post("/restaurant/menu-items", data);

    try {
      return await request(payload);
    } catch (err1) {
      if (err1.response?.status !== 422) throw err1;
      // Fallback if older backend without dietary_type field
      const { dietary_type, ...rest } = payload;
      return await request(rest);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return showToast("Menu item name is required.", "error");
    const fullPrice = Number(formData.full_price || 0);
    if (fullPrice <= 0) return showToast("Price must be greater than 0.", "error");

    if (formData.has_half_portion && formData.half_price !== "") {
      const halfPrice = Number(formData.half_price);
      if (halfPrice <= 0) {
        return showToast("Half portion price must be greater than 0 if enabled.", "error");
      }
      if (halfPrice >= fullPrice) {
        return showToast("Half portion price must be strictly less than full price.", "error");
      }
    }

    try {
      setSaving(true);
      const payload = buildPayload();

      if (editingItem) {
        await saveWithFallback(payload, editingItem.id);
        showToast("Menu item updated successfully.", "success");
      } else {
        await saveWithFallback(payload);
        showToast("Menu item created successfully.", "success");
      }

      setIsModalOpen(false);
      await fetchMenuItems();
    } catch (err) {
      console.error("Save menu item error:", err);
      showToast(getApiErrorMessage(err, "Failed to save menu item."), "error");
    } finally {
      setSaving(false);
    }
  }

  function initiateDelete(item) {
    setItemToDelete(item);
    setDeleteBlockedError(false);
  }

  async function confirmDelete() {
    if (!itemToDelete) return;
    try {
      setDeletingId(itemToDelete.id);
      await api.delete(`/restaurant/menu-items/${itemToDelete.id}`);
      showToast("Menu item deleted permanently.", "success");
      setItemToDelete(null);
      setDeleteBlockedError(false);
      await fetchMenuItems();
    } catch (err) {
      console.error("Delete menu item error:", err);
      const errMsg = getApiErrorMessage(err, "Failed to delete menu item.");
      // Check if blocked by past orders
      if (err.response?.status === 400 && String(errMsg).toLowerCase().includes("orders")) {
        setDeleteBlockedError(true);
      } else {
        showToast(errMsg, "error");
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDeactivateFromModal() {
    if (!itemToDelete) return;
    try {
      setDeletingId(itemToDelete.id);
      await api.put(`/restaurant/menu-items/${itemToDelete.id}`, { is_available: false });
      showToast(`${getItemName(itemToDelete)} marked as Unavailable and hidden from ordering.`, "success");
      setItemToDelete(null);
      setDeleteBlockedError(false);
      await fetchMenuItems();
    } catch (err) {
      showToast(getApiErrorMessage(err, "Failed to deactivate menu item."), "error");
    } finally {
      setDeletingId(null);
    }
  }

  const clearFilters = () => {
    setSearchText("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setDietaryFilter("all");
    setSortBy("name-asc");
  };

  function renderDietaryBadge(dietaryVal) {
    const config = dietaryTypes.find((d) => d.value === dietaryVal) || dietaryTypes[0];

    return (
      <span
        className={`dietary-badge ${config.className}`}
        title={config.label}
      >
        <span
          className={`dietary-icon ${config.iconClass}`}
          aria-hidden="true"
        />
        {config.label}
      </span>
    );
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
        title="Menu Items Catalog"
        kicker="RESTAURANT MANAGEMENT"
        description="Configure dish pricing, portion variations, dietary indicators, GST rates, and live ordering availability."
        icon={Utensils}
        backPath="/restaurant"
        rightAction={
          <button
            type="button"
            className="portal-action-btn"
            onClick={openAddModal}
          >
            <Plus size={16} /> Add Menu Item
          </button>
        }
      />

      {/* STATS GRID */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Menu Items"
          value={stats.total}
          Icon={Utensils}
          colorTheme="blue"
        />
        <StatCard
          title="Available To Order"
          value={stats.available}
          Icon={ChefHat}
          colorTheme="green"
        />
        <StatCard
          title="Unavailable / Inactive"
          value={stats.unavailable}
          Icon={XCircle}
          colorTheme="orange"
        />
        <StatCard
          title="Average Dish Value"
          value={stats.total > 0 ? `₹${(stats.totalValue / stats.total).toFixed(0)}` : "₹0"}
          Icon={IndianRupee}
          colorTheme="purple"
        />
      </div>

      {/* QUICK STATUS CHIPS */}
      <div className="rmi-quick-filter-strip">
        <div
          className={`rs-chip ${categoryFilter === "all" ? "active" : ""}`}
          onClick={() => setCategoryFilter("all")}
        >
          <span>All Categories ({stats.total})</span>
        </div>
        {allCategories.map((cat) => {
          const count = menuItems.filter((i) => getItemCategory(i).toLowerCase() === cat.toLowerCase()).length;
          if (count === 0 && categoryFilter !== cat.toLowerCase()) return null;
          return (
            <div
              key={cat}
              className={`rs-chip ${categoryFilter === cat.toLowerCase() ? "active" : ""}`}
              onClick={() => setCategoryFilter(cat.toLowerCase())}
            >
              <span>{cat} ({count})</span>
            </div>
          );
        })}
      </div>

      <section className="dir-modules-section">
        <ModuleWriternHeader
          title="Menu Catalog"
          description="Browse and manage all food, beverage, and dessert items organized by category."
          badgeCount={filteredItems.length}
          badgeLabel="items shown"
        />

        {/* CONTROLS & FILTERS */}
        <div className="dir-controls">
          <div className="dir-search-box" style={{ flex: 1.5 }}>
            <Search size={18} className="search-icon" />
            <input
              placeholder="Search items by name or category..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="dir-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              title="Filter by category"
            >
              <option value="all">All Categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat.toLowerCase()}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              className="dir-filter-select"
              value={dietaryFilter}
              onChange={(e) => setDietaryFilter(e.target.value)}
              title="Filter by dietary preference"
            >
              <option value="all">All Dietary</option>
              <option value="veg">Pure Veg</option>
              <option value="non-veg">Non-Veg</option>
              <option value="egg">Egg</option>
              <option value="vegan">Vegan</option>
            </select>

            <select
              className="dir-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              title="Filter by availability"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </select>

            <select
              className="dir-filter-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              title="Sort items"
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="price-low">Sort: Price (Low → High)</option>
              <option value="price-high">Sort: Price (High → Low)</option>
              <option value="status">Sort: Available First</option>
            </select>

            <button
              type="button"
              className="btn-cancel"
              style={{ height: "40px", padding: "0 14px" }}
              onClick={clearFilters}
              title="Reset all filters"
            >
              Clear
            </button>
          </div>
        </div>

        {/* 6 ITEMS PER ROW GRID */}
        {loading ? (
          <div className="empty-state-card">Loading menu catalog...</div>
        ) : itemsByCategory.length === 0 ? (
          <div className="empty-state-card">
            <h4>No menu items found</h4>
            <p>Try clearing your search query or adjusting your filters.</p>
          </div>
        ) : (
          <div className="rmi-categories-list">
            {itemsByCategory.map(({ category, items: catItems }) => (
              <div key={category} className="rmi-category-group">
                <div className="rmi-category-heading">
                  <h3>{category}</h3>
                  <span className="mono-pill">{catItems.length} Items</span>
                </div>

                <div className="rmi-items-grid-6">
                  {catItems.map((item) => {
                    const available = getItemAvailable(item);
                    const halfPrice = getItemHalfPrice(item);
                    const fullPrice = getItemFullPrice(item);
                    const dietaryVal = getItemDietary(item);
                    const taxVal = getItemTax(item);

                    return (
                      <div
                        key={item.id}
                        className={`rmi-item-card ${available ? "border-available" : "border-unavailable"}`}
                        onClick={() => openEditModal(item)}
                        title="Click to edit item"
                      >
                        {/* Top: Dietary Badge + Status Pill */}
                        <div className="rmi-card-top">
                          {renderDietaryBadge(dietaryVal)}
                          <button
                            type="button"
                            className={`rs-status-badge ${available ? "badge-available" : "badge-unavailable"}`}
                            style={{ cursor: "pointer", border: "none" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAvailability(item);
                            }}
                            title="Click to toggle availability"
                          >
                            {available ? "Available" : "Unavailable"}
                          </button>
                        </div>

                        {/* Title & Tax Pill */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "4px" }}>
                          <span className="rmi-item-name" title={getItemName(item)}>
                            {getItemName(item)}
                          </span>
                          <span className="rmi-tax-pill" title={`GST ${taxVal}%`}>
                            {taxVal}% GST
                          </span>
                        </div>

                        {/* Mid: Price Stack & Actions */}
                        <div className="rmi-card-mid">
                          <div className="rmi-price-stack">
                            {halfPrice > 0 && (
                              <span className="rmi-price-half">Half: ₹{halfPrice.toFixed(0)}</span>
                            )}
                            <span className="rmi-price-full">
                              {halfPrice > 0 ? "Full: " : ""}₹{fullPrice.toFixed(0)}
                            </span>
                          </div>

                          <div className="rmi-actions-row">
                            <button
                              type="button"
                              className="dir-row-edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(item);
                              }}
                              title="Edit Item"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="dir-row-edit-btn btn-del"
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateDelete(item);
                              }}
                              title="Delete or Deactivate Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {item.description && (
                          <div className="rmi-card-bottom">
                            <span className="rmi-desc-text">{item.description}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* EDIT & ADD MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: "620px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</h2>
                <p className="modal-kicker">Manage dish pricing, dietary classification, portion variations, and GST rates.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* DIETARY PREFERENCE */}
                <div className="form-group">
                  <label>Dietary Classification *</label>
                  <div className="dietary-selector-row">
                    {dietaryTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`dietary-selector-btn ${formData.dietary_type === type.value ? type.activeClass : ""}`}
                        onClick={() => handleDietarySelect(type.value)}
                      >
                        <span
                          className={`dietary-icon ${type.iconClass}`}
                          aria-hidden="true"
                        />
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* NAME & CATEGORY */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Item Name *</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Paneer Butter Masala, Cold Coffee"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="dir-select-field"
                      required
                    >
                      {defaultCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="Custom">+ Custom Category...</option>
                    </select>
                  </div>
                </div>

                {/* CUSTOM CATEGORY INPUT IF SELECTED */}
                {formData.category === "Custom" && (
                  <div className="form-group">
                    <label>Enter Custom Category *</label>
                    <input
                      type="text"
                      name="customCategory"
                      placeholder="e.g. Chinese Sizzlers, Tandoor Special"
                      value={formData.customCategory}
                      onChange={handleChange}
                      required
                    />
                  </div>
                )}

                {/* PRICING & HALF PORTION */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Price (₹) *</label>
                    <input
                      type="number"
                      name="full_price"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 260"
                      value={formData.full_price}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>GST Tax Rate *</label>
                    <select
                      name="tax_percent"
                      value={formData.tax_percent}
                      onChange={handleChange}
                      className="dir-select-field"
                      required
                    >
                      {gstTaxOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* HALF PORTION CHECKBOX & FIELD */}
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div className="rmi-checkbox-row">
                    <label>
                      <input
                        type="checkbox"
                        name="has_half_portion"
                        checked={formData.has_half_portion}
                        onChange={handleChange}
                      />
                      Enable Half-Portion Option for this dish
                    </label>
                  </div>

                  {formData.has_half_portion && (
                    <div className="form-group" style={{ marginTop: "10px" }}>
                      <label>Half Portion Price (₹) *</label>
                      <input
                        type="number"
                        name="half_price"
                        min="0"
                        step="0.01"
                        placeholder="Must be less than full price (e.g. 150)"
                        value={formData.half_price}
                        onChange={handleChange}
                        required={formData.has_half_portion}
                      />
                    </div>
                  )}
                </div>

                {/* DESCRIPTION */}
                <div className="form-group">
                  <label>Description / Ingredients (Optional)</label>
                  <textarea
                    name="description"
                    placeholder="Short description, spice level, allergens, or preparation details"
                    rows="2"
                    value={formData.description}
                    onChange={handleChange}
                    className="asr-modal-textarea"
                  />
                </div>

                {/* AVAILABILITY TOGGLE */}
                <div className="rmi-checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      name="is_available"
                      checked={formData.is_available}
                      onChange={handleChange}
                    />
                    Item is active & available for guest ordering
                  </label>
                </div>

                <div className="info-box-note">
                  <Briefcase size={15} color="#2d5696" style={{ flexShrink: 0 }} />
                  <span>
                    Changes made here sync live to the Table POS, Front Desk Room Service, and Kitchen Display System (KDS).
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  <Save size={14} /> {saving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE / DEACTIVATE MODAL */}
      {itemToDelete && (
        <div className="modal-overlay nested-modal" onClick={() => setItemToDelete(null)}>
          <div
            className="modal-content delete-confirm-modal"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ fontSize: "16px", color: deleteBlockedError ? "#d97706" : "#dc2626" }}>
                {deleteBlockedError ? "Order History Detected" : "Remove Menu Item"}
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setItemToDelete(null)}
                disabled={deletingId === itemToDelete.id}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: "12px" }}>
              {deleteBlockedError ? (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "12px", borderRadius: "8px", color: "#92400e", fontSize: "13px", lineHeight: "1.4" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", fontWeight: "bold", marginBottom: "4px" }}>
                    <AlertTriangle size={16} /> Cannot Delete Permanently
                  </div>
                  <strong>{getItemName(itemToDelete)}</strong> has existing restaurant order records. Removing it permanently would corrupt past invoices and GST audit trails.
                  <br /><br />
                  <strong>Recommendation:</strong> Deactivate this item instead. It will immediately disappear from waiter POS and room-service ordering portals while preserving previous sales logs.
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.4" }}>
                  Are you sure you want to remove <strong>{getItemName(itemToDelete)}</strong>?
                  <br /><br />
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Note: If this dish was ordered previously, hotel policy preserves past guest checks. You can safely <strong>Deactivate</strong> it below to hide it from new orders.
                  </span>
                </p>
              )}
            </div>

            <div className="modal-footer" style={{ background: "#f8fafc", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setItemToDelete(null)}
                disabled={deletingId === itemToDelete.id}
              >
                Cancel
              </button>

              {/* Smart Deactivate Option */}
              <button
                type="button"
                className="btn-warning-deactivate"
                onClick={handleDeactivateFromModal}
                disabled={deletingId === itemToDelete.id}
                title="Mark item as Unavailable so it cannot be ordered"
              >
                <XCircle size={14} /> Deactivate Item
              </button>

              {/* Permanent Delete Option */}
              {!deleteBlockedError && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={confirmDelete}
                  disabled={deletingId === itemToDelete.id}
                >
                  <Trash2 size={14} /> {deletingId === itemToDelete.id ? "Deleting..." : "Delete Permanently"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}