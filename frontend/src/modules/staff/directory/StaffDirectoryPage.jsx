import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext"; 
import { Search, Plus, Phone, Briefcase, X, Users, CreditCard, Landmark, UserX, UserCheck, Download, Clock, Eye } from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import "./staffDirectory.css";

export default function StaffDirectoryPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth(); 

  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); 

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", data: null });

  const initialFormState = {
    full_name: "", phone: "", department: "front_desk", designation: "", status: "active",
    hotel_id: user?.hotel_id || 1, aadhaar_no: "", pan_no: "", dob: "", father_name: "", employee_type: "permanent",
    working_hours: 8, bank_account_no: "", bank_name: "", ifsc_code: ""
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchStaff = async () => {
    if (!token) return; 
    setIsLoading(true);
    try {
      let url = "http://localhost:8000/staff";
      if (departmentFilter) url += `?department=${departmentFilter}`;
      const response = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setStaffList(Array.isArray(data) ? data : []);
      }
    } catch (error) { console.error("Error:", error); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [departmentFilter, token]); 

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setFormData(initialFormState);
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

  const handleViewClick = (staff) => {
    setFormData({
      full_name: staff.full_name || "", phone: staff.phone || "", department: staff.department || "front_desk",
      designation: staff.designation || "", status: staff.status || "active", hotel_id: staff.hotel_id || user?.hotel_id || 1,
      aadhaar_no: staff.aadhaar_no || "", pan_no: staff.pan_no || "", dob: staff.dob || "", father_name: staff.father_name || "",
      employee_type: staff.employee_type || "permanent", 
      working_hours: staff.working_hours || 8,
      bank_account_no: staff.bank_account_no || "",
      bank_name: staff.bank_name || "", ifsc_code: staff.ifsc_code || ""
    });
    setEditingStaffId(staff.id);
    setErrorMessage("");
    setIsViewMode(true); 
    setIsModalOpen(true);
  };

  const handleToggleClick = (staff) => {
    const isCurrentlyActive = staff.status === 'active';
    setConfirmModal({
      isOpen: true, title: isCurrentlyActive ? "Deactivate Employee" : "Reactivate Employee",
      message: isCurrentlyActive ? "Flag this employee as INACTIVE?" : "REACTIVATE this employee?",
      data: { staffId: staff.id, newStatus: isCurrentlyActive ? 'inactive' : 'active' }
    });
  };

  const executeStatusToggle = async () => {
    if (!confirmModal.data) return;
    try {
      const response = await fetch(`http://localhost:8000/staff/${confirmModal.data.staffId}`, {
        method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ status: confirmModal.data.newStatus })
      });
      if (response.ok) { fetchStaff(); setConfirmModal({ isOpen: false, title: "", message: "", data: null }); } 
      else { alert("Failed to update."); }
    } catch (error) { console.error("Error:", error); }
  };

  const handleSubmitStaff = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(""); 

    try {
      const payload = { 
        ...formData, 
        hotel_id: parseInt(formData.hotel_id, 10), 
        working_hours: parseInt(formData.working_hours, 10) || 8,
        full_name: formData.full_name.trim() 
      };
      
      const url = editingStaffId ? `http://localhost:8000/staff/${editingStaffId}` : "http://localhost:8000/staff";
      const method = editingStaffId ? "PUT" : "POST";

      const response = await fetch(url, {
        method: method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) { closeModal(); fetchStaff(); } 
      else {
        const errorData = await response.json();
        setErrorMessage(typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail));
      }
    } catch (error) { setErrorMessage("Network error occurred."); } finally { setIsSubmitting(false); }
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
      `"${s.department || ''}"`,
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
    
    return matchesSearch && matchesType;
  });

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

          <div className="dir-search-box">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Search by name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <select className="dir-filter-select" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">All Departments</option>
            <option value="front_desk">Front Desk</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="restaurant">Restaurant</option>
            <option value="management">Management</option>
            <option value="maintenance">Maintenance</option>
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
               filteredStaff.map((staff) => {
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
                         <strong>{staff?.designation || "No Role"}</strong>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                           <span className="department-badge" style={{ margin: 0 }}>
                             <Briefcase size={12} />
                             {staff?.department ? staff.department.replace('_', ' ') : "None"}
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
                       <button className="action-btn edit-btn" onClick={() => handleViewClick(staff)} title="View Details"><Eye size={16} /></button>
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
                
                <div className="form-section-title" style={{marginTop:0}}>Personal Details</div>
                <div className="form-group"><label>Full Name</label><input type="text" name="full_name" required value={formData.full_name} onChange={handleInputChange} disabled={isViewMode} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Phone Number</label><input type="text" name="phone" required value={formData.phone} onChange={handleInputChange} disabled={isViewMode} /></div>
                  <div className="form-group"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleInputChange} disabled={isViewMode} /></div>
                </div>

                <div className="form-group"><label>Father's Name</label><input type="text" name="father_name" value={formData.father_name} onChange={handleInputChange} disabled={isViewMode} /></div>

                <div className="form-row">
                  <div className="form-group"><label>Aadhaar Card No</label><input type="text" name="aadhaar_no" value={formData.aadhaar_no} onChange={handleInputChange} disabled={isViewMode} /></div>
                  <div className="form-group"><label>PAN Card No</label><input type="text" name="pan_no" value={formData.pan_no} onChange={handleInputChange} disabled={isViewMode} /></div>
                </div>

                <div className="form-section-title">Company Details</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={formData.department} onChange={handleInputChange} disabled={isViewMode}>
                      <option value="front_desk">Front Desk</option>
                      <option value="housekeeping">Housekeeping</option>
                      <option value="restaurant">Restaurant</option>
                      <option value="management">Management</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Designation / Role</label><input type="text" name="designation" required value={formData.designation} onChange={handleInputChange} disabled={isViewMode} /></div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Employment Type</label>
                    <select name="employee_type" value={formData.employee_type} onChange={handleInputChange} disabled={isViewMode}>
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Daily Hours</label>
                    <input type="number" name="working_hours" required min="1" max="24" value={formData.working_hours} onChange={handleInputChange} disabled={isViewMode} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} disabled={isViewMode}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="form-section-title">Bank Details</div>
                <div className="form-group"><label>Bank Name</label><input type="text" name="bank_name" value={formData.bank_name} onChange={handleInputChange} disabled={isViewMode} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Account Number</label><input type="text" name="bank_account_no" value={formData.bank_account_no} onChange={handleInputChange} disabled={isViewMode} /></div>
                  <div className="form-group"><label>IFSC Code</label><input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleInputChange} disabled={isViewMode} /></div>
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
              <button className="btn-submit btn-danger" onClick={executeStatusToggle}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}