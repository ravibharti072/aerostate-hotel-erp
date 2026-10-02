import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Hotel,
  Plus,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  MapPin,
  Search,
  Download,
  X,
  Eye,
  ShieldCheck,
  UserCheck,
  UserX
} from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard";
import ModuleWriternHeader from "../../../components/headers/ModuleWriternHeader";
import styles from "./hotelOnboard.module.css";

export default function HotelOnboardPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingHotelId, setEditingHotelId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });

  const initialFormState = {
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    tax_number: "",
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  // Auto-dismiss messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
  }

  async function fetchHotels() {
    try {
      setLoading(true);
      const response = await api.get("/hotels");
      setHotels(normalizeList(response.data, "hotels"));
    } catch (err) {
      console.error("Failed to fetch hotels:", err);
      setError("Failed to load hotels list.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHotels();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const openAddModal = () => {
    setFormData(initialFormState);
    setEditingHotelId(null);
    setError("");
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError("");
    setEditingHotelId(null);
    setIsViewMode(false);
    setFormData(initialFormState);
  };

  const handleViewClick = (hotel) => {
    setFormData({
      name: hotel.name || "",
      owner_name: hotel.owner_name || "",
      email: hotel.email || "",
      phone: hotel.phone || "",
      address: hotel.address || "",
      city: hotel.city || "",
      state: hotel.state || "",
      country: hotel.country || "",
      tax_number: hotel.tax_number || "",
      is_active: hotel.is_active ?? true
    });
    setEditingHotelId(hotel.id);
    setError("");
    setIsViewMode(true);
    setIsModalOpen(true);
  };

  const handleToggleClick = (hotel) => {
    const isCurrentlyActive = hotel.is_active;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyActive ? "Deactivate Hotel Property" : "Reactivate Hotel Property",
      message: isCurrentlyActive ? `Deactivate "${hotel.name}"? Tenants will lose platform access.` : `Reactivate "${hotel.name}"?`,
      data: { hotelId: hotel.id, newStatus: !isCurrentlyActive }
    });
  };

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      await api.put(`/hotels/${confirmModal.data.hotelId}`, { is_active: confirmModal.data.newStatus });
      fetchHotels();
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
      setSuccess("Hotel status updated successfully.");
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update hotel status.");
    }
  };

  async function handleSubmitHotel(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSubmitting(true);
      if (editingHotelId) {
        await api.put(`/hotels/${editingHotelId}`, formData);
        setSuccess("Hotel updated successfully!");
      } else {
        await api.post("/hotels", formData);
        setSuccess("Hotel registered successfully!");
      }
      closeModal();
      fetchHotels();
    } catch (err) {
      console.error("Hotel submission error:", err);
      setError(err.response?.data?.detail || "Failed to save hotel details.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleDownloadHotelData = () => {
    if (!hotels.length) {
      alert("No hotel records available to download.");
      return;
    }

    const headers = ["ID", "Hotel Name", "Owner", "Email", "Phone", "City", "State", "Country", "Tax Number", "Status", "Registered On"];
    const rows = hotels.map(h => [
      `HOTEL-${h.id.toString().padStart(4, '0')}`,
      `"${h.name || ''}"`,
      `"${h.owner_name || ''}"`,
      `"${h.email || ''}"`,
      `"${h.phone || ''}"`,
      `"${h.city || ''}"`,
      `"${h.state || ''}"`,
      `"${h.country || ''}"`,
      `"${h.tax_number || ''}"`,
      h.is_active ? "Active" : "Inactive",
      h.created_at ? new Date(h.created_at).toISOString().split('T')[0] : ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hotel_tenants_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHotels = hotels.filter(hotel => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (hotel?.name || "").toLowerCase().includes(search) || 
      (hotel?.owner_name || "").toLowerCase().includes(search) ||
      (hotel?.email || "").toLowerCase().includes(search) ||
      (hotel?.phone || "").includes(search);
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && hotel?.is_active) || 
      (statusFilter === "inactive" && !hotel?.is_active);

    return matchesSearch && matchesStatus;
  });

  const hotelStats = useMemo(() => {
    return {
      total: hotels.length,
      active: hotels.filter(h => h.is_active).length,
      inactive: hotels.filter(h => !h.is_active).length,
    };
  }, [hotels]);

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="Hotel Onboarding" 
        kicker="PLATFORM MANAGEMENT"
        description="Manage all hotel properties, ownership records, and tenant accounts."
        icon={Hotel} 
        backPath="/super-admin/dashboard"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles["dir-add-btn"]} style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadHotelData}>
              <Download size={18} /> Download Data
            </button>
            <button className={styles["dir-add-btn"]} onClick={openAddModal}>
              <Plus size={18} /> Add New Hotel
            </button>
          </div>
        }
      />

      {/* Feedback Alerts */}
      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      {/* STATS GRID */}
      <div className={styles["dir-stats-grid"]}>
        <StatCard title="Total Properties" value={hotelStats.total} Icon={Building2} colorTheme="blue" />
        <StatCard title="Active Tenants" value={hotelStats.active} Icon={UserCheck} colorTheme="green" />
        <StatCard title="Inactive Properties" value={hotelStats.inactive} Icon={UserX} colorTheme="purple" />
        <StatCard title="System Status" value="Online" Icon={ShieldCheck} colorTheme="orange" />
      </div>

      {/* MODULE SECTION */}
      <section className={styles["dir-modules-section"]}>
        <ModuleWriternHeader 
          title="Active Hotel Tenants"
          description="View, sort, and update hotel properties onboarded on the network."
          badgeCount={filteredHotels.length}
          badgeLabel="hotels"
        />

        {/* TOOLBAR */}
        <div className={styles["dir-controls"]}>
          <select className={styles["dir-filter-select"]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          <div className={styles["dir-search-box"]}>
            <Search size={18} className={styles["search-icon"]} />
            <input 
              type="text" 
              placeholder="Search by hotel name, owner, or email..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* TABLE CONTAINER */}
        <div className={styles["dir-table-container"]}>
          <table className={styles["dir-table"]}>
            <thead>
              <tr>
                <th>Hotel Name</th>
                <th>Owner</th>
                <th>Contact Info</th>
                <th>Location</th>
                <th>Status</th>
                <th>Registered On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className={styles["empty-state"]}>Loading hotels...</td>
                </tr>
              ) : filteredHotels.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles["empty-state"]}>No hotels match the selected filters.</td>
                </tr>
              ) : (
                filteredHotels.map((hotel) => {
                  const isActive = hotel?.is_active;
                  return (
                    <tr key={hotel.id}>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["table-hotel-name"]}>
                          <Building2 size={16} className="color-blue" />
                          <div>
                            <strong>{hotel.name}</strong>
                            <span className={styles["staff-id"]}>ID: HOTEL-{hotel.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>{hotel.owner_name}</td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["contact-info"]}>
                          <span><Mail size={13} /> {hotel.email}</span>
                          <span><Phone size={13} /> {hotel.phone}</span>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["location-info"]}>
                          <MapPin size={13} />
                          {hotel.city ? `${hotel.city}, ${hotel.country || ""}` : "N/A"}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${isActive ? styles["status-active"] : styles["status-inactive"]}`}>
                          {isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>{new Date(hotel.created_at).toLocaleDateString()}</td>
                      <td className={styles["actions-cell"]}>
                        <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleViewClick(hotel)} title="View / Edit Details">
                          <Eye size={16} />
                        </button>
                        <button className={`${styles["action-btn"]} ${isActive ? styles["delete-btn"] : styles["reactivate-btn"]}`} onClick={() => handleToggleClick(hotel)} title={isActive ? "Deactivate" : "Reactivate"}>
                          {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ADD / EDIT / VIEW HOTEL MODAL */}
      {isModalOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]}>
            <div className={styles["modal-header"]}>
              <h2>{editingHotelId ? (isViewMode ? "View Hotel Property" : "Edit Hotel Property") : "Register New Hotel Property"}</h2>
              <button className={styles["modal-close"]} onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitHotel}>
              <div className={styles["modal-body"]}>
                {error && <div className={styles["modal-error-message"]}>{error}</div>}
                
                <div className={styles["form-section-title"]} style={{marginTop:0}}>Property Details</div>
                <div className={styles["form-group"]}>
                  <label>Hotel Name *</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. Aerostate Grand Resort" />
                </div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Owner Name *</label>
                    <input type="text" name="owner_name" required value={formData.owner_name} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. John Doe" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Tax Number / GST</label>
                    <input type="text" name="tax_number" value={formData.tax_number} onChange={handleInputChange} disabled={isViewMode} placeholder="Tax Registration ID" />
                  </div>
                </div>

                <div className={styles["form-section-title"]}>Contact Information</div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Official Email *</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. contact@hotel.com" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Phone Number *</label>
                    <input type="text" name="phone" required value={formData.phone} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. +1 234 567 890" />
                  </div>
                </div>

                <div className={styles["form-section-title"]}>Location & Address</div>
                <div className={styles["form-group"]}>
                  <label>Street Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} disabled={isViewMode} placeholder="Street address" />
                </div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>City</label>
                    <input type="text" name="city" value={formData.city} onChange={handleInputChange} disabled={isViewMode} placeholder="City" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>State / Province</label>
                    <input type="text" name="state" value={formData.state} onChange={handleInputChange} disabled={isViewMode} placeholder="State" />
                  </div>
                </div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Country</label>
                    <input type="text" name="country" value={formData.country} onChange={handleInputChange} disabled={isViewMode} placeholder="Country" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Account Status</label>
                    <select name="is_active" value={formData.is_active ? "true" : "false"} onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === "true" }))} disabled={isViewMode}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className={styles["modal-footer"]}>
                <button type="button" className={styles["btn-cancel"]} onClick={closeModal}>{isViewMode ? "Close" : "Cancel"}</button>
                {isViewMode ? (
                  <button type="button" className={styles["btn-submit"]} onClick={() => setIsViewMode(false)}>
                    Edit Details
                  </button>
                ) : (
                  <button type="submit" className={styles["btn-submit"]} disabled={submitting}>
                    {submitting ? "Saving..." : (editingHotelId ? "Update Hotel" : "Onboard Hotel")}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["confirm-modal-content"]}>
            <div className={styles["modal-header"]} style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h2>{confirmModal.title}</h2>
              <button className={styles["modal-close"]} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}><X size={20} /></button>
            </div>
            <div className={styles["modal-body"]} style={{ textAlign: 'center', padding: '10px 24px', fontSize: '14px', color: '#475569' }}>
              <p>{confirmModal.message}</p>
            </div>
            <div className={styles["modal-footer"]} style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
              <button className={styles["btn-cancel"]} onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancel</button>
              <button className={`${styles["btn-submit"]} ${styles["btn-danger"]}`} onClick={executeStatusToggle}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}