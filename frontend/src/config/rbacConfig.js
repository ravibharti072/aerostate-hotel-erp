/**
 * RBAC Configuration & Helpers
 * Generic, department-agnostic role and navigation access control.
 */

export const ROLE_LEVELS = {
  HOTEL_ADMIN: "hotel_admin",
  DEPARTMENT_HEAD: "department_head",
  EMPLOYEE: "employee",
};

/**
 * Registry of department-specific navigation and route permissions.
 * Currently active for Maintenance; other departments can be added here
 * in future phases without rewriting routing logic.
 */
export const DEPARTMENT_CONFIGS = {
  maintenance: {
    department_head: {
      defaultRoute: "/maintenance/tasks",
      allowedModules: ["maintenance", "alerts"],
      allowedPaths: [
        "/dashboard",
        "/maintenance",
        "/maintenance/dashboard",
        "/maintenance/admin",
        "/maintenance/tasks",
        "/maintenance/my-tasks",
        "/maintenance/requests",
        "/maintenance/work-orders",
        "/maintenance/preventive",
        "/maintenance/assets",
        "/maintenance/reports",
        "/alerts",
        "/alerts/details",
        "/settings",
      ],
      allowedNavChildren: {
        maintenance: [
          "/maintenance/admin",
          "/maintenance/tasks",
          "/maintenance/my-tasks",
          "/maintenance/requests",
          "/maintenance/work-orders",
          "/maintenance/preventive",
          "/maintenance/assets",
        ],
      },
      labelOverrides: {
        "/maintenance/admin": "Operations Command Center",
        "/maintenance/tasks": "Tasks & Assignments",
        "/maintenance/my-tasks": "My Assigned Tasks",
        "/maintenance/requests": "Maintenance Requests",
        "/maintenance/work-orders": "Work Orders & Tasks",
      },
    },
    employee: {
      defaultRoute: "/maintenance/my-tasks",
      allowedModules: ["maintenance", "alerts"],
      allowedPaths: [
        "/dashboard",
        "/maintenance/dashboard",
        "/maintenance/my-tasks",
        "/maintenance/requests",
        "/alerts",
        "/alerts/details",
        "/settings",
      ],
      allowedNavChildren: {
        maintenance: [
          "/maintenance/my-tasks",
          "/maintenance/requests",
        ],
      },
      labelOverrides: {
        "/maintenance/my-tasks": "My Assigned Tasks",
        "/maintenance/requests": "Service Requests",
      },
    },
  },
  housekeeping: {
    department_head: {
      defaultRoute: "/housekeeping/dashboard",
      allowedModules: ["housekeeping", "rooms", "maintenance", "alerts", "reports"],
      allowedPaths: [
        "/dashboard",
        "/housekeeping",
        "/housekeeping/dashboard",
        "/housekeeping/checkout-cleaning",
        "/housekeeping/inspection",
        "/housekeeping/maintenance",
        "/housekeeping/maintenance-requests",
        "/housekeeping/tasks",
        "/room-status",
        "/alerts",
        "/alerts/details",
        "/settings",
        "/reports",
      ],
      allowedNavChildren: {
        housekeeping: [
          "/housekeeping/checkout-cleaning",
          "/housekeeping/inspection",
          "/housekeeping/maintenance-requests",
        ],
        rooms: [
          "/room-status",
        ],
      },
      labelOverrides: {
        "/housekeeping/dashboard": "Operations Dashboard",
        "/housekeeping/checkout-cleaning": "Checkout Cleaning",
        "/housekeeping/inspection": "Cleaning Inspection",
        "/housekeeping/maintenance-requests": "Maintenance Requests",
        "/room-status": "Room Status (View)",
      },
    },
    employee: {
      defaultRoute: "/dashboard",
      allowedModules: ["housekeeping", "maintenance", "alerts"],
      allowedPaths: [
        "/dashboard",
        "/housekeeping",
        "/housekeeping/staff",
        "/housekeeping/my-tasks",
        "/housekeeping/maintenance",
        "/housekeeping/maintenance-requests",
        "/alerts",
        "/alerts/details",
        "/settings",
      ],
      allowedNavChildren: {
        housekeeping: [
          "/housekeeping/maintenance-requests",
        ],
      },
      labelOverrides: {
        "/housekeeping/maintenance-requests": "Raise Maintenance",
      },
    },
  },
  // ---------------------------------------------------------------
  // FRONT DESK: scoped cross-module access
  // dept string stored as "front_desk" in the staff table
  // ---------------------------------------------------------------
  front_desk: {
    department_head: {
      defaultRoute: "/dashboard",
      allowedModules: ["front-desk", "rooms", "maintenance", "restaurant", "housekeeping", "alerts"],
      allowedPaths: [
        "/dashboard",
        // Core front-desk
        "/bookings",
        "/check-in-out",
        "/guests",
        "/extra-charges",
        "/invoices",
        "/payments",
        // Room overview
        "/room-status",
        // Scoped cross-module (limited views only)
        "/maintenance/requests",             // file & track own tickets
        "/restaurant/billing",               // post charge to room/invoice
        "/housekeeping/checkout-cleaning",   // view room cleanliness
        // System
        "/alerts",
        "/alerts/details",
        "/settings",
      ],
      allowedNavChildren: {
        "front-desk": [
          "/bookings",
          "/check-in-out",
          "/guests",
          "/extra-charges",
          "/invoices",
          "/payments",
        ],
        rooms: [
          "/room-status",
        ],
        maintenance: [
          "/maintenance/requests",
        ],
        restaurant: [
          "/restaurant/billing",
        ],
        housekeeping: [
          "/housekeeping/checkout-cleaning",
        ],
      },
      labelOverrides: {
        "/maintenance/requests": "Report Maintenance Issue",
        "/restaurant/billing": "Post Restaurant Charge",
        "/housekeeping/checkout-cleaning": "Room Cleanliness Status",
      },
    },
    employee: {
      defaultRoute: "/dashboard",
      allowedModules: ["front-desk", "rooms", "maintenance", "restaurant", "housekeeping", "alerts"],
      allowedPaths: [
        "/dashboard",
        // Core front-desk
        "/bookings",
        "/check-in-out",
        "/guests",
        "/extra-charges",
        "/invoices",
        "/payments",
        // Room overview
        "/room-status",
        // Scoped cross-module (limited views only)
        "/maintenance/requests",             // file & track own tickets
        "/restaurant/billing",               // post charge to room/invoice
        "/housekeeping/checkout-cleaning",   // view room cleanliness
        // System
        "/alerts",
        "/alerts/details",
        "/settings",
      ],
      allowedNavChildren: {
        "front-desk": [
          "/bookings",
          "/check-in-out",
          "/guests",
          "/extra-charges",
          "/invoices",
          "/payments",
        ],
        rooms: [
          "/room-status",
        ],
        maintenance: [
          "/maintenance/requests",
        ],
        restaurant: [
          "/restaurant/billing",
        ],
        housekeeping: [
          "/housekeeping/checkout-cleaning",
        ],
      },
      labelOverrides: {
        "/maintenance/requests": "Report Maintenance Issue",
        "/restaurant/billing": "Post Restaurant Charge",
        "/housekeeping/checkout-cleaning": "Room Cleanliness Status",
      },
    },
  },
};

