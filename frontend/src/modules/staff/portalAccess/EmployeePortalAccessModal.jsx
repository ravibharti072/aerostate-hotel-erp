import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  User,
  ShieldCheck,
  KeyRound,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Eye,
  EyeOff,
  Hotel,
  BedDouble,
  ClipboardList,
  Utensils,
  Package,
  Wrench,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  Building2,
  Briefcase,
} from "lucide-react";
import api from "@api/api";
import { DEPARTMENT_OPTIONS } from "../directory/StaffDirectoryPage";
import "./portalAccess.css";

// Standard Designation & Role Options (No portal multi-select!)
export const DESIGNATION_OPTIONS = [
  {
    key: "housekeeping_staff",
    label: "Housekeeping Staff",
    role: "housekeeping",
    role_level: "employee",
    department: "housekeeping",
    defaultDesignation: "Room Attendant",
    badge: "Staff",
    icon: ClipboardList,
    colorClass: "pa-icon-green",
    description: "Room cleaning staff: checkout turnovers, stayover sanitization, and room cleaning tasks.",
  },
  {
    key: "housekeeping_hod",
    label: "Housekeeping HOD",
    role: "housekeeping",
    role_level: "department_head",
    department: "housekeeping",
    defaultDesignation: "Housekeeping Manager",
    badge: "HOD",
    icon: ClipboardList,
    colorClass: "pa-icon-teal",
    description: "Housekeeping head: cleaning task assignment, room inspection & pass, and attendant workload management.",
  },
  {
    key: "front_desk_staff",
    label: "Front Desk Staff",
    role: "front-desk",
    role_level: "employee",
    department: "front_desk",
    defaultDesignation: "Receptionist",
    badge: "Staff",
    icon: Hotel,
    colorClass: "pa-icon-blue",
    description: "Reception staff: guest check-in/out, room bookings, guest directory, and billing.",
  },
  {
    key: "front_desk_hod",
    label: "Front Desk HOD",
    role: "front-desk",
    role_level: "department_head",
    department: "front_desk",
    defaultDesignation: "Front Office Manager",
    badge: "HOD",
    icon: Hotel,
    colorClass: "pa-icon-blue",
    description: "Front office head: command center, shift audit logs, room inventory, and team supervision.",
  },
  {
    key: "restaurant_staff",
    label: "Restaurant Staff",
    role: "restaurant",
    role_level: "employee",
    department: "restaurant",
    defaultDesignation: "Waiter / Steward",
    badge: "Staff",
    icon: Utensils,
    colorClass: "pa-icon-orange",
    description: "Restaurant & kitchen staff: order taking, kitchen display system, and table management.",
  },
  {
    key: "restaurant_hod",
    label: "Restaurant HOD",
    role: "restaurant",
    role_level: "department_head",
    department: "restaurant",
    defaultDesignation: "F&B Manager",
    badge: "HOD",
    icon: Utensils,
    colorClass: "pa-icon-orange",
    description: "F&B department head: menu catalog, POS bills, dining revenue reports, and banquet operations.",
  },
  {
    key: "maintenance_staff",
    label: "Maintenance Staff",
    role: "maintenance",
    role_level: "employee",
    department: "maintenance",
    defaultDesignation: "Maintenance Technician",
    badge: "Staff",
    icon: Wrench,
    colorClass: "pa-icon-red",
    description: "Maintenance technician: assigned work orders, equipment repairs, and room issue fixes.",
  },
  {
    key: "maintenance_hod",
    label: "Maintenance HOD",
    role: "maintenance",
    role_level: "department_head",
    department: "maintenance",
    defaultDesignation: "Chief Engineer",
    badge: "HOD",
    icon: Wrench,
    colorClass: "pa-icon-red",
    description: "Engineering head: task dispatching, asset catalog, preventive maintenance schedules.",
  },
  {
    key: "accounts_staff",
    label: "Accounts Staff",
    role: "accountant",
    role_level: "employee",
    department: "accounts",
    defaultDesignation: "Accountant",
    badge: "Staff",
    icon: CreditCard,
    colorClass: "pa-icon-green",
    description: "Accounts staff: daily operational expenses, cash ledger entries, and supplier vouchers.",
  },
  {
    key: "accounts_hod",
    label: "Accounts HOD",
    role: "accountant",
    role_level: "department_head",
    department: "accounts",
    defaultDesignation: "Financial Controller",
    badge: "HOD",
    icon: CreditCard,
    colorClass: "pa-icon-green",
    description: "Finance head: financial audits, profit/loss statements, salary payroll approvals.",
  },
  {
    key: "hotel_admin",
    label: "Hotel Admin",
    role: "hotel-admin",
    role_level: "admin",
    department: "management",
    defaultDesignation: "General Manager",
    badge: "Admin",
    icon: ShieldCheck,
    colorClass: "pa-icon-teal",
    description: "Hotel Administrator: full property administration, all department oversight, and staff management.",
  },
];

