import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext"; 
import api from "@api/api";
import { Search, Plus, Phone, Briefcase, X, Users, CreditCard, Landmark, UserX, UserCheck, Download, Clock, Eye, KeyRound, ShieldCheck, Pencil } from "lucide-react";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard"; 
import ModuleWriternHeader from "../../../components/headers/ModuleWriternHeader";
import Pagination from "../../../components/common/Pagination";
import EmployeePortalAccessModal from "../portalAccess/EmployeePortalAccessModal";
import "./staffDirectory.css";

export const DEPARTMENT_OPTIONS = [
  { value: "front_desk", label: "Front Desk" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "restaurant", label: "Restaurant" },
  { value: "banquet_events", label: "Banquet & Events" },
  { value: "store_purchase", label: "Store & Purchase" },
  { value: "accounts", label: "Accounts" },
  { value: "hr_admin", label: "HR & Admin" },
  { value: "security", label: "Security" },
  { value: "sales_marketing", label: "Sales & Marketing" },
  { value: "driver", label: "Driver" },
  { value: "gardening", label: "Gardening" },
  { value: "maintenance", label: "Maintenance" },
  { value: "management", label: "Management" },
];

export const DEPARTMENT_DESIGNATIONS = {
  maintenance: {
    department_head: ["Chief Engineer", "Maintenance Manager", "Maintenance Supervisor"],
    employee: ["Electrician", "Plumber", "AC Technician", "Carpenter", "Maintenance Technician", "Painter", "General Helper", "Gardener"],
  },
  front_desk: {
    department_head: ["Front Office Manager", "Front Desk Supervisor"],
    employee: ["Receptionist", "Front Desk Executive", "Night Auditor", "Concierge", "Bellboy / Porter", "Cashier"],
  },
  housekeeping: {
    department_head: ["Executive Housekeeper", "Housekeeping Manager", "Housekeeping Supervisor"],
    employee: ["Room Attendant", "Housekeeper", "Laundry Attendant", "Public Area Attendant", "Linen Room Attendant"],
  },
  restaurant: {
    department_head: ["F&B Manager", "Restaurant Manager", "Executive Chef"],
    employee: ["Captain", "Waiter / Steward", "Sous Chef", "Line Cook", "Bartender", "Kitchen Steward"],
  },
  banquet_events: {
    department_head: ["Banquet Manager", "Events Director"],
    employee: ["Banquet Executive", "Events Coordinator", "Banquet Steward", "AV Technician"],
  },
  store_purchase: {
    department_head: ["Purchase Manager", "Store Manager"],
    employee: ["Storekeeper", "Purchase Assistant", "Inventory Clerk"],
  },
  accounts: {
    department_head: ["Financial Controller", "Chief Accountant", "Accounts Manager"],
    employee: ["Accountant", "Accounts Assistant", "Cashier", "Night Auditor"],
  },
  hr_admin: {
    department_head: ["HR Manager", "Admin Manager"],
    employee: ["HR Executive", "HR Assistant", "Admin Officer"],
  },
  security: {
    department_head: ["Chief Security Officer", "Security Supervisor"],
    employee: ["Security Guard", "CCTV Operator", "Gatekeeper"],
  },
  sales_marketing: {
    department_head: ["Sales Director", "Marketing Manager"],
    employee: ["Sales Executive", "Marketing Coordinator", "Digital Marketer"],
  },
  driver: {
    department_head: ["Transport Supervisor"],
    employee: ["Hotel Chauffeur", "Van Driver", "Valet Driver"],
  },
  gardening: {
    department_head: ["Head Gardener / Landscape Supervisor"],
    employee: ["Gardener", "Horticulturist"],
  },
  management: {
    department_head: ["General Manager", "Operations Manager", "Resident Manager"],
    employee: ["Duty Manager", "Management Trainee", "Executive Assistant"],
  },
};

export const getDesignationsFor = (department, roleLevel) => {
  const deptKey = (department || "").toLowerCase().trim();
  const levelKey = roleLevel === "department_head" ? "department_head" : "employee";
  const deptConfig = DEPARTMENT_DESIGNATIONS[deptKey] || DEPARTMENT_DESIGNATIONS.management;
  return deptConfig?.[levelKey] || [];
};

