import { useNavigate } from "react-router-dom";
import { 
  Wrench, 
  PlusCircle, 
  ClipboardList, 
  Sparkles, 
  UserCheck, 
  CalendarCheck, 
  FileText, 
  AlertTriangle,
  Clock,
  CheckCircle2
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleCard from "../../../components/ModuleCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader";
import "./maintenance.css";

export default function MaintenancePortalPage() {
  const navigate = useNavigate();

  // Updated to use the simple "color" prop matching your ModuleCard component
  const maintenanceModules = [
    {
      title: "Active Requests",
      icon: ClipboardList,
      path: "/maintenance/requests",
      color: "blue",
    },
    {
      title: "Raise Request",
      icon: PlusCircle,
      path: "/maintenance/create",
      color: "green",
    },
    {
      title: "Housekeeping Issues",
      icon: Sparkles,
      path: "/maintenance/housekeeping-raised",
      color: "orange",
    },
    {
      title: "Guest Requests",
      icon: UserCheck,
      path: "/maintenance/guest-raised",
      color: "purple",
    },
    {
      title: "Preventive Schedule",
      icon: CalendarCheck,
      path: "/maintenance/schedule",
      color: "blue",
    },
    {
      title: "Maintenance Reports",
      icon: FileText,
      path: "/maintenance/reports",
      color: "green",
    },
  ];

  return (
    <div className="maint-portal-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Maintenance Portal"
        kicker="FACILITY OPERATIONS"
        description="Manage room repairs, source tracking (Housekeeping/Guests), and technician workflows."
        icon={Wrench}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="maint-stats-grid">
        <StatCard
          title="Active Issues"
          value={0}
          Icon={AlertTriangle}
          colorTheme="orange"
        />
        <StatCard
          title="In Progress"
          value={0}
          Icon={Clock}
          colorTheme="blue"
        />
        <StatCard
          title="Urgent Active"
          value={0}
          Icon={Wrench}
          colorTheme="purple"
        />
        <StatCard
          title="Completed Today"
          value={0}
          Icon={CheckCircle2}
          colorTheme="green"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="maint-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Maintenance Modules"
          description="Open any module to manage related operations."
          badgeCount={maintenanceModules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="maint-modules-grid">
          {maintenanceModules.map((module) => (
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