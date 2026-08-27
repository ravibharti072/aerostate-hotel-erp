import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { 
  CreditCard,
  Banknote, 
  AlertCircle, 
  X, 
  Users, 
  TrendingDown, 
  Wallet,
  Plus,
  Edit,
  Download,
  Shield
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import "./staffSalary.css";

export default function StaffSalaryPage() {
  const { token, user } = useAuth();
  
  const [staffList, setStaffList] = useState([]);
  const [salaryStructures, setSalaryStructures] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Tabs: 'permanent' or 'contract'
  const [activeTab, setActiveTab] = useState("permanent");

  // Modal States
  const [modalType, setModalType] = useState(null); // 'setup_contract' or 'setup_permanent'
  const [activeStaff, setActiveStaff] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms matching your database schema
  const [contractForm, setContractForm] = useState({ fixed_basic: "" });
  const [permanentForm, setPermanentForm] = useState({ 
    basic_salary: "", 
    hra: "", 
    special_allowance: "", 
    other_allowance: "", 
    epf_deduction: "", 
    esi_deduction: "" 
  });

  const fetchData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      // 1. Fetch active staff
      const staffRes = await fetch("http://localhost:8000/staff", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffList(Array.isArray(data) ? data : []);
      }
      
      // 2. Fetch salary structures
      const structRes = await fetch("http://localhost:8000/staff-salary-structures", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (structRes.ok) {
        const structData = await structRes.json();
        setSalaryStructures(structData || {});
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Auto-Sort Employees
  const permanentStaff = staffList.filter(s => s.employee_type !== 'contract');
  const contractStaff = staffList.filter(s => s.employee_type === 'contract');

  // Calculate Overall Stats for the Grid
  const calculateOverallStats = () => {
    let totalEmployees = staffList.length;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    staffList.forEach(staff => {
      const struct = salaryStructures[staff.id];
      if (struct) {
        if (staff.employee_type === 'contract') {
          const basic = Number(struct.fixed_basic) || Number(struct.basic_salary) || 0;
          totalGross += basic;
          totalNet += basic;
        } else {
          totalGross += Number(struct.gross_salary) || 0;
          totalDeductions += (Number(struct.epf_deduction) || 0) + (Number(struct.esi_deduction) || 0);
          totalNet += Number(struct.net_salary) || 0;
        }
      }
    });

    return { totalEmployees, totalGross, totalDeductions, totalNet };
  };

  const stats = calculateOverallStats();

  // --- CONTRACT HANDLERS ---
  const handleOpenContractSetup = (staff) => {
    setActiveStaff(staff);
    const existing = salaryStructures[staff.id];
    setContractForm({ fixed_basic: existing?.fixed_basic || existing?.basic_salary || "" });
    setModalType('setup_contract');
  };

  const handleSaveContract = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const basic = parseFloat(contractForm.fixed_basic) || 0;
    
    const payload = {
      hotel_id: parseInt(activeStaff.hotel_id || user?.hotel_id || 1, 10),
      staff_id: parseInt(activeStaff.id, 10),
      basic_salary: basic,
      hra: 0,
      special_allowance: 0,
      other_allowance: 0,
      epf_deduction: 0,
      esi_deduction: 0,
      gross_salary: basic,
      net_salary: basic
    };

    try {
      const response = await fetch("http://localhost:8000/staff-salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        fetchData();
        setModalType(null);
      } else {
        const err = await response.json();
        alert(`Failed to save: ${JSON.stringify(err.detail || err)}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- PERMANENT HANDLERS ---
  const handleOpenPermanentSetup = (staff) => {
    setActiveStaff(staff);
    const existing = salaryStructures[staff.id];
    setPermanentForm({
      basic_salary: existing?.basic_salary || "",
      hra: existing?.hra || "",
      special_allowance: existing?.special_allowance || "",
      other_allowance: existing?.other_allowance || "",
      epf_deduction: existing?.epf_deduction || "",
      esi_deduction: existing?.esi_deduction || ""
    });
    setModalType('setup_permanent');
  };

  const handleSavePermanent = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Parse inputs
    const basic = parseFloat(permanentForm.basic_salary) || 0;
    const hra = parseFloat(permanentForm.hra) || 0;
    const spl = parseFloat(permanentForm.special_allowance) || 0;
    const oth = parseFloat(permanentForm.other_allowance) || 0;
    const epf = parseFloat(permanentForm.epf_deduction) || 0;
    const esi = parseFloat(permanentForm.esi_deduction) || 0;

    const gross = basic + hra + spl + oth;
    const net = gross - epf - esi;

    const payload = {
      hotel_id: parseInt(activeStaff.hotel_id || user?.hotel_id || 1, 10),
      staff_id: parseInt(activeStaff.id, 10),
      basic_salary: basic,
      hra: hra,
      special_allowance: spl,
      other_allowance: oth,
      epf_deduction: epf,
      esi_deduction: esi,
      gross_salary: gross,
      net_salary: net
    };

    try {
      const response = await fetch("http://localhost:8000/staff-salary-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        fetchData();
        setModalType(null);
      } else {
        const err = await response.json();
        alert(`Failed to save: ${JSON.stringify(err.detail || err)}`);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DOWNLOAD HANDLER ---
  const handleDownloadSalaryData = () => {
    let headers = [];
    let rows = [];
    let filename = "";

    if (activeTab === "permanent") {
      if (!permanentStaff.length) {
        alert("No permanent staff records to download.");
        return;
      }
      headers = ["Employee ID", "Name", "Role", "Basic", "HRA", "Special Allowance", "Other Allowance", "Gross Salary", "EPF Deduction", "ESI Deduction", "Total Deductions", "Net Payable"];
      rows = permanentStaff.map(staff => {
        const struct = salaryStructures[staff.id] || {};
        const basic = Number(struct.basic_salary) || 0;
        const hra = Number(struct.hra) || 0;
        const spl = Number(struct.special_allowance) || 0;
        const oth = Number(struct.other_allowance) || 0;
        const gross = Number(struct.gross_salary) || 0;
        const epf = Number(struct.epf_deduction) || 0;
        const esi = Number(struct.esi_deduction) || 0;
        const net = Number(struct.net_salary) || 0;
        return [
          `EMP-${String(staff.id || '').padStart(4, '0')}`,
          `"${staff.full_name || ''}"`,
          `"${staff.designation || ''}"`,
          basic, hra, spl, oth, gross, epf, esi, (epf + esi), net
        ];
      });
      filename = `permanent_salary_structure_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      if (!contractStaff.length) {
        alert("No contractual staff records to download.");
        return;
      }
      headers = ["Employee ID", "Name", "Role", "Fixed Monthly Basic (Net Payable)"];
      rows = contractStaff.map(staff => {
        const struct = salaryStructures[staff.id] || {};
        const basic = Number(struct.fixed_basic) || Number(struct.basic_salary) || 0;
        return [
          `EMP-${String(staff.id || '').padStart(4, '0')}`,
          `"${staff.full_name || ''}"`,
          `"${staff.designation || 'Labor'}"`,
          basic
        ];
      });
      filename = `contractual_salary_structure_${new Date().toISOString().split('T')[0]}.csv`;
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const liveGross = (parseFloat(permanentForm.basic_salary)||0) + (parseFloat(permanentForm.hra)||0) + (parseFloat(permanentForm.special_allowance)||0) + (parseFloat(permanentForm.other_allowance)||0);
  const liveDeductions = (parseFloat(permanentForm.epf_deduction)||0) + (parseFloat(permanentForm.esi_deduction)||0);
  const liveNet = liveGross - liveDeductions;

  return (
    <div className="salary-page">
      <PortalHeader 
        title="Staff Salary Structure"
        kicker="FINANCE & HR"
        description="Assign fixed wages for contractual labor and comprehensive salary structures for permanent staff."
        icon={CreditCard}
        backPath="/staff"
        rightAction={
          <button className="salary-download-btn" onClick={handleDownloadSalaryData}>
            <Download size={18} /> Download Data
          </button>
        }
      />

      {/* --- REUSABLE STATS GRID --- */}
      <div className="salary-stats-grid">
        <StatCard
          title="Total Employees"
          value={stats.totalEmployees}
          Icon={Users}
          colorTheme="blue"
        />
        <StatCard
          title="Monthly Gross"
          value={`₹${stats.totalGross.toLocaleString()}`}
          Icon={Banknote}
          colorTheme="purple"
        />
        <StatCard
          title="Total Deductions"
          value={`₹${stats.totalDeductions.toLocaleString()}`}
          Icon={TrendingDown}
          colorTheme="red"
        />
        <StatCard
          title="Net Payable"
          value={`₹${stats.totalNet.toLocaleString()}`}
          Icon={Wallet}
          colorTheme="green"
        />
      </div>

      {/* --- MODULE SECTION --- */}
      <section className="salary-modules-section">
        {/* REUSABLE WRITERN HEADER */}
        <ModuleWriternHeader 
          title="Salary Assignments"
          description="Manage and update staff compensation and deductions."
          badgeCount={activeTab === 'permanent' ? permanentStaff.length : contractStaff.length}
          badgeLabel="employees"
        />

        {/* TABS TOOLBAR */}
        <div className="salary-toolbar-card">
          <button 
            className={`tab-btn ${activeTab === 'permanent' ? 'active' : ''}`} 
            onClick={() => setActiveTab('permanent')}
          >
            Permanent Employees ({permanentStaff.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'contract' ? 'active' : ''}`} 
            onClick={() => setActiveTab('contract')}
          >
            Contractual / Labor ({contractStaff.length})
          </button>
        </div>

        {/* TABLES */}
        {activeTab === 'permanent' && (
          <div className="salary-table-container">
            <table className="salary-table detailed-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Basic</th>
                  <th>HRA</th>
                  <th>Spl. Allw</th>
                  <th>Other</th>
                  <th>Gross Salary</th>
                  <th>EPF</th>
                  <th>ESI</th>
                  <th>Deduction</th>
                  <th>Payable Salary</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="12" className="empty-state">Loading permanent staff from database...</td></tr>
                ) : permanentStaff.length === 0 ? (
                  <tr><td colSpan="12" className="empty-state">No permanent staff found.</td></tr>
                ) : (
                  permanentStaff.map(staff => {
                    const struct = salaryStructures[staff.id];
                    const isAssigned = !!struct;

                    return (
                      <tr key={staff.id}>
                        <td>
                          <div className="employee-cell">
                            <strong>{staff.full_name}</strong>
                            <span className="emp-id">EMP-{String(staff.id || '').padStart(4, '0')}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: '#334155', fontWeight: '600', textTransform: 'capitalize' }}>
                            {staff.designation}
                          </span>
                        </td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.basic_salary}` : '-'}</td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.hra}` : '-'}</td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.special_allowance}` : '-'}</td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.other_allowance}` : '-'}</td>
                        <td className="currency-cell">
                          {isAssigned ? <strong style={{ color: '#0f172a' }}>₹{struct.gross_salary}</strong> : '-'}
                        </td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.epf_deduction}` : '-'}</td>
                        <td className="currency-cell">{isAssigned ? `₹${struct.esi_deduction}` : '-'}</td>
                        <td className="currency-cell">
                          {isAssigned ? <strong style={{ color: '#ef4444' }}>- ₹{Number(struct.epf_deduction || 0) + Number(struct.esi_deduction || 0)}</strong> : '-'}
                        </td>
                        <td>
                          {isAssigned ? (
                            <span className="net-salary-badge">₹{struct.net_salary}</span>
                          ) : (
                            <span className="unassigned-badge"><AlertCircle size={14} /> Unassigned</span>
                          )}
                        </td>
                        <td className="actions-cell text-right">
                          <button 
                            className="action-btn edit-icon-btn" 
                            onClick={() => handleOpenPermanentSetup(staff)}
                            title={isAssigned ? "Edit Salary Structure" : "Assign Salary"}
                          >
                            {isAssigned ? <Edit size={16} /> : <Plus size={16} />} 
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'contract' && (
          <div className="salary-table-container">
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Contract Employee</th>
                  <th>Role</th>
                  <th>Employee Type</th>
                  <th>Payable Salary</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="5" className="empty-state">Loading contractual staff...</td></tr>
                ) : contractStaff.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">No contractual staff found.</td></tr>
                ) : (
                  contractStaff.map(staff => {
                    const struct = salaryStructures[staff.id];
                    const isAssigned = !!struct;

                    return (
                      <tr key={staff.id}>
                        <td>
                          <div className="employee-cell">
                            <strong>{staff.full_name}</strong>
                            <span className="emp-id">EMP-{String(staff.id || '').padStart(4, '0')}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '13px', color: '#334155', fontWeight: '600', textTransform: 'capitalize' }}>
                            {staff.designation || "Labor"}
                          </span>
                        </td>
                        <td>
                          <span className="type-badge-contract">Contractual</span>
                        </td>
                        <td>
                          {isAssigned ? (
                            <span className="net-salary-badge">₹{struct.fixed_basic || struct.basic_salary}</span>
                          ) : (
                            <span className="unassigned-badge"><AlertCircle size={14} /> Unassigned</span>
                          )}
                        </td>
                        <td className="actions-cell text-right">
                          <button 
                            className="action-btn edit-icon-btn" 
                            onClick={() => handleOpenContractSetup(staff)}
                            title={isAssigned ? "Edit Payable Salary" : "Assign Salary"}
                          >
                            {isAssigned ? <Edit size={16} /> : <Plus size={16} />} 
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* MODAL: SETUP PERMANENT SALARY */}
      {modalType === 'setup_permanent' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2>Permanent Salary Structure</h2>
              <button className="modal-close" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePermanent}>
              <div className="modal-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <Shield size={24} color="#3b82f6" />
                  <div>
                    <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{activeStaff?.full_name}</strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Permanent Employee • {activeStaff?.designation}</span>
                  </div>
                </div>

                <div className="form-section-title" style={{ marginTop: '8px' }}>Earnings (Gross Salary)</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Basic Salary (₹)</label>
                    <input type="number" required value={permanentForm.basic_salary} onChange={(e) => setPermanentForm({...permanentForm, basic_salary: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>HRA (₹)</label>
                    <input type="number" value={permanentForm.hra} onChange={(e) => setPermanentForm({...permanentForm, hra: e.target.value})} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Special Allowance (₹)</label>
                    <input type="number" value={permanentForm.special_allowance} onChange={(e) => setPermanentForm({...permanentForm, special_allowance: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Other Allowances (₹)</label>
                    <input type="number" value={permanentForm.other_allowance} onChange={(e) => setPermanentForm({...permanentForm, other_allowance: e.target.value})} />
                  </div>
                </div>

                <div className="form-section-title">Deductions</div>
                <div className="form-row">
                  <div className="form-group">
                    <label>EPF Deduction (₹)</label>
                    <input type="number" value={permanentForm.epf_deduction} onChange={(e) => setPermanentForm({...permanentForm, epf_deduction: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>ESI / Other Deductions (₹)</label>
                    <input type="number" value={permanentForm.esi_deduction} onChange={(e) => setPermanentForm({...permanentForm, esi_deduction: e.target.value})} />
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#166534' }}>
                    <span>Live Gross Salary:</span>
                    <strong>₹{liveGross}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#991b1b', borderBottom: '1px solid #bbf7d0', paddingBottom: '8px' }}>
                    <span>Live Deductions:</span>
                    <strong>- ₹{liveDeductions}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ color: '#166534', fontWeight: '700', fontSize: '15px' }}>Payable Salary:</span>
                    <strong style={{ color: '#166534', fontSize: '20px' }}>₹{liveNet}</strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Structure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SETUP CONTRACT SALARY */}
      {modalType === 'setup_contract' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2>Contractual Salary</h2>
              <button className="modal-close" onClick={() => setModalType(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveContract}>
              <div className="modal-body">
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Set the fixed payable salary for <strong>{activeStaff?.full_name}</strong>. Contract workers do not have HRA or PF deductions in this module.
                </p>
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Payable Salary (₹)</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="e.g. 15000"
                    value={contractForm.fixed_basic} 
                    onChange={(e) => setContractForm({...contractForm, fixed_basic: e.target.value})} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setModalType(null)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Salary"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}