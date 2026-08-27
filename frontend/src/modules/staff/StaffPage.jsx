import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CalendarCheck,
  Banknote,
  CalendarOff,
  Briefcase,
  UserCheck,
  UserMinus,
  CreditCard,
  Fingerprint // <-- Added icon for the Biometric module
} from "lucide-react";
import PortalHeader from "../../components/PortalHeader";
import StatCard from "../../components/StatCard"; 
import ModuleCard from "../../components/ModuleCard"; 
import ModuleWriternHeader from "../../components/ModuleWriternHeader";
import "./staffPage.css";

export default function StaffPage() {
  const navigate = useNavigate();

  // Mock stats for the UI. You can replace these with API data later!
  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
  });

  const staffModules = [
    {
      title: "Staff Directory",
      icon: Users,
      path: "/staff/directory",
      color: "blue"
    },
    {
      title: "Staff Salary Structure",
      icon: CreditCard,
      path: "/staff/salary-structure",
      color: "purple"
    },
    {
      title: "Attendance",
      icon: CalendarCheck,
      path: "/staff/attendance",
      color: "green"
    },
    {
      title: "Payroll Processing",
      icon: Banknote,
      path: "/staff/salaries",
      color: "purple"
    },
    {
      title: "Leave Management",
      icon: CalendarOff,
      path: "/staff/leaves",
      color: "orange"
    },
    // --- NEW BIOMETRIC LOGS MODULE ---
    {
      title: "Biometric Logs",
      icon: Fingerprint,
      path: "/staff/biometric-logs",
      color: "indigo" // You can change this to match your preferred theme color
    }
  ];

  return (
    <div className="staff-portal-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Staff & HR Portal"
        kicker="HUMAN RESOURCES"
        description="Manage employee records, daily attendance, payroll processing, and leave requests."
        icon={Briefcase}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="staff-stats-grid">
        <StatCard
          title="Total Staff"
          value={stats.totalStaff}
          Icon={Users}
          colorTheme="blue"
        />
        <StatCard
          title="Present Today"
          value={stats.presentToday}
          Icon={UserCheck}
          colorTheme="green"
        />
        <StatCard
          title="On Leave"
          value={stats.onLeave}
          Icon={UserMinus}
          colorTheme="orange"
        />
        <StatCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          Icon={CalendarOff}
          colorTheme="purple"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="staff-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="HR Modules"
          description="Open any module to manage related operations."
          badgeCount={staffModules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="staff-modules-grid">
          {staffModules.map((module) => (
            <ModuleCard
              key={module.title}
              title={module.title}
              Icon={module.icon}
              colorTheme={module.color}
              onClick={() => navigate(module.path)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}