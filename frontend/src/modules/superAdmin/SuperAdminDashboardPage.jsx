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
  ListOrdered,
  Calendar,
  Megaphone,
  Send,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";
import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import PortalHeader from "../../components/headers/PortalHeader";
import StatCard from "../../components/cards/StatCard";
import ModuleCard from "../../components/cards/ModuleCard";
import styles from "./superAdminDashboard.module.css";

// Removed the SuperAdminSidebar import

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [alertForm, setAlertForm] = useState({ title: "", message: "", alert_type: "info" });
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState({ show: false, type: "", message: "" });
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

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

  const handlePublishAlert = async (e) => {
    e.preventDefault();
    setToast({ show: false, type: "", message: "" });

    if (!alertForm.title || !alertForm.message) {
      setToast({ show: true, type: "error", message: "Please fill out both title and message." });
      return;
    }
    
    setIsPublishing(true);
    try {
      await api.post("/announcements/", alertForm);
      setToast({ show: true, type: "success", message: "System Announcement Published Successfully! All hotels will see it immediately." });
      setAlertForm({ title: "", message: "", alert_type: "info" });
      
      setTimeout(() => {
        setToast({ show: false, type: "", message: "" });
        setShowBroadcastModal(false);
      }, 2500);

    } catch (err) {
      console.error(err);
      setToast({ show: true, type: "error", message: "Failed to publish announcement. Check your connection." });
    } finally {
      setIsPublishing(false);
    }
  };

  const moduleCards = [
    { title: "Hotel Onboard", icon: Hotel, path: "/super-admin/hotel-onboard", colorTheme: "blue" },
    { title: "Create Credential", icon: Key, path: "/super-admin/create-credential", colorTheme: "purple" },
    { title: "Subscriptions", icon: Calendar, path: "/super-admin/subscriptions", colorTheme: "green" },
    { title: "Assign Module", icon: UserCog, path: "/super-admin/assign-module", colorTheme: "orange" },
    { title: "Hotels Directory", icon: ListOrdered, path: "/super-admin/hotels", colorTheme: "orange" },
    { 
      title: "System Announcements", 
      icon: Megaphone, 
      action: () => setShowBroadcastModal(true), 
      colorTheme: "pink" 
    },
    { title: "Settings", icon: Settings, path: "/super-admin/settings", colorTheme: "gray" },
  ];

  return (
    <div className={styles["sa-main"]}>
      
      <PortalHeader 
        title="Super Admin Portal"
        kicker="PLATFORM MANAGEMENT"
        icon={Building2}
        showBack={false}
        isDashboard={true}
      />

      <section className={styles["welcome-banner"]}>
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

      <section className={styles["stats-grid"]}>
        <StatCard title="Total Hotels" value={stats.totalHotels} Icon={Building2} colorTheme="blue" />
        <StatCard title="Active Hotels" value={stats.activeHotels} Icon={Hotel} colorTheme="green" />
        <StatCard title="Hotel Users" value={stats.totalUsers} Icon={Users} colorTheme="orange" />
        <StatCard title="System Status" value="Online" Icon={ShieldCheck} colorTheme="purple" />
      </section>

      <section className={styles["modules-section"]}>
        <div className={styles["section-header"]}>
          <div>
            <h3>Modules</h3>
            <p>Open any module to manage platform operations.</p>
          </div>
          <div className={styles["module-badge"]}>
            {moduleCards.length} modules
          </div>
        </div>

        <div className={styles["modules-grid"]}>
          {moduleCards.map((mod) => (
            <div 
              key={mod.title} 
              className={styles["module-wrapper"]}
            >
              <ModuleCard
                title={mod.title}
                Icon={mod.icon}
                colorTheme={mod.colorTheme}
                onClick={() => {
                  if (mod.action) {
                    mod.action();
                  } else {
                    navigate(mod.path);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* BROADCAST ANNOUNCEMENT MODAL */}
      {showBroadcastModal && (
        <div className={styles["modal-backdrop"]}>
          <div className={styles["modal-container"]}>
            <button 
              onClick={() => setShowBroadcastModal(false)}
              className={styles["modal-close-btn"]}
            >
              <X size={20} />
            </button>

            <div className={styles["broadcast-section"]}>
              <div className={styles["broadcast-header"]}>
                <div className={styles["broadcast-icon"]}>
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3>Broadcast Global Update Alert</h3>
                  <p>Push a real-time banner alert to every hotel dashboard on the network.</p>
                </div>
              </div>

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
                    rows="3"
                    value={alertForm.message} 
                    onChange={e => setAlertForm({...alertForm, message: e.target.value})}
                    className={styles["form-textarea"]}
                  />
                </div>

                <div className={styles["form-actions"]}>
                  <button 
                    type="button" 
                    onClick={() => setShowBroadcastModal(false)}
                    className={styles["btn-secondary"]}
                  >
                    Cancel
                  </button>
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
}