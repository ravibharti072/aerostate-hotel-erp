import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCog,
  CheckSquare,
  Square,
  ArrowLeft,
  Building2,
  Save
} from "lucide-react";
import api from "../../api/api";
import styles from "./assignModule.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function AssignModulePage() {
  const navigate = useNavigate();

  const [hotels, setHotels] = useState([]);
  const [availableModules, setAvailableModules] = useState([]); // Fetched from backend
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedModules, setSelectedModules] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
  }

  // Fetch both hotels and available system modules when the page loads
  async function fetchInitialData() {
    try {
      setLoading(true);
      
      // Replace "/modules" with your actual backend endpoint for all modules if it differs
      const [hotelsRes, modulesRes] = await Promise.all([
        api.get("/hotels"),
        api.get("/modules").catch(() => ({ data: [] })) 
      ]);

      setHotels(normalizeList(hotelsRes.data, "hotels"));
      
      // Store the dynamic modules fetched from the database
      const fetchedModules = normalizeList(modulesRes.data, "modules");
      
      // Fallback to hardcoded if backend endpoint doesn't exist yet, just so your page doesn't break
      if (fetchedModules.length === 0) {
        console.warn("No modules fetched from backend. Ensure you have a GET /modules route.");
      } else {
        setAvailableModules(fetchedModules);
      }

    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      setError("Failed to load hotels or system modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch exactly what is saved in the database for the selected hotel
  async function fetchHotelModules(hotelId) {
    try {
      const res = await api.get(`/hotels/${hotelId}/modules`);
      const assignedMods = res.data?.modules || [];
      
      const initialModules = {};
      availableModules.forEach((mod) => {
        // Match backend format (might be mod.id, mod.key, or mod.name depending on your DB)
        initialModules[mod.id || mod.module_key] = assignedMods.includes(mod.id || mod.module_key); 
      });
      setSelectedModules(initialModules);
    } catch (err) {
      console.error("Failed to fetch assigned modules:", err);
      setError("Could not load hotel's current permissions.");
    }
  }

  function handleHotelChange(e) {
    const hotelId = e.target.value;
    setSelectedHotelId(hotelId);
    setError("");
    setSuccess("");

    if (hotelId) {
      fetchHotelModules(hotelId);
    } else {
      setSelectedModules({});
    }
  }

  function toggleModule(modKey) {
    setSelectedModules((prev) => ({
      ...prev,
      [modKey]: !prev[modKey],
    }));
  }

  async function handleSaveModules(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedHotelId) {
      setError("Please select a hotel property first.");
      return;
    }

    try {
      setSubmitting(true);
      
      const modulesToSave = Object.keys(selectedModules).filter(
        (key) => selectedModules[key] === true
      );

      await api.put(`/hotels/${selectedHotelId}/modules`, { modules: modulesToSave }); 

      setSuccess("Module permissions updated successfully for the selected hotel!");
    } catch (err) {
      console.error("Failed to update modules:", err);
      setError("Failed to save module configurations.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles["sa-page"]}>
      <SuperAdminSidebar />

      <main className={styles["sa-main"]}>
        <header className={styles["sa-header-card"]}>
          <div className={styles["sa-header-left"]}>
            <div className={styles["sa-header-icon"]}>
              <UserCog size={24} />
            </div>
            <div>
              <span className={styles["sa-kicker"]}>Platform Management</span>
              <h1>Assign ERP Modules</h1>
            </div>
          </div>

          <button className={styles["sa-back-btn"]} onClick={() => navigate("/super-admin/dashboard")}>
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
        </header>

        {error && <div className={styles["alert-error"]}>{error}</div>}
        {success && <div className={styles["alert-success"]}>{success}</div>}

        <section className={styles["sa-form-section"]}>
          <div className={styles["section-title"]}>
            <Building2 size={20} />
            <h3>Select Tenant & Configure Access</h3>
          </div>

          <form onSubmit={handleSaveModules}>
            <div className={styles["select-hotel-container"]}>
              <label>Select Target Hotel Property *</label>
              <select
                value={selectedHotelId}
                onChange={handleHotelChange}
                required
                className={styles["hotel-dropdown"]}
              >
                <option value="">-- Choose Hotel Property --</option>
                {hotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name} (ID: {hotel.id}) - {hotel.city || "Global"}
                  </option>
                ))}
              </select>
            </div>

            {selectedHotelId && (
              <div className={styles["modules-container"]}>
                <div className={styles["modules-heading"]}>
                  <h4>Available System Modules</h4>
                  <span>Check or uncheck to grant or restrict module access for this tenant.</span>
                </div>

                <div className={styles["modules-grid"]}>
                  {/* Dynamically mapping over availableModules from backend */}
                  {availableModules.length > 0 ? (
                    availableModules.map((mod) => {
                      const modKey = mod.id || mod.module_key || mod.name; 
                      const isChecked = !!selectedModules[modKey];
                      return (
                        <div
                          key={modKey}
                          className={`${styles["module-checkbox-card"]} ${isChecked ? styles["checked"] : ""}`}
                          onClick={() => toggleModule(modKey)}
                        >
                          <div className={styles["checkbox-icon"]}>
                            {isChecked ? (
                              <CheckSquare size={20} className={styles["text-green"]} />
                            ) : (
                              <Square size={20} className={styles["text-gray"]} />
                            )}
                          </div>
                          <div className={styles["checkbox-info"]}>
                            <h5>{mod.name || mod.title || "Unnamed Module"}</h5>
                            <p>{mod.description || "No description provided."}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p>No modules found in the system. Please ensure your backend is returning modules.</p>
                  )}
                </div>

                <div className={styles["form-actions"]}>
                  <button type="submit" className={styles["submit-btn"]} disabled={submitting || availableModules.length === 0}>
                    <Save size={16} />
                    {submitting ? "Saving Access..." : "Save Module Permissions"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}