// Backward compatibility stub for existing imports
export const PORTAL_DEFINITIONS = DESIGNATION_OPTIONS.map((d) => ({
  key: d.key,
  label: d.label,
  description: d.description,
  icon: d.icon,
  colorClass: d.colorClass,
}));

// Helper to determine the best matching designation for an employee
export const getDesignationForStaff = (staff) => {
  if (!staff) return DESIGNATION_OPTIONS[0];
  const dept = String(staff.department || "").toLowerCase().trim();
  const roleLevel = String(staff.role_level || staff.user?.role_level || "").toLowerCase().trim();
  const designation = String(staff.designation || "").toLowerCase().trim();
  const userRole = String(staff.user?.role || "").toLowerCase().trim();

  const isHead =
    roleLevel === "department_head" ||
    roleLevel === "admin" ||
    designation.includes("head") ||
    designation.includes("manager") ||
    designation.includes("supervisor") ||
    designation.includes("chief");

  if (userRole === "hotel-admin" || dept.includes("manage") || designation.includes("general manager")) {
    return DESIGNATION_OPTIONS.find((d) => d.key === "hotel_admin") || DESIGNATION_OPTIONS[0];
  }
  if (dept.includes("housekeep") || dept.includes("clean") || userRole === "housekeeping") {
    return DESIGNATION_OPTIONS.find((d) => d.key === (isHead ? "housekeeping_hod" : "housekeeping_staff")) || DESIGNATION_OPTIONS[0];
  }
  if (dept.includes("maint") || dept.includes("engin") || dept.includes("garden") || userRole === "maintenance") {
    return DESIGNATION_OPTIONS.find((d) => d.key === (isHead ? "maintenance_hod" : "maintenance_staff")) || DESIGNATION_OPTIONS[6];
  }
  if (dept.includes("rest") || dept.includes("banquet") || dept.includes("food") || dept.includes("kitchen") || userRole === "restaurant") {
    return DESIGNATION_OPTIONS.find((d) => d.key === (isHead ? "restaurant_hod" : "restaurant_staff")) || DESIGNATION_OPTIONS[4];
  }
  if (dept.includes("account") || dept.includes("cash") || dept.includes("finance") || userRole === "accountant") {
    return DESIGNATION_OPTIONS.find((d) => d.key === (isHead ? "accounts_hod" : "accounts_staff")) || DESIGNATION_OPTIONS[8];
  }
  if (dept.includes("front") || userRole === "front-desk") {
    return DESIGNATION_OPTIONS.find((d) => d.key === (isHead ? "front_desk_hod" : "front_desk_staff")) || DESIGNATION_OPTIONS[2];
  }

  return isHead ? DESIGNATION_OPTIONS[1] : DESIGNATION_OPTIONS[0];
};