/**
 * Normalizes user role level: hotel_admin, department_head, or employee.
 */
export function getUserRoleLevel(user) {
  if (!user) return ROLE_LEVELS.EMPLOYEE;
  const role = (user.role || "").toLowerCase();
  if (role === "super-admin" || role === "hotel-admin") {
    return ROLE_LEVELS.HOTEL_ADMIN;
  }
  const roleLevel = (user.role_level || "").toLowerCase();
  if (roleLevel === "department_head") {
    return ROLE_LEVELS.DEPARTMENT_HEAD;
  }
  return ROLE_LEVELS.EMPLOYEE;
}

/**
 * Returns lowercase normalized department name for the user.
 */
export function getUserDepartment(user) {
  if (!user) return "";
  let dept = user.department || user.staff?.department || "";
  if (!dept && user.role) {
    const r = (user.role || "").toLowerCase();
    if (r.includes("housekeep")) dept = "housekeeping";
    else if (r.includes("front") || r.includes("desk")) dept = "front_desk";
    else if (r.includes("maint") || r.includes("engin")) dept = "maintenance";
    else if (r.includes("rest") || r.includes("food")) dept = "restaurant";
    else if (r.includes("account") || r.includes("cash")) dept = "accounts";
  }
  return dept.toLowerCase().trim();
}

/**
 * Checks whether user is Hotel Admin or Super Admin.
 */
export function isHotelAdmin(user) {
  return getUserRoleLevel(user) === ROLE_LEVELS.HOTEL_ADMIN;
}

