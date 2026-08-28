import { useEffect, useState } from "react";
import { Settings, User, Lock, Building, Save, ShieldCheck } from "lucide-react";
import api from "../../../api/api";
import PortalHeader from "../../../components/PortalHeader";
import styles from "./superAdminSettings.module.css";

export default function SuperAdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // System Organization details (Display only for now)
  const [companyInfo] = useState({
    name: "Aerostate Lab",
    role: "Platform Operator & Developer",
    systemVersion: "v1.0.0"
  });

  // Admin Profile State
  const [profileData, setProfileData] = useState({
    id: null,
    username: "",
    full_name: "",
  });

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

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

  // Fetch current admin details
  useEffect(() => {
    async function fetchAdminProfile() {
      try {
        setLoading(true);
        const res = await api.get("/users");
        const allUsers = res.data?.users || res.data || [];
        const superAdmin = allUsers.find(u => u.role === "super-admin");
        
        if (superAdmin) {
          setProfileData({
            id: superAdmin.id,
            username: superAdmin.username,
            full_name: superAdmin.full_name || "System Admin",
          });
        }
      } catch (err) {
        console.error("Failed to fetch admin profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAdminProfile();
  }, []);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleSecurityChange = (e) => {
    setSecurityData({ ...securityData, [e.target.name]: e.target.value });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileData.id) return;
    
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      await api.put(`/users/${profileData.id}`, {
        full_name: profileData.full_name,
        username: profileData.username,
      });
      setSuccess("Admin profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (securityData.newPassword !== securityData.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (securityData.newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/users/${profileData.id}`, {
        password: securityData.newPassword
      });
      setSuccess("Admin credentials updated successfully.");
      setSecurityData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update security credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles["sa-main"]}>
      <PortalHeader 
        title="System Settings" 
        kicker="PLATFORM CONFIGURATION"
        description="Manage your platform's administrative profile and security credentials."
        icon={Settings} 
        backPath="/super-admin/dashboard" /* <-- Adds the Back Button */
      />

      {error && <div className={styles["alert-error"]}>{error}</div>}
      {success && <div className={styles["alert-success"]}>{success}</div>}

      <div className={styles["settings-layout"]}>
        
        {/* TOP ROW: Platform Operator */}
        <section className={styles["settings-card"]}>
          <div className={styles["card-header"]}>
            <div className={styles["card-icon-wrapper"]} style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <Building size={20} />
            </div>
            <div>
              <h3>Platform Operator</h3>
              <p>System licensing and organization details.</p>
            </div>
          </div>
          <div className={styles["card-body"]}>
            <div className={styles["info-grid"]}>
              <div className={styles["info-item"]}>
                <span className={styles["info-label"]}>Operating Entity</span>
                <span className={styles["info-value"]}><strong>{companyInfo.name}</strong></span>
              </div>
              <div className={styles["info-item"]}>
                <span className={styles["info-label"]}>Role</span>
                <span className={styles["info-value"]}>{companyInfo.role}</span>
              </div>
              <div className={styles["info-item"]}>
                <span className={styles["info-label"]}>System Version</span>
                <span className={styles["info-value"]}>{companyInfo.systemVersion}</span>
              </div>
              <div className={styles["info-item"]}>
                <span className={styles["info-label"]}>Access Level</span>
                <span className={styles["info-value"]} style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                  <ShieldCheck size={16} /> Full Super Admin
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* BOTTOM ROW: Profile & Security (Side by Side) */}
        <div className={styles["settings-grid"]}>
          
          {/* Admin Profile */}
          <section className={styles["settings-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-icon-wrapper"]} style={{ background: '#f5f3ff', color: '#6366f1' }}>
                <User size={20} />
              </div>
              <div>
                <h3>Administrator Profile</h3>
                <p>Update your personal administrative details.</p>
              </div>
            </div>
            <div className={styles["card-body"]}>
              <form onSubmit={handleUpdateProfile} className={styles["settings-form"]}>
                <div className={styles["form-group"]}>
                  <label>Admin Name</label>
                  <input 
                    type="text" 
                    name="full_name" 
                    value={profileData.full_name} 
                    onChange={handleProfileChange}
                    placeholder="e.g. System Administrator"
                    required
                  />
                </div>
                <div className={styles["form-group"]}>
                  <label>Admin Username</label>
                  <input 
                    type="text" 
                    name="username" 
                    value={profileData.username} 
                    onChange={handleProfileChange}
                    required
                  />
                </div>
                <div className={styles["form-actions"]}>
                  <button type="submit" className={styles["btn-save"]} disabled={submitting || loading}>
                    <Save size={16} /> Save Profile
                  </button>
                </div>
              </form>
            </div>
          </section>

          {/* Security Credentials */}
          <section className={styles["settings-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-icon-wrapper"]} style={{ background: '#fdf2f8', color: '#8b5cf6' }}>
                <Lock size={20} />
              </div>
              <div>
                <h3>Security Credentials</h3>
                <p>Update your master login password.</p>
              </div>
            </div>
            <div className={styles["card-body"]}>
              <form onSubmit={handleUpdatePassword} className={styles["settings-form"]}>
                <div className={styles["form-group"]}>
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    name="currentPassword" 
                    value={securityData.currentPassword} 
                    onChange={handleSecurityChange}
                    placeholder="Enter current password to verify"
                  />
                </div>
                <div className={styles["form-row"]}>
                  <div className={styles["form-group"]}>
                    <label>New Password</label>
                    <input 
                      type="password" 
                      name="newPassword" 
                      value={securityData.newPassword} 
                      onChange={handleSecurityChange}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div className={styles["form-group"]}>
                    <label>Confirm Password</label>
                    <input 
                      type="password" 
                      name="confirmPassword" 
                      value={securityData.confirmPassword} 
                      onChange={handleSecurityChange}
                      placeholder="Repeat password"
                    />
                  </div>
                </div>
                <div className={styles["form-actions"]}>
                  <button type="submit" className={styles["btn-save"]} disabled={submitting || !securityData.newPassword}>
                    <ShieldCheck size={16} /> Update Password
                  </button>
                </div>
              </form>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}