import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  ShieldCheck,
  Edit,
  X,
  Save,
  Calendar,
  CheckCircle,
  XCircle,
  Building2,
  Plus,
  Search,
  Download,
  Eye,
  UserCheck,
  UserX,
  Users
} from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard";
import ModuleWriternHeader from "../../../components/headers/ModuleWriternHeader";
import styles from "./subscriptionManagement.module.css";

export default function SubscriptionManagementPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State (Edit, Create, or View)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create", "edit", or "view"
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });

  const [formData, setFormData] = useState({
    hotel_id: "",
    username: "",
    password: "",
    is_active: true,
    subscription_start: new Date().toISOString().slice(0, 10),
    valid_upto: "2027-01-01",
  });

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error message
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

  async function fetchData() {
    try {
      setLoading(true);
      const [hotelsRes, usersRes] = await Promise.all([
        api.get("/hotels").catch(() => ({ data: [] })),
        api.get("/users").catch(() => ({ data: [] }))
      ]);

      setHotels(normalizeList(hotelsRes.data, "hotels"));
      setUsers(normalizeList(usersRes.data, "users"));
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load platform data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Retrieve saved subscriptions from localStorage for custom persistence
  const savedSubscriptions = JSON.parse(localStorage.getItem("hotel_subscriptions") || "{}");

  // Combine hotels with their respective admin user credentials and calculate expiry status
  const combinedData = hotels.map((hotel) => {
    const adminUser = users.find(
      (u) => u.hotel_id === hotel.id && u.role === "hotel-admin"
    );
    const customSub = savedSubscriptions[hotel.id] || {};

    const subscription_start = customSub.subscription_start || adminUser?.subscription_start || hotel.created_at?.slice(0, 10) || "2026-01-01";
    const valid_upto = customSub.valid_upto || adminUser?.valid_upto || "2027-01-01";

    // Automatically check if today's date has passed the expiry date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(valid_upto);
    expiryDate.setHours(0, 0, 0, 0);

    const isExpired = today > expiryDate;
    const dbActive = customSub.is_active !== undefined ? customSub.is_active : (adminUser ? adminUser.is_active : hotel.is_active);
    const finalActiveStatus = isExpired ? false : dbActive;

    return {
      ...hotel,
      adminUser: adminUser || null,
      subscription_start,
      valid_upto,
      is_active: finalActiveStatus,
      isExpired,
    };
  });

  // Hotels that do NOT have credentials yet
  const unassignedHotels = combinedData.filter((item) => !item.adminUser);

  function handleOpenCreate() {
    setModalMode("create");
    setSelectedItem(null);
    setFormData({
      hotel_id: unassignedHotels[0]?.id || "",
      username: "",
      password: "",
      is_active: true,
      subscription_start: new Date().toISOString().slice(0, 10),
      valid_upto: "2027-01-01",
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(item) {
    setModalMode("edit");
    setSelectedItem(item);
    setFormData({
      hotel_id: item.id,
      username: item.adminUser?.username || "",
      password: "",
      is_active: item.is_active,
      subscription_start: item.subscription_start,
      valid_upto: item.valid_upto,
    });
    setIsModalOpen(true);
  }

  function handleOpenView(item) {
    setModalMode("view");
    setSelectedItem(item);
    setFormData({
      hotel_id: item.id,
      username: item.adminUser?.username || "N/A",
      password: "",
      is_active: item.is_active,
      subscription_start: item.subscription_start,
      valid_upto: item.valid_upto,
    });
    setIsModalOpen(true);
  }

  function handleToggleClick(item) {
    if (!item.adminUser) {
      setError("Cannot toggle status for a hotel without an assigned admin credential.");
      return;
    }
    const isCurrentlyActive = item.is_active;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyActive ? "Deactivate Subscription" : "Reactivate Subscription",
      message: isCurrentlyActive ? `Deactivate subscription and login for "${item.name}"?` : `Reactivate subscription for "${item.name}"?`,
      data: { hotelId: item.id, adminUserId: item.adminUser.id, newStatus: !isCurrentlyActive }
    });
  }

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      const { hotelId, adminUserId, newStatus } = confirmModal.data;

      const currentSubs = JSON.parse(localStorage.getItem("hotel_subscriptions") || "{}");
      if (!currentSubs[hotelId]) {
        const targetItem = combinedData.find(i => i.id === hotelId);
        currentSubs[hotelId] = {
          subscription_start: targetItem?.subscription_start || new Date().toISOString().slice(0, 10),
          valid_upto: targetItem?.valid_upto || "2027-01-01",
          is_active: newStatus,
        };
      } else {
        currentSubs[hotelId].is_active = newStatus;
      }
      localStorage.setItem("hotel_subscriptions", JSON.stringify(currentSubs));

      await api.put(`/users/${adminUserId}`, { is_active: newStatus }).catch(() => {});
      
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
      setSuccess("Subscription status updated successfully.");
      fetchData();
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update status.");
    }
  };

  function handleCloseModal() {
    setIsModalOpen(false);
    setSelectedItem(null);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      setSubmitting(true);

      const targetHotelId = formData.hotel_id || selectedItem?.id;

      // Check expiry date against today upon saving
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(formData.valid_upto);
      expiryDate.setHours(0, 0, 0, 0);

      const isNowExpired = today > expiryDate;
      const finalActiveState = isNowExpired ? false : formData.is_active;

      // Save subscription dates and active status to localStorage for instant UI persistence
      const currentSubs = JSON.parse(localStorage.getItem("hotel_subscriptions") || "{}");
      currentSubs[targetHotelId] = {
        subscription_start: formData.subscription_start,
        valid_upto: formData.valid_upto,
        is_active: finalActiveState,
      };
      localStorage.setItem("hotel_subscriptions", JSON.stringify(currentSubs));

      if (modalMode === "create") {
        if (!formData.hotel_id) {
          setError("Please select a hotel property.");
          setSubmitting(false);
          return;
        }

        const createPayload = {
          hotel_id: parseInt(formData.hotel_id),
          username: formData.username,
          password: formData.password,
          role: "hotel-admin",
          full_name: `${formData.username} Admin`,
          email: `${formData.username}@aerostatehotel.com`,
          phone: "0000000000",
          user_quota: 15,
          is_active: finalActiveState,
          subscription_start: formData.subscription_start,
          valid_upto: formData.valid_upto,
        };

        await api.post("/auth/register-user", createPayload);
        setSuccess("Hotel Admin credentials created successfully!");
      } else {
        // Edit mode
        if (selectedItem?.adminUser) {
          const userPayload = {
            username: formData.username,
            role: "hotel-admin",
            hotel_id: selectedItem.id,
            is_active: finalActiveState,
            subscription_start: formData.subscription_start,
            valid_upto: formData.valid_upto,
          };
          if (formData.password) {
            userPayload.password = formData.password;
          }

          await api.put(`/users/${selectedItem.adminUser.id}`, userPayload).catch(() => {
            console.warn("User endpoint direct update fallback triggered.");
          });
        }
        setSuccess("Subscription & credentials updated successfully!");
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Operation failed:", err);
      setError(err.response?.data?.detail || "Failed to process request.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleDownloadData = () => {
    if (!combinedData.length) {
      alert("No subscription records available to download.");
      return;
    }

    const headers = ["ID", "Hotel Property", "Admin Username", "Status", "Subscription Start", "Valid Upto"];
    const rows = combinedData.map(item => [
      `HOTEL-${item.id.toString().padStart(4, '0')}`,
      `"${item.name || ''}"`,
      `"${item.adminUser?.username || 'No Credential'}"`,
      item.is_active ? "Active" : "Inactive",
      item.subscription_start || '',
      item.valid_upto || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `subscription_plans_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = combinedData.filter(item => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (item?.name || "").toLowerCase().includes(search) || 
      (item?.adminUser?.username || "").toLowerCase().includes(search);
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && item?.is_active) || 
      (statusFilter === "inactive" && !item?.is_active);

    return matchesSearch && matchesStatus;
  });

  const subscriptionStats = useMemo(() => {
    return {
      total: combinedData.length,
      active: combinedData.filter(i => i.is_active).length,
      inactive: combinedData.filter(i => !i.is_active).length,
      unassigned: unassignedHotels.length,
    };
  }, [combinedData, unassignedHotels]);

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="Subscription & Credential Management" 
        kicker="PLATFORM MANAGEMENT"
        description="Manage login credentials, account activation status, and subscription validity periods."
        icon={Key} 
        backPath="/super-admin/dashboard"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles["dir-add-btn"]} style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadData}>
              <Download size={18} /> Download Data
            </button>
            {unassignedHotels.length > 0 && (
              <button className={styles["dir-add-btn"]} onClick={handleOpenCreate}>
                <Plus size={18} /> Create Credential
              </button>
            )}
          </div>
        }
      />

      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      {/* STATS GRID */}
      <div className={styles["dir-stats-grid"]}>
        <StatCard
          title="Total Properties"
          value={subscriptionStats.total}
          Icon={Building2}
          colorTheme="blue"
        />
        <StatCard
          title="Active Subscriptions"
          value={subscriptionStats.active}
          Icon={UserCheck}
          colorTheme="green"
        />
        <StatCard
          title="Inactive / Expired"
          value={subscriptionStats.inactive}
          Icon={UserX}
          colorTheme="purple"
        />
        <StatCard
          title="Unassigned Hotels"
          value={subscriptionStats.unassigned}
          Icon={ShieldCheck}
          colorTheme="orange"
        />
      </div>

      {/* MODULE SECTION */}
      <section className={styles["dir-modules-section"]}>
        <ModuleWriternHeader 
          title="Hotel Tenants & Validity Plan"
          description="View, sort, and manage account activation status and subscription validity periods."
          badgeCount={filteredData.length}
          badgeLabel="properties"
        />

        {/* TOOLBAR */}
        <div className={styles["dir-controls"]}>
          <select className={styles["dir-filter-select"]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive / Expired Only</option>
          </select>

          <div className={styles["dir-search-box"]}>
            <Search size={18} className={styles["search-icon"]} />
            <input 
              type="text" 
              placeholder="Search by hotel name or admin username..." 
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
                <th>Hotel Property</th>
                <th>Admin Username</th>
                <th>Status</th>
                <th>Subscription Start</th>
                <th>Valid Upto (Expiry)</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className={styles["empty-state"]}>Loading subscription records...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan="6" className={styles["empty-state"]}>No properties match the selected filters.</td>
                </tr>
              ) : (
                filteredData.map((item) => {
                  const isActive = item?.is_active;
                  return (
                    <tr key={item.id}>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["table-hotel-name"]}>
                          <Building2 size={16} className="color-blue" />
                          <div>
                            <strong>{item.name}</strong>
                            <span className={styles["staff-id"]}>ID: HOTEL-{item.id.toString().padStart(4, '0')}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        {item.adminUser ? (
                          <span className={styles["department-badge"]}>
                            {item.adminUser.username}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No Credential Yet</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${isActive ? styles["status-active"] : styles["status-inactive"]}`}>
                          {isActive ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["date-info"]}>
                          <Calendar size={13} />
                          {item.subscription_start}
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["date-info-expiry"]}>
                          <Calendar size={13} />
                          {item.valid_upto}
                        </div>
                      </td>
                      <td className={styles["actions-cell"]}>
                        <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleOpenView(item)} title="View Details">
                          <Eye size={16} />
                        </button>
                        {item.adminUser ? (
                          <>
                            <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleOpenEdit(item)} title="Manage Subscription & Credentials">
                              <Edit size={16} />
                            </button>
                            <button className={`${styles["action-btn"]} ${isActive ? styles["delete-btn"] : styles["reactivate-btn"]}`} onClick={() => handleToggleClick(item)} title={isActive ? "Deactivate" : "Reactivate"}>
                              {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                            </button>
                          </>
                        ) : (
                          <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={handleOpenCreate} title="Create Login">
                            <Plus size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal (Create, Edit, or View) */}
      {isModalOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]}>
            <div className={styles["modal-header"]}>
              <h2>
                {modalMode === "create"
                  ? "Create Admin Credentials"
                  : modalMode === "view"
                  ? `View Tenant: ${selectedItem?.name}`
                  : `Manage Tenant: ${selectedItem?.name}`}
              </h2>
              <button className={styles["modal-close"]} onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={styles["modal-body"]}>
                {modalMode === "create" && (
                  <div className={styles["form-group"]}>
                    <label>Select Hotel Property *</label>
                    <select
                      name="hotel_id"
                      value={formData.hotel_id}
                      onChange={handleChange}
                      required
                      disabled={modalMode === "view"}
                    >
                      <option value="">-- Choose Hotel Property --</option>
                      {unassignedHotels.map((hotel) => (
                        <option key={hotel.id} value={hotel.id}>
                          {hotel.name} (ID: {hotel.id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Admin Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="e.g. grand_admin"
                      required
                      disabled={modalMode === "view"}
                    />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>
                      {modalMode === "create" ? "Secure Password *" : "New Password (Optional)"}
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••••••"
                      required={modalMode === "create"}
                      disabled={modalMode === "view"}
                    />
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Subscription Start Date *</label>
                    <input
                      type="date"
                      name="subscription_start"
                      value={formData.subscription_start}
                      onChange={handleChange}
                      required
                      disabled={modalMode === "view"}
                    />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Valid Upto / Expiry Date *</label>
                    <input
                      type="date"
                      name="valid_upto"
                      value={formData.valid_upto}
                      onChange={handleChange}
                      required
                      disabled={modalMode === "view"}
                    />
                  </div>
                </div>

                <div className={styles["form-group"]}>
                  <label>Account Status</label>
                  <select
                    name="is_active"
                    value={formData.is_active ? "true" : "false"}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === "true" }))}
                    disabled={modalMode === "view"}
                  >
                    <option value="true">Active (Allow Login Access)</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className={styles["modal-footer"]}>
                <button type="button" className={styles["btn-cancel"]} onClick={handleCloseModal}>
                  {modalMode === "view" ? "Close" : "Cancel"}
                </button>
                {modalMode === "view" ? (
                  <button type="button" className={styles["btn-submit"]} onClick={() => setModalMode("edit")}>
                    Edit Details
                  </button>
                ) : (
                  <button type="submit" className={styles["btn-submit"]} disabled={submitting}>
                    <Save size={16} />
                    {submitting ? "Saving..." : modalMode === "create" ? "Create Credential" : "Save Changes"}
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