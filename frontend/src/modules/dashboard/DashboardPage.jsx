import React from "react";
import { useAuth } from "../../context/AuthContext";
import FrontDeskCalendarDashboard from "../frontDesk/dashboard/FrontDeskCalendarDashboard";
import HousekeepingDashboard from "../housekeeping/dashboard/HousekeepingDashboard";
import HousekeepingStaffDashboard from "../housekeeping/staff/HousekeepingStaffDashboard";
import MaintenanceDashboard from "../maintenance/dashboard/MaintenanceDashboard";
import RestaurantDashboard from "../restaurant/dashboard/RestaurantDashboard";
import RoomsDashboard from "../rooms/dashboard/RoomsDashboard";

/**
 * Main PMS Dashboard Page
 *
 * Strictly tied to the logged-in staff member's department:
 * - Front Desk department / role -> renders Front Desk Dashboard ONLY.
 * - Housekeeping department / role:
 *     - Employee / staff -> renders HousekeepingStaffDashboard ONLY.
 *     - HOD / Admin -> renders HousekeepingDashboard ONLY.
 * - Maintenance department / role -> renders Maintenance Dashboard ONLY.
 * - Restaurant / F&B department / role -> renders Restaurant Dashboard ONLY.
 * - Rooms department / role -> renders Rooms Dashboard ONLY.
 * - General Hotel Admins without a staff department default to Front Desk.
 *
 * No tabs or cross-department switchers are displayed on the department dashboard.
 */
export default function DashboardPage() {
  const { user } = useAuth();

  const userDept = (user?.department || "").toLowerCase().trim();
  const userRole = (user?.role || "").toLowerCase().trim();
  const roleLevel = (user?.role_level || "").toLowerCase().trim();
  const isAdmin = userRole === "hotel-admin" || userRole === "super-admin";

  // Housekeeping department staff
  if (
    userDept.includes("housekeep") ||
    userDept.includes("clean") ||
    userRole === "housekeeping"
  ) {
    if (!isAdmin && roleLevel === "employee") {
      return <HousekeepingStaffDashboard showBack={false} isDashboard={true} />;
    }
    return <HousekeepingDashboard isEmbedded={false} />;
  }

  // Maintenance & Engineering staff
  if (
    userDept.includes("maint") ||
    userDept.includes("engin") ||
    userRole === "maintenance"
  ) {
    return <MaintenanceDashboard isEmbedded={false} />;
  }

  // Restaurant & F&B staff
  if (
    userDept.includes("rest") ||
    userDept.includes("banquet") ||
    userDept.includes("food") ||
    userDept.includes("kitchen") ||
    userRole === "restaurant"
  ) {
    return <RestaurantDashboard isEmbedded={false} />;
  }

  // Rooms department staff
  if (userDept.includes("room") || userRole === "rooms") {
    return <RoomsDashboard isEmbedded={false} />;
  }

  // Front Desk department & Default Hotel Admin Command Center
  return <FrontDeskCalendarDashboard isEmbedded={false} />;
}