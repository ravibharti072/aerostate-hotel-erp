import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import api from "@api/api";
import { 
  Banknote, 
  Search, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  X, 
  Users, 
  TrendingDown, 
  Wallet,
  Info,
  Calendar,
  Clock,
  Lock
} from "lucide-react";
import PortalHeader from "../../../components/headers/PortalHeader";
import StatCard from "../../../components/cards/StatCard"; 
import { DEPARTMENT_OPTIONS, formatDepartment } from "../directory/StaffDirectoryPage";
import "./staffPayroll.css";

export default function StaffPayrollPage() {
  const { token, user, goLiveDate } = useAuth();
  
  const [staffList, setStaffList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [payrollRecordsObj, setPayrollRecordsObj] = useState({});
  const [salaryStructures, setSalaryStructures] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Custom Toast Notification State
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Month Selection & Go-Live Hooks
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const goLiveMonth = goLiveDate ? goLiveDate.slice(0, 7) : null;
  const defaultInitialMonth = goLiveMonth && currentMonthStr < goLiveMonth ? goLiveMonth : currentMonthStr;

  const [selectedMonth, setSelectedMonth] = useState(defaultInitialMonth);

  // Tabs & Filters
  const [activeTypeTab, setActiveTypeTab] = useState("permanent"); 
  const [statusTab, setStatusTab] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  // Modal State
  const [viewModalData, setViewModalData] = useState(null);
  const [adjustMode, setAdjustMode] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ amount: "", reason: "", type: "deduction" });
  
  const [confirmFinalizeStaffId, setConfirmFinalizeStaffId] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3500);
  };

  // --- FETCH ALL DATA FROM BACKEND ---
  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [staffRes, attRes, leaveRes, structRes, payrollRes] = await Promise.all([
        api.get("/staff"),
        api.get("/staff-attendance"),
        api.get("/staff-leaves"),
        api.get("/staff-salaries"),
        api.get(`/staff-payroll?month=${selectedMonth}`)
      ]);

      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setAttendanceRecords(Array.isArray(attRes.data) ? attRes.data : []);
      setLeaveRecords(Array.isArray(leaveRes.data) ? leaveRes.data : []);
      setSalaryStructures(structRes.data || {});

      const payrollData = payrollRes.data;
      const mappedRecords = {};
      if (Array.isArray(payrollData)) {
        payrollData.forEach((r) => { mappedRecords[r.staff_id] = r; });
      } else if (payrollData && typeof payrollData === "object") {
        Object.assign(mappedRecords, payrollData);
      }
      setPayrollRecordsObj(mappedRecords);
      
    } catch (error) {
      console.error("Error fetching data from backend:", error);
      showToast("Failed to connect to backend server.", "info");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    const isLocked = goLiveMonth && selectedMonth < goLiveMonth;
    if (!isLocked) {
      fetchData(); 
    }
  }, [token, selectedMonth, goLiveMonth]);

  const handleProcessPayroll = async () => {
    try {
      await api.post("/staff-payroll/process", { month: selectedMonth });
      showToast(`Payroll successfully processed for ${selectedMonth} by backend.`, "success");
      fetchData(); 
    } catch (error) {
      console.error("Error calling backend process payroll:", error);
      const detail = error.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Backend failed to process payroll.");
      showToast(msg, "info");
    }
  };

  const executeFinalizePayroll = async () => {
    if (!confirmFinalizeStaffId) return;
    const record = payrollRecordsObj[confirmFinalizeStaffId];
    if (!record) return;

    try {
      await api.put(`/staff-payroll/${record.id || confirmFinalizeStaffId}`, {
        status: 'Finalized',
        month: selectedMonth,
        staff_id: confirmFinalizeStaffId
      });
      showToast("Payroll finalized and locked permanently by backend.", "success");
      setConfirmFinalizeStaffId(null);
      fetchData();
      setViewModalData(null);
    } catch (error) {
      console.error("Error finalizing payroll:", error);
      showToast("Failed to finalize on backend.", "info");
    }
  };

  const updateRecordStatus = async (staffId, newStatus) => {
    const record = payrollRecordsObj[staffId];
    if (!record) return;

    try {
      await api.put(`/staff-payroll/${record.id || staffId}`, {
        status: newStatus,
        month: selectedMonth,
        staff_id: staffId
      });
      showToast(`Payroll status updated to ${newStatus}.`, "success");
      fetchData();
      setViewModalData(null);
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update status on backend.", "info");
    }
  };

  const handleAddAdjustment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(adjustForm.amount);
    if (!amount || !adjustForm.reason) return;

    const record = viewModalData.record;

    try {
      await api.post(`/staff-payroll/${record.id || viewModalData.staff.id}/adjustments`, {
        type: adjustForm.type,
        amount: amount,
        reason: adjustForm.reason,
        month: selectedMonth
      });
      showToast("Adjustment saved to backend database.", "success");
      setAdjustMode(false);
      setAdjustForm({ amount: "", reason: "", type: "deduction" });
      fetchData();
      setViewModalData(null);
    } catch (error) {
      console.error("Error saving adjustment:", error);
      showToast("Failed to save adjustment.", "info");
    }
  };

  const getDaysInMonth = (yearMonth) => {
    const [year, month] = yearMonth.split('-');
    return new Date(year, month, 0).getDate();
  };

  const isDateInLeaveRange = (dateStr, startDateStr, endDateStr) => {
    const target = new Date(dateStr).setHours(0, 0, 0, 0);
    const start = new Date(startDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    const end = new Date(endDateStr.split("T")[0]).setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  };

  // --- ATTENDANCE STATS SIMULATION FOR MODAL PREVIEW ---
  const simulateStaffUpToMonth = (staff, targetMonthStr) => {
    if (!staff || !targetMonthStr) return { monthStatuses: [] };

    const startDateString = staff.leave_tracking_start_date || staff.created_at || targetMonthStr + "-01";
    let currDate = new Date(startDateString);
    currDate.setDate(1); 

    const [targetY, targetM] = targetMonthStr.split('-').map(Number);
    const targetDateLimit = new Date(targetY, targetM - 1, 1);

    let balance = parseFloat(staff.legacy_leave_balance) || 0;
    let targetMonthDaysStatuses = [];
    const todayDateStr = new Date().toISOString().split("T")[0];

    while (currDate <= targetDateLimit) {
      const y = currDate.getFullYear();
      const m = currDate.getMonth() + 1;
      const mStr = `${y}-${String(m).padStart(2, '0')}`;

      balance += 4;

      const daysInMonth = new Date(y, m, 0).getDate();
      let monthStatuses = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, '0');
        const dateStr = `${mStr}-${dayStr}`;

        const attRecord = attendanceRecords.find(r => r.staff_id === staff.id && r.attendance_date?.startsWith(dateStr));
        const matchingLeave = leaveRecords.find(l => l.staff_id === staff.id && l.status === "approved" && isDateInLeaveRange(dateStr, l.start_date, l.end_date));

        let status = null;
        if (attRecord) status = attRecord.status;
        else if (matchingLeave) status = 'on-leave';

        const isFutureOrToday = dateStr >= todayDateStr;

        if (status === 'present') {
          monthStatuses.push({ date: dateStr, status: 'present' });
        } else if (status === 'half-day') {
          monthStatuses.push({ date: dateStr, status: 'half-day' });
        } else if (status === 'on-leave') {
          balance = Math.max(0, balance - 1);
          monthStatuses.push({ date: dateStr, status: 'on-leave' });
        } else if (status === 'off-day') {
          balance = Math.max(0, balance - 1);
          monthStatuses.push({ date: dateStr, status: 'off-day' });
        } else {
          if (!isFutureOrToday) {
            if (balance > 0) {
              balance = Math.max(0, balance - 1);
              monthStatuses.push({ date: dateStr, status: 'off-day' }); 
            } else {
              monthStatuses.push({ date: dateStr, status: 'absent' }); 
            }
          } else {
            monthStatuses.push({ date: dateStr, status: '-' }); 
          }
        }
      }

      if (mStr === targetMonthStr) {
        targetMonthDaysStatuses = monthStatuses;
      }

      currDate.setMonth(currDate.getMonth() + 1);
    }

    return { monthStatuses: targetMonthDaysStatuses };
  };

  const getModalAttendanceStats = (staffId, grossVal) => {
    const staff = staffList.find(s => s.id === staffId);
    const daysInMonth = getDaysInMonth(selectedMonth);
    const perDay = Math.round((grossVal || 0) / daysInMonth);

    if (!staff) return { daysInMonth, perDay, presentDays: 0, totalLeaves: 0, excessLeaves: 0 };

    const { monthStatuses } = simulateStaffUpToMonth(staff, selectedMonth);

    let presentDays = 0;
    let totalLeaves = 0;
    let absentDays = 0;

    monthStatuses.forEach(st => {
      if (st.status === 'present') presentDays++;
      else if (st.status === 'half-day') presentDays += 0.5;
      else if (st.status === 'on-leave' || st.status === 'off-day') totalLeaves++;
      else if (st.status === 'absent') absentDays++;
    });

    return { daysInMonth, perDay, presentDays, totalLeaves, excessLeaves: absentDays };
  };

  // --- FILTERING & AGGREGATIONS (Directly using backend calculations) ---
  const currentMonthRecordsArray = Object.values(payrollRecordsObj);
  
  const stats = {
    total: currentMonthRecordsArray.length,
    gross: currentMonthRecordsArray.reduce((sum, r) => sum + (r.gross || 0), 0),
    deductions: currentMonthRecordsArray.reduce((sum, r) => sum + (r.deductions || 0), 0),
    net: currentMonthRecordsArray.reduce((sum, r) => sum + (r.net || 0), 0),
  };

  let allDataMapped = currentMonthRecordsArray.map(rec => {
    return { record: rec, staff: staffList.find(s => s.id === rec.staff_id) || {} };
  });

  const permanentData = allDataMapped.filter(d => d.staff.employee_type !== 'contract');
  const contractData = allDataMapped.filter(d => d.staff.employee_type === 'contract');

  let displayData = activeTypeTab === 'permanent' ? permanentData : contractData;

  if (statusTab !== "All") displayData = displayData.filter(d => d.record.status === statusTab);
  if (deptFilter) displayData = displayData.filter(d => d.staff.department === deptFilter);
  if (searchTerm) displayData = displayData.filter(d => 
    d.staff.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.staff.id?.toString().includes(searchTerm)
  );

  const getStatusBadgeClass = (status) => {
    switch(status) {
      case 'Finalized': return 'badge-finalized';
      case 'Paid': return 'badge-paid';
      case 'Review': return 'badge-review';
      case 'Draft': return 'badge-draft';
      case 'Cancelled': return 'badge-cancelled';
      default: return '';
    }
  };

  const isPayrollLocked = goLiveMonth && selectedMonth < goLiveMonth;

  return (
    <div className="payroll-page">
      {toast.show && (
        <div className={`payroll-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <PortalHeader 
        title="Payroll Processing"
        kicker="FINANCE & HR"
        description="Calculate, review, finalize, and manage monthly employee payroll via backend sync."
        icon={Banknote}
        backPath="/staff"
        rightAction={
          <div className="payroll-header-actions">
            <input 
              type="month" 
              className="payroll-month-picker"
              value={selectedMonth} 
              min={goLiveMonth || ""}
              onChange={(e) => setSelectedMonth(e.target.value)} 
            />
            <button 
              className="btn-process-payroll" 
              onClick={handleProcessPayroll}
              disabled={isPayrollLocked}
            >
              Process Payroll
            </button>
          </div>
        }
      />

      {isPayrollLocked ? (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '48px', textAlign: 'center', margin: '24px 0' }}>
          <Lock size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Restricted Period (Pre-Go-Live)</h2>
          <p style={{ color: '#7f1d1d', maxWidth: '500px', margin: '0 auto' }}>
            Digital payroll processing for this property officially begins on <strong>{goLiveDate}</strong>. You cannot view or process payroll records prior to this date.
          </p>
        </div>
      ) : (
        <>
          <div className="payroll-stats-grid">
            <StatCard title="Total Employees" value={stats.total} Icon={Users} colorTheme="blue" />
            <StatCard title="Gross Payroll" value={`₹${stats.gross.toLocaleString()}`} Icon={Banknote} colorTheme="purple" />
            <StatCard title="Total Deductions" value={`₹${stats.deductions.toLocaleString()}`} Icon={TrendingDown} colorTheme="red" />
            <StatCard title="Net Payroll" value={`₹${stats.net.toLocaleString()}`} Icon={Wallet} colorTheme="green" />
          </div>

          <div className="payroll-type-tabs">
            <button 
              className={`type-tab-btn ${activeTypeTab === 'permanent' ? 'active' : ''}`} 
              onClick={() => { setActiveTypeTab('permanent'); setStatusTab('All'); }}
            >
              Permanent Employees ({permanentData.length})
            </button>
            <button 
              className={`type-tab-btn ${activeTypeTab === 'contract' ? 'active' : ''}`} 
              onClick={() => { setActiveTypeTab('contract'); setStatusTab('All'); }}
            >
              Contractual / Labor ({contractData.length})
            </button>
          </div>

          <div className="payroll-status-tabs">
            <button className={statusTab === 'All' ? 'active' : ''} onClick={() => setStatusTab('All')}>All</button>
            <button className={statusTab === 'Draft' ? 'active' : ''} onClick={() => setStatusTab('Draft')}>Draft</button>
            <button className={statusTab === 'Review' ? 'active' : ''} onClick={() => setStatusTab('Review')}>Review</button>
            <button className={statusTab === 'Finalized' ? 'active' : ''} onClick={() => setStatusTab('Finalized')}>Finalized</button>
            <button className={statusTab === 'Paid' ? 'active' : ''} onClick={() => setStatusTab('Paid')}>Paid</button>
            <button className={statusTab === 'Cancelled' ? 'active' : ''} onClick={() => setStatusTab('Cancelled')}>Cancelled</button>
          </div>

          <div className="payroll-table-filters">
            <div className="payroll-search-box">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search employee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="payroll-filter-select">
              <option value="">All Departments</option>
              {DEPARTMENT_OPTIONS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          <div className="payroll-table-container">
            <table className="payroll-table detailed-table">
              <thead>
                {activeTypeTab === 'permanent' ? (
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Basic</th>
                    <th>Allowances</th>
                    <th>Gross Salary</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Contract Employee</th>
                    <th>Role</th>
                    <th>Payable Salary</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="9" className="empty-state">Loading payroll data from server...</td></tr>
                ) : displayData.length === 0 ? (
                  <tr><td colSpan="9" className="empty-state">No payroll records found for {selectedMonth}. Click "Process Payroll" to calculate.</td></tr>
                ) : (
                  displayData.map(({staff, record}) => (
                    <tr key={record.id || staff.id}>
                      <td>
                        <div className="emp-info-cell">
                          <strong>{staff.full_name || "Unknown"}</strong>
                          <span className="emp-id-text">EMP-{staff.id?.toString().padStart(4, '0')}</span>
                        </div>
                      </td>
                      <td>
                        <span className="dept-pill-badge">{formatDepartment(staff.department)}</span>
                      </td>
                      
                      {activeTypeTab === 'permanent' ? (
                        <>
                          <td className="currency-val">₹{record.basic?.toLocaleString()}</td>
                          <td className="currency-val">₹{record.allowances?.toLocaleString()}</td>
                          <td className="currency-val" style={{fontWeight: 600}}>₹{record.gross?.toLocaleString()}</td>
                          <td className="currency-val" style={{color: '#ef4444'}}>- ₹{record.deductions?.toLocaleString()}</td>
                          <td className="currency-val"><span className="net-payable-badge">₹{record.net?.toLocaleString()}</span></td>
                        </>
                      ) : (
                        <td className="currency-val"><span className="net-payable-badge">₹{record.net?.toLocaleString()}</span></td>
                      )}

                      <td>
                        <span className={`payroll-status-pill ${getStatusBadgeClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="payroll-btn-view" onClick={() => setViewModalData({staff, record})}>
                          <FileText size={14} style={{marginRight: '4px'}}/> View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PAYROLL DETAIL MODAL */}
      {viewModalData && (() => {
        const attStats = getModalAttendanceStats(viewModalData.staff.id, viewModalData.record.gross);
        const breakdown = viewModalData.record.breakdown || {};
        const totalDeductions = viewModalData.record.deductions || 0;
        const netPayable = viewModalData.record.net || 0;

        return (
          <div className="modal-overlay">
            <div className="modal-content payroll-detail-modal">
              <div className="modal-header">
                <h2>Payroll Details & Attendance Preview</h2>
                <button className="modal-close" onClick={() => { setViewModalData(null); setAdjustMode(false); }}><X size={20} /></button>
              </div>
              
              <div className="modal-body">
                <div className="payroll-info-strip">
                  <div className="emp-details-left">
                    <h3>{viewModalData.staff.full_name}</h3>
                    <p>EMP-{viewModalData.staff.id.toString().padStart(4, '0')} • {viewModalData.staff.designation}</p>
                    <p style={{textTransform: 'capitalize'}}>{viewModalData.staff.department?.replace('_', ' ')} • {viewModalData.staff.employee_type || 'Permanent'}</p>
                  </div>
                  <div className="payroll-period-box">
                    <span className="lbl">Payroll Month</span>
                    <strong>{selectedMonth}</strong>
                    <span className={`payroll-status-pill ${getStatusBadgeClass(viewModalData.record.status)}`}>
                      {viewModalData.record.status}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginTop: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Attendance & Per-Day Rate Calculation</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px', color: '#475569' }}>
                    <div>Month Days: <strong style={{color:'#0f172a'}}>{attStats.daysInMonth} Days</strong></div>
                    <div>Per-Day Rate: <strong style={{color:'#0f172a'}}>₹{attStats.perDay} / day</strong></div>
                    <div>Paid Offs Allowed: <strong style={{color:'#16a34a'}}>4 Leaves</strong></div>
                    <div>Total Days Present: <strong style={{color:'#0f172a'}}>{attStats.presentDays} Days</strong></div>
                    <div>Total Leaves Taken: <strong style={{color:'#d97706'}}>{attStats.totalLeaves} Days</strong></div>
                    <div>Excess LOP Days: <strong style={{color: attStats.excessLeaves > 0 ? '#ef4444' : '#16a34a'}}>{attStats.excessLeaves} Days</strong></div>
                  </div>
                </div>

                <div className="payroll-breakdown-grid">
                  <div className="payroll-breakdown-section">
                    <h4 className="payroll-section-title">Earnings Breakdown</h4>
                    <div className="payroll-breakdown-row"><span>Basic Salary</span><span>₹{breakdown.basic?.toLocaleString() || viewModalData.record.basic?.toLocaleString()}</span></div>
                    {viewModalData.staff.employee_type !== 'contract' && (
                      <>
                        <div className="payroll-breakdown-row"><span>HRA</span><span>₹{breakdown.hra?.toLocaleString() || 0}</span></div>
                        <div className="payroll-breakdown-row"><span>Special Allowance</span><span>₹{breakdown.special_allowance?.toLocaleString() || 0}</span></div>
                        <div className="payroll-breakdown-row"><span>Other Allowance</span><span>₹{breakdown.other_allowance?.toLocaleString() || 0}</span></div>
                      </>
                    )}
                    <div className="payroll-breakdown-row payroll-total-row"><span>Gross Salary</span><span>₹{viewModalData.record.gross?.toLocaleString()}</span></div>
                  </div>

                  <div className="payroll-breakdown-section">
                    <h4 className="payroll-section-title">Deductions Breakdown</h4>
                    {viewModalData.staff.employee_type !== 'contract' && (
                      <>
                        <div className="payroll-breakdown-row"><span>EPF</span><span>₹{breakdown.epf?.toLocaleString() || 0}</span></div>
                        <div className="payroll-breakdown-row"><span>ESI</span><span>₹{breakdown.esi?.toLocaleString() || 0}</span></div>
                      </>
                    )}
                    {viewModalData.record.adjustments?.map((adj, i) => (
                       <div className="payroll-breakdown-row" key={i}>
                         <span style={{color:'#dc2626'}}>{adj.reason}</span>
                         <span style={{color:'#dc2626'}}>₹{adj.amount?.toLocaleString()}</span>
                       </div>
                    ))}
                    <div className="payroll-breakdown-row payroll-total-row" style={{color: '#dc2626'}}><span>Total Deductions</span><span>₹{totalDeductions.toLocaleString()}</span></div>
                  </div>
                </div>

                <div className="payroll-final-calc">
                  <div className="payroll-calc-row"><span>Gross Salary</span><span>₹{viewModalData.record.gross?.toLocaleString()}</span></div>
                  <div className="payroll-calc-row"><span>Total Deductions</span><span>− ₹{totalDeductions.toLocaleString()}</span></div>
                  <div className="payroll-calc-row payroll-net-row"><span>Net Payable Amount</span><span>₹{netPayable.toLocaleString()}</span></div>
                </div>

                {adjustMode && (
                  <div className="payroll-adj-box">
                    <h4>Manual Adjustment</h4>
                    <form onSubmit={handleAddAdjustment} className="payroll-adj-form">
                      <select value={adjustForm.type} onChange={e => setAdjustForm({...adjustForm, type: e.target.value})}>
                        <option value="deduction">Add Deduction</option>
                        <option value="allowance">Add Allowance</option>
                      </select>
                      <input type="number" placeholder="Amount" required value={adjustForm.amount} onChange={e => setAdjustForm({...adjustForm, amount: e.target.value})} />
                      <input type="text" placeholder="Reason (e.g. LOP)" required value={adjustForm.reason} onChange={e => setAdjustForm({...adjustForm, reason: e.target.value})} />
                      <button type="submit" className="btn-save-adj">Save</button>
                      <button type="button" className="btn-cancel-adj" onClick={() => setAdjustMode(false)}>Cancel</button>
                    </form>
                  </div>
                )}
              </div>

              <div className="modal-footer payroll-action-footer">
                 {(viewModalData.record.status === 'Draft' || viewModalData.record.status === 'Review') && (
                   <>
                     {!adjustMode && <button className="btn-outline" onClick={() => setAdjustMode(true)}>Add Adjustment</button>}
                     <button className="btn-primary" onClick={() => setConfirmFinalizeStaffId(viewModalData.staff.id)}>Finalize Payroll</button>
                   </>
                 )}
                 {viewModalData.record.status === 'Finalized' && (
                   <button className="btn-success" onClick={() => updateRecordStatus(viewModalData.staff.id, 'Paid')}><CheckCircle2 size={16} style={{marginRight: '6px'}}/> Mark as Paid</button>
                 )}
              </div>
            </div>
          </div>
        );
      })()}

      {confirmFinalizeStaffId && (
        <div className="modal-overlay" style={{ zIndex: 11000 }}>
          <div className="confirm-modal-content">
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0' }}>
              <h2>Finalize Payroll?</h2>
              <button className="modal-close" onClick={() => setConfirmFinalizeStaffId(null)}><X size={20} /></button>
            </div>
            <div className="modal-body confirm-modal-body">
              <p>Historical calculations and net payable amounts will be locked permanently on the server.</p>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', backgroundColor: 'transparent' }}>
              <button className="btn-cancel" onClick={() => setConfirmFinalizeStaffId(null)}>Cancel</button>
              <button className="btn-submit btn-primary" onClick={executeFinalizePayroll}>Confirm & Finalize</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}