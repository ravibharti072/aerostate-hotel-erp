import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Wallet, 
  HandCoins, 
  TrendingUp, 
  Receipt,
  Landmark,
  CalendarDays,
  Clock,
  CheckCircle
} from "lucide-react";

import { useAuth } from "@context/AuthContext";
import api from "@api/api";
import { 
  PortalHeader, 
  StatCard, 
  ModuleCard, 
  ModuleWriternHeader 
} from "@components";
import "./accountsPortal.css";

export default function AccountsPortalPage() {
  const navigate = useNavigate();
  const { token, goLiveDate } = useAuth();
  
  // Month Selection & Go-Live Hooks
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const goLiveMonth = goLiveDate ? goLiveDate.slice(0, 7) : null;
  const defaultInitialMonth = goLiveMonth && currentMonthStr < goLiveMonth ? goLiveMonth : currentMonthStr;

  const [selectedMonth, setSelectedMonth] = useState(defaultInitialMonth);
  const [metrics, setMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const res = await api.get(`/accounts/overview?salary_month=${selectedMonth}`);
        setMetrics(res.data);
      } catch (err) {
        console.error("Error fetching accounts overview:", err);
        setMetrics(null);
      } finally {
        setIsLoading(false);
      }
    };

    const isLocked = goLiveMonth && selectedMonth < goLiveMonth;
    if (!isLocked) {
      fetchOverview();
    } else {
      setMetrics(null);
      setIsLoading(false);
    }
  }, [token, selectedMonth, goLiveMonth]);

  // Safe fallback metrics so the cards always render nicely
  const safeMetrics = metrics || {
    salary_metrics: { total_disbursed: 0, total_pending: 0, pending_count: 0 },
    advance_metrics: { total_advances_approved: 0, pending_requests_count: 0 },
    total_operational_outflow: 0
  };

  const modules = [
    {
      id: "salary-payout",
      title: "Salary Payout",
      icon: Wallet,
      color: "blue",
      path: "/accounts/salary-payout",
      badge: safeMetrics.salary_metrics.pending_count ? `${safeMetrics.salary_metrics.pending_count} Pending` : null,
      isComingSoon: false
    },
    {
      id: "salary-advances",
      title: "Salary Advances & Loans",
      icon: HandCoins,
      color: "purple",
      path: "/accounts/salary-advances",
      badge: safeMetrics.advance_metrics.pending_requests_count ? `${safeMetrics.advance_metrics.pending_requests_count} Requests` : null,
      isComingSoon: false
    },
    {
      id: "expenses",
      title: "Operational Expenses",
      icon: Receipt,
      color: "green",
      path: "/accounts/expenses",
      badge: "Active",
      isComingSoon: false
    },
    {
      id: "invoices-payments",
      title: "Revenue & Billing",
      icon: TrendingUp,
      color: "orange",
      path: "/invoices",
      badge: "Active",
      isComingSoon: false
    }
  ];

  const handleCardClick = (m) => {
    if (m.isComingSoon) {
      alert("This module will be available soon!");
    } else {
      navigate(m.path);
    }
  };

  return (
    <div className="accounts-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Accounts & Financial Portal"
        kicker="FINANCE & MANAGEMENT"
        description="Manage salary payouts, track staff advances, and monitor operational cash flow."
        icon={Landmark}
        backPath="/dashboard"
        rightAction={
          <div className="accounts-month-picker">
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

      {/* --- REUSABLE STATS GRID (4 Columns) --- */}
      <div className="accounts-stats-grid">
        <StatCard
          title={`Salary Disbursed (${selectedMonth})`}
          value={`₹${safeMetrics.salary_metrics.total_disbursed.toLocaleString()}`}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Pending Payout Outflow"
          value={`₹${safeMetrics.salary_metrics.total_pending.toLocaleString()}`}
          Icon={Clock}
          colorTheme="yellow"
        />
        <StatCard
          title="Active Staff Advances"
          value={`₹${safeMetrics.advance_metrics.total_advances_approved.toLocaleString()}`}
          Icon={HandCoins}
          colorTheme="purple"
        />
        <StatCard
          title="Total Operational Outflow"
          value={`₹${safeMetrics.total_operational_outflow.toLocaleString()}`}
          Icon={Receipt}
          colorTheme="gray"
        />
      </div>

      {/* MODULES SECTION */}
      <section className="accounts-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Financial Modules"
          description="Open any module to manage related operations or view reports."
          badgeCount={modules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="accounts-modules-grid">
          {modules.map((m) => (
            <div key={m.id} className="module-wrapper" onClick={() => handleCardClick(m)}>
              {/* Custom overlay badge for pending/coming soon logic */}
              {m.badge && (
                <span className={`custom-module-badge ${m.isComingSoon ? 'badge-soon' : 'badge-pending'}`}>
                  {m.badge}
                </span>
              )}
              <ModuleCard
                title={m.title}
                Icon={m.icon}
                colorTheme={m.color}
                onClick={() => {}} // Handled by wrapper
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}