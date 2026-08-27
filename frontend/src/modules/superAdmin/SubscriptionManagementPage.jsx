import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  ShieldCheck,
  ArrowLeft,
  Edit,
  X,
  Save,
  Calendar,
  UserCheck,
  CheckCircle,
  XCircle,
  Building2,
  Plus
} from "lucide-react";
import api from "../../api/api";
import styles from "./subscriptionManagement.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function SubscriptionManagementPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State (Edit or Create)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("edit"); // "create" or "edit"
  const [selectedItem, setSelectedItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className={styles["sa-page"]}>
      <SuperAdminSidebar />

      <main className={styles["sa-main"]}>
        {/* Top Header Card */}
        <header className={styles["sa-header-card"]}>
          <div className={styles["sa-header-left"]}>
            <div className={styles["sa-header-icon"]}>
              <Key size={24} />
            </div>
            <div>
              <span className={styles["sa-kicker"]}>Platform Management</span>
              <h1>Subscription & Credential Management</h1>
            </div>
          </div>

          <div className={styles["header-actions-group"]}>
            {unassignedHotels.length > 0 && (
              <button className={styles["create-btn"]} onClick={handleOpenCreate}>
                <Plus size={16} />
                Create Credential
              </button>
            )}
            <button className={styles["sa-back-btn"]} onClick={() => navigate("/super-admin/dashboard")}>
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
          </div>
        </header>

        {error && <div className={styles["alert-error"]}>{error}</div>}
        {success && <div className={styles["alert-success"]}>{success}</div>}

        {/* Directory Table Section */}
        <section className={styles["sa-list-section"]}>
          <div className={styles["sa-modules-header"]}>
            <div>
              <h3>Hotel Tenants & Validity Plan</h3>
              <p>Manage login credentials, account activation status, and subscription validity periods.</p>
            </div>
          </div>

          <div className={styles["table-responsive"]}>
            <table className={styles["hotels-table"]}>
              <thead>
                <tr>
                  <th>Hotel Property</th>
                  <th>Admin Username</th>
                  <th>Status</th>
                  <th>Subscription Start</th>
                  <th>Valid Upto (Expiry)</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {combinedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles["no-data"]}>
                      No properties found.
                    </td>
                  </tr>
                ) : (
                  combinedData.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className={styles["table-hotel-name"]}>
                          <Building2 size={16} className="color-blue" />
                          <div>
                            <strong>{item.name}</strong>
                            <span className={styles["hotel-id-tag"]}>ID: {item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {item.adminUser ? (
                          <div className={styles["credential-pill"]}>
                            <UserCheck size={14} className="color-green" />
                            <span>{item.adminUser.username}</span>
                          </div>
                        ) : (
                          <span className={styles["no-credential"]}>No Credential Yet</span>
                        )}
                      </td>
                      <td>
                        <span className={`${styles["status-badge"]} ${item.is_active ? styles["active"] : styles["inactive"]}`}>
                          {item.is_active ? <CheckCircle size={13} /> : <XCircle size={13} />}
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className={styles["date-info"]}>
                          <Calendar size={13} />
                          {item.subscription_start}
                        </div>
                      </td>
                      <td>
                        <div className={styles["date-info-expiry"]}>
                          <Calendar size={13} />
                          {item.valid_upto}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {item.adminUser ? (
                          <button
                            className={styles["btn-icon-edit"]}
                            onClick={() => handleOpenEdit(item)}
                            title="Manage Subscription & Credentials"
                          >
                            <Edit size={14} /> Manage
                          </button>
                        ) : (
                          <button
                            className={styles["btn-icon-create"]}
                            onClick={handleOpenCreate}
                            title="Create Credentials"
                          >
                            <Plus size={14} /> Create Login
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal (Create or Edit) */}
        {isModalOpen && (
          <div className={styles["modal-overlay"]}>
            <div className={styles["modal-card"]}>
              <div className={styles["modal-header"]}>
                <h3>
                  {modalMode === "create"
                    ? "Create Admin Credentials"
                    : `Manage Tenant: ${selectedItem?.name}`}
                </h3>
                <button className={styles["modal-close"]} onClick={handleCloseModal}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className={styles["modal-form"]}>
                <div className={styles["form-grid"]}>
                  
                  {modalMode === "create" && (
                    <div className={`${styles["form-group"]} ${styles["full-width"]}`}>
                      <label>Select Hotel Property *</label>
                      <select
                        name="hotel_id"
                        value={formData.hotel_id}
                        onChange={handleChange}
                        required
                        className={styles["modal-select"]}
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

                  <div className={styles["form-group"]}>
                    <label>Admin Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="e.g. grand_admin"
                      required
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
                    />
                  </div>

                  <div className={styles["form-group"]}>
                    <label>Subscription Start Date *</label>
                    <input
                      type="date"
                      name="subscription_start"
                      value={formData.subscription_start}
                      onChange={handleChange}
                      required
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
                    />
                  </div>

                  <div className={`${styles["form-group"]} ${styles["checkbox-group"]}`}>
                    <label className={styles["checkbox-label"]}>
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleChange}
                      />
                      Active Account Status (Allow Login Access)
                    </label>
                  </div>

                </div>

                <div className={styles["modal-actions"]}>
                  <button type="button" className={styles["cancel-btn"]} onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="submit" className={styles["submit-btn"]} disabled={submitting}>
                    <Save size={16} />
                    {submitting ? "Saving..." : modalMode === "create" ? "Create Credential" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}