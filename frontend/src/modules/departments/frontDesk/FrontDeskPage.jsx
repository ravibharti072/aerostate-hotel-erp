import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Building2,
  LogOut,
  UserCheck,
  UserPlus,
  BarChart3
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleCard from "../../../components/ModuleCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader"; 
import "./frontDesk.css";

export default function FrontDeskPage() {
  const navigate = useNavigate();

  const [stats] = useState({
    todayCheckins: 0,
    todayCheckouts: 0,
    activeBookings: 0,
    totalGuests: 0,
  });

  const frontDeskModules = [
    {
      id: "bookings",
      title: "Bookings",
      icon: CalendarCheck,
      path: "/bookings",
      color: "purple"
    },
    {
      id: "checkin-checkout",
      title: "Check-in / Checkout",
      icon: BedDouble,
      path: "/check-in-out",
      color: "teal"
    },
    {
      id: "guest-services",
      title: "Guest Services",
      icon: ClipboardList,
      path: "/guest-services",
      color: "orange"
    },
    {
      id: "invoices",
      title: "Invoices",
      icon: FileText,
      path: "/invoices",
      color: "gray"
    },
    {
      id: "payments",
      title: "Payments",
      icon: CreditCard,
      path: "/payments",
      color: "green"
    },
    {
      id: "reports",
      title: "Front Desk Reports",
      icon: BarChart3,
      path: "/reports/front-desk",
      color: "blue"
    },
  ];

  return (
    <div className="fd-portal-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Front Desk Portal"
        kicker="HOTEL OPERATIONS"
        description="Manage reception tasks, guest services, invoices, payments, and operational reports."
        icon={Building2}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="fd-stats-grid">
        <StatCard
          title="Today's Check-ins"
          value={stats.todayCheckins}
          Icon={UserCheck}
          colorTheme="blue"
        />
        <StatCard
          title="Today's Checkouts"
          value={stats.todayCheckouts}
          Icon={LogOut}
          colorTheme="orange"
        />
        <StatCard
          title="Active Bookings"
          value={stats.activeBookings}
          Icon={CalendarCheck}
          colorTheme="purple"
        />
        <StatCard
          title="Total Guests"
          value={stats.totalGuests}
          Icon={UserPlus}
          colorTheme="green"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="fd-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Front Desk Modules"
          description="Open any module to manage operations or view reports."
          badgeCount={frontDeskModules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="fd-modules-grid">
          {frontDeskModules.map((module) => (
            <ModuleCard
              key={module.id}
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