import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Coffee,
  FileText,
  ReceiptText,
  Soup,
  Table2,
  Utensils,
  DollarSign
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleCard from "../../../components/ModuleCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader"; // <-- Import added here
import "./restaurant.css";

export default function RestaurantPage() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    todayOrders: 0,
    activeTables: 0,
    pendingKitchen: 0,
    todayRevenue: 0,
  });

  // Updated to use the simple "color" prop matching your ModuleCard component
  const restaurantModules = [
    {
      title: "Menu Items",
      icon: Utensils,
      path: "/restaurant/menu-items",
      active: true,
      color: "blue"
    },
    {
      title: "Restaurant Orders",
      icon: ClipboardList,
      path: "/restaurant/orders",
      active: true,
      color: "green"
    },
    {
      title: "Room Service",
      icon: Coffee,
      path: "/restaurant/room-service",
      active: true,
      color: "orange"
    },
    {
      title: "Kitchen Display",
      icon: Soup,
      path: "/restaurant/kitchen",
      active: true,
      color: "red"
    },
    {
      title: "Table Management",
      icon: Table2,
      path: "/restaurant/tables",
      active: true,
      color: "indigo"
    },
    {
      title: "Restaurant Billing",
      icon: ReceiptText,
      path: "/restaurant/billing",
      active: true,
      color: "teal"
    },
    {
      title: "Restaurant Reports",
      icon: FileText,
      path: "/restaurant/reports",
      active: true,
      color: "gray"
    },
  ];

  function handleCardClick(module) {
    if (!module.active) {
      alert("This restaurant module will be designed next.");
      return;
    }
    navigate(module.path);
  }

  return (
    <div className="rest-portal-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Restaurant Portal"
        kicker="HOTEL OPERATIONS"
        description="Manage menu items, guest food orders, room service, kitchen workflow, restaurant billing, and reports."
        icon={Utensils}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="rest-stats-grid">
        <StatCard
          title="Today's Orders"
          value={stats.todayOrders}
          Icon={ClipboardList}
          colorTheme="blue"
        />
        <StatCard
          title="Active Tables"
          value={stats.activeTables}
          Icon={Table2}
          colorTheme="green"
        />
        <StatCard
          title="Pending Kitchen"
          value={stats.pendingKitchen}
          Icon={Soup}
          colorTheme="orange"
        />
        <StatCard
          title="Today's Revenue"
          value={`₹${stats.todayRevenue}`}
          Icon={DollarSign}
          colorTheme="purple"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="rest-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Restaurant Modules"
          description="Open any module to manage related operations."
          badgeCount={restaurantModules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="rest-modules-grid">
          {restaurantModules.map((module) => (
            <ModuleCard
              key={module.title}
              title={module.title}
              Icon={module.icon}
              colorTheme={module.color}
              onClick={() => handleCardClick(module)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}