import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, 
  CheckCircle, 
  Clock, 
  Search, 
  Check, 
  X, 
  CreditCard,
  Wallet,
  Lock,
  AlertCircle,
  Banknote,
  Users
} from "lucide-react";

import { useAuth } from "@context/AuthContext";
import api from "@api/api";
import { 
  PortalHeader, 
  StatCard, 
  ModuleWriternHeader 
} from "@components";
import "./salaryPayout.css";

export default function SalaryPayoutPage() {
  const navigate = useNavigate();
  const { token, goLiveDate } = useAuth();

  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const goLiveMonth = goLiveDate ? goLiveDate.slice(0, 7) : null;
  const defaultInitialMonth = goLiveMonth && currentMonthStr < goLiveMonth ? goLiveMonth : currentMonthStr;

  const [selectedMonth, setSelectedMonth] = useState(defaultInitialMonth);
  const [salaries, setSalaries] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSalary, setSelectedSalary] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disburseForm, setDisburseForm] = useState({
    payment_method: "bank_transfer",
    transaction_id: "",
    remarks: ""
  });

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [staffRes, salaryRes] = await Promise.all([
        api.get("/staff"),
        api.get(`/staff-payroll?month=${selectedMonth}`)
      ]);

      const staffData = Array.isArray(staffRes.data) ? staffRes.data : [];
      setStaffList(staffData);

      const salaryData = Array.isArray(salaryRes.data) ? salaryRes.data : [];
      const accountsData = salaryData.filter(s => s.status === "Finalized" || s.status === "Paid");
      setSalaries(accountsData);
    } catch (err) {
      console.error("Error fetching payout data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const isLocked = goLiveMonth && selectedMonth < goLiveMonth;
    if (!isLocked) {
      fetchData();
    }
  }, [selectedMonth, token, goLiveMonth]);

  const handleOpenDisburseModal = (salary) => {
    setSelectedSalary(salary);
    setDisburseForm({
      payment_method: salary.payment_method || "bank_transfer",
      transaction_id: "",
      remarks: "Salary settled via Accounts"
    });
    setIsModalOpen(true);
  };

  const handleDisburseSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        status: "Paid",
        month: selectedMonth,
        staff_id: selectedSalary.staff_id,
        payment_method: disburseForm.payment_method,
        transaction_id: disburseForm.transaction_id,
        remarks: disburseForm.remarks
      };

      await api.put(`/staff-payroll/${selectedSalary.id}`, payload);
      setIsModalOpen(false);
      fetchData(); 
    } catch (err) {
      console.error("Error disbursing salary:", err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Disbursement failed.");
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStaff = (staffId) => staffList.find((s) => s.id === staffId);

  const filteredSalaries = salaries.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (searchQuery) {
      const staff = getStaff(s.staff_id);
      const name = staff?.full_name || `${staff?.first_name || ""} ${staff?.last_name || ""}`;
      if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // --- 4 KPI Metrics Calculation ---
  const totalNet = salaries.reduce((acc, s) => acc + (s.net || 0), 0);
  const totalPaid = salaries.filter(s => s.status === "Paid").reduce((acc, s) => acc + (s.net || 0), 0);
  const totalPending = salaries.filter(s => s.status === "Finalized").reduce((acc, s) => acc + (s.net || 0), 0);
  const settledCount = salaries.filter(s => s.status === "Paid").length;
  const totalCount = salaries.length;

  const isPayrollLocked = goLiveMonth && selectedMonth < goLiveMonth;

  return (
    <div className="salary-payout-page">
      <PortalHeader 
        title="Salary Payout"
        kicker="FINANCE & ACCOUNTS"
        description={`Execute and authorize staff payroll settlements for ${selectedMonth}.`}
        icon={Wallet}
        backPath="/accounts"
        rightAction={
          <div className="month-picker-box">
            <CalendarDays size={18} className="icon" />
            <input 
              type="month" 
              value={selectedMonth} 
              min={goLiveMonth || ""}
              onChange={(e) => setSelectedMonth(e.target.value)} 
            />
          </div>
        }
      />

      {isPayrollLocked ? (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '48px', textAlign: 'center', margin: '24px 0' }}>
          <Lock size={48} color="#dc2626" style={{ margin: '0 auto 16px auto', display: 'block' }} />
          <h2 style={{ color: '#991b1b', marginBottom: '8px' }}>Restricted Period (Pre-Go-Live)</h2>
          <p style={{ color: '#7f1d1d', maxWidth: '500px', margin: '0 auto' }}>
            Digital financial tracking for this property officially begins on <strong>{goLiveDate}</strong>. You cannot process payouts prior to this date.
          </p>
        </div>
      ) : (
        <>
          {/* 4 STANDARDIZED STAT CARDS */}
          <div className="payout-stats-grid">
            <StatCard 
              title="Total Net Payroll" 
              value={`₹${totalNet.toLocaleString()}`} 
              Icon={Banknote} 
              colorTheme="blue" 
            />
            <StatCard 
              title="Pending Outflow" 
              value={`₹${totalPending.toLocaleString()}`} 
              Icon={Clock} 
              colorTheme="yellow" 
            />
            <StatCard 
              title="Total Disbursed" 
              value={`₹${totalPaid.toLocaleString()}`} 
              Icon={CheckCircle} 
              colorTheme="green" 
            />
            <StatCard 
              title="Staff Settled" 
              value={`${settledCount} / ${totalCount}`} 
              Icon={Users} 
              colorTheme="purple" 
            />
          </div>

          {/* --- MODULE SECTION --- */}
          <section className="payout-modules-section">
            <ModuleWriternHeader 
              title="Payroll Disbursements"
              description="Review finalized payrolls and execute staff salary settlements."
              badgeCount={filteredSalaries.length}
              badgeLabel="records"
            />

            {/* TOOLBAR */}
            <div className="payout-controls">
              <div className="payout-search-box">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search employee by name..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="status-select">
                <option value="">All Statuses</option>
                <option value="Finalized">Pending Settlement</option>
                <option value="Paid">Paid & Disbursed</option>
              </select>
            </div>

            {/* TABLE */}
            <div className="payout-table-container">
              <table className="payout-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Basic Salary</th>
                    <th>Allowances</th>
                    <th>Deductions</th>
                    <th>Net Payout</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan="7" className="empty-state">Loading payout records...</td></tr>
                  ) : filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <AlertCircle size={24} color="#94a3b8" />
                          <span>No finalized payroll records found for this month. Waiting for HR to finalize.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSalaries.map((s) => {
                      const staff = getStaff(s.staff_id);
                      return (
                        <tr key={s.id}>
                          <td>
                            <div className="staff-info-cell">
                              <strong>{staff?.full_name || `Staff #${s.staff_id}`}</strong>
                              <span>EMP-{s.staff_id.toString().padStart(4, "0")} • {staff?.department?.replace('_', ' ') || "N/A"}</span>
                            </div>
                          </td>
                          <td>₹{(s.basic || 0).toLocaleString()}</td>
                          <td className="text-green">+₹{(s.allowances || 0).toLocaleString()}</td>
                          <td className="text-red">-₹{(s.deductions || 0).toLocaleString()}</td>
                          <td><strong className="net-amount">₹{(s.net || 0).toLocaleString()}</strong></td>
                          <td>
                            <span className={`status-tag ${s.status === 'Paid' ? 'paid' : 'pending'}`}>
                              {s.status === 'Paid' ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td className="actions-cell text-right">
                            {s.status === "Finalized" ? (
                              <button className="disburse-btn" onClick={() => handleOpenDisburseModal(s)}>
                                <CreditCard size={14} /> Pay / Disburse
                              </button>
                            ) : (
                              <span className="settled-tag"><Check size={14} /> Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* DISBURSEMENT MODAL */}
      {isModalOpen && selectedSalary && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Authorize Salary Payout</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleDisburseSubmit}>
              <div className="modal-body">
                <div className="disburse-summary-banner">
                  <div>
                    <span>Disbursing To:</span>
                    <strong>{getStaff(selectedSalary.staff_id)?.full_name}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span>Net Payable:</span>
                    <strong className="text-green" style={{ fontSize: '18px' }}>₹{selectedSalary.net?.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select 
                    value={disburseForm.payment_method} 
                    onChange={(e) => setDisburseForm({...disburseForm, payment_method: e.target.value})}
                  >
                    <option value="bank_transfer">Direct Bank Transfer / NEFT</option>
                    <option value="upi">UPI / Online</option>
                    <option value="cash">Cash Counter</option>
                    <option value="cheque">Company Cheque</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Transaction / UTR Reference ID (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. UTR928371928" 
                    value={disburseForm.transaction_id}
                    onChange={(e) => setDisburseForm({...disburseForm, transaction_id: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Notes</label>
                  <input 
                    type="text" 
                    value={disburseForm.remarks}
                    onChange={(e) => setDisburseForm({...disburseForm, remarks: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Processing..." : "Confirm & Disburse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}