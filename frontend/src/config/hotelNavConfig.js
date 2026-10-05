import {
  LayoutDashboard,
  Hotel,
  BedDouble,
  Users,
  CreditCard,
  Utensils,
  Package,
  Wrench,
  Settings,
  ClipboardList,
  ClipboardCheck,
  FileText,
  Truck,
} from "lucide-react";

export const hotelNavSections = [
  {
    section: "MAIN",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        alwaysShow: true,
      },
    ],
  },
  {
    section: "OPERATIONS",
    items: [
      {
        label: "Front Desk",
        icon: Hotel,
        moduleKey: "front-desk",
        children: [
          { label: "Bookings", path: "/bookings" },
          { label: "Check In / Out", path: "/check-in-out" },
          { label: "Guests Directory", path: "/guests" },
          { label: "Guest Services", path: "/extra-charges" },
          { label: "Invoices", path: "/invoices" },
          { label: "Payments", path: "/payments" },
        ],
      },
      {
        label: "Rooms",
        icon: BedDouble,
        moduleKey: "rooms",
        children: [
          { label: "Add Room", path: "/rooms/add" },
          { label: "Room Status", path: "/room-status" },
        ],
      },
      {
        label: "Restaurant",
        icon: Utensils,
        moduleKey: "restaurant",
        children: [
          { label: "Menu Items", path: "/restaurant/menu-items" },
          { label: "Orders", path: "/restaurant/orders" },
          { label: "Room Service", path: "/restaurant/room-service" },
          { label: "Kitchen", path: "/restaurant/kitchen" },
          { label: "Table Management", path: "/restaurant/tables" },
          { label: "Billing", path: "/restaurant/billing" },
          { label: "Reports", path: "/restaurant/reports" },
        ],
      },
      {
        label: "Housekeeping",
        icon: ClipboardList,
        moduleKey: "housekeeping",
        children: [
          { label: "Checkout Cleaning", path: "/housekeeping/checkout-cleaning" },
          { label: "Cleaning Inspection", path: "/housekeeping/inspection" },
          { label: "Cleaning Checklists", path: "/checklists" },
          { label: "Maintenance Requests", path: "/housekeeping/maintenance-requests" },
        ],
      },
      {
        label: "Maintenance",
        icon: Wrench,
        moduleKey: "maintenance",
        children: [
          { label: "Operations Center", path: "/maintenance/admin" },
          { label: "My Assigned Tasks", path: "/maintenance/my-tasks" },
          { label: "Work Orders", path: "/maintenance/work-orders" },
          { label: "Service Requests", path: "/maintenance/requests" },
          { label: "Preventive Maintenance", path: "/maintenance/preventive" },
          { label: "Assets & Equipment", path: "/maintenance/assets" },
        ],
      },
    ],
  },
  {
    section: "FINANCE & SUPPLY",
    items: [
      {
        label: "Accounts",
        icon: CreditCard,
        moduleKey: "accounts",
        children: [
          { label: "Operational Expenses", path: "/accounts/expenses" },
          { label: "Salary Payouts", path: "/accounts/salary-payout" },
          { label: "Salary Advances", path: "/accounts/salary-advances" },
        ],
      },
      {
        label: "Inventory",
        icon: Package,
        moduleKey: "inventory",
        children: [
          { label: "Inventory Directory", path: "/inventory/directory" },
          { label: "Stock In / Out", path: "/inventory/stock-in-out" },
          { label: "Stock Adjustments", path: "/inventory/adjustments" },
          { label: "Low Stock Alerts", path: "/inventory/low-stock" },
          { label: "Inventory Reports", path: "/inventory/reports" },
        ],
      },
      {
        label: "Procurement",
        path: "/procurement",
        icon: Truck,
        moduleKey: "inventory",
      },
    ],
  },
  {
    section: "STAFF & REPORTS",
    items: [
      {
        label: "Staff / HR",
        icon: Users,
        moduleKey: "staff",
        children: [
          { label: "Directory", path: "/staff/directory" },
          { label: "Portal Access", path: "/staff/portal-access" },
          { label: "Attendance", path: "/staff/attendance" },
          { label: "Biometric Logs", path: "/staff/biometric-logs" },
          { label: "Leaves", path: "/staff/leaves" },
          { label: "Salary Structure", path: "/staff/salary-structure" },
          { label: "Salaries / Payroll", path: "/staff/salaries" },
        ],
      },
      {
        label: "Reports",
        path: "/reports",
        icon: FileText,
        moduleKey: "reports",
        alwaysShow: true,
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
        alwaysShow: true,
      },
    ],
  },
];