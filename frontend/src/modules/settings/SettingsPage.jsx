import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "@api/api";
import { 
  Building2, 
  UserCircle, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  Save, 
  ShieldCheck,
  Settings,
  Calendar,
  KeyRound,
  Users,
  Clock,
  CheckCircle2,
  CheckCircle,
  Edit,
  X,
  Eye,
  EyeOff,
  Sliders,
  AlertCircle,
  BedDouble,
  UtensilsCrossed,
  Sparkles,
  Briefcase,
  Package,
  IndianRupee,
  BarChart3,
  Search,
  Plus,
  ExternalLink,
  Hotel
} from "lucide-react";
import PortalHeader from "../../components/headers/PortalHeader";
import ModuleWriternHeader from "../../components/headers/ModuleWriternHeader";
import EmployeePortalAccessModal, { PORTAL_DEFINITIONS } from "../staff/portalAccess/EmployeePortalAccessModal";
import { DEPARTMENT_CONFIGS } from "../../config/rbacConfig";
import "../staff/portalAccess/portalAccess.css";
import "./settings.css";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { token, user, logout, updateHotelInfo } = useAuth();

  // Only super-admin and hotel-admin can see hotel property/policy settings
  const isAdmin = user?.role === "hotel-admin" || user?.role === "super-admin";

  const [activeTab, setActiveTab] = useState(isAdmin ? "property" : "security"); // "property" | "security" | "policies" | "permissions"

  // Super Admin Multi-Hotel Support
  const [hotels, setHotels] = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState("");
  
  // Hotel Data & Edit Mode State
  const [hotelData, setHotelData] = useState(null);
  const [isEditingHotel, setIsEditingHotel] = useState(false);
  const [isLoadingHotel, setIsLoadingHotel] = useState(true);
  const [isSavingHotel, setIsSavingHotel] = useState(false);
  
  const [hotelForm, setHotelForm] = useState({
    name: "",
    owner_name: "",
    email: "",
    phone: "",
    tax_number: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    default_checkin_time: "11:00",
    default_checkout_time: "11:00",
    checkout_grace_minutes: 60,
    require_full_payment_before_checkout: false,
  });

  // User Profile Form State
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    username: user?.username || "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const userId = user?.user_id || user?.id;

  // Sync form data if user loads
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        full_name: user.full_name || prev.full_name || "",
        username: user.username || prev.username || "",
      }));
    }
  }, [user]);

  // Compute portal user's assigned modules for chips
  const userAllowedModules = useMemo(() => {
    if (!user) return ["housekeeping"];
    if (Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0) {
      return user.allowed_modules;
    }
    const dept = (user.department || "").toLowerCase();
    const roleLevel = (user.role_level || "").toLowerCase() || "employee";
    for (const [key, config] of Object.entries(DEPARTMENT_CONFIGS)) {
      if (dept.includes(key) && config[roleLevel]?.allowedModules) {
        return config[roleLevel].allowedModules;
      }
    }
    return [dept || "housekeeping", "reports", "alerts"];
  }, [user]);

  // Role display title
  const roleDisplay = useMemo(() => {
    if (!user) return "STAFF";
    if (user.role === "hotel-admin") return "HOTEL ADMIN";
    if (user.role === "super-admin") return "SUPER ADMIN";
    if (user.role_level === "department_head") {
      return `${(user.department || "Department").replace(/_/g, " ").toUpperCase()} HOD`;
    }
    return (user.designation || user.role || "STAFF").toUpperCase();
  }, [user]);

  // Staff Portal Access State
  const [staffData, setStaffData] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDeptFilter, setStaffDeptFilter] = useState("all");
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [selectedStaffForModal, setSelectedStaffForModal] = useState(null);

  // 1. Fetch Hotels if super-admin
  useEffect(() => {
    async function loadHotels() {
      if (user?.role === "super-admin") {
        try {
          const res = await api.get("/hotels");
          const list = Array.isArray(res.data) ? res.data : [];
          setHotels(list);
          if (list.length > 0 && !selectedHotelId) {
            setSelectedHotelId(String(list[0].id));
          }
        } catch (err) {
          console.error("Failed to load hotels list", err);
        }
      }
    }
    loadHotels();
  }, [user]);

  // 2. Fetch Active Hotel Details
  const effectiveHotelId = user?.role === "super-admin" ? selectedHotelId : user?.hotel_id;

  useEffect(() => {
    const fetchHotel = async () => {
      if (!effectiveHotelId) {
        setIsLoadingHotel(false);
        return;
      }
      setIsLoadingHotel(true);
      try {
        const res = await api.get(`/hotels/${effectiveHotelId}`);
        const data = res.data;
        setHotelData(data);
        setHotelForm({
          name: data.name || "",
          owner_name: data.owner_name || "",
          email: data.email || "",
          phone: data.phone || "",
          tax_number: data.tax_number || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          country: data.country || "India",
          default_checkin_time: data.default_checkin_time || "11:00",
          default_checkout_time: data.default_checkout_time || "11:00",
          checkout_grace_minutes: data.checkout_grace_minutes !== undefined ? data.checkout_grace_minutes : 60,
          require_full_payment_before_checkout: Boolean(data.require_full_payment_before_checkout),
        });
      } catch (err) {
        console.error("Failed to load hotel data", err);
      } finally {
        setIsLoadingHotel(false);
      }
    };
    fetchHotel();
  }, [effectiveHotelId]);

  // 3. Fetch Staff Portal Access Roster
  const fetchStaffStatus = async () => {
    if (!effectiveHotelId && user?.role !== "super-admin") {
      setIsLoadingStaff(false);
      return;
    }
    setIsLoadingStaff(true);
    try {
      const res = await api.get("/staff/unassigned-users", {
        params: effectiveHotelId ? { hotel_id: effectiveHotelId } : {},
      });
      setStaffData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load staff portal access data:", err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (activeTab === "permissions") {
      fetchStaffStatus();
    }
  }, [activeTab, effectiveHotelId]);

  // Computed Staff Access Statistics
  const staffStats = useMemo(() => {
    const total = staffData.length;
    const assigned = staffData.filter((s) => s.is_assigned).length;
    const unassigned = total - assigned;
    return {
      total,
      assigned,
      unassigned,
      totalModules: PORTAL_DEFINITIONS.length,
    };
  }, [staffData]);

  // Filtered Staff Roster
  const filteredStaff = useMemo(() => {
    return staffData.filter((s) => {
      const search = staffSearch.toLowerCase();
      const matchesSearch =
        (s.full_name || "").toLowerCase().includes(search) ||
        (s.phone || "").includes(search) ||
        (s.user?.username || "").toLowerCase().includes(search) ||
        (s.department || "").toLowerCase().includes(search);

      const matchesDept =
        staffDeptFilter === "all" ||
        (s.department || "").toLowerCase() === staffDeptFilter.toLowerCase();

      const matchesStatus =
        staffStatusFilter === "all" ||
        (staffStatusFilter === "assigned" && s.is_assigned) ||
        (staffStatusFilter === "unassigned" && !s.is_assigned);

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [staffData, staffSearch, staffDeptFilter, staffStatusFilter]);

  // Handle Hotel Property Update
  const handleSaveHotel = async (e) => {
    e.preventDefault();
    if (!effectiveHotelId) return;
    setIsSavingHotel(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        name: hotelForm.name.trim(),
        owner_name: hotelForm.owner_name.trim(),
        email: hotelForm.email.trim(),
        phone: hotelForm.phone.trim(),
        tax_number: hotelForm.tax_number ? hotelForm.tax_number.trim() : null,
        address: hotelForm.address ? hotelForm.address.trim() : null,
        city: hotelForm.city ? hotelForm.city.trim() : null,
        state: hotelForm.state ? hotelForm.state.trim() : null,
        country: hotelForm.country ? hotelForm.country.trim() : "India",
        default_checkin_time: hotelForm.default_checkin_time || "11:00",
        default_checkout_time: hotelForm.default_checkout_time || "11:00",
        checkout_grace_minutes: parseInt(hotelForm.checkout_grace_minutes, 10) || 60,
        require_full_payment_before_checkout: Boolean(hotelForm.require_full_payment_before_checkout),
      };

      const res = await api.put(`/hotels/${effectiveHotelId}`, payload);
      setHotelData(res.data);
      if (updateHotelInfo) {
        updateHotelInfo(res.data);
      }
      setIsEditingHotel(false);
      setMessage({ type: "success", text: "Property details updated successfully!" });
      setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    } catch (err) {
      console.error("Failed to update hotel", err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Failed to update hotel property.");
      setMessage({ type: "error", text: msg });
    } finally {
      setIsSavingHotel(false);
    }
  };

  // Handle User Credentials Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (formData.password && formData.password !== formData.confirmPassword) {
      return setMessage({ type: "error", text: "New passwords do not match." });
    }
    if (formData.password && formData.password.length < 6) {
      return setMessage({ type: "error", text: "Password must be at least 6 characters long." });
    }

    setIsSubmittingProfile(true);
    const payload = {
      full_name: formData.full_name.trim(),
      username: formData.username.trim()
    };
    if (formData.password) {
      payload.password = formData.password;
    }

    try {
      await api.put(`/users/${userId}`, payload);
      setMessage({ 
        type: "success", 
        text: "Credentials updated successfully! Logging you out to refresh your secure session..." 
      });
      setFormData({ ...formData, password: "", confirmPassword: "" });
      
      if (formData.password || formData.username !== user?.username) {
        setTimeout(() => logout(), 2200);
      } else {
        setTimeout(() => setMessage({ type: "", text: "" }), 4000);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Failed to update profile.");
      setMessage({ type: "error", text: msg });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  return (
    <div className="settings-page">
      {/* UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Settings & Configuration"
        kicker={isAdmin ? "ENTERPRISE CONTROLS" : "MY ACCOUNT"}
        description={
          isAdmin
            ? "Configure property information, operational stay policies, cashier timings, and secure login credentials."
            : "Update your personal profile, display name, and login credentials."
        }
        icon={Settings}
        backPath="/dashboard"
        rightAction={
          user?.role === "super-admin" && hotels.length > 0 ? (
            <div className="settings-hotel-selector">
              <Building2 size={15} className="hotel-sel-icon" />
              <select
                className="hotel-sel-dropdown"
                value={selectedHotelId}
                onChange={(e) => {
                  setSelectedHotelId(e.target.value);
                  setIsEditingHotel(false);
                }}
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.city ? `(${h.city})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      {/* MODULE SECTION */}
      <section className="settings-modules-section">
        <ModuleWriternHeader 
          title="Configuration Hub"
          description="Select a category below to inspect or modify system settings."
        />

        {/* FEEDBACK ALERT MESSAGE */}
        {message.text && (
          <div className={`settings-alert-banner ${message.type}`}>
            {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* NAVIGATION TABS */}
        <div className="settings-nav-tabs">
          {isAdmin && (
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === "property" ? "active" : ""}`}
              onClick={() => setActiveTab("property")}
            >
              <Building2 size={16} />
              <span>Property & Operations</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              <ShieldCheck size={16} />
              <span>Login &amp; Security</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === "policies" ? "active" : ""}`}
              onClick={() => setActiveTab("policies")}
            >
              <Clock size={16} />
              <span>Operational Policies</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className={`settings-tab-btn ${activeTab === "permissions" ? "active" : ""}`}
              onClick={() => setActiveTab("permissions")}
            >
              <KeyRound size={16} />
              <span>Staff Credentials</span>
            </button>
          )}
        </div>

        <div className="settings-content-stack">
          {/* =========================================================
              TAB 1: PROPERTY & OPERATIONS
              ========================================================= */}
          {activeTab === "property" && (
            <div className="settings-card">
              <div className="card-header">
                <div className="card-header-left">
                  <Building2 size={20} className="header-icon blue" />
                  <div>
                    <h2>Property Profile</h2>
                    <p className="card-subtitle">Official details for invoices, tax receipts, and guest communication.</p>
                  </div>
                </div>

                {(user?.role === "hotel-admin" || user?.role === "super-admin") && (
                  <button
                    type="button"
                    className={`btn-action-outline ${isEditingHotel ? "active" : ""}`}
                    onClick={() => setIsEditingHotel(!isEditingHotel)}
                  >
                    {isEditingHotel ? (
                      <>
                        <X size={15} /> Cancel Edit
                      </>
                    ) : (
                      <>
                        <Edit size={15} /> Edit Details
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="card-body">
                {isLoadingHotel ? (
                  <div className="settings-loading-state">
                    <div className="settings-spinner" />
                    <span>Loading property information...</span>
                  </div>
                ) : !hotelData ? (
                  <p className="text-muted">No hotel property found. Please select or onboard a hotel.</p>
                ) : isEditingHotel ? (
                  /* --- EDIT PROPERTY FORM --- */
                  <form onSubmit={handleSaveHotel} className="settings-form-layout">
                    <div className="form-grid-2">
                      <div className="settings-form-group">
                        <label>Hotel Name *</label>
                        <input
                          type="text"
                          required
                          value={hotelForm.name}
                          onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Registered Owner / Entity *</label>
                        <input
                          type="text"
                          required
                          value={hotelForm.owner_name}
                          onChange={(e) => setHotelForm({ ...hotelForm, owner_name: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Contact Phone Number *</label>
                        <input
                          type="text"
                          required
                          value={hotelForm.phone}
                          onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Official Email Address *</label>
                        <input
                          type="email"
                          required
                          value={hotelForm.email}
                          onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>GST / Tax Identification Number</label>
                        <input
                          type="text"
                          placeholder="e.g. 27ABCDE1234F1Z5"
                          value={hotelForm.tax_number}
                          onChange={(e) => setHotelForm({ ...hotelForm, tax_number: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>City & State</label>
                        <div className="input-group-row">
                          <input
                            type="text"
                            placeholder="City"
                            value={hotelForm.city}
                            onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="State"
                            value={hotelForm.state}
                            onChange={(e) => setHotelForm({ ...hotelForm, state: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="settings-form-group span-2">
                        <label>Full Physical Address</label>
                        <textarea
                          rows={2}
                          placeholder="Street, landmark, postal code"
                          value={hotelForm.address}
                          onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-actions-bar">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => setIsEditingHotel(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-submit"
                        disabled={isSavingHotel}
                      >
                        <Save size={16} />
                        {isSavingHotel ? "Saving..." : "Save Property Details"}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* --- VIEW PROPERTY INFO --- */
                  <div className="hotel-info-grid">
                    <div className="info-tile">
                      <span className="info-tile-label"><Building2 size={13} /> Hotel Name</span>
                      <span className="info-tile-value">{hotelData.name}</span>
                    </div>

                    <div className="info-tile">
                      <span className="info-tile-label"><UserCircle size={13} /> Registered Owner</span>
                      <span className="info-tile-value">{hotelData.owner_name}</span>
                    </div>

                    <div className="info-tile">
                      <span className="info-tile-label"><Hash size={13} /> GST / Tax ID</span>
                      <span className="info-tile-value">{hotelData.tax_number || "Not Registered"}</span>
                    </div>

                    <div className="info-tile">
                      <span className="info-tile-label"><Mail size={13} /> Official Email</span>
                      <span className="info-tile-value">{hotelData.email}</span>
                    </div>

                    <div className="info-tile">
                      <span className="info-tile-label"><Phone size={13} /> Phone Number</span>
                      <span className="info-tile-value">{hotelData.phone}</span>
                    </div>

                    <div className="info-tile">
                      <span className="info-tile-label"><MapPin size={13} /> Address</span>
                      <span className="info-tile-value">
                        {[hotelData.address, hotelData.city, hotelData.state, hotelData.country].filter(Boolean).join(", ") || "Not Provided"}
                      </span>
                    </div>

                    <div className="info-tile go-live-tile">
                      <div className="go-live-header">
                        <span className="info-tile-label bold-blue"><Calendar size={13} /> System Go-Live & Activation Date</span>
                        <span className="go-live-badge">System Active</span>
                      </div>
                      <span className="go-live-value">
                        {hotelData.go_live_date
                          ? new Date(hotelData.go_live_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                          : "Immediate Live Deployment"}
                      </span>
                      <p className="go-live-note">
                        Attendance, night audit, and financial ledger restrictions prior to this date are governed by platform security policy.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: LOGIN CREDENTIALS & SECURITY
              ========================================================= */}
          {activeTab === "security" && (
            <div className="settings-card">
              <div className="card-header">
                <div className="card-header-left">
                  <KeyRound size={20} className="header-icon blue" />
                  <div>
                    <h2>
                      {isAdmin ? "Admin Account & Credentials" : "Employee Profile & Security Credentials"}
                    </h2>
                    <p className="card-subtitle">
                      {isAdmin
                        ? "Manage your administrator profile and secure login credentials."
                        : "Your authorized employee credentials, assigned department, and login security."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card-body">
                {/* QUICK STATS CARDS MATCHING SECOND IMAGE */}
                <div className="settings-pa-stats-grid">
                  <div className="settings-pa-stat-card blue">
                    <div className="stat-content">
                      <span className="stat-label">Employee Profile</span>
                      <span className="stat-value">{user?.full_name || user?.username || "Employee"}</span>
                    </div>
                    <Users size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card green">
                    <div className="stat-content">
                      <span className="stat-label">Account Status</span>
                      <span className="stat-value">Account Active</span>
                    </div>
                    <CheckCircle size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card orange">
                    <div className="stat-content">
                      <span className="stat-label">Login Username</span>
                      <span className="stat-value">@{user?.username}</span>
                    </div>
                    <KeyRound size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card purple">
                    <div className="stat-content">
                      <span className="stat-label">Assigned Department</span>
                      <span className="stat-value">
                        {user?.department
                          ? user.department.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                          : (user?.role === "housekeeping" ? "Housekeeping" : (user?.role === "hotel-admin" ? "Administration" : "Operations"))}
                      </span>
                    </div>
                    <Briefcase size={22} className="stat-icon" />
                  </div>
                </div>

                {/* SINGLE-ROW DETAILS TABLE MATCHING IMAGE 2 EXACT DESIGN */}
                <div className="settings-pa-table-wrap" style={{ marginTop: "24px" }}>
                  <table className="settings-pa-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department &amp; Designation</th>
                        <th>Login Username</th>
                        <th>Role</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <div className="pa-employee-cell">
                            <div className="pa-avatar">
                              {(user?.full_name || user?.username || "E")[0].toUpperCase()}
                            </div>
                            <div className="pa-employee-details">
                              <span className="pa-employee-name">{user?.full_name || user?.username}</span>
                              <span className="pa-employee-sub">
                                <span>ID #{user?.staff_id || user?.user_id || user?.id || "1"}</span>
                                <span>•</span>
                                <span>{user?.phone || user?.email || (user?.hotel_name ? user.hotel_name : "Verified Staff")}</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            <span className="pa-dept-badge">
                              {user?.department ? user.department.replace(/_/g, " ") : "Housekeeping"}
                            </span>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {user?.designation || (user?.role_level === "department_head" ? "Head of Department (HOD)" : "Staff Member")}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: "700", color: "#0f172a" }}>
                            @{user?.username}
                          </span>
                        </td>

                        <td>
                          <span className="pa-role-badge">{roleDisplay}</span>
                        </td>

                        <td>
                          <span className="pa-status-badge pa-status-assigned">
                            Account Active
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* UPDATE USERNAME AND PASSWORD FORM */}
                <div style={{ marginTop: "30px", paddingTop: "24px", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <KeyRound size={18} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#0f172a" }}>
                      Update Username & Access Password
                    </h3>
                  </div>
                  <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
                    Modify your login username or update your secure access password. Leave the password fields blank if only updating your username.
                  </p>

                  <form onSubmit={handleUpdateProfile} className="settings-form-layout">
                    <div className="form-grid-2">
                      <div className="settings-form-group">
                        <label>Login Username *</label>
                        <input 
                          type="text" 
                          required
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Full Name *</label>
                        <input 
                          type="text" 
                          required
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="section-divider">
                      <span>Change Password (Leave blank to keep existing password)</span>
                    </div>

                    <div className="form-grid-2">
                      <div className="settings-form-group">
                        <label>New Password</label>
                        <div className="password-input-wrap">
                          <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Min 6 characters"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      <div className="settings-form-group">
                        <label>Confirm New Password</label>
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Re-type new password"
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="form-actions-bar">
                      <button type="submit" className="btn-submit" disabled={isSubmittingProfile}>
                        <Save size={16} />
                        {isSubmittingProfile ? "Updating Credentials..." : "Save Credentials"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 3: OPERATIONAL POLICIES
              ========================================================= */}
          {activeTab === "policies" && (
            <div className="settings-card">
              <div className="card-header">
                <div className="card-header-left">
                  <Clock size={20} className="header-icon green" />
                  <div>
                    <h2>Operational Policies & Check-in Timings</h2>
                    <p className="card-subtitle">Automate standard guest stay policies, check-in, and cashier settlement rules.</p>
                  </div>
                </div>

                {(user?.role === "hotel-admin" || user?.role === "super-admin") && (
                  <button
                    type="button"
                    className={`btn-action-outline ${isEditingHotel ? "active" : ""}`}
                    onClick={() => setIsEditingHotel(!isEditingHotel)}
                  >
                    {isEditingHotel ? (
                      <>
                        <X size={15} /> Cancel Edit
                      </>
                    ) : (
                      <>
                        <Edit size={15} /> Edit Policies
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="card-body">
                {isEditingHotel ? (
                  <form onSubmit={handleSaveHotel} className="settings-form-layout">
                    <div className="form-grid-2">
                      <div className="settings-form-group">
                        <label>Default Check-in Time (24h)</label>
                        <input
                          type="time"
                          value={hotelForm.default_checkin_time}
                          onChange={(e) => setHotelForm({ ...hotelForm, default_checkin_time: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Default Checkout Time (24h)</label>
                        <input
                          type="time"
                          value={hotelForm.default_checkout_time}
                          onChange={(e) => setHotelForm({ ...hotelForm, default_checkout_time: e.target.value })}
                        />
                      </div>

                      <div className="settings-form-group">
                        <label>Checkout Grace Period (Minutes)</label>
                        <input
                          type="number"
                          min="0"
                          max="240"
                          value={hotelForm.checkout_grace_minutes}
                          onChange={(e) => setHotelForm({ ...hotelForm, checkout_grace_minutes: e.target.value })}
                        />
                        <small className="field-hint">Time allowed past checkout before additional charge prompt.</small>
                      </div>

                      <div className="settings-form-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={hotelForm.require_full_payment_before_checkout}
                            onChange={(e) => setHotelForm({ ...hotelForm, require_full_payment_before_checkout: e.target.checked })}
                          />
                          <span>Enforce zero-balance settlement before guest checkout</span>
                        </label>
                        <small className="field-hint">Requires all room, restaurant, and laundry bills to be settled before checkout completion.</small>
                      </div>
                    </div>

                    <div className="form-actions-bar">
                      <button type="button" className="btn-cancel" onClick={() => setIsEditingHotel(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-submit" disabled={isSavingHotel}>
                        <Save size={16} />
                        {isSavingHotel ? "Saving..." : "Save Policies"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="policies-summary-grid">
                    <div className="policy-card">
                      <span className="policy-label">Standard Check-in Time</span>
                      <span className="policy-value">{hotelData?.default_checkin_time || "11:00 AM"}</span>
                      <span className="policy-desc">Guests arriving earlier are flagged for Early Check-in.</span>
                    </div>

                    <div className="policy-card">
                      <span className="policy-label">Standard Checkout Time</span>
                      <span className="policy-value">{hotelData?.default_checkout_time || "11:00 AM"}</span>
                      <span className="policy-desc">Billing cycle day cutoff time.</span>
                    </div>

                    <div className="policy-card">
                      <span className="policy-label">Checkout Grace Period</span>
                      <span className="policy-value">{hotelData?.checkout_grace_minutes ?? 60} Minutes</span>
                      <span className="policy-desc">Courtesy window before overdue penalties apply.</span>
                    </div>

                    <div className="policy-card">
                      <span className="policy-label">Zero Balance Checkout</span>
                      <span className={`policy-badge ${hotelData?.require_full_payment_before_checkout ? "enabled" : "flexible"}`}>
                        {hotelData?.require_full_payment_before_checkout ? "Strict Enforcement" : "Flexible Checkout Allowed"}
                      </span>
                      <span className="policy-desc">Controls whether checkout can proceed with balance due.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: PORTAL ACCESS & PERMISSIONS
              ========================================================= */}
          {activeTab === "permissions" && (user?.role === "hotel-admin" || user?.role === "super-admin") && (
            <div className="settings-card">
              <div className="card-header">
                <div className="card-header-left">
                  <KeyRound size={20} className="header-icon blue" />
                  <div>
                    <h2>Employee Access & Security Credentials</h2>
                    <p className="card-subtitle">Authorize employee accounts to access specific operational modules and manage login credentials.</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn-submit"
                    onClick={() => {
                      setSelectedStaffForModal(null);
                      setIsStaffModalOpen(true);
                    }}
                  >
                    <Plus size={15} /> Provision Access
                  </button>
                  <button
                    type="button"
                    className="btn-action-outline"
                    onClick={() => navigate("/staff/portal-access")}
                    title="Open Full Screen Roster Page"
                  >
                    <ExternalLink size={14} /> Dedicated Page
                  </button>
                </div>
              </div>

              <div className="card-body">
                {/* QUICK STATS CARDS */}
                <div className="settings-pa-stats-grid">
                  <div className="settings-pa-stat-card blue">
                    <div className="stat-content">
                      <span className="stat-label">Total Employees</span>
                      <span className="stat-value">{staffStats.total}</span>
                    </div>
                    <Users size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card green">
                    <div className="stat-content">
                      <span className="stat-label">Accounts Active</span>
                      <span className="stat-value">{staffStats.assigned}</span>
                    </div>
                    <CheckCircle size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card orange">
                    <div className="stat-content">
                      <span className="stat-label">Pending Accounts</span>
                      <span className="stat-value">{staffStats.unassigned}</span>
                    </div>
                    <KeyRound size={22} className="stat-icon" />
                  </div>

                  <div className="settings-pa-stat-card purple">
                    <div className="stat-content">
                      <span className="stat-label">Operational Modules</span>
                      <span className="stat-value">{staffStats.totalModules} Modules</span>
                    </div>
                    <Building2 size={22} className="stat-icon" />
                  </div>
                </div>

                {/* CONTROLS & SEARCH */}
                <div className="settings-pa-controls">
                  <div className="settings-pa-search">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search employee by name, username, phone or department..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                    />
                  </div>

                  <div className="settings-pa-filters">
                    <select
                      className="settings-pa-select"
                      value={staffDeptFilter}
                      onChange={(e) => setStaffDeptFilter(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      <option value="front_desk">Front Desk</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="food_beverage">Food & Beverage / Restaurant</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="accounts">Accounts</option>
                    </select>

                    <select
                      className="settings-pa-select"
                      value={staffStatusFilter}
                      onChange={(e) => setStaffStatusFilter(e.target.value)}
                    >
                      <option value="all">All Account Statuses</option>
                      <option value="assigned">Account Linked</option>
                      <option value="unassigned">Pending / Unassigned</option>
                    </select>
                  </div>
                </div>

                {/* STAFF ROSTER TABLE */}
                <div className="settings-pa-table-wrap">
                  <table className="settings-pa-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department &amp; Designation</th>
                        <th>Login Username</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingStaff ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                            <div className="settings-loading-state" style={{ justifyContent: "center" }}>
                              <div className="settings-spinner" />
                              <span>Loading employee access permissions...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredStaff.length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                            No employees match your search criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredStaff.map((staff) => {
                          const allowed = staff.user?.allowed_modules || [];
                          return (
                            <tr key={staff.id}>
                              <td>
                                <div className="pa-employee-cell">
                                  <div className="pa-avatar">
                                    {(staff.full_name || "S")[0].toUpperCase()}
                                  </div>
                                  <div className="pa-employee-details">
                                    <span className="pa-employee-name">{staff.full_name}</span>
                                    <span className="pa-employee-sub">
                                      <span>ID #{staff.id}</span>
                                      <span>•</span>
                                      <span>{staff.phone}</span>
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                                  <span className="pa-dept-badge">{staff.department}</span>
                                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                                    {staff.designation || "Staff"}
                                  </span>
                                </div>
                              </td>

                              <td>
                                {staff.user ? (
                                  <span style={{ fontWeight: "700", color: "#0f172a" }}>
                                    @{staff.user.username}
                                  </span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "12px" }}>
                                    Not provisioned
                                  </span>
                                )}
                              </td>

                              <td>
                                {staff.user ? (
                                  <span className="pa-role-badge">{staff.user.role}</span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                                )}
                              </td>

                              <td>
                                <span
                                  className={`pa-status-badge ${
                                    staff.is_assigned ? "pa-status-assigned" : "pa-status-unassigned"
                                  }`}
                                >
                                  {staff.is_assigned ? "Account Active" : "Unassigned"}
                                </span>
                              </td>

                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className={`pa-action-btn ${staff.is_assigned ? "edit-btn" : "create-btn"}`}
                                  onClick={() => {
                                    setSelectedStaffForModal(staff);
                                    setIsStaffModalOpen(true);
                                  }}
                                >
                                  {staff.is_assigned ? (
                                    <>
                                      <Edit size={13} /> Edit Access
                                    </>
                                  ) : (
                                    <>
                                      <KeyRound size={13} /> Provision Access
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PORTAL ACCESS MODAL */}
      <EmployeePortalAccessModal
        isOpen={isStaffModalOpen}
        onClose={() => {
          setIsStaffModalOpen(false);
          setSelectedStaffForModal(null);
        }}
        initialStaff={selectedStaffForModal}
        hotelId={effectiveHotelId}
        onSuccess={() => {
          fetchStaffStatus();
          setMessage({
            type: "success",
            text: "Employee portal access and credentials updated successfully!",
          });
          setTimeout(() => setMessage({ type: "", text: "" }), 4000);
        }}
      />
    </div>
  );
}