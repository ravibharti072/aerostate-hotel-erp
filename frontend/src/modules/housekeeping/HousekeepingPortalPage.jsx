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
  AlertTriangle,
  Shirt,
  Wine,
} from "lucide-react";

import {
  PortalHeader,
  StatCard,
  ModuleCard,
  ModuleWriternHeader,
} from "@components";
import "./housekeepingPortal.css";

export default function HousekeepingPortalPage() {
  const navigate = useNavigate();

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
      title: "Laundry Orders",
      icon: Shirt,
      path: "/housekeeping/laundry",
      color: "blue"
    },
    {
      title: "Minibar Charges",
      icon: Wine,
      path: "/housekeeping/minibar",
      color: "purple"
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

      {/* MODULES SECTION */}
      <section className="hk-modules-section">
        <ModuleWriternHeader 
          title="Housekeeping Modules"
          description="Open any module to manage related operations."
          badgeCount={portalItems.length}
        />

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