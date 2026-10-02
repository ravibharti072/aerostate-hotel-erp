import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  UserPlus,
  Plus,
  Search,
  Download,
  X,
  Eye,
  ShieldCheck,
  UserCheck,
  UserX,
  Building2,
  Users,
  Lock,
  Mail,
  Phone
} from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard";
import ModuleWriternHeader from "../../../components/headers/ModuleWriternHeader";
import styles from "./createCredential.module.css";

export default function CreateCredentialPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });

  const initialFormState = {
    hotel_id: "",
    username: "",
    password: "",
    role: "hotel-admin",
    full_name: "",
    email: "",
    phone: "",
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
      console.error("Failed to fetch credential page data:", err);
      setError("Failed to load platform data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
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
    setEditingUserId(null);
    setError("");
    setIsViewMode(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError("");
    setEditingUserId(null);
    setIsViewMode(false);
    setFormData(initialFormState);
  };

  const handleViewClick = (userRecord) => {
    setFormData({
      hotel_id: userRecord.hotel_id || "",
      username: userRecord.username || "",
      password: "",
      role: userRecord.role || "hotel-admin",
      full_name: userRecord.full_name || "",
      email: userRecord.email || "",
      phone: userRecord.phone || "",
      is_active: userRecord.is_active ?? true
    });
    setEditingUserId(userRecord.id);
    setError("");
    setIsViewMode(true);
    setIsModalOpen(true);
  };

  const handleToggleClick = (userRecord) => {
    const isCurrentlyActive = userRecord.is_active !== false;
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyActive ? "Deactivate User Access" : "Reactivate User Access",
      message: isCurrentlyActive ? `Deactivate user "${userRecord.username}"?` : `Reactivate user "${userRecord.username}"?`,
      data: { userId: userRecord.id, newStatus: !isCurrentlyActive }
    });
  };

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      await api.put(`/users/${confirmModal.data.userId}`, { is_active: confirmModal.data.newStatus });
      fetchData();
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
      setSuccess("User status updated successfully.");
    } catch (err) {
      console.error("Status update error:", err);
      setError("Failed to update user status.");
    }
  };

  async function handleSubmitCredential(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.hotel_id && formData.role === "hotel-admin") {
      setError("Please select a hotel property.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        hotel_id: formData.hotel_id ? parseInt(formData.hotel_id) : null,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        full_name: formData.full_name || `${formData.username} Admin`,
        email: formData.email || `${formData.username}@aerostatehotel.com`,
        phone: formData.phone || "0000000000",
        user_quota: 15,
        is_active: formData.is_active
      };

      if (editingUserId) {
        await api.put(`/users/${editingUserId}`, payload);
        setSuccess("Credentials updated successfully!");
      } else {
        await api.post("/auth/register-user", payload);
        setSuccess("Hotel Admin credentials created successfully!");
      }

      closeModal();
      fetchData();
    } catch (err) {
      console.error("Credential submission error:", err);
      setError(err.response?.data?.detail || "Failed to save credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleDownloadData = () => {
    if (!users.length) {
      alert("No credential records available to download.");
      return;
    }

    const headers = ["ID", "Username", "Full Name", "Role", "Hotel ID", "Email", "Phone", "Status", "Created At"];
    const rows = users.map(u => [
      `USER-${u.id.toString().padStart(4, '0')}`,
      `"${u.username || ''}"`,
      `"${u.full_name || ''}"`,
      `"${u.role || ''}"`,
      u.hotel_id || 'N/A',
      `"${u.email || ''}"`,
      `"${u.phone || ''}"`,
      u.is_active !== false ? "Active" : "Inactive",
      u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `platform_credentials_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hotelMap = useMemo(() => {
    const map = {};
    hotels.forEach(h => { map[h.id] = h.name; });
    return map;
  }, [hotels]);

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      (user?.username || "").toLowerCase().includes(search) || 
      (user?.full_name || "").toLowerCase().includes(search) ||
      (user?.email || "").toLowerCase().includes(search);
    
    const matchesRole = 
      roleFilter === "all" || user?.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const credentialStats = useMemo(() => {
    return {
      total: users.length,
      admin: users.filter(u => u.role === 'hotel-admin').length,
      active: users.filter(u => u.is_active !== false).length,
      inactive: users.filter(u => u.is_active === false).length,
    };
  }, [users]);

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="Create Hotel Admin Credentials" 
        kicker="PLATFORM MANAGEMENT"
        description="Provision and manage administrative access for hotel properties."
        icon={Key} 
        backPath="/super-admin/dashboard"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={styles["dir-add-btn"]} style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadData}>
              <Download size={18} /> Download Data
            </button>
            <button className={styles["dir-add-btn"]} onClick={openAddModal}>
              <Plus size={18} /> Add New Credential
            </button>
          </div>
        }
      />

      {/* Feedback Alerts */}
      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      {/* STATS GRID */}
      <div className={styles["dir-stats-grid"]}>
        <StatCard title="Total Accounts" value={credentialStats.total} Icon={Users} colorTheme="blue" />
        <StatCard title="Hotel Admins" value={credentialStats.admin} Icon={ShieldCheck} colorTheme="green" />
        <StatCard title="Active Users" value={credentialStats.active} Icon={UserCheck} colorTheme="purple" />
        <StatCard title="System Status" value="Online" Icon={Key} colorTheme="orange" />
      </div>

      {/* MODULE SECTION */}
      <section className={styles["dir-modules-section"]}>
        <ModuleWriternHeader 
          title="Credential Roster"
          description="View, sort, and manage system user credentials and permissions."
          badgeCount={filteredUsers.length}
          badgeLabel="credentials"
        />

        {/* TOOLBAR */}
        <div className={styles["dir-controls"]}>
          <select className={styles["dir-filter-select"]} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            <option value="hotel-admin">Hotel Admin</option>
            <option value="super-admin">Super Admin</option>
          </select>

          <div className={styles["dir-search-box"]}>
            <Search size={18} className={styles["search-icon"]} />
            <input 
              type="text" 
              placeholder="Search by username, full name, or email..." 
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
                <th>Username / Name</th>
                <th>Role</th>
                <th>Assigned Property</th>
                <th>Contact Info</th>
                <th>Status</th>
                <th>Registered On</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className={styles["empty-state"]}>Loading credentials...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles["empty-state"]}>No credentials match the selected filters.</td>
                </tr>
              ) : (
                filteredUsers.map((userRecord) => {
                  const isActive = userRecord?.is_active !== false;
                  return (
                    <tr key={userRecord.id}>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["table-hotel-name"]}>
                          <Key size={16} className="color-blue" />
                          <div>
                            <strong>{userRecord.username}</strong>
                            <span className={styles["staff-id"]}>{userRecord.full_name || "N/A"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <span className={styles["department-badge"]}>
                          {userRecord.role || "user"}
                        </span>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        {userRecord.hotel_id ? (hotelMap[userRecord.hotel_id] || `Hotel ID: ${userRecord.hotel_id}`) : "Platform Wide"}
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        <div className={styles["contact-info"]}>
                          <span><Mail size={13} /> {userRecord.email || "N/A"}</span>
                          <span><Phone size={13} /> {userRecord.phone || "N/A"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${isActive ? styles["status-active"] : styles["status-inactive"]}`}>
                          {isActive ? <UserCheck size={13} /> : <UserX size={13} />}
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ opacity: isActive ? 1 : 0.5 }}>
                        {userRecord.created_at ? new Date(userRecord.created_at).toLocaleDateString() : "N/A"}
                      </td>
                      <td className={styles["actions-cell"]}>
                        <button className={`${styles["action-btn"]} ${styles["edit-btn"]}`} onClick={() => handleViewClick(userRecord)} title="View / Edit Details">
                          <Eye size={16} />
                        </button>
                        <button className={`${styles["action-btn"]} ${isActive ? styles["delete-btn"] : styles["reactivate-btn"]}`} onClick={() => handleToggleClick(userRecord)} title={isActive ? "Deactivate" : "Reactivate"}>
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

      {/* ADD / EDIT / VIEW MODAL */}
      {isModalOpen && (
        <div className={styles["modal-overlay"]}>
          <div className={styles["modal-content"]}>
            <div className={styles["modal-header"]}>
              <h2>{editingUserId ? (isViewMode ? "View Credential Details" : "Edit Credential") : "Provision Admin Access"}</h2>
              <button className={styles["modal-close"]} onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitCredential}>
              <div className={styles["modal-body"]}>
                {error && <div className={styles["modal-error-message"]}>{error}</div>}
                
                <div className={styles["form-section-title"]} style={{marginTop:0}}>Account Details</div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Admin Username *</label>
                    <input type="text" name="username" required value={formData.username} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. grand_admin" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>{editingUserId ? "New Password (leave blank to keep)" : "Secure Password *"} </label>
                    <input type="password" name="password" required={!editingUserId} value={formData.password} onChange={handleInputChange} disabled={isViewMode} placeholder="••••••••••••" />
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Assigned Role *</label>
                    <select name="role" value={formData.role} onChange={handleInputChange} disabled={isViewMode}>
                      <option value="hotel-admin">Hotel Admin</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Select Hotel Property *</label>
                    <select name="hotel_id" value={formData.hotel_id} onChange={handleInputChange} disabled={isViewMode}>
                      <option value="">-- Choose Hotel --</option>
                      {hotels.map((hotel) => (
                        <option key={hotel.id} value={hotel.id}>
                          {hotel.name} (ID: {hotel.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles["form-section-title"]}>Personal & Contact Info</div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Full Name</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} disabled={isViewMode} placeholder="e.g. John Doe" />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={isViewMode} placeholder="admin@hotel.com" />
                  </div>
                </div>

                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>Phone Number</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} disabled={isViewMode} placeholder="+1 234 567 890" />
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
                    {submitting ? "Saving..." : (editingUserId ? "Update Credential" : "Create Admin Credential")}
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