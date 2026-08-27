import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BedDouble,
  PlusCircle,
  LayoutGrid,
  CheckCircle,
  Key,
  Wrench
} from "lucide-react";
import PortalHeader from "../../../components/PortalHeader";
import StatCard from "../../../components/StatCard"; 
import ModuleCard from "../../../components/ModuleCard"; 
import ModuleWriternHeader from "../../../components/ModuleWriternHeader"; // <-- Import added here
import "./rooms.css";

export default function RoomsPage() {
  const navigate = useNavigate();

  // Mock stats for the UI. You can hook these up to your API later!
  const [stats] = useState({
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    maintenanceRooms: 0,
  });

  // Updated to use the "color" prop matching your ModuleCard component
  const roomModules = [
    {
      title: "Add & Manage Rooms",
      icon: PlusCircle,
      path: "/rooms/add",
      color: "blue"
    },
    {
      title: "Room Status",
      icon: LayoutGrid,
      path: "/room-status",
      color: "green"
    },
  ];

  return (
    <div className="rooms-portal-page">
      {/* SHARED UNIFIED PORTAL HEADER */}
      <PortalHeader 
        title="Rooms Portal"
        kicker="HOTEL OPERATIONS"
        description="Manage room creation, pricing tiers, and live room operational tracking."
        icon={BedDouble}
        backPath="/dashboard"
      />

      {/* --- REUSABLE STATS GRID --- */}
      <section className="rooms-stats-grid">
        <StatCard
          title="Total Rooms"
          value={stats.totalRooms}
          Icon={BedDouble}
          colorTheme="blue"
        />
        <StatCard
          title="Available Rooms"
          value={stats.availableRooms}
          Icon={CheckCircle}
          colorTheme="green"
        />
        <StatCard
          title="Occupied Rooms"
          value={stats.occupiedRooms}
          Icon={Key}
          colorTheme="orange"
        />
        <StatCard
          title="Maintenance"
          value={stats.maintenanceRooms}
          Icon={Wrench}
          colorTheme="purple"
        />
      </section>
      {/* --------------------------- */}

      {/* MODULES SECTION */}
      <section className="rooms-modules-section">
        {/* --- REUSABLE WRITERN HEADER --- */}
        <ModuleWriternHeader 
          title="Room Modules"
          description="Open any module to manage related operations."
          badgeCount={roomModules.length}
        />

        {/* --- REUSABLE MODULE CARDS GRID --- */}
        <div className="rooms-modules-grid">
          {roomModules.map((module) => (
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