export const formatDepartment = (dept) => {
  if (!dept) return "None";
  const normalized = String(dept).trim().toLowerCase();
  const match = DEPARTMENT_OPTIONS.find(
    (d) => d.value.toLowerCase() === normalized || d.label.toLowerCase() === normalized
  );
  if (match) return match.label;
  return dept.replace(/_/g, " ");
};

export default function StaffDirectoryPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth(); 

  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); 

  const [roleLevelFilter, setRoleLevelFilter] = useState("all"); 

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Toast feedback state
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalModalStaff, setPortalModalStaff] = useState(null);

  const isHotelAdmin = user?.role === "hotel-admin" || user?.role === "super-admin";

  const initialFormState = {
    full_name: "",
    phone: "",
    dob: "",
    father_name: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    aadhaar_no: "",
    pan_no: "",
    department: "housekeeping",
    role_level: "employee",
    designation: "Room Attendant",
    custom_designation: "",
    employee_type: "permanent",
    joining_date: new Date().toISOString().split("T")[0],
    working_hours: 8,
    status: "active",
    hotel_id: user?.hotel_id || 1,
    create_portal_access: false,
    portal_username: "",
    portal_password: "",
    force_department_head: false,
    bank_name: "",
    bank_account_no: "",
    ifsc_code: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchStaff = async () => {
    if (!token) return; 
    setIsLoading(true);
    try {
      const params = {};
      if (departmentFilter) params.department = departmentFilter;
      const response = await api.get("/staff", { params });
      setStaffList(Array.isArray(response.data) ? response.data : []);
    } catch (error) { console.error("Error fetching staff:", error); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [departmentFilter, token]); 

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, typeFilter, roleLevelFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    const defaultDesigs = getDesignationsFor("housekeeping", "employee");
    setFormData({
      ...initialFormState,
      department: "housekeeping",
      role_level: "employee",
      designation: defaultDesigs[0] || "Room Attendant",
      joining_date: new Date().toISOString().split("T")[0],
      working_hours: 8,
      status: "active",
    });
    setEditingStaffId(null);
    setErrorMessage("");
    setIsViewMode(false); 
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setErrorMessage(""); 
    setEditingStaffId(null);
    setIsViewMode(false);
    setFormData(initialFormState);
  };

  const handleEditClick = (staff) => {
    const roleLevel = staff.role_level || "employee";
    const available = getDesignationsFor(staff.department, roleLevel);
    const isStandard = available.includes(staff.designation);

    setFormData({
      full_name: staff.full_name || "",
      phone: staff.phone || "",
      dob: staff.dob || "",
      father_name: staff.father_name || "",
      emergency_contact_name: staff.emergency_contact_name || "",
      emergency_contact_phone: staff.emergency_contact_phone || "",
      aadhaar_no: staff.aadhaar_no || "",
      pan_no: staff.pan_no || "",
      department: staff.department || "housekeeping",
      role_level: roleLevel,
      designation: isStandard ? staff.designation : (staff.designation ? "custom" : ""),
      custom_designation: isStandard ? "" : (staff.designation || ""),
      employee_type: staff.employee_type || "permanent",
      joining_date: staff.joining_date ? String(staff.joining_date).split("T")[0] : new Date().toISOString().split("T")[0],
      working_hours: staff.working_hours ?? 8,
      status: staff.status || "active",
      hotel_id: staff.hotel_id || user?.hotel_id || 1,
      bank_name: staff.bank_name || "",
      bank_account_no: staff.bank_account_no || "",
      ifsc_code: staff.ifsc_code || "",
      create_portal_access: false,
      portal_username: "",
      portal_password: "",
      force_department_head: false,
    });
    setEditingStaffId(staff.id);
    setErrorMessage("");
    setIsViewMode(false); // Direct Edit Mode
    setIsModalOpen(true);
  };

  const handleViewClick = (staff) => {
    const roleLevel = staff.role_level || "employee";
    const available = getDesignationsFor(staff.department, roleLevel);
    const isStandard = available.includes(staff.designation);

    setFormData({
      full_name: staff.full_name || "",
      phone: staff.phone || "",
      dob: staff.dob || "",
      father_name: staff.father_name || "",
      emergency_contact_name: staff.emergency_contact_name || "",
      emergency_contact_phone: staff.emergency_contact_phone || "",
      aadhaar_no: staff.aadhaar_no || "",
      pan_no: staff.pan_no || "",
      department: staff.department || "housekeeping",
      role_level: roleLevel,
      designation: isStandard ? staff.designation : (staff.designation ? "custom" : ""),
      custom_designation: isStandard ? "" : (staff.designation || ""),
      employee_type: staff.employee_type || "permanent",
      joining_date: staff.joining_date ? String(staff.joining_date).split("T")[0] : new Date().toISOString().split("T")[0],
      working_hours: staff.working_hours ?? 8,
      status: staff.status || "active",
      hotel_id: staff.hotel_id || user?.hotel_id || 1,
      bank_name: staff.bank_name || "",
      bank_account_no: staff.bank_account_no || "",
      ifsc_code: staff.ifsc_code || "",
      create_portal_access: false,
      portal_username: "",
      portal_password: "",
      force_department_head: false,
    });
    setEditingStaffId(staff.id);
    setErrorMessage("");
    setIsViewMode(true); 
    setIsModalOpen(true);
  };

  const handleToggleClick = (staff) => {
    const isCurrentlyActive = staff.status === 'active';
    setConfirmModal({
      isOpen: true,
      title: isCurrentlyActive ? "Deactivate Employee" : "Reactivate Employee",
      message: isCurrentlyActive ? "Flag this employee as INACTIVE?" : "REACTIVATE this employee?",
      data: { action: "toggle_status", staffId: staff.id, newStatus: isCurrentlyActive ? 'inactive' : 'active' }
    });
  };

  const handleConfirmModalAction = () => {
    if (!confirmModal.data) return;
    if (confirmModal.data.action === "confirm_head") {
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
      executeSaveStaff(true);
    } else if (confirmModal.data.action === "toggle_status") {
      executeStatusToggle();
    }
  };

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      await api.put(`/staff/${confirmModal.data.staffId}`, { status: confirmModal.data.newStatus });
      fetchStaff();
      setConfirmModal({ isOpen: false, title: "", message: "", data: null });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const handleSubmitStaff = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const targetDesignation = formData.designation === "custom"
      ? (formData.custom_designation || "").trim()
      : formData.designation;

    if (!targetDesignation) {
      setErrorMessage("Please select or specify a designation.");
      return;
    }

    // Check Department Head uniqueness
    if (formData.role_level === "department_head" && !formData.force_department_head) {
      const existingHead = staffList.find(
        (s) =>
          s.department === formData.department &&
          s.role_level === "department_head" &&
          s.status === "active" &&
          s.id !== editingStaffId
      );
      if (existingHead) {
        setConfirmModal({
          isOpen: true,
          title: "Confirm Department Head",
          message: `An active Department Head (${existingHead.full_name}) is already assigned to the ${formatDepartment(formData.department)} department. Only one active Department Head is standard. Do you want to proceed and assign ${formData.full_name || "this employee"} as Department Head?`,
          data: { action: "confirm_head" },
        });
        return;
      }
    }

    await executeSaveStaff(false);
  };

  const executeSaveStaff = async (forcedHead = false) => {
    setIsSubmitting(true);
    setErrorMessage("");

    const targetDesignation = formData.designation === "custom"
      ? (formData.custom_designation || "").trim()
      : formData.designation;

    try {
      const payload = { 
        ...formData, 
        designation: targetDesignation,
        hotel_id: parseInt(formData.hotel_id, 10), 
        working_hours: parseInt(formData.working_hours, 10) || 8,
        full_name: formData.full_name.trim(),
        force_department_head: forcedHead || formData.force_department_head,
      };
      
      if (editingStaffId) {
        const updatePayload = { ...payload };
        delete updatePayload.create_portal_access;
        delete updatePayload.portal_username;
        delete updatePayload.portal_password;
        if (!updatePayload.email || !updatePayload.email.trim()) {
          updatePayload.email = null;
        }
        if (!updatePayload.dob) {
          delete updatePayload.dob;
        }
        await api.put(`/staff/${editingStaffId}`, updatePayload);
        showToast(`Employee "${formData.full_name}" updated successfully!`, "success");
      } else {
        await api.post("/staff", payload);
        showToast(`Employee "${formData.full_name}" created successfully!`, "success");
      }

      closeModal();
      fetchStaff();
    } catch (error) {
      console.error("Error saving staff:", error);
      const detail = error.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Failed to save staff record.");
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadStaffData = () => {
    if (!staffList.length) {
      alert("No staff records available to download.");
      return;
    }

    const headers = ["ID", "Full Name", "Phone", "Department", "Designation", "Employment Type", "Daily Hours", "Status", "Bank Name", "Account No", "IFSC"];
    const rows = staffList.map(s => [
      `EMP-${s.id.toString().padStart(4, '0')}`,
      `"${s.full_name || ''}"`,
      `"${s.phone || ''}"`,
      `"${formatDepartment(s.department)}"`,
      `"${s.designation || ''}"`,
      `"${s.employee_type || ''}"`,
      s.working_hours || 8,
      `"${s.status || ''}"`,
      `"${s.bank_name || ''}"`,
      `"${s.bank_account_no || ''}"`,
      `"${s.ifsc_code || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `staff_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStaff = staffList.filter(staff => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (staff?.full_name || "").toLowerCase().includes(search) || (staff?.phone || "").includes(search);
    const matchesType = typeFilter === "all" || staff?.employee_type === typeFilter;
    const matchesDept = !departmentFilter || staff?.department === departmentFilter;
    const matchesRoleLevel = roleLevelFilter === "all" || (staff?.role_level || "employee") === roleLevelFilter;
    
    return matchesSearch && matchesType && matchesDept && matchesRoleLevel;
  });

  const paginatedStaff = useMemo(() => {
    if (pageSize === "all") return filteredStaff;
    const start = (currentPage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, currentPage, pageSize]);

  // Calculate live stats for the StatCards
  const directoryStats = useMemo(() => {
    return {
      total: staffList.length,
      active: staffList.filter(s => s.status === 'active').length,
      permanent: staffList.filter(s => !s.employee_type || s.employee_type === 'permanent').length,
      contract: staffList.filter(s => s.employee_type === 'contract').length,
    };
  }, [staffList]);

  return (
    <div className="directory-page">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}

      <PortalHeader 
        title="Staff Directory" kicker="HUMAN RESOURCES"
        description="Manage all hotel employees, their roles, and contact information."
        icon={Users} backPath="/staff"
        rightAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="dir-add-btn" style={{ backgroundColor: '#4f46e5' }} onClick={handleDownloadStaffData}>
              <Download size={18} /> Download Data
            </button>
            <button className="dir-add-btn" onClick={openAddModal}>
              <Plus size={18} /> Add New Staff
            </button>
          </div>
        }
      />

      {/* --- REUSABLE STATS GRID --- */}
      <div className="dir-stats-grid">
        <StatCard
          title="Total Staff"
          value={directoryStats.total}
          Icon={Users}
          colorTheme="blue"
        />
        <StatCard
          title="Active Employees"
          value={directoryStats.active}
          Icon={UserCheck}
          colorTheme="green"
        />
        <StatCard
          title="Permanent Staff"
          value={directoryStats.permanent}
          Icon={Briefcase}
          colorTheme="purple"
        />
        <StatCard
          title="Contractual / Labor"
          value={directoryStats.contract}
          Icon={Clock}
          colorTheme="orange"
        />
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="dir-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Employee Roster"
          description="View, sort, and update hotel staff records and details."
          badgeCount={filteredStaff.length}
          badgeLabel="staff"
        />

        {/* TOOLBAR */}
        <div className="dir-controls">
          <select className="dir-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Employment Types</option>
            <option value="permanent">Permanent Staff</option>
            <option value="contract">Contractual Staff</option>
          </select>

          <select className="dir-filter-select" value={roleLevelFilter} onChange={(e) => setRoleLevelFilter(e.target.value)}>
            <option value="all">All Role Levels</option>
            <option value="employee">Staff / Technicians</option>
            <option value="department_head">Department Heads (HOD)</option>
          </select>

          <div className="dir-search-box">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <select className="dir-filter-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All Departments</option>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* TABLE */}
        <div className="dir-table-container">
          <table className="dir-table">
            <thead>
              <tr><th>Employee Name</th><th>Role & Type</th><th>Govt IDs</th><th>Bank Details</th><th>Status</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td colSpan="6" className="empty-state">Loading staff...</td></tr> : 
               filteredStaff.length === 0 ? <tr><td colSpan="6" className="empty-state">No staff matches the selected filters.</td></tr> :
               paginatedStaff.map((staff) => {
                 const nameParts = (staff?.full_name || "Unknown").trim().split(" ");
                 const initials = (nameParts[0]?.[0] || "") + (nameParts.length > 1 ? nameParts[nameParts.length-1][0] : "");
                 const isActive = staff?.status === 'active';
                 return (
                   <tr key={staff.id}>
                     <td style={{ opacity: isActive ? 1 : 0.5 }}>
                       <div className="staff-name-cell">
                         <div className="staff-avatar">{initials.toUpperCase()}</div>
                         <div>
                           <strong>{staff.full_name}</strong>
                           <span className="staff-id">ID: EMP-{staff.id.toString().padStart(4, '0')}</span>
                           <div className="contact-item" style={{ marginTop: '4px' }}>
                             <Phone size={12} /> {staff?.phone || "N/A"}
                           </div>
                         </div>
                       </div>
                     </td>
                     <td style={{ opacity: isActive ? 1 : 0.5 }}>
                       <div className="role-cell">
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                           <strong>{staff?.designation || "No Role"}</strong>
                           {staff?.role_level === "department_head" && (
                             <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                               <ShieldCheck size={11} /> HOD
                             </span>
                           )}
                         </div>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                           <span className="department-badge" style={{ margin: 0 }}>
                             <Briefcase size={12} />
                             {formatDepartment(staff?.department)}
                           </span>
                           <span style={{
                             fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                             backgroundColor: staff?.employee_type === 'contract' ? '#fef3c7' : '#e0f2fe',
                             color: staff?.employee_type === 'contract' ? '#92400e' : '#0369a1'
                           }}>
                             {staff?.employee_type || 'Permanent'}
                           </span>
                           <span style={{
                             fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', padding: '2px 6px', borderRadius: '4px',
                             backgroundColor: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px'
                           }}>
                             <Clock size={10} /> {staff?.working_hours || 8} HRS
                           </span>
                         </div>
                       </div>
                     </td>
                     <td style={{ opacity: isActive ? 1 : 0.5 }}>
                       <div className="info-stack">
                         <div className="info-row">
                           <CreditCard size={12} className="info-icon" />
                           <span className="info-label">Aadhaar:</span>
                           <span className="info-value">[Aadhaar Redacted]</span>
                         </div>
                         <div className="info-row">
                           <CreditCard size={12} className="info-icon" />
                           <span className="info-label">PAN:</span>
                           <span className="info-value">{staff?.pan_no || "N/A"}</span>
                         </div>
                       </div>
                     </td>
                     <td style={{ opacity: isActive ? 1 : 0.5 }}>
                       <div className="info-stack">
                         <div className="info-row">
                           <Landmark size={12} className="info-icon" />
                           <span className="info-label">Bank:</span>
                           <span className="info-value">{staff?.bank_name || "N/A"}</span>
                         </div>
                         <div className="info-row">
                           <span className="info-label" style={{ marginLeft: '16px' }}>A/c:</span>
                           <span className="info-value">{staff?.bank_account_no || "N/A"}</span>
                         </div>
                         <div className="info-row">
                           <span className="info-label" style={{ marginLeft: '16px' }}>IFSC:</span>
                           <span className="info-value">{staff?.ifsc_code || "N/A"}</span>
                         </div>
                       </div>
                     </td>
                     <td><span className={`status-badge ${isActive ? 'status-active' : 'status-inactive'}`}>{staff.status}</span></td>
                     <td className="actions-cell">
                       <button className="action-btn edit-btn" style={{ color: '#059669' }} onClick={() => { setPortalModalStaff(staff); setIsPortalModalOpen(true); }} title="Configure Portal Access"><KeyRound size={16} /></button>
                       <button className="action-btn edit-btn" onClick={() => handleViewClick(staff)} title="View Details"><Eye size={16} /></button>
                       <button className="action-btn edit-btn" style={{ color: '#2563eb' }} onClick={() => handleEditClick(staff)} title="Edit Employee Details"><Pencil size={15} /></button>
                       <button className={`action-btn ${isActive ? 'delete-btn' : 'reactivate-btn'}`} onClick={() => handleToggleClick(staff)} title={isActive ? "Deactivate" : "Reactivate"}>
                         {isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                       </button>
                     </td>
                   </tr>
                 );
               })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION (20 items per page with Next / Previous & sizing) */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredStaff.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          itemLabel="employees"
        />
      </section>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingStaffId ? (isViewMode ? "View Staff Member" : "Edit Staff Member") : "Add New Staff Member"}</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitStaff}>
              <div className="modal-body">
                {errorMessage && <div className="modal-error-message">{errorMessage}</div>}

                {/* Auto-Generated Employee ID & Status Banner */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#475569" }}>
                      Employee ID:
                    </span>
                    <span
                      style={{
                        fontSize: "12.5px",
                        fontWeight: "700",
                        color: "#0369a1",
                        background: "#e0f2fe",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {editingStaffId
                        ? `EMP-${String(editingStaffId).padStart(4, "0")}`
                        : "Auto-Generated on Save"}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#475569" }}>
                      Status:
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#166534",
                        background: "#dcfce7",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      Active (Automatic)
                    </span>
                  </div>
                </div>

                {/* SECTION 1: PERSONAL INFORMATION */}
                <div className="form-section-title" style={{ marginTop: 0 }}>
                  1. Personal Information
                </div>

                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="full_name"
                    required
                    placeholder="Enter full name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Father / Guardian Name</label>
                  <input
                    type="text"
                    name="father_name"
                    placeholder="Father or Guardian's full name"
                    value={formData.father_name}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Emergency Contact Name</label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      placeholder="Emergency contact person"
                      value={formData.emergency_contact_name}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="form-group">
                    <label>Emergency Contact Phone</label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      placeholder="Emergency phone number"
                      value={formData.emergency_contact_phone}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Aadhaar Number</label>
                    <input
                      type="text"
                      name="aadhaar_no"
                      placeholder="12-digit Aadhaar number"
                      maxLength="14"
                      value={formData.aadhaar_no}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      name="pan_no"
                      placeholder="10-digit PAN (e.g. ABCDE1234F)"
                      maxLength="10"
                      style={{ textTransform: "uppercase" }}
                      value={formData.pan_no}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setFormData((prev) => ({ ...prev, pan_no: val }));
                      }}
                      disabled={isViewMode}
                    />
                  </div>
                </div>

                {/* SECTION 2: EMPLOYMENT */}
                <div className="form-section-title">2. Employment</div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Department *</label>
                    <select
                      name="department"
                      required
                      value={formData.department}
                      onChange={(e) => {
                        const newDept = e.target.value;
                        const available = getDesignationsFor(newDept, formData.role_level);
                        setFormData((prev) => ({
                          ...prev,
                          department: newDept,
                          designation: available[0] || "custom",
                          custom_designation: "",
                        }));
                      }}
                      disabled={isViewMode}
                    >
                      {DEPARTMENT_OPTIONS.map((dept) => (
                        <option key={dept.value} value={dept.value}>
                          {dept.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Role Level *</label>
                    <select
                      name="role_level"
                      required
                      value={formData.role_level}
                      onChange={(e) => {
                        const newLevel = e.target.value;
                        const available = getDesignationsFor(formData.department, newLevel);
                        setFormData((prev) => ({
                          ...prev,
                          role_level: newLevel,
                          designation: available[0] || "custom",
                          custom_designation: "",
                        }));
                      }}
                      disabled={isViewMode}
                    >
                      <option value="employee">Employee</option>
                      <option value="department_head">Department Head</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Designation *</label>
                    <select
                      name="designation"
                      required
                      value={formData.designation}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    >
                      {getDesignationsFor(formData.department, formData.role_level).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value="custom">Other / Custom Designation...</option>
                    </select>
                  </div>

                  {formData.designation === "custom" && (
                    <div className="form-group">
                      <label>Specify Custom Designation *</label>
                      <input
                        type="text"
                        name="custom_designation"
                        required
                        placeholder="Enter custom job title"
                        value={formData.custom_designation}
                        onChange={handleInputChange}
                        disabled={isViewMode}
                      />
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Employment Type *</label>
                    <select
                      name="employee_type"
                      required
                      value={formData.employee_type}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Date of Joining *</label>
                    <input
                      type="date"
                      name="joining_date"
                      required
                      value={formData.joining_date ? String(formData.joining_date).split("T")[0] : ""}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                    />
                  </div>

                  <div className="form-group">
                    <label>Daily Working Hours</label>
                    <input
                      type="number"
                      name="working_hours"
                      min="1"
                      max="24"
                      value={formData.working_hours ?? 8}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                      placeholder="8"
                    />
                  </div>
                </div>

                {/* SECTION 3: PORTAL ACCESS */}
                <div className="form-section-title">3. Portal Access</div>

                {!editingStaffId && !isViewMode && (
                  <>
                    <div style={{ marginBottom: "12px" }}>
                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          cursor: "pointer",
                          fontSize: "13px",
                          fontWeight: "600",
                        }}
                      >
                        <input
                          type="checkbox"
                          name="create_portal_access"
                          checked={formData.create_portal_access}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const autoUser = (formData.full_name || "emp")
                              .toLowerCase()
                              .replace(/[^a-z0-9]/g, "");
                            const randomPass = "Staff@" + Math.floor(1000 + Math.random() * 9000);
                            setFormData((prev) => ({
                              ...prev,
                              create_portal_access: checked,
                              portal_username: checked && !prev.portal_username ? autoUser : prev.portal_username,
                              portal_password: checked && !prev.portal_password ? randomPass : prev.portal_password,
                            }));
                          }}
                        />
                        Create Portal Login (Optional)
                      </label>
                      <p style={{ margin: "4px 0 0 24px", fontSize: "12px", color: "#64748b" }}>
                        If enabled, temporary login credentials will be generated and password change will be forced on first login.
                      </p>
                    </div>

                    {formData.create_portal_access && (
                      <div
                        className="form-row"
                        style={{
                          background: "#f8fafc",
                          padding: "14px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          marginBottom: "12px",
                        }}
                      >
                        <div className="form-group">
                          <label>Portal Username *</label>
                          <input
                            type="text"
                            name="portal_username"
                            required
                            placeholder="e.g. rahul.sharma"
                            value={formData.portal_username}
                            onChange={handleInputChange}
                          />
                        </div>
                        <div className="form-group">
                          <label>Temporary Password *</label>
                          <input
                            type="text"
                            name="portal_password"
                            required
                            placeholder="Min 6 characters"
                            value={formData.portal_password}
                            onChange={handleInputChange}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {editingStaffId && !isViewMode && (
                  <div
                    style={{
                      marginTop: "4px",
                      marginBottom: "14px",
                      padding: "12px 16px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: "#166534" }}>
                        Portal Login Credentials
                      </div>
                      <div style={{ fontSize: "12px", color: "#15803d" }}>
                        Auto-grants {formData.department === "housekeeping" ? "Housekeeping & Rooms" : formatDepartment(formData.department)} module access.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#059669",
                      }}
                      onClick={() => {
                        const matched = staffList.find((s) => s.id === editingStaffId);
                        if (matched) {
                          setPortalModalStaff(matched);
                          setIsPortalModalOpen(true);
                        }
                      }}
                    >
                      <KeyRound size={14} /> Provision / Manage Credentials
                    </button>
                  </div>
                )}

                {/* SECTION 4: BANK DETAILS */}
                <div className="form-section-title">4. Bank Details</div>

                <div className="form-group">
                  <label>Bank Name</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                    placeholder="e.g. State Bank of India"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      name="bank_account_no"
                      value={formData.bank_account_no}
                      onChange={handleInputChange}
                      disabled={isViewMode}
                      placeholder="Bank account number"
                    />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc_code"
                      value={formData.ifsc_code}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setFormData((prev) => ({ ...prev, ifsc_code: val }));
                      }}
                      disabled={isViewMode}
                      placeholder="e.g. SBIN0001234"
                      maxLength="11"
                    />
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>{isViewMode ? "Close" : "Cancel"}</button>
                {isViewMode ? (
                  <button type="button" className="btn-submit" onClick={() => setIsViewMode(false)}>
                    Edit Details
                  </button>
                ) : (
                  <button type="submit" className="btn-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Staff Member"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="confirm-modal-content">
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h2>{confirmModal.title}</h2>
              <button className="modal-close" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}><X size={20} /></button>
            </div>
            <div className="modal-body confirm-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
              <button className="btn-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>Cancel</button>
              <button className="btn-submit btn-danger" onClick={handleConfirmModalAction}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {/* EMPLOYEE PORTAL ACCESS MODAL */}
      <EmployeePortalAccessModal
        isOpen={isPortalModalOpen}
        onClose={() => {
          setIsPortalModalOpen(false);
          setPortalModalStaff(null);
        }}
        initialStaff={portalModalStaff}
        hotelId={user?.hotel_id}
        onSuccess={() => {
          fetchStaff();
        }}
      />
    </div>
  );
}