/**
 * Checks whether user is a Department Head.
 * If department is provided, checks if they head that specific department.
 */
export function isDepartmentHead(user, department = null) {
  const isHead = getUserRoleLevel(user) === ROLE_LEVELS.DEPARTMENT_HEAD;
  if (!isHead) return false;
  if (department) {
    return getUserDepartment(user).includes(department.toLowerCase());
  }
  return true;
}

/**
 * Checks whether user is an Employee (Technician/Staff).
 */
export function isEmployee(user, department = null) {
  const isEmp = getUserRoleLevel(user) === ROLE_LEVELS.EMPLOYEE;
  if (!isEmp) return false;
  if (department) {
    return getUserDepartment(user).includes(department.toLowerCase());
  }
  return true;
}

/**
 * Returns default landing route based on user role and department.
 */
export function getDefaultRouteForUser(user) {
  if (!user || isHotelAdmin(user)) {
    return "/dashboard";
  }

  const dept = getUserDepartment(user);
  const roleLevel = getUserRoleLevel(user);

  for (const [key, config] of Object.entries(DEPARTMENT_CONFIGS)) {
    if (dept.includes(key) && config[roleLevel]?.defaultRoute) {
      return config[roleLevel].defaultRoute;
    }
  }

  return "/dashboard";
}

/**
 * Checks if a specific path is permitted for the current user.
 */
export function canAccessRoute(path, user) {
  if (!user) return false;
  if (isHotelAdmin(user)) return true;

  // Normalize path (strip query params / trailing slashes)
  const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";

  // System & universal routes accessible to ALL authenticated users
  if (
    cleanPath === "/dashboard" ||
    cleanPath.startsWith("/alerts") ||
    cleanPath.startsWith("/settings") ||
    cleanPath.startsWith("/reports")
  ) {
    return true;
  }

  const dept = getUserDepartment(user);
  const roleLevel = getUserRoleLevel(user);

  // Check if department has specific RBAC config
  for (const [key, config] of Object.entries(DEPARTMENT_CONFIGS)) {
    if (dept.includes(key)) {
      const roleConfig = config[roleLevel];
      if (!roleConfig) return false;

      // Allow department root path (which redirects to dashboard/submodule)
      if (cleanPath === `/${key}`) return true;

      // Check if path or sub-resource path is explicitly allowed
      const isAllowed = roleConfig.allowedPaths.some(
        (allowed) => cleanPath === allowed || cleanPath.startsWith(allowed + "/")
      );
      return isAllowed;
    }
  }

  // Fallback for departments not yet in DEPARTMENT_CONFIGS:
  const userAllowed = Array.isArray(user.allowed_modules) ? user.allowed_modules : [];
  if (userAllowed.includes("all")) return true;

  // Always block super-admin panel for non-admins
  if (cleanPath.startsWith("/super-admin")) return false;

  // Staff / HR module: only accessible to HR/accounts/management depts
  // or users who have "staff" explicitly in their allowed_modules.
  // NOTE: user.role === "staff" is intentionally NOT sufficient — that would
  // grant every employee access to the HR module (the old bug).
  if (cleanPath.startsWith("/staff")) {
    const HR_DEPARTMENTS = ["hr", "human resources", "accounts", "finance", "management"];
    const hasHrDept = HR_DEPARTMENTS.some((d) => dept.includes(d));
    const hasStaffModule = userAllowed.includes("staff") || userAllowed.includes("hr");
    return hasHrDept || hasStaffModule;
  }

  // Accounts module: only accessible to accounts/finance/management depts or explicit module
  if (cleanPath.startsWith("/accounts")) {
    const ACC_DEPARTMENTS = ["accounts", "finance", "management"];
    const hasAccDept = ACC_DEPARTMENTS.some((d) => dept.includes(d));
    const hasAccModule = userAllowed.includes("accounts") || userAllowed.includes("finance");
    return hasAccDept || hasAccModule;
  }

  // Maintenance module: only accessible to users in the maintenance/engineering department.
  // Other departments (front-desk, restaurant, housekeeping etc.) are blocked
  // even if "maintenance" appears in their allowed_modules — the backend rejects
  // cross-department requests and we must not show a broken page.
  if (cleanPath.startsWith("/maintenance")) {
    return dept.includes("maintenance") || dept.includes("engineer");
  }

  return true;
}

/**
 * Dynamically filters and customizes sidebar navigation items based on user role.
 */
