import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  Sparkles,
  UserCheck,
  Wrench,
  BaggageClaim,
  AlertTriangle
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleCard from "../../../components/ModuleCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader"; 
import "./housekeepingPortal.css";

export default function HousekeepingPortalPage() {
  const navigate = useNavigate();

  // Mock stats for the UI
  const [stats] = useState({
    pendingCleans: 0,
    inspectedRooms: 0,
    openMaintenance: 0,
    staffOnDuty: 0,
  });

  const portalItems = [
    {
      title: "Checkout Cleaning",
      icon: Sparkles,
      path: "/housekeeping/checkout-cleaning",
      color: "blue"
    },
    {
      title: "Assigned Work",
      icon: UserCheck,
      path: "/housekeeping/assigned-work",
      color: "purple"
    },
    {
      title: "Raise Maintenance Request",
      icon: Wrench,
      path: "/housekeeping/maintenance",
      color: "teal"
    },
    {
      title: "Inspection Checklist",
      icon: ClipboardCheck,
      path: "/housekeeping/tasks",
      color: "orange"
    },
    {
      title: "Daily Reports",
      icon: BarChart3,
      path: "/housekeeping/reports",
      color: "gray"
    },
    {
      title: "Task History",
      icon: ClipboardList,
      path: "/housekeeping/reports",
      color: "green"
    },
  ];

  return (
    <div className="hk-portal-page">
      
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Housekeeping Portal"
        kicker="HOTEL OPERATIONS"
        description="Manage checkout cleaning, assigned housekeeping work, maintenance requests, and reports."
        icon={BaggageClaim}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="hk-stats-grid">
        <StatCard
          title="Pending Cleans"
          value={stats.pendingCleans}
          Icon={Sparkles}
          colorTheme="blue"
        />
        <StatCard
          title="Inspected Rooms"
          value={stats.inspectedRooms}
          Icon={ClipboardCheck}
          colorTheme="green"
        />
        <StatCard
          title="Open Maintenance"
          value={stats.openMaintenance}
          Icon={AlertTriangle}
          colorTheme="orange"
        />
        <StatCard
          title="Staff On Duty"
          value={stats.staffOnDuty}
          Icon={UserCheck}
          colorTheme="purple"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="hk-modules-section">
        
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Housekeeping Modules"
          description="Open any module to manage related operations."
          badgeCount={portalItems.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="hk-modules-grid">
          {portalItems.map((item) => (
            <ModuleCard
              key={item.title}
              title={item.title}
              Icon={item.icon}
              colorTheme={item.color}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </section>

    </div>
  );
}