import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Hotel,
  BedDouble,
  ClipboardList,
  Utensils,
  Package,
  Wrench,
  CreditCard,
  Users,
  FileText,
  Settings,
  Bell,
} from "lucide-react";
import { useAuth } from "@context/AuthContext";
import ModuleCard from "../cards/ModuleCard";
import styles from "./DepartmentPortalsWidget.module.css";

export const OPERATIONAL_PORTALS = [
  {
    title: "Front Desk",
    description: "Bookings, check-ins, guest directory, invoices & billing",
    icon: Hotel,
    path: "/front-desk",
    color: "blue",
    moduleKey: "front-desk",
  },
  {
    title: "Rooms",
    description: "Manage room inventory, types, and live room occupancy",
    icon: BedDouble,
    path: "/rooms",
    color: "teal",
    moduleKey: "rooms",
  },
  {
    title: "Housekeeping",
    description: "Room cleaning status, task assignments, inspection logs",
    icon: ClipboardList,
    path: "/housekeeping",
    color: "green",
    moduleKey: "housekeeping",
  },
  {
    title: "Restaurant",
    description: "POS billing, menu engineering, table and kitchen orders",
    icon: Utensils,
    path: "/restaurant",
    color: "orange",
    moduleKey: "restaurant",
  },
  {
    title: "Inventory",
    description: "Stock tracking, item consumption, low-stock reorders",
    icon: Package,
    path: "/inventory",
    color: "orange",
    moduleKey: "inventory",
  },
  {
    title: "Maintenance",
    description: "Equipment issues, preventive schedules & work orders",
    icon: Wrench,
    path: "/maintenance",
    color: "red",
    moduleKey: "maintenance",
  },
  {
    title: "Accounts",
    description: "Financial ledger, daily expense entries, salary payouts",
    icon: CreditCard,
    path: "/accounts",
    color: "green",
    moduleKey: "accounts",
  },
  {
    title: "Staff / HR",
    description: "Employee directory, biometric attendance, leaves, payroll",
    icon: Users,
    path: "/staff",
    color: "purple",
    moduleKey: "staff",
  },
  {
    title: "Reports",
    description: "Revenue insights, occupancy metrics, operational audit",
    icon: FileText,
    path: "/reports",
    color: "gray",
    moduleKey: "reports",
  },
  {
    title: "Settings & Profile",
    description: "Hotel profile, system configuration & login credentials",
    icon: Settings,
    path: "/settings",
    color: "gray",
    moduleKey: "settings",
    alwaysShow: true,
  },
  {
    title: "Updates & Alerts",
    description: "System announcements, maintenance notices & bulletins",
    icon: Bell,
    path: "/alerts",
    color: "red",
    moduleKey: "alerts",
    alwaysShow: true,
    isAlertTile: true,
  },
];

export default function DepartmentPortalsWidget({
  assignedModules = [],
  unreadAlertId = null,
  onAlertClick = null,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const operationPortals = useMemo(() => {
    const isSuperAdmin = user?.role === "super-admin";
    const isHotelAdmin = user?.role === "hotel-admin";
    const userAllowed = Array.isArray(user?.allowed_modules) ? user.allowed_modules : null;

    return OPERATIONAL_PORTALS.filter((portal) => {
      if (portal.alwaysShow || isSuperAdmin) return true;
      if (isHotelAdmin) {
        return assignedModules.includes(portal.moduleKey);
      }
      // Employee / Staff user: strictly enforce user.allowed_modules
      if (userAllowed !== null) {
        return userAllowed.includes(portal.moduleKey);
      }
      // Fallback
      return assignedModules.includes(portal.moduleKey);
    });
  }, [assignedModules, user]);

  const handlePortalClick = (portal) => {
    if (portal.isAlertTile && unreadAlertId && onAlertClick) {
      onAlertClick(unreadAlertId);
    }
    navigate(portal.path);
  };

  return (
    <section className={styles["modules-section"]}>
      <div className={styles["section-header"]}>
        <div>
          <h3>Department Portals</h3>
          <p>Open any module to manage related operations.</p>
        </div>
        <div className={styles["module-badge"]}>
          {operationPortals.length} modules
        </div>
      </div>

      <div className={styles["modules-grid"]}>
        {operationPortals.map((portal) => (
          <div
            key={portal.path}
            className={styles["module-wrapper"]}
            onClick={() => handlePortalClick(portal)}
          >
            {portal.isAlertTile && unreadAlertId && (
              <span className={styles["pulse-dot"]}></span>
            )}

            <ModuleCard
              title={portal.title}
              Icon={portal.icon}
              colorTheme={portal.color}
              onClick={() => {}}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