export default function EmployeePortalAccessModal({
  isOpen,
  onClose,
  initialStaff = null,
  hotelId,
  onSuccess,
}) {
  const [currentStep, setCurrentStep] = useState(initialStaff ? 2 : 1);
  const [staffList, setStaffList] = useState([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const [selectedStaff, setSelectedStaff] = useState(initialStaff);
  const [selectedDesignationKey, setSelectedDesignationKey] = useState("housekeeping_staff");

  // Credentials State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const applyStaffSelection = (staff) => {
    setSelectedStaff(staff);
    const matchedDesig = getDesignationForStaff(staff);
    setSelectedDesignationKey(matchedDesig?.key || "housekeeping_staff");

    if (staff.user) {
      // Existing user account
      setUsername(staff.user.username || "");
      setEmail(staff.user.email || staff.email || "");
      setPhone(staff.user.phone || staff.phone || "");
      setPassword("");
    } else {
      // New user account
      const baseName = (staff.full_name || "emp")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      setUsername(`${baseName}${staff.id}`);
      setEmail(staff.email || "");
      setPhone(staff.phone || "");
      setPassword("Staff@" + Math.floor(1000 + Math.random() * 9000));
    }
  };

  // Load unassigned/assigned staff list
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setSuccessMsg("");

    const fetchStaffDirectory = async () => {
      setIsLoadingStaff(true);
      try {
        const res = await api.get("/staff/unassigned-users", {
          params: hotelId ? { hotel_id: hotelId } : {},
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setStaffList(list);

        if (initialStaff) {
          const matched = list.find((s) => s.id === initialStaff.id) || initialStaff;
          applyStaffSelection(matched);
          setCurrentStep(2);
        } else {
          setCurrentStep(1);
        }
      } catch (err) {
        console.error("Failed to fetch staff portal status:", err);
      } finally {
        setIsLoadingStaff(false);
      }
    };

    fetchStaffDirectory();
  }, [isOpen, hotelId, initialStaff]);

  const handleSelectStaff = (staff) => {
    applyStaffSelection(staff);
    setCurrentStep(2);
  };

  // Auto Generate Password
  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const name = (s.full_name || "").toLowerCase();
      const phoneNum = s.phone || "";
      const matchesSearch =
        name.includes(searchTerm.toLowerCase()) || phoneNum.includes(searchTerm);
      const matchesDept =
        deptFilter === "all" ||
        s.department?.toLowerCase() === deptFilter.toLowerCase();
      return matchesSearch && matchesDept;
    });
  }, [staffList, searchTerm, deptFilter]);

  const selectedConfig = useMemo(() => {
    return (
      DESIGNATION_OPTIONS.find((d) => d.key === selectedDesignationKey) ||
      DESIGNATION_OPTIONS[0]
    );
  }, [selectedDesignationKey]);

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedStaff) {
      setErrorMsg("Please select an employee.");
      return;
    }

    if (!username.trim()) {
      setErrorMsg("Username is required.");
      return;
    }

    if (!selectedStaff.user && (!password || password.length < 6)) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password && password.length > 0 && password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        staff_id: selectedStaff.id,
        username: username.trim(),
        role: selectedConfig.role,
        role_level: selectedConfig.role_level,
        department: selectedConfig.department,
        designation: selectedConfig.defaultDesignation,
        allowed_modules: [],
        email: email && email.trim() ? email.trim() : null,
        phone: phone && phone.trim() ? phone.trim() : null,
      };

      if (password && password.trim()) {
        payload.password = password.trim();
      }

      await api.post("/auth/create-employee-portal-access", payload);
      setSuccessMsg(`Access configured for ${selectedStaff.full_name} as ${selectedConfig.label}!`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1100);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : "Failed to configure designation access.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pa-modal-overlay">
      <div className="pa-modal-content">
        {/* Modal Header */}
        <div className="pa-modal-header">
          <div>
            <h3>
              {selectedStaff?.user
                ? "Manage Employee Designation & Access"
                : "Assign Designation & Portal Access"}
            </h3>
            <p>
              {selectedStaff
                ? `Assign role designation (HOD vs Staff) and credentials for ${selectedStaff.full_name}.`
                : "Select an employee to assign their department role and portal login."}
            </p>
          </div>
          <button className="pa-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Wizard Steps */}
        {!initialStaff && (
          <div className="pa-wizard-steps">
            <div
              className={`pa-step-item ${currentStep === 1 ? "active" : ""} ${
                selectedStaff ? "completed" : ""
              }`}
              onClick={() => setCurrentStep(1)}
            >
              <div className="pa-step-num">
                {selectedStaff ? <Check size={14} /> : "1"}
              </div>
              <span className="pa-step-label">Select Employee</span>
            </div>

            <div
              className={`pa-step-item ${currentStep === 2 ? "active" : ""}`}
              onClick={() => selectedStaff && setCurrentStep(2)}
            >
              <div className="pa-step-num">2</div>
              <span className="pa-step-label">Designation & Login</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="pa-modal-body">
          {errorMsg && (
            <div className="pa-alert pa-alert-error">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="pa-alert pa-alert-success">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: EMPLOYEE PICKER */}
          {currentStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="pa-picker-search">
                <div className="pa-search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, designation, or phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="pa-filter-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {DEPARTMENT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pa-staff-picker-list">
                {isLoadingStaff ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    Loading staff directory...
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                    No staff found matching search.
                  </div>
                ) : (
                  filteredStaff.map((staff) => {
                    const matched = getDesignationForStaff(staff);
                    return (
                      <div
                        key={staff.id}
                        className={`pa-staff-picker-item ${
                          selectedStaff?.id === staff.id ? "selected" : ""
                        }`}
                        onClick={() => handleSelectStaff(staff)}
                      >
                        <div className="pa-avatar">
                          {(staff.full_name || "S")[0].toUpperCase()}
                        </div>
                        <div className="pa-picker-info">
                          <div className="pa-picker-name">
                            {staff.full_name}{" "}
                            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>
                              (Emp #{staff.id})
                            </span>
                          </div>
                          <div className="pa-picker-dept">
                            {staff.department?.toUpperCase()} • {staff.designation || "Staff"}
                          </div>
                        </div>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#059669",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontWeight: "600",
                            }}
                          >
                            Suggested: {matched.label}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: CREDENTIALS & DESIGNATION SETUP */}
          {currentStep === 2 && selectedStaff && (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Employee Summary Card */}
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "50%",
                      background: "#166534",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "700",
                      fontSize: "15px",
                    }}
                  >
                    {(selectedStaff.full_name || "S")[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: "700", color: "#166534", fontSize: "14px" }}>
                      {selectedStaff.full_name}{" "}
                      <span style={{ fontWeight: "500", fontSize: "12px", color: "#475569" }}>
                        (EMP-#{selectedStaff.id})
                      </span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#15803d" }}>
                      {selectedStaff.department?.toUpperCase()} • {selectedStaff.designation || "Staff"}{" "}
                      {selectedStaff.user ? "• (Active Login)" : "• (New Login)"}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: selectedStaff.user ? "#15803d" : "#b45309",
                    background: selectedStaff.user ? "#dcfce7" : "#fef3c7",
                    border: `1px solid ${selectedStaff.user ? "#86efac" : "#fde68a"}`,
                    padding: "3px 10px",
                    borderRadius: "6px",
                  }}
                >
                  {selectedStaff.user ? "Account Provisioned" : "Unprovisioned"}
                </span>
              </div>

              {/* DESIGNATION DROPDOWN */}
              <div className="pa-form-group full-width">
                <label className="pa-form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Assign Department Role & Designation *</span>
                  <span style={{ fontSize: "11px", color: "#166534", fontWeight: "700" }}>
                    Select HOD or Staff
                  </span>
                </label>
                <select
                  className="pa-form-select"
                  value={selectedDesignationKey}
                  onChange={(e) => setSelectedDesignationKey(e.target.value)}
                  style={{
                    fontWeight: "700",
                    fontSize: "14px",
                    padding: "10px 12px",
                    border: "2px solid #166962",
                    borderRadius: "8px",
                  }}
                >
                  <optgroup label="Housekeeping Department">
                    <option value="housekeeping_staff">Housekeeping Staff (Attendant / Cleaner)</option>
                    <option value="housekeeping_hod">Housekeeping HOD (Housekeeping Manager / Head)</option>
                  </optgroup>
                  <optgroup label="Front Desk Department">
                    <option value="front_desk_staff">Front Desk Staff (Receptionist / Front Agent)</option>
                    <option value="front_desk_hod">Front Desk HOD (Front Office Manager / Head)</option>
                  </optgroup>
                  <optgroup label="Restaurant & POS Department">
                    <option value="restaurant_staff">Restaurant Staff (Waiter / Steward / Kitchen)</option>
                    <option value="restaurant_hod">Restaurant HOD (F&B Manager / Head)</option>
                  </optgroup>
                  <optgroup label="Maintenance & Engineering">
                    <option value="maintenance_staff">Maintenance Staff (Technician / Plumber / Electrician)</option>
                    <option value="maintenance_hod">Maintenance HOD (Chief Engineer / Head)</option>
                  </optgroup>
                  <optgroup label="Accounts & Finance">
                    <option value="accounts_staff">Accounts Staff (Accountant / Cashier)</option>
                    <option value="accounts_hod">Accounts HOD (Financial Controller / Head)</option>
                  </optgroup>
                  <optgroup label="General Hotel Management">
                    <option value="hotel_admin">Hotel Admin (General Manager / Administrator)</option>
                  </optgroup>
                </select>
              </div>

              {/* Selected Role Info Card */}
              {selectedConfig && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "6px",
                      background: "#166962",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                        {selectedConfig.label}
                      </strong>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: selectedConfig.badge === "HOD" ? "#fef3c7" : "#e0f2fe",
                          color: selectedConfig.badge === "HOD" ? "#b45309" : "#0369a1",
                        }}
                      >
                        {selectedConfig.badge}
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                      {selectedConfig.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Form Grid */}
              <div className="pa-form-grid">
                <div className="pa-form-group">
                  <label className="pa-form-label">
                    <span>Username *</span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Unique Login ID</span>
                  </label>
                  <input
                    type="text"
                    className="pa-form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="e.g. emp8"
                  />
                </div>

                <div className="pa-form-group">
                  <label className="pa-form-label">
                    <span>{selectedStaff?.user ? "Change Password" : "Password *"}</span>
                    <button
                      type="button"
                      className="pa-input-inline-btn"
                      style={{ position: "static" }}
                      onClick={generatePassword}
                    >
                      <Sparkles size={12} style={{ display: "inline", marginRight: "4px" }} />
                      Generate
                    </button>
                  </label>
                  <div className="pa-input-with-action">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="pa-form-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!selectedStaff?.user}
                      placeholder={selectedStaff?.user ? "Leave blank to keep current" : "Min 6 characters"}
                    />
                    <button
                      type="button"
                      className="pa-input-inline-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pa-form-group">
                  <label className="pa-form-label">Email (Optional)</label>
                  <input
                    type="email"
                    className="pa-form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@hotel.com"
                  />
                </div>

                <div className="pa-form-group">
                  <label className="pa-form-label">Phone (Optional)</label>
                  <input
                    type="text"
                    className="pa-form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Mobile number"
                  />
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pa-modal-footer">
          <div>
            {!initialStaff && currentStep === 2 && (
              <button
                type="button"
                className="pa-btn-secondary"
                onClick={() => setCurrentStep(1)}
              >
                <ChevronLeft size={16} /> Choose Different Employee
              </button>
            )}
          </div>

          <div className="pa-footer-actions">
            <button type="button" className="pa-btn-secondary" onClick={onClose}>
              Cancel
            </button>

            {currentStep === 1 ? (
              <button
                type="button"
                className="pa-btn-primary"
                onClick={() => {
                  if (!selectedStaff) {
                    setErrorMsg("Please select an employee first.");
                    return;
                  }
                  setErrorMsg("");
                  setCurrentStep(2);
                }}
              >
                Set Credentials <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="pa-btn-primary"
                disabled={isSubmitting}
                onClick={handleSubmit}
                style={{ backgroundColor: "#166962", borderColor: "#166962" }}
              >
                {isSubmitting ? (
                  "Saving Access..."
                ) : (
                  <>
                    <KeyRound size={16} />
                    {selectedStaff?.user ? "Save Designation Access" : "Assign Designation Access"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
