import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  HandCoins, 
  Plus, 
  Check, 
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  Wallet,
  CalendarDays
} from "lucide-react";

import { useAuth } from "@context/AuthContext";
import api from "@api/api";
import { 
  PortalHeader, 
  StatCard, 
  ModuleWriternHeader 
} from "@components";
import "./salaryAdvances.css";

export default function SalaryAdvancesPage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [advances, setAdvances] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    staff_id: "",
    amount: "",
    deduct_month: currentMonth,
    payment_method: "cash",
    reason: "",
    remarks: ""
  });

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [staffRes, advancesRes] = await Promise.all([
        api.get("/staff"),
        api.get("/accounts/advances")
      ]);

      setStaffList(Array.isArray(staffRes.data) ? staffRes.data : []);
      setAdvances(Array.isArray(advancesRes.data) ? advancesRes.data : []);
    } catch (err) {
      console.error("Error fetching advances data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleOpenModal = () => {
    setAdvanceForm({
      staff_id: "",
      amount: "",
      deduct_month: selectedMonth,
      payment_method: "cash",
      reason: "",
      remarks: ""
    });
    setIsModalOpen(true);
  };

  const handleSubmitAdvance = async (e) => {
    e.preventDefault();
    if (!advanceForm.staff_id) return alert("Please select a staff member.");
    if (advanceForm.amount <= 0) return alert("Amount must be greater than zero.");
    
    setIsSubmitting(true);

    const payload = {
      hotel_id: user?.hotel_id || 1,
      staff_id: parseInt(advanceForm.staff_id),
      amount: parseFloat(advanceForm.amount),
      deduct_month: advanceForm.deduct_month,
      status: "approved", // Issued by Accounts directly, so pre-approved
      payment_method: advanceForm.payment_method,
      reason: advanceForm.reason,
      remarks: advanceForm.remarks
    };

    try {
      await api.post("/accounts/advances", payload);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error submitting advance:", err);
      const detail = err.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(", ") : "Failed to issue advance.");
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (advanceId, newStatus) => {
    try {
      await api.put(`/accounts/advances/${advanceId}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error("Error updating advance status:", err);
    }
  };

  const getStaff = (staffId) => staffList.find((s) => s.id === staffId);

  // Local Filters
  const filteredAdvances = advances.filter((adv) => {
    if (statusFilter && adv.status !== statusFilter) return false;
    if (searchQuery) {
      const staff = getStaff(adv.staff_id);
      const name = staff?.full_name || `${staff?.first_name || ""} ${staff?.last_name || ""}`;
      if (!name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // --- 4 KPI Metrics Calculation ---
  const activeAdvancesTotal = advances
    .filter(a => a.status === "approved")
    .reduce((sum, a) => sum + a.amount, 0);

  const pendingRequestsCount = advances
    .filter(a => a.status === "pending").length;

  const recoveredThisMonthTotal = advances
    .filter(a => a.status === "recovered" && a.deduct_month === selectedMonth)
    .reduce((sum, a) => sum + a.amount, 0);

  const totalRecoveredAllTime = advances
    .filter(a => a.status === "recovered")
    .reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="advances-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Salary Advances & Loans"
        kicker="FINANCE & ACCOUNTS"
        description="Issue mid-month cash advances and track deductions for payroll."
        icon={HandCoins}
        backPath="/accounts"
        rightAction={
          <div className="advances-header-actions">
            <div className="month-picker-box">
              <CalendarDays size={18} className="icon" />
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
              />
            </div>
            <button className="btn-issue-advance" onClick={handleOpenModal}>
              <Plus size={18} /> Issue Advance
            </button>
          </div>
        }
      />

      {/* 4 STANDARDIZED STAT CARDS */}
      <div className="advances-stats-grid">
        <StatCard 
          title="Active Advances" 
          value={`₹${activeAdvancesTotal.toLocaleString()}`} 
          Icon={HandCoins} 
          colorTheme="blue" 
        />
        <StatCard 
          title="Pending Requests" 
          value={pendingRequestsCount} 
          Icon={Clock} 
          colorTheme="yellow" 
        />
        <StatCard 
          title={`Recovered (${selectedMonth})`} 
          value={`₹${recoveredThisMonthTotal.toLocaleString()}`} 
          Icon={CheckCircle} 
          colorTheme="green" 
        />
        <StatCard 
          title="Total Recovered (All Time)" 
          value={`₹${totalRecoveredAllTime.toLocaleString()}`} 
          Icon={Wallet} 
          colorTheme="purple" 
        />
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="advances-modules-section">
        <ModuleWriternHeader 
          title="Advances Directory"
          description="Manage pending requests and track issued advances against future payrolls."
          badgeCount={filteredAdvances.length}
          badgeLabel="records"
        />

        {/* Controls & Search */}
        <div className="advances-controls">
          <div className="advances-search-box">
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
            <option value="pending">Pending Request</option>
            <option value="approved">Approved & Active</option>
            <option value="recovered">Recovered (Deducted)</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        <div className="advances-table-container">
          <table className="advances-table">
            <thead>
              <tr>
                <th>Date Issued</th>
                <th>Employee Details</th>
                <th>Amount (₹)</th>
                <th>Target Deduct Month</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" className="empty-state">Loading advance records...</td></tr>
              ) : filteredAdvances.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={24} color="#94a3b8" />
                      <span>No advance records found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAdvances.map((adv) => {
                  const staff = getStaff(adv.staff_id);
                  const issueDate = new Date(adv.advance_date).toLocaleDateString("en-IN", {
                    day: 'numeric', month: 'short', year: 'numeric'
                  });

                  return (
                    <tr key={adv.id}>
                      <td>
                        <div className="date-cell">
                          <strong>{issueDate}</strong>
                          <span>{adv.payment_method?.replace('_', ' ').toUpperCase()}</span>
                        </div>
                      </td>
                      <td>
                        <div className="staff-info-cell">
                          <strong>{staff?.full_name || `Staff #${adv.staff_id}`}</strong>
                          <span>EMP-{adv.staff_id.toString().padStart(4, "0")}</span>
                        </div>
                      </td>
                      <td><strong className="amount-cell text-red">₹{adv.amount.toLocaleString()}</strong></td>
                      <td>
                        <div className="target-month-badge">
                          <Clock size={12} /> {adv.deduct_month}
                        </div>
                      </td>
                      <td>
                        <span className={`status-tag ${adv.status}`}>
                          {adv.status}
                        </span>
                      </td>
                      <td className="actions-cell text-right">
                        {adv.status === "pending" && (
                          <div className="action-group">
                            <button className="btn-approve" onClick={() => handleUpdateStatus(adv.id, "approved")} title="Approve">
                              <Check size={16} />
                            </button>
                            <button className="btn-reject" onClick={() => handleUpdateStatus(adv.id, "rejected")} title="Reject">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                        {adv.status === "approved" && (
                          <button className="btn-recover" onClick={() => handleUpdateStatus(adv.id, "recovered")}>
                            Mark Recovered
                          </button>
                        )}
                        {adv.status === "recovered" && (
                          <span className="settled-tag"><Check size={14} /> Settled</span>
                        )}
                        {adv.status === "rejected" && (
                          <span className="denied-tag"><X size={14} /> Denied</span>
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

      {/* Issue Advance Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Issue Salary Advance</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitAdvance}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Employee</label>
                  <select 
                    required
                    value={advanceForm.staff_id}
                    onChange={(e) => setAdvanceForm({...advanceForm, staff_id: e.target.value})}
                  >
                    <option value="" disabled>-- Select Staff Member --</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name || s.first_name} (EMP-{s.id.toString().padStart(4, '0')})</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Advance Amount (₹)</label>
                    <input 
                      type="number" 
                      required min="1" step="1"
                      placeholder="e.g. 5000"
                      value={advanceForm.amount}
                      onChange={(e) => setAdvanceForm({...advanceForm, amount: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Deduct Month</label>
                    <input 
                      type="month" 
                      required
                      value={advanceForm.deduct_month}
                      onChange={(e) => setAdvanceForm({...advanceForm, deduct_month: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Disbursement Method</label>
                  <select 
                    value={advanceForm.payment_method} 
                    onChange={(e) => setAdvanceForm({...advanceForm, payment_method: e.target.value})}
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="bank_transfer">Bank Transfer / NEFT</option>
                    <option value="upi">UPI</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reason / Remarks (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Medical emergency, Festival advance"
                    value={advanceForm.reason}
                    onChange={(e) => setAdvanceForm({...advanceForm, reason: e.target.value})}
                  />
                </div>
                
                <div className="info-banner">
                  <AlertCircle size={16} />
                  <span>This advance will automatically mark as recovered when the salary for <strong>{advanceForm.deduct_month}</strong> is disbursed.</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Processing..." : "Authorize Issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}