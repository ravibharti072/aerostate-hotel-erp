import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "@api/api";
import {
  Users,
  CalendarCheck,
  Banknote,
  CalendarOff,
  Briefcase,
  UserCheck,
  UserMinus,
  CreditCard,
  Fingerprint,
  ShieldCheck
} from "lucide-react";
import PortalHeader from "../../components/headers/PortalHeader";
import StatCard from "../../components/cards/StatCard"; 
import ModuleCard from "../../components/cards/ModuleCard"; 
import ModuleWriternHeader from "../../components/headers/ModuleWriternHeader";
import "./staffPage.css";

export default function StaffPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    onLeave: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const [staffRes, attRes, leaveRes] = await Promise.all([
          api.get("/staff"),
          api.get("/staff-attendance"),
          api.get("/staff-leaves", { params: { status: "pending" } })
        ]);

        const staffData = Array.isArray(staffRes.data) ? staffRes.data : [];
        const attData = Array.isArray(attRes.data) ? attRes.data : [];
        const leaveData = Array.isArray(leaveRes.data) ? leaveRes.data : [];

        const todayAttendance = attData.filter((a) => {
          if (!a.attendance_date) return false;
          return a.attendance_date.slice(0, 10) === todayStr;
        });

        const presentCount = todayAttendance.filter((a) => a.status === "present").length;
        const onLeaveCount = todayAttendance.filter((a) => a.status === "on-leave").length;

        if (isMounted) {
          setStats({
            totalStaff: staffData.length,
            presentToday: presentCount,
            onLeave: onLeaveCount,
            pendingApprovals: leaveData.length,
          });
        }
      } catch (err) {
        console.error("Error fetching staff portal summary stats:", err);
      }
    };

    fetchStats();
    return () => {
      isMounted = false;
    };
  }, [token]);

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
    {
      title: "Portal Access",
      icon: ShieldCheck,
      path: "/staff/portal-access",
      color: "blue"
    },
    // --- NEW BIOMETRIC LOGS MODULE ---
    {
      title: "Biometric Logs",
      icon: Fingerprint,
      path: "/staff/biometric-logs",
      color: "indigo"
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