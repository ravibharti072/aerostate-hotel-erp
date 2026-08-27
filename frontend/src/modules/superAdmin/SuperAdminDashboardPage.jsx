import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Hotel,
  ShieldCheck,
  Users,
  Key,
  UserCog,
  Settings,
  Clock,
  ArrowRight,
  ListOrdered,
  Calendar,
  Megaphone,
  Send,
  CheckCircle2, // <-- Added for success icon
  AlertCircle   // <-- Added for error icon
} from "lucide-react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import styles from "./superAdminDashboard.module.css";
import SuperAdminSidebar from "./SuperAdminSidebar";

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [alertForm, setAlertForm] = useState({ title: "", message: "", alert_type: "info" });
  const [isPublishing, setIsPublishing] = useState(false);
  
  // NEW: State for in-software feedback message
  const [toast, setToast] = useState({ show: false, type: "", message: "" });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  function normalizeList(data, key) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.[key])) return data.data[key];
    return [];
  }

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const [hotelsResponse, usersResponse] = await Promise.all([
        api.get("/hotels").catch(() => ({ data: [] })),
        api.get("/users").catch(() => ({ data: [] })),
      ]);
      setHotels(normalizeList(hotelsResponse.data, "hotels"));
      setUsers(normalizeList(usersResponse.data, "users"));
    } catch (error) {
      console.error("Super admin dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    const activeHotels = hotels.filter((hotel) => hotel.is_active).length;
    return {
      totalHotels: hotels.length,
      activeHotels,
      totalUsers: users.length,
    };
  }, [hotels, users]);

  // UPDATED: Handler using in-software Toast instead of browser Alert
  const handlePublishAlert = async (e) => {
    e.preventDefault();
    setToast({ show: false, type: "", message: "" }); // Reset

    if (!alertForm.title || !alertForm.message) {
      setToast({ show: true, type: "error", message: "Please fill out both title and message." });
      return;
    }
    
    setIsPublishing(true);
    try {
      await api.post("/announcements/", alertForm);
      setToast({ show: true, type: "success", message: "System Announcement Published Successfully! All hotels will see it immediately." });
      setAlertForm({ title: "", message: "", alert_type: "info" });
      
      // Auto-hide the message after 5 seconds
      setTimeout(() => {
        setToast({ show: false, type: "", message: "" });
      }, 5000);

    } catch (err) {
      console.error(err);
      setToast({ show: true, type: "error", message: "Failed to publish announcement. Check your connection." });
    } finally {
      setIsPublishing(false);
    }
  };

  const formattedTime = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  
  const formattedDate = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const moduleCards = [
    { label: "Hotel Onboard", icon: Hotel, path: "/super-admin/hotel-onboard", iconClass: styles["icon-blue"] },
    { label: "Create Credential", icon: Key, path: "/super-admin/create-credential", iconClass: styles["icon-purple"] },
    { label: "Subscriptions & Validity", icon: Calendar, path: "/super-admin/subscriptions", iconClass: styles["icon-green"] },
    { label: "Assign Module", icon: UserCog, path: "/super-admin/assign-module", iconClass: styles["icon-orange"] },
    { label: "Hotels Directory", icon: ListOrdered, path: "/super-admin/hotels", iconClass: styles["icon-yellow"] },
    { label: "Settings", icon: Settings, path: "/super-admin/settings", iconClass: styles["icon-gray"] },
  ];

  return (
    <div className={styles["sa-page"]}>
      <SuperAdminSidebar />

      <main className={styles["sa-main"]}>
        
        <header className={styles["sa-header-card"]}>
          <div className={styles["sa-header-left"]}>
            <div className={styles["sa-header-icon"]}>
              <Building2 size={24} />
            </div>
            <div>
              <span className={styles["sa-kicker"]}>Platform Management</span>
              <h1>Super Admin Portal</h1>
            </div>
          </div>

          <div className={styles["sa-time-widget"]}>
            <Clock size={20} className={styles["time-icon"]} />
            <div className={styles["time-text"]}>
              <span className={styles["date"]}>{formattedDate}</span>
              <span className={styles["time"]}>{formattedTime}</span>
            </div>
          </div>
        </header>

        <section className={styles["sa-welcome-banner"]}>
          <div className={styles["welcome-content"]}>
            <span className={styles["welcome-label"]}>WELCOME BACK</span>
            <h2>{user?.username || "superadmin"}</h2>
            <p>Your platform control center is ready. Select a module below to continue work.</p>
          </div>
          <div className={styles["welcome-profile"]}>
            <div className={styles["profile-avatar"]}>
              {(user?.username || "S")[0].toUpperCase()}
            </div>
            <div className={styles["profile-info"]}>
              <span>Logged in as</span>
              <strong>{user?.username || "superadmin"}</strong>
            </div>
          </div>
        </section>

        <section className={styles["sa-stats-grid"]}>
          <div className={styles["sa-stat-card"]}>
            <div className={`${styles["sa-stat-icon-wrapper"]} ${styles["bg-light-blue"]}`}>
              <Building2 size={22} className={styles["color-blue"]} />
            </div>
            <div className={styles["sa-stat-info"]}>
              <p>Total Hotels</p>
              <h2>{stats.totalHotels}</h2>
            </div>
          </div>

          <div className={styles["sa-stat-card"]}>
            <div className={`${styles["sa-stat-icon-wrapper"]} ${styles["bg-light-green"]}`}>
              <Hotel size={22} className={styles["color-green"]} />
            </div>
            <div className={styles["sa-stat-info"]}>
              <p>Active Hotels</p>
              <h2>{stats.activeHotels}</h2>
            </div>
          </div>

          <div className={styles["sa-stat-card"]}>
            <div className={`${styles["sa-stat-icon-wrapper"]} ${styles["bg-light-orange"]}`}>
              <Users size={22} className={styles["color-orange"]} />
            </div>
            <div className={styles["sa-stat-info"]}>
              <p>Hotel Users</p>
              <h2>{stats.totalUsers}</h2>
            </div>
          </div>

          <div className={styles["sa-stat-card"]}>
            <div className={`${styles["sa-stat-icon-wrapper"]} ${styles["bg-light-purple"]}`}>
              <ShieldCheck size={22} className={styles["color-purple"]} />
            </div>
            <div className={styles["sa-stat-info"]}>
              <p>System Status</p>
              <h2 className={styles["status-online"]}>Online</h2>
            </div>
          </div>
        </section>

        <section className={styles["sa-modules-section"]}>
          <div className={styles["sa-modules-header"]}>
            <div>
              <h3>Modules</h3>
              <p>Open any module to manage platform operations.</p>
            </div>
            <div className={styles["module-badge"]}>
              {moduleCards.length} modules
            </div>
          </div>

          <div className={styles["sa-modules-grid"]}>
            {moduleCards.map((mod) => (
              <div 
                key={mod.path} 
                className={styles["sa-module-card"]}
                onClick={() => navigate(mod.path)}
              >
                <div className={`${styles["module-icon-wrapper"]} ${mod.iconClass}`}>
                  <mod.icon size={24} />
                </div>
                <div className={styles["module-content"]}>
                  <h4>{mod.label}</h4>
                </div>
                <ArrowRight size={20} className={styles["module-arrow"]} />
              </div>
            ))}
          </div>
        </section>

        {/* BROADCAST ANNOUNCEMENT PUBLISHER */}
        <section className={styles["broadcast-section"]}>
          <div className={styles["broadcast-header"]}>
            <div className={styles["broadcast-icon"]}>
              <Megaphone size={20} />
            </div>
            <div>
              <h3>Broadcast Global Update Alert</h3>
              <p>Push a real-time banner alert to every hotel dashboard on the network.</p>
            </div>
          </div>

          {/* NEW: Inline Success / Error Message */}
          {toast.show && (
            <div className={`${styles["software-toast"]} ${styles[toast.type]}`}>
              {toast.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{toast.message}</span>
            </div>
          )}

          <form onSubmit={handlePublishAlert} className={styles["broadcast-form"]}>
            <div className={styles["form-row"]}>
              <div className={styles["form-group"]}>
                <label>Alert Title</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g., New Feature: Salary Advances Released!" 
                  value={alertForm.title} 
                  onChange={e => setAlertForm({...alertForm, title: e.target.value})}
                  className={styles["form-input"]}
                />
              </div>
              
              <div className={styles["form-group"]}>
                <label>Banner Color (Type)</label>
                <select 
                  value={alertForm.alert_type} 
                  onChange={e => setAlertForm({...alertForm, alert_type: e.target.value})}
                  className={styles["form-select"]}
                >
                  <option value="info">Info (Blue)</option>
                  <option value="success">Success (Green)</option>
                  <option value="warning">Warning (Orange)</option>
                  <option value="critical">Critical (Red)</option>
                </select>
              </div>
            </div>

            <div className={styles["form-group"]}>
              <label>Alert Message</label>
              <textarea 
                required 
                placeholder="Type the full details of the update here..." 
                rows="2"
                value={alertForm.message} 
                onChange={e => setAlertForm({...alertForm, message: e.target.value})}
                className={styles["form-textarea"]}
              />
            </div>

            <div className={styles["form-actions"]}>
              <button 
                type="submit" 
                disabled={isPublishing} 
                className={styles["btn-publish"]}
              >
                <Send size={16} /> 
                {isPublishing ? "Publishing..." : "Push Alert to All Hotels"}
              </button>
            </div>
          </form>
        </section>

      </main>
    </div>
  );
}