export function filterNavSectionsForUser(navSections, user, assignedHotelModules = []) {
  if (!user) return [];

  const isAdmin = isHotelAdmin(user);
  const dept = getUserDepartment(user);
  const roleLevel = getUserRoleLevel(user);

  // 1. HOTEL ADMIN / SUPER ADMIN: Existing hotel module filtering
  if (isAdmin) {
    return navSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((item) => {
          if (item.alwaysShow) return true;
          return (
            assignedHotelModules.length === 0 ||
            assignedHotelModules.includes(item.moduleKey)
          );
        }),
      }))
      .filter((sec) => sec.items.length > 0);
  }

  // 2. CHECK CONFIGURED DEPARTMENT (e.g. Maintenance)
  let matchingConfig = null;
  for (const [key, config] of Object.entries(DEPARTMENT_CONFIGS)) {
    if (dept.includes(key) && config[roleLevel]) {
      matchingConfig = config[roleLevel];
      break;
    }
  }

  if (matchingConfig) {
    const { allowedNavChildren, labelOverrides, allowedModules } = matchingConfig;

    return navSections
      .map((sec) => {
        const filteredItems = sec.items
          .filter((item) => {
            if (item.path === "/dashboard") return true;
            if (item.path === "/settings" || item.alwaysShow) return true;
            if (item.path === "/reports" || item.moduleKey === "reports") return true;
            if (item.moduleKey === "alerts") return true;
            if (!item.moduleKey) return false;
            return allowedModules.includes(item.moduleKey);
          })
          .map((item) => {
            // Filter children if present
            if (Array.isArray(item.children) && item.moduleKey) {
              const allowedChildren = allowedNavChildren[item.moduleKey];
              if (!allowedChildren) return null;

              const filteredChildren = item.children
                .filter((child) => allowedChildren.includes(child.path))
                .map((child) => {
                  const overrideLabel = labelOverrides?.[child.path];
                  return overrideLabel ? { ...child, label: overrideLabel } : child;
                });

              if (filteredChildren.length === 0) return null;

              return {
                ...item,
                children: filteredChildren,
              };
            }

            // Single item without children
            const overrideLabel = labelOverrides?.[item.path];
            return overrideLabel ? { ...item, label: overrideLabel } : item;
          })
          .filter(Boolean);

        return {
          ...sec,
          items: filteredItems,
        };
      })
      .filter((sec) => sec.items.length > 0);
  }

  // 3. FALLBACK FOR OTHER DEPARTMENTS: filter by allowed_modules only
  // IMPORTANT: Do NOT use userRole === item.moduleKey here.
  // That check would grant every user with role "staff" access to
  // the "Staff / HR" module (moduleKey: "staff"), which is a security hole.
  const userAllowed = Array.isArray(user.allowed_modules) ? user.allowed_modules : [];

  // Departments that grant access to the Staff/HR module regardless of allowed_modules
  const HR_DEPARTMENTS = ["hr", "human resources", "accounts", "finance", "management"];
  const isHrDept = HR_DEPARTMENTS.some((d) => dept.includes(d));

  // Departments that grant access to the Accounts module
  const ACC_DEPARTMENTS = ["accounts", "finance", "management"];
  const isAccDept = ACC_DEPARTMENTS.some((d) => dept.includes(d));

  return navSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => {
        if (item.alwaysShow) return true;
        if (item.path === "/settings" || item.path === "/reports") return true;
        if (!item.moduleKey) return false;

        // Staff/HR: only HR departments or users with explicit "staff"/"hr" module grant
        if (item.moduleKey === "staff") {
          return isHrDept || userAllowed.includes("staff") || userAllowed.includes("hr");
        }

        // Accounts: only accounts/finance/management departments or explicit grant
        if (item.moduleKey === "accounts") {
          return isAccDept || userAllowed.includes("accounts") || userAllowed.includes("finance");
        }

        // Maintenance: only users whose department is maintenance/engineering.
        // Having "maintenance" in allowed_modules is NOT enough — other departments
        // (front-desk, restaurant, housekeeping) may have it listed but are blocked
        // by the backend and should not see the sidebar entry at all.
        if (item.moduleKey === "maintenance") {
          return dept.includes("maintenance") || dept.includes("engineer");
        }

        // All other modules: check allowed_modules list
        return userAllowed.includes(item.moduleKey) || userAllowed.includes("all");
      }),
    }))
    .filter((sec) => sec.items.length > 0);
}
