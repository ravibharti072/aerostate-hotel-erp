import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChefHat,
  Edit,
  Filter,
  IndianRupee,
  Plus,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import api from "../../../../api/api";
import { useAuth } from "../../../../context/AuthContext";
import PortalHeader from "../../../../components/PortalHeader";
import StatCard from "../../../../components/StatCard"; 
import ModuleWriternHeader from "../../../../components/ModuleWriternHeader";
import "./restaurantMenuItems.css";

const initialForm = {
  name: "",
  category: "Food",
  half_price: "",
  full_price: "",
  description: "",
  is_available: true,
};

const categories = [
  "Food",
  "Beverages & Water",
  "Snacks & Packaged",
  "Desserts & Sweets",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Room Service",
  "Other",
];

export default function RestaurantMenuItemsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [menuItems, setMenuItems] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingItem, setEditingItem] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

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
  function getItemCategory(item) { return item?.category || item?.item_category || "Food"; }
  function getItemAvailable(item) {
    if (typeof item?.is_available === "boolean") return item.is_available;
    if (typeof item?.available === "boolean") return item.available;
    const status = String(item?.status || "").toLowerCase();
    if (status === "unavailable" || status === "inactive") return false;
    return true;
  }

  const supportsHalfPortion = useMemo(() => {
    const cat = (formData.category || "").toLowerCase();
    return cat === "food" || cat === "breakfast" || cat === "lunch" || cat === "dinner";
  }, [formData.category]);

  async function fetchMenuItems() {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/restaurant/menu-items");
      const list = normalizeList(response.data, "menu_items");
      setMenuItems(filterByHotel(list));
    } catch (err) {
      console.error("Fetch menu items error:", err);
      setError(getApiErrorMessage(err, "Failed to load menu items."));
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
    return { total: menuItems.length, available, unavailable, totalValue };
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const search = searchText.toLowerCase();
    return menuItems.filter((item) => {
      const name = getItemName(item).toLowerCase();
      const category = getItemCategory(item).toLowerCase();
      const available = getItemAvailable(item);

      const matchesSearch = !search || name.includes(search);
      const matchesStatus = statusFilter === "all" || (statusFilter === "available" && available) || (statusFilter === "unavailable" && !available);
      const matchesCategory = categoryFilter === "all" || category === categoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [menuItems, searchText, statusFilter, categoryFilter]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  function openAddModal() {
    setFormData(initialForm);
    setEditingItem(null);
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormData({
      name: getItemName(item),
      category: getItemCategory(item),
      half_price: getItemHalfPrice(item) || "",
      full_price: getItemFullPrice(item) || "",
      description: item.description || "",
      is_available: getItemAvailable(item),
    });
    setError("");
    setIsModalOpen(true);
  }

  function triggerDelete(item) {
    setItemToDelete(item);
  }

  function buildPayload() {
    const hotelId = getLoggedInHotelId();
    if (!hotelId) throw new Error("Hotel ID not found. Please logout and login again.");

    const cat = (formData.category || "").toLowerCase();
    const isFood = cat === "food" || cat === "breakfast" || cat === "lunch" || cat === "dinner";

    return {
      hotel_id: Number(hotelId),
      name: formData.name.trim(),
      item_name: formData.name.trim(),
      category: formData.category,
      half_price: isFood && formData.half_price ? Number(formData.half_price) : null,
      full_price: Number(formData.full_price || 0),
      price: Number(formData.full_price || 0),
      rate: Number(formData.full_price || 0),
      description: formData.description.trim(),
      is_available: Boolean(formData.is_available),
      available: Boolean(formData.is_available),
      status: formData.is_available ? "available" : "unavailable",
    };
  }

  async function saveWithFallback(payload, itemId = null) {
    const request = (data) => itemId ? api.put(`/restaurant/menu-items/${itemId}`, data) : api.post("/restaurant/menu-items", data);
    try {
      return await request(payload);
    } catch (err1) {
      if (err1.response?.status !== 422) throw err1;
      try {
        return await request({ 
          hotel_id: payload.hotel_id, 
          name: payload.name, 
          category: payload.category, 
          price: payload.price, 
          half_price: payload.half_price, 
          full_price: payload.full_price, 
          description: payload.description, 
          is_available: payload.is_available 
        });
      } catch (err2) {
        if (err2.response?.status !== 422) throw err2;
        return await request({ 
          hotel_id: payload.hotel_id, 
          item_name: payload.item_name, 
          category: payload.category, 
          price: payload.price, 
          half_price: payload.half_price, 
          full_price: payload.full_price, 
          description: payload.description, 
          status: payload.status 
        });
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Menu item name is required.");
    if (Number(formData.full_price || 0) <= 0) return setError("Price must be greater than 0.");

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = buildPayload();

      if (editingItem) {
        await saveWithFallback(payload, editingItem.id);
        setSuccess("Menu item updated successfully.");
      } else {
        await saveWithFallback(payload);
        setSuccess("Menu item created successfully.");
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccess(""), 3000);
      await fetchMenuItems();
    } catch (err) {
      console.error("Save menu item error:", err);
      setError(getApiErrorMessage(err, "Failed to save menu item."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!itemToDelete) return;

    try {
      setDeletingId(itemToDelete.id);
      setError("");
      setSuccess("");
      await api.delete(`/restaurant/menu-items/${itemToDelete.id}`);
      setSuccess("Menu item deleted successfully.");
      setTimeout(() => setSuccess(""), 3000);
      await fetchMenuItems();
    } catch (err) {
      console.error("Delete menu item error:", err);
      setError(getApiErrorMessage(err, "Failed to delete menu item."));
    } finally {
      setDeletingId(null);
      setItemToDelete(null);
    }
  }

  return (
    <div className="rmi-page">
      {/* SHARED UNIFIED PORTAL HEADER WITH ADD BUTTON */}
      <PortalHeader 
        title="Menu Items"
        kicker="RESTAURANT MANAGEMENT"
        description="Create, update, sort, and manage hotel restaurant food and beverage items."
        icon={Utensils}
        backPath="/restaurant"
        rightAction={
          <button className="rmi-add-btn" onClick={openAddModal}>
            <Plus size={16} /> Add Menu Item
          </button>
        }
      />

      {error && <div className="rmi-error-box">{error}</div>}
      {success && <div className="rmi-success-box">{success}</div>}

      {/* --- REUSABLE STATS GRID --- */}
      <section className="rmi-stats-grid">
        <StatCard
          title="Total Items"
          value={stats.total}
          Icon={Utensils}
          colorTheme="blue"
        />
        <StatCard
          title="Available"
          value={stats.available}
          Icon={ChefHat}
          colorTheme="green"
        />
        <StatCard
          title="Unavailable"
          value={stats.unavailable}
          Icon={X}
          colorTheme="red"
        />
        <StatCard
          title="Total Menu Value"
          value={`₹${stats.totalValue.toFixed(2)}`}
          Icon={IndianRupee}
          colorTheme="purple"
        />
      </section>

      {/* --- MODULE SECTION (Header + Toolbar + Grid) --- */}
      <section className="rmi-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Menu Catalog"
          description="Manage, search, and filter your food and beverage items."
          badgeCount={filteredItems.length}
          badgeLabel="items"
        />

        {/* TOOLBAR */}
        <div className="rmi-toolbar-card">
          <div className="rmi-search-box">
            <Search size={16}/>
            <input placeholder="Search items by name..." value={searchText} onChange={e => setSearchText(e.target.value)}/>
          </div>

          <div className="rmi-filters-right-group">
            <div className="rmi-filter-box">
              <Utensils size={16}/>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="rmi-filter-box">
              <Filter size={16}/>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>
        </div>

        {/* ITEMS GRID */}
        {loading ? (
          <div className="rmi-empty">Loading menu items...</div>
        ) : filteredItems.length === 0 ? (
          <div className="rmi-empty">No items found matching your filters.</div>
        ) : (
          <div className="rmi-cards-grid">
            {filteredItems.map(item => (
              <div key={item.id} className={`rmi-item-card ${!getItemAvailable(item) ? "unavailable-card" : ""}`}>
                <div className="rmi-item-header">
                  <span className="rmi-item-category">{getItemCategory(item)}</span>
                  <span className={`rmi-pill ${getItemAvailable(item) ? "available" : "unavailable"}`}>
                    {getItemAvailable(item) ? "Available" : "Unavailable"}
                  </span>
                </div>

                <h4 className="rmi-item-name">{getItemName(item)}</h4>
                {item.description && <p className="rmi-item-desc">{item.description}</p>}

                <div className="rmi-item-footer">
                  <div className="rmi-price-group">
                    {getItemHalfPrice(item) > 0 && (
                      <span className="rmi-item-price-half">Half: ₹{getItemHalfPrice(item).toFixed(2)}</span>
                    )}
                    <span className="rmi-item-price-full">
                      {getItemHalfPrice(item) > 0 ? "Full: " : ""}₹{getItemFullPrice(item).toFixed(2)}
                    </span>
                  </div>

                  <div className="rmi-item-actions">
                    <button className="rmi-action-btn edit" title="Edit Item" onClick={() => openEditModal(item)}>
                      <Edit size={14} />
                    </button>
                    <button className="rmi-action-btn delete" title="Delete Item" onClick={() => triggerDelete(item)} disabled={deletingId === item.id}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="rmi-modal-backdrop">
          <div className="rmi-modal">
            <div className="rmi-modal-header">
              <h3>{editingItem ? "Edit Menu Item" : "Add Menu Item"}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={18}/></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="rmi-form-row">
                <div className="rmi-form-group">
                  <label>Item Name *</label>
                  <input type="text" name="name" placeholder="E.g. Coca Cola or Dal Makhani" value={formData.name} onChange={handleChange} required />
                </div>
                <div className="rmi-form-group">
                  <label>Category *</label>
                  <select name="category" value={formData.category} onChange={handleChange} required>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rmi-form-row">
                {supportsHalfPortion && (
                  <div className="rmi-form-group">
                    <label>Half Price (₹)</label>
                    <input type="number" name="half_price" min="0" step="0.01" placeholder="Optional" value={formData.half_price} onChange={handleChange} />
                  </div>
                )}
                <div className={`rmi-form-group ${!supportsHalfPortion ? "rmi-full-width" : ""}`}>
                  <label>{supportsHalfPortion ? "Full Price (₹) *" : "Price (₹) *"}</label>
                  <input type="number" name="full_price" min="0" step="0.01" placeholder="E.g. 100" value={formData.full_price} onChange={handleChange} required />
                </div>
              </div>

              <div className="rmi-form-group">
                <label>Description (Optional)</label>
                <textarea name="description" placeholder="Preparation notes or ingredients" rows="3" value={formData.description} onChange={handleChange} />
              </div>

              <div className="rmi-checkbox-box">
                <label>
                  <input type="checkbox" name="is_available" checked={formData.is_available} onChange={handleChange} />
                  Item is currently available for order
                </label>
              </div>

              <div className="rmi-modal-actions">
                <button type="button" className="rmi-btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="rmi-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingItem ? "Update Item" : "Create Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {itemToDelete && (
        <div className="rmi-modal-backdrop">
          <div className="rmi-modal rmi-delete-modal">
            <div className="rmi-modal-header">
              <h3>Confirm Deletion</h3>
              <button onClick={() => setItemToDelete(null)}><X size={18}/></button>
            </div>
            <div className="rmi-delete-message">
              <p>Are you sure you want to delete <strong>{getItemName(itemToDelete)}</strong>?</p>
              <p>This action cannot be undone and it will be removed from your menu.</p>
            </div>
            <div className="rmi-modal-actions">
              <button type="button" className="rmi-btn-secondary" onClick={() => setItemToDelete(null)}>Cancel</button>
              <button type="button" className="rmi-btn-danger" onClick={confirmDelete} disabled={deletingId === itemToDelete.id}>
                {deletingId === itemToDelete.id ? "Deleting..." : "Yes, Delete Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}