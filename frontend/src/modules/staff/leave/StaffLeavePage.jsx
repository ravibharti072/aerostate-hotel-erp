import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import api from "@api/api";
import { 
  ArrowLeft, Plus, Calendar, CheckCircle, XCircle, Clock, Trash2, X, Filter, Check, Ban, Users, Lock, Edit, Unlock
} from "lucide-react";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard"; 
import "./staffLeave.css";

export default function StaffLeavePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tabs State
  const [activeTab, setActiveTab] = useState("requests"); 

  // Filters for Requests Tab
  const [statusFilter, setStatusFilter] = useState("");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState("");
  const [staffSearch, setStaffSearch] = useState(""); 

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // --- PASSWORD UNLOCK STATE ---
  const [passwordInput, setPasswordInput] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false); 
  const [editingStaffId, setEditingStaffId] = useState(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Forms
  const [formData, setFormData] = useState({
    staff_id: "", leave_type: "casual", start_date: todayStr, end_date: todayStr,
    total_days: 1, reason: "", status: "pending", approved_by: "", remarks: "", hotel_id: user?.hotel_id || 1,
  });

  const [balanceFormData, setBalanceFormData] = useState({
    legacy_leave_balance: 0, leave_tracking_start_date: todayStr
  });

  const calculateDays = (start, end) => {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate - startDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const handleDateChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    const calculatedDays = calculateDays(
      field === "start_date" ? value : formData.start_date,
      field === "end_date" ? value : formData.end_date
    );
    updated.total_days = calculatedDays;
    setFormData(updated);
  };

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);

    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (leaveTypeFilter) params.leave_type = leaveTypeFilter;
      if (selectedStaffFilter) params.staff_id = selectedStaffFilter;

      const [staffRes, leaveRes, attRes] = await Promise.all([
        api.get("/staff"),
        api.get("/staff-leaves", { params }),
        api.get("/staff-attendance")
      ]);

      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setLeaves(Array.isArray(leaveRes.data) ? leaveRes.data : []);
      setAttendanceRecords(Array.isArray(attRes.data) ? attRes.data : []);

    } catch (error) {
      console.error("Error loading leave management data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, leaveTypeFilter, selectedStaffFilter, token]);

  const handleOpenModal = () => {
    setFormData({
      staff_id: "", leave_type: "casual", start_date: todayStr, end_date: todayStr, total_days: 1, reason: "",
      status: "pending", approved_by: user?.full_name || user?.username || "Admin", remarks: "", hotel_id: user?.hotel_id || 1,
    });
    setErrorMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setErrorMessage("");
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    if (!formData.staff_id || formData.total_days <= 0) {
      setErrorMessage("Please ensure all fields are correct.");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        hotel_id: parseInt(formData.hotel_id, 10), staff_id: parseInt(formData.staff_id, 10), leave_type: formData.leave_type,
        start_date: `${formData.start_date}T00:00:00`, end_date: `${formData.end_date}T23:59:59`, total_days: parseFloat(formData.total_days),
        reason: formData.reason || "Personal Leave", status: formData.status,
        approved_by: formData.status === "approved" ? formData.approved_by : null, remarks: formData.remarks || null,
      };

      await api.post("/staff-leaves", payload);
      closeModal();
      fetchData();
    } catch (err) {
      console.error("Error submitting leave request:", err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Failed to submit leave request.");
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (leave, newStatus) => {
    try {
      const payload = { status: newStatus, approved_by: newStatus === "approved" ? user?.full_name || user?.username || "Admin" : leave.approved_by };
      await api.put(`/staff-leaves/${leave.id}`, payload);
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update leave status.");
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm("Are you sure you want to delete this leave record?")) return;
    try {
      await api.delete(`/staff-leaves/${leaveId}`);
      fetchData();
    } catch (err) {
      console.error("Error deleting leave:", err);
      alert("Failed to delete record.");
    }
  };

  const isDateInLeaveRange = (dateStr, startDateStr, endDateStr) => {
    const target = new Date(dateStr).setHours(0, 0, 0, 0);
    const start = new Date(startDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    const end = new Date(endDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  };

  const calculateWeeklyOffBalance = (staff) => {
    const startDateString = staff.leave_tracking_start_date || staff.created_at;
    if (!startDateString) return parseFloat(staff.legacy_leave_balance) || 0;

    let currDate = new Date(startDateString);
    currDate.setDate(1); 
    
    const today = new Date();
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const [targetY, targetM] = currentMonthStr.split('-').map(Number);
    const targetDateLimit = new Date(targetY, targetM - 1, 1);

    let balance = parseFloat(staff.legacy_leave_balance) || 0;

    while (currDate <= targetDateLimit) {
      const y = currDate.getFullYear();
      const m = currDate.getMonth() + 1;
      const mStr = `${y}-${String(m).padStart(2, '0')}`;

      balance += 4;

      const daysInMonth = new Date(y, m, 0).getDate();

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${mStr}-${dayStr}`;

        const attRecord = attendanceRecords.find(r => r.staff_id === staff.id && r.attendance_date?.startsWith(dateStr));
        const matchingLeave = leaves.find(l => l.staff_id === staff.id && l.status === "approved" && isDateInLeaveRange(dateStr, l.start_date, l.end_date));

        const isFutureOrToday = dateStr >= todayStr;

        if (attRecord && (attRecord.status === 'off-day' || attRecord.status === 'on-leave')) {
          balance = Math.max(0, balance - 1);
        } else if (matchingLeave) {
          balance = Math.max(0, balance - 1);
        } else if (!attRecord && !matchingLeave && !isFutureOrToday) {
          if (balance > 0) {
            balance -= 1;
          }
        }
      }

      currDate.setMonth(currDate.getMonth() + 1);
    }

    return Math.max(0, balance);
  };

  const openBalanceModal = (staff) => {
    setEditingStaffId(staff.id);
    setBalanceFormData({
      legacy_leave_balance: staff.legacy_leave_balance || 0,
      leave_tracking_start_date: staff.leave_tracking_start_date ? staff.leave_tracking_start_date.split('T')[0] : todayStr
    });
    setPasswordInput(""); 
    
    const role = (user?.role || "").toLowerCase();
    if (role === 'admin' || role === 'manager' || role === 'superadmin') {
      setIsUnlocked(true);
    } else {
      setIsUnlocked(false);
    }
    
    setErrorMessage("");
    setIsBalanceModalOpen(true);
  };

  const handleUnlockClick = () => {
    const entered = passwordInput.trim();
    if (entered.length > 0) {
      setIsUnlocked(true);
      setErrorMessage("");
    } else {
      setErrorMessage("Please enter a valid password.");
    }
  };

  const submitBalanceUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.put(`/staff/${editingStaffId}`, {
        legacy_leave_balance: parseFloat(balanceFormData.legacy_leave_balance),
        leave_tracking_start_date: `${balanceFormData.leave_tracking_start_date}T00:00:00`
      });
      setIsBalanceModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error updating balances:", err);
      alert("Failed to update balances.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const getStaffName = (staffId) => {
    const staff = staffList.find((s) => s.id === staffId);
    return staff ? staff.full_name || `${staff.first_name || ""} ${staff.last_name || ""}`.trim() : "Unknown Staff";
  };
  const formatDateDisplay = (dateString) => dateString ? dateString.split("T")[0] : "-";

  const pendingCount = leaves.filter((l) => l.status === "pending").length;
  const approvedCount = leaves.filter((l) => l.status === "approved").length;
  const rejectedCount = leaves.filter((l) => l.status === "rejected").length;
  const totalDaysTaken = leaves.filter((l) => l.status === "approved").reduce((sum, l) => sum + (l.total_days || 0), 0);

  const filteredStaffForBalances = staffList.filter(s => 
    s.status === 'active' && (s.full_name || "").toLowerCase().includes(staffSearch.toLowerCase())
  );

  return (
    <div className="leave-page">
      <PortalHeader 
        title="Leave Management"
        kicker="HUMAN RESOURCES"
        description="Review leave applications, manage approvals, and audit historical balances."
        icon={Calendar}
        backPath="/staff"
        rightAction={
          activeTab === 'requests' && (
            <button className="leave-add-btn" onClick={handleOpenModal}>
              <Plus size={18} /> New Leave Request
            </button>
          )
        }
      />

      {/* --- MOVED STATS GRID BELOW THE HEADER --- */}
      <div className="leave-stats-grid">
        <StatCard
          title="Pending Requests"
          value={pendingCount}
          Icon={Clock}
          colorTheme="orange"
        />
        <StatCard
          title="Approved Requests"
          value={approvedCount}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Rejected / Cancelled"
          value={rejectedCount}
          Icon={XCircle}
          colorTheme="red"
        />
        <StatCard
          title="Total Approved Days"
          value={`${totalDaysTaken} Days`}
          Icon={Calendar}
          colorTheme="blue"
        />
      </div>
      {/* ----------------------------------------- */}

      <div className="leave-tabs">
        <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          Leave Applications
        </button>
        <button className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`} onClick={() => setActiveTab('balances')}>
          Staff Leave Balances
        </button>
      </div>

      {activeTab === 'requests' && (
        <>
          <div className="leave-toolbar">
            <div className="filter-group">
              <Filter size={16} className="filter-icon" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="leave-select">
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="filter-group">
              <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} className="leave-select">
                <option value="">All Leave Types</option>
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="paid">Paid Leave</option>
                <option value="unpaid">Unpaid Leave</option>
                <option value="emergency">Emergency Leave</option>
              </select>
            </div>
            <div className="filter-group">
              <select value={selectedStaffFilter} onChange={(e) => setSelectedStaffFilter(e.target.value)} className="leave-select">
                <option value="">All Staff Members</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name || "Unknown"} (EMP-{s.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="leave-table-container">
            <table className="leave-table">
              <thead>
                <tr><th>Employee Name</th><th>Leave Type</th><th>Duration</th><th>Total Days</th><th>Reason & Remarks</th><th>Status</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {isLoading ? (<tr><td colSpan="7" className="empty-state">Loading requests...</td></tr>) : 
                 leaves.length === 0 ? (<tr><td colSpan="7" className="empty-state">No leave requests found.</td></tr>) : 
                 leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>
                      <div className="employee-cell">
                        <strong>{getStaffName(leave.staff_id)}</strong>
                        <span className="emp-id">EMP-{leave.staff_id.toString().padStart(4, "0")}</span>
                      </div>
                    </td>
                    <td><span className={`leave-type-badge type-${leave.leave_type}`}>{leave.leave_type.replace("-", " ")}</span></td>
                    <td>
                      <div className="date-duration-cell">
                        <span>{formatDateDisplay(leave.start_date)}</span><span className="duration-divider">to</span><span>{formatDateDisplay(leave.end_date)}</span>
                      </div>
                    </td>
                    <td><strong>{leave.total_days} {leave.total_days === 1 ? "Day" : "Days"}</strong></td>
                    <td>
                      <div className="reason-cell">
                        <span className="reason-text">{leave.reason || "No reason specified"}</span>
                        {leave.approved_by && <small className="approved-by-tag">By: {leave.approved_by}</small>}
                      </div>
                    </td>
                    <td><span className={`status-badge status-${leave.status}`}>{leave.status}</span></td>
                    <td className="actions-cell">
                      {leave.status === "pending" ? (
                        <div className="action-buttons-group">
                          <button className="action-btn-pill approve" title="Approve" onClick={() => handleUpdateStatus(leave, "approved")}><Check size={14} /> Approve</button>
                          <button className="action-btn-pill reject" title="Reject" onClick={() => handleUpdateStatus(leave, "rejected")}><Ban size={14} /> Reject</button>
                        </div>
                      ) : (
                        <button className="action-btn delete-btn" title="Delete Record" onClick={() => handleDeleteLeave(leave.id)}><Trash2 size={16} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'balances' && (
        <>
          <div className="leave-toolbar">
            <div className="filter-group">
              <Users size={16} className="filter-icon" />
              <input 
                type="text" 
                placeholder="Search active staff..." 
                value={staffSearch} 
                onChange={(e) => setStaffSearch(e.target.value)} 
                className="leave-select"
                style={{ paddingLeft: '40px', minWidth: '250px' }}
              />
            </div>
          </div>

          <div className="leave-table-container">
            <table className="leave-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Opening Balance (Excel)</th>
                  <th>Tracking Started On</th>
                  <th>Current Live Balance</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (<tr><td colSpan="5" className="empty-state">Loading staff balances...</td></tr>) : 
                 filteredStaffForBalances.length === 0 ? (<tr><td colSpan="5" className="empty-state">No active staff found.</td></tr>) : 
                 filteredStaffForBalances.map((staff) => {
                  const currentBalance = calculateWeeklyOffBalance(staff);
                  return (
                    <tr key={staff.id}>
                      <td>
                        <div className="employee-cell">
                          <strong>{staff.full_name || "Unknown"}</strong>
                          <span className="emp-id">EMP-{staff.id.toString().padStart(4, "0")} • {staff.designation}</span>
                        </div>
                      </td>
                      <td><strong>{staff.legacy_leave_balance || 0} Offs</strong></td>
                      <td><span className="date-duration-cell">{formatDateDisplay(staff.leave_tracking_start_date || staff.created_at)}</span></td>
                      <td>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: currentBalance < 0 ? '#ef4444' : '#16a34a', padding: '4px 10px', backgroundColor: currentBalance < 0 ? '#fef2f2' : '#f0fdf4', borderRadius: '6px' }}>
                          {currentBalance} Weekly Offs
                        </span>
                      </td>
                      <td className="actions-cell">
                        <button className="action-btn edit-btn" onClick={() => openBalanceModal(staff)}>
                          <Edit size={16} /> Edit Settings
                        </button>
                      </td>
                    </tr>
                  )
                 })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* NEW LEAVE REQUEST MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>New Leave Application</h2>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmitLeave}>
              <div className="modal-body">
                {errorMessage && <div className="modal-error-message">{errorMessage}</div>}
                <div className="form-group">
                  <label>Select Employee</label>
                  <select required value={formData.staff_id} onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}>
                    <option value="">-- Choose Employee --</option>
                    {staffList.filter(s=>s.status==='active').map((staff) => (
                      <option key={staff.id} value={staff.id}>{staff.full_name} (EMP-{staff.id})</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Leave Type</label>
                    <select value={formData.leave_type} onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}>
                      <option value="casual">Casual Leave</option><option value="sick">Sick Leave</option>
                      <option value="paid">Paid Leave</option><option value="unpaid">Unpaid Leave</option>
                      <option value="emergency">Emergency Leave</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Application Status</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                      <option value="pending">Pending Approval</option><option value="approved">Approved</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date</label>
                    <input type="date" required value={formData.start_date} onChange={(e) => handleDateChange("start_date", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="date" required value={formData.end_date} onChange={(e) => handleDateChange("end_date", e.target.value)} />
                  </div>
                </div>
                <div className="form-group duration-preview-box">
                  <span>Calculated Duration:</span><strong>{formData.total_days} {formData.total_days === 1 ? "Day" : "Days"}</strong>
                </div>
                <div className="form-group">
                  <label>Reason for Leave</label>
                  <textarea rows="3" required placeholder="Enter reason..." value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Approver / Remarks (Optional)</label>
                  <input type="text" placeholder="e.g. Approved by HR" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "Submit Application"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BALANCE SETTINGS MODAL */}
      {isBalanceModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Legacy Leave Settings</h2>
              <button className="modal-close" type="button" onClick={() => setIsBalanceModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={submitBalanceUpdate}>
              <div className="modal-body">
                {errorMessage && (
                  <div className="modal-error-message" style={{ padding: '8px 12px', marginBottom: '8px' }}>
                    {errorMessage}
                  </div>
                )}
                
                {!isUnlocked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '16px', borderRadius: '50%' }}>
                      <Lock size={32} color="#64748b" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>Password Confirmation Required</h3>
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Enter your login password to edit historical balances.</p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input 
                        type="password" 
                        autoComplete="current-password"
                        placeholder="Enter password..." 
                        value={passwordInput} 
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleUnlockClick();
                          }
                        }}
                        style={{ padding: '10px 14px', fontSize: '14px', border: '1px solid #cbd5e1', borderRadius: '8px', width: '200px', outline: 'none' }}
                      />
                      <button 
                        type="button" 
                        onClick={handleUnlockClick}
                        style={{ backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Unlock size={14} /> Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: '700', marginBottom: '4px' }}>
                      <Unlock size={18} /> Verified & Unlocked
                    </div>
                    
                    <div className="form-group">
                      <label style={{ color: '#166534' }}>Opening Balance (Supports .5 points e.g. 1.5, 2.5)</label>
                      <input 
                        type="number" 
                        step="0.5" 
                        required 
                        placeholder="e.g. 1.5, 2, 2.5, 4"
                        value={balanceFormData.legacy_leave_balance} 
                        onChange={(e) => setBalanceFormData({...balanceFormData, legacy_leave_balance: e.target.value})} 
                        style={{ borderColor: '#bbf7d0', padding: '12px', fontSize: '15px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ color: '#166534' }}>ERP Tracking Start Date</label>
                      <input 
                        type="date" 
                        required 
                        value={balanceFormData.leave_tracking_start_date} 
                        onChange={(e) => setBalanceFormData({...balanceFormData, leave_tracking_start_date: e.target.value})} 
                        style={{ borderColor: '#bbf7d0', padding: '12px' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsBalanceModalOpen(false)}>Close</button>
                {isUnlocked && (
                  <button type="submit" className="btn-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Update Balance"}
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}