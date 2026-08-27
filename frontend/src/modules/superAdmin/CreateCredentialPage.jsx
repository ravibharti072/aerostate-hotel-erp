import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  UserPlus,
  ArrowLeft,
} from "lucide-react";
import api from "../../api/api";
import styles from "./createCredential.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function CreateCredentialPage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [existingAdminHotelIds, setExistingAdminHotelIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    hotel_id: "",
    username: "",
    password: "",
    role: "hotel-admin",
  });

  // Auto-dismiss success message after 4 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
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

  async function fetchInitializationData() {
    try {
      setLoading(true);
      // Fetch both hotels and existing users simultaneously
      const [hotelsRes, usersRes] = await Promise.all([
        api.get("/hotels").catch(() => ({ data: [] })),
        api.get("/users").catch(() => ({ data: [] }))
      ]);

      const fetchedHotels = normalizeList(hotelsRes.data, "hotels");
      const fetchedUsers = normalizeList(usersRes.data, "users");

      setHotels(fetchedHotels);

      // Find all hotel IDs that already have a hotel-admin assigned
      const hotelIdsWithAdmins = fetchedUsers
        .filter((user) => user.role === "hotel-admin" && user.hotel_id)
        .map((user) => user.hotel_id);

      setExistingAdminHotelIds(hotelIdsWithAdmins);
    } catch (err) {
      console.error("Failed to initialize credential page data:", err);
      setError("Failed to load platform data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInitializationData();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleCreateCredential(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.hotel_id) {
      setError("Please select a hotel property.");
      return;
    }

    try {
      setSubmitting(true);
      
      const payload = {
        hotel_id: parseInt(formData.hotel_id),
        username: formData.username,
        password: formData.password,
        role: formData.role,
        full_name: `${formData.username} Admin`,
        email: `${formData.username}@aerostatehotel.com`,
        phone: "0000000000",
        user_quota: 15,
        is_active: true
      };

      await api.post("/auth/register-user", payload);
      
      setSuccess("Hotel Admin credentials created successfully!");
      
      // Add newly created hotel ID to the excluded list immediately
      setExistingAdminHotelIds((prev) => [...prev, parseInt(formData.hotel_id)]);

      setFormData({
        hotel_id: "",
        username: "",
        password: "",
        role: "hotel-admin",
      });
    } catch (err) {
      console.error("Credential creation error:", err);
      setError(err.response?.data?.detail || "Failed to create credentials. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Filter out any hotel that already has an admin credential created previously or now
  const availableHotels = hotels.filter((hotel) => !existingAdminHotelIds.includes(hotel.id));

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
              <h1>Create Hotel Admin Credentials</h1>
            </div>
          </div>

          <button className={styles["sa-back-btn"]} onClick={() => navigate("/super-admin/dashboard")}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
        </header>

        {/* Feedback Alerts */}
        {error && <div className={styles["alert-error"]}>{error}</div>}
        {success && <div className={styles["alert-success"]}>{success}</div>}

        {/* Credential Form Card */}
        <section className={styles["sa-form-section"]}>
          <div className={styles["section-title"]}>
            <UserPlus size={20} />
            <h3>Provision Admin Access</h3>
          </div>

          <form onSubmit={handleCreateCredential} className={styles["credential-form"]}>
            <div className={styles["form-grid"]}>
              
              {/* Row 1: Select Hotel Property & Assigned Role */}
              <div className={styles["form-group"]}>
                <label>Select Hotel Property *</label>
                <select
                  name="hotel_id"
                  value={formData.hotel_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Choose Hotel --</option>
                  {availableHotels.map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} (ID: {hotel.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles["form-group"]}>
                <label>Assigned Role</label>
                <input
                  type="text"
                  value="Hotel Admin"
                  disabled
                  className={styles["disabled-input"]}
                />
              </div>

              {/* Row 2: Admin Username & Secure Password */}
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
                <label>Secure Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  required
                />
              </div>

            </div>

            <div className={styles["form-actions"]}>
              <button type="submit" className={styles["submit-btn"]} disabled={submitting}>
                {submitting ? "Generating Credentials..." : "Create Admin Credential"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}