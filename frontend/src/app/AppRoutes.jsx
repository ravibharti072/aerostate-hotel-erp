import { Navigate, Route, Routes } from "react-router-dom";

import PublicRoute from "./routeGuards/PublicRoute";
import ProtectedRoute from "./routeGuards/ProtectedRoute";
import SuperAdminRoute from "./routeGuards/SuperAdminRoute";

import LoginPage from "../modules/auth/LoginPage";
import SuperAdminLoginPage from "../modules/auth/SuperAdminLoginPage";

import HotelLayout from "../layouts/HotelLayout";
import SuperAdminLayout from "../layouts/SuperAdminLayout";

import DashboardPage from "../modules/dashboard/DashboardPage";

// FRONT DESK IMPORTS
import FrontDeskCalendarDashboard from "../modules/frontDesk/dashboard/FrontDeskCalendarDashboard";
import BookingsPage from "../modules/frontDesk/bookings/BookingsPage";
import CheckInOutPage from "../modules/frontDesk/checkInOut/CheckInOutPage";
import GuestsPage from "../modules/frontDesk/guests/GuestsPage";
import InvoicesPage from "../modules/frontDesk/invoices/InvoicesPage";
import PaymentsPage from "../modules/frontDesk/payments/PaymentsPage";
import ExtraChargesPage from "../modules/frontDesk/extraCharges/ExtraChargesPage";

// ROOMS IMPORTS
import RoomsPage from "../modules/rooms/RoomsPage.jsx";
import AddRoomPage from "../modules/rooms/add/AddRoomPage.jsx";
import RoomStatusPage from "../modules/rooms/status/RoomStatusPage.jsx";

// REPORTS IMPORTS
import ReportsPage from "../modules/reports/ReportsPage";

// RESTAURANT IMPORTS
import RestaurantPage from "../modules/restaurant/RestaurantPage.jsx";
import RestaurantMenuItemsPage from "../modules/restaurant/menuItems/RestaurantMenuItemsPage.jsx";
import RestaurantOrdersPage from "../modules/restaurant/orders/RestaurantOrdersPage.jsx";
import RestaurantRoomServicePage from "../modules/restaurant/roomService/RestaurantRoomServicePage.jsx";
import RestaurantKitchenPage from "../modules/restaurant/kitchen/RestaurantKitchenPage.jsx";
import RestaurantTableManagementPage from "../modules/restaurant/tables/RestaurantTableManagementPage.jsx";
import RestaurantBillingPage from "../modules/restaurant/billing/RestaurantBillingPage.jsx";
import RestaurantReportsPage from "../modules/restaurant/reports/RestaurantReportsPage.jsx";

// HOUSEKEEPING IMPORTS
import HousekeepingDashboard from "../modules/housekeeping/dashboard/HousekeepingDashboard.jsx";
import HousekeepingPortalPage from "../modules/housekeeping/HousekeepingPortalPage.jsx";
import CheckoutCleaningPage from "../modules/housekeeping/checkoutCleaning/CheckoutCleaningPage.jsx";
import AssignedWork from "../modules/housekeeping/assignedWork/AssignedWork.jsx";
import HousekeepingPage from "../modules/housekeeping/tasks/HousekeepingPage.jsx";
import HousekeepingMaintenancePage from "../modules/housekeeping/maintenance/HousekeepingMaintenancePage.jsx";
import CleaningInspectionPage from "../modules/housekeeping/inspection/CleaningInspectionPage.jsx";
import ChecklistsPage from "../modules/checklists/ChecklistsPage.jsx";
import HousekeepingStaffDashboard from "../modules/housekeeping/staff/HousekeepingStaffDashboard.jsx";
import LaundryOrdersPage from "../modules/housekeeping/laundry/LaundryOrdersPage.jsx";
import MinibarChargesPage from "../modules/housekeeping/minibar/MinibarChargesPage.jsx";

// MAINTENANCE SUB-MODULE PORTALS
import MaintenanceDashboard from "../modules/maintenance/dashboard/MaintenanceDashboard.jsx";
import MaintenanceRequestsPage from "../modules/maintenance/requests/MaintenanceRequestsPage.jsx";
import WorkOrdersPage from "../modules/maintenance/workOrders/WorkOrdersPage.jsx";
import PreventiveMaintenancePage from "../modules/maintenance/preventive/PreventiveMaintenancePage.jsx";
import AssetsPage from "../modules/maintenance/assets/AssetsPage.jsx";
import MaintenanceTasksPage from "../modules/maintenance/tasks/MaintenanceTasksPage.jsx";
import MaintenanceEmployeeTasksPage from "../modules/maintenance/tasks/MaintenanceEmployeeTasksPage.jsx";
import MaintenanceAdminPage from "../modules/maintenance/admin/MaintenanceAdminPage.jsx";

// INVENTORY SUBMODULE IMPORTS
import StockDirectory from "../modules/inventory/directory/StockDirectory.jsx";
import StockInOut from "../modules/inventory/stockInOut/StockInOut.jsx";
import StockAdjustments from "../modules/inventory/adjustments/StockAdjustments.jsx";
import LowStock from "../modules/inventory/lowStock/LowStock.jsx";
import InventoryReports from "../modules/inventory/reports/InventoryReports.jsx";

// PROCUREMENT
import ProcurementPage from "../modules/procurement/ProcurementPage.jsx";

// STAFF IMPORTS
import StaffPage from "../modules/staff/StaffPage.jsx";
import StaffDirectoryPage from "../modules/staff/directory/StaffDirectoryPage.jsx";
import StaffAttendancePage from "../modules/staff/attendance/StaffAttendancePage.jsx";
import StaffPayrollPage from "../modules/staff/payroll/StaffPayrollPage.jsx";
import StaffSalaryPage from "../modules/staff/payroll/StaffSalaryPage.jsx";
import StaffLeavePage from "../modules/staff/leave/StaffLeavePage.jsx";
import BiometricLogsPage from "../modules/staff/biometric/BiometricLogsPage.jsx";
import EmployeePortalAccessPage from "../modules/staff/portalAccess/EmployeePortalAccessPage.jsx";

// ACCOUNTS IMPORTS
import AccountsPortalPage from "../modules/accounts/AccountsPortalPage.jsx";
import SalaryPayoutPage from "../modules/accounts/SalaryPayoutPage.jsx";
import SalaryAdvancesPage from "../modules/accounts/SalaryAdvancesPage.jsx";
import ExpensesPage from "../modules/accounts/ExpensesPage.jsx";

// SETTINGS & ALERTS IMPORTS
import SettingsPage from "../modules/settings/SettingsPage.jsx";
import AlertsListPage from "../modules/alerts/AlertsListPage.jsx";
import AlertDetailPage from "../modules/alerts/AlertDetailPage.jsx";

// SUPER ADMIN IMPORTS
import SuperAdminDashboardPage from "../modules/superAdmin/SuperAdminDashboardPage";
import HotelOnboardPage from "../modules/superAdmin/hotelOnboard/HotelOnboardPage";
import CreateCredentialPage from "../modules/superAdmin/createCredential/CreateCredentialPage";
import SubscriptionManagementPage from "../modules/superAdmin/subscriptions/SubscriptionManagementPage";
import AssignModulePage from "../modules/superAdmin/assignModule/AssignModulePage";
import HotelsDirectoryPage from "../modules/superAdmin/hotels/HotelsDirectoryPage";
import HotelUsersPage from "../modules/superAdmin/users/HotelUsersPage";
import SuperAdminSettingsPage from "../modules/superAdmin/settings/SuperAdminSettingsPage";

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      <Route
        path="/super-admin-login"
        element={
          <PublicRoute>
            <SuperAdminLoginPage />
          </PublicRoute>
        }
      />

      {/* --- HOTEL ADMIN LAYOUT --- */}
      <Route
        element={
          <ProtectedRoute>
            <HotelLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* FRONT DESK */}
        <Route path="/front-desk" element={<Navigate to="/front-desk/dashboard" replace />} />
        <Route path="/front-desk/dashboard" element={<FrontDeskCalendarDashboard />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/check-in-out" element={<CheckInOutPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/front-desk/guests" element={<GuestsPage />} />
        <Route path="/extra-charges" element={<ExtraChargesPage />} />
        <Route path="/guest-services" element={<Navigate to="/extra-charges" replace />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/check-in" element={<Navigate to="/check-in-out" replace />} />
        <Route path="/check-out" element={<Navigate to="/check-in-out" replace />} />
        <Route path="/reports/front-desk" element={<Navigate to="/reports" replace />} />
        <Route path="/reports/front-desk/*" element={<Navigate to="/reports" replace />} />

        {/* ROOMS */}
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/add" element={<AddRoomPage />} />
        <Route path="/rooms/status" element={<RoomStatusPage />} />
        <Route path="/room-status" element={<RoomStatusPage />} />

        {/* RESTAURANT */}
        <Route path="/restaurant" element={<RestaurantPage />} />
        <Route path="/restaurant/menu-items" element={<RestaurantMenuItemsPage />} />
        <Route path="/restaurant/orders" element={<RestaurantOrdersPage />} />
        <Route path="/restaurant/room-service" element={<RestaurantRoomServicePage />} />
        <Route path="/restaurant/kitchen" element={<RestaurantKitchenPage />} />
        <Route path="/restaurant/tables" element={<RestaurantTableManagementPage />} />
        <Route path="/restaurant/billing" element={<RestaurantBillingPage />} />
        <Route path="/restaurant/reports" element={<RestaurantReportsPage />} />

        {/* HOUSEKEEPING */}
        <Route path="/housekeeping" element={<Navigate to="/housekeeping/dashboard" replace />} />
        <Route path="/housekeeping/dashboard" element={<HousekeepingDashboard />} />
        <Route path="/housekeeping/portal" element={<HousekeepingPortalPage />} />
        <Route path="/housekeeping/checkout-cleaning" element={<CheckoutCleaningPage />} />
        <Route path="/housekeeping/inspection" element={<CleaningInspectionPage />} />
        <Route path="/housekeeping/staff" element={<HousekeepingStaffDashboard />} />
        <Route path="/housekeeping/my-tasks" element={<HousekeepingStaffDashboard />} />
        <Route path="/housekeeping/maintenance" element={<HousekeepingMaintenancePage />} />
        <Route path="/housekeeping/maintenance-requests" element={<HousekeepingMaintenancePage />} />
        <Route path="/housekeeping/maintenance/requests" element={<Navigate to="/housekeeping/maintenance-requests" replace />} />
        <Route path="/housekeeping/assigned-work" element={<AssignedWork />} />
        <Route path="/housekeeping/reports" element={<Navigate to="/housekeeping/checkout-cleaning" replace />} />
        <Route path="/housekeeping/laundry" element={<LaundryOrdersPage />} />
        <Route path="/housekeeping/minibar" element={<MinibarChargesPage />} />

        {/* CHECKLISTS (HOD builds them, staff tick them off) */}
        <Route path="/checklists" element={<ChecklistsPage />} />
        <Route path="/checklists/add" element={<ChecklistsPage />} />
        <Route path="/housekeeping/checklists" element={<ChecklistsPage />} />

        {/* MAINTENANCE */}
        <Route path="/maintenance" element={<Navigate to="/maintenance/dashboard" replace />} />
        <Route path="/maintenance/dashboard" element={<MaintenanceDashboard />} />
        <Route path="/maintenance/admin" element={<MaintenanceAdminPage />} />
        <Route path="/maintenance/tasks" element={<MaintenanceTasksPage />} />
        <Route path="/maintenance/my-tasks" element={<MaintenanceEmployeeTasksPage />} />
        <Route path="/maintenance/requests" element={<MaintenanceRequestsPage />} />
        <Route path="/maintenance/work-orders" element={<WorkOrdersPage />} />
        <Route path="/maintenance/preventive" element={<PreventiveMaintenancePage />} />
        <Route path="/maintenance/assets" element={<AssetsPage />} />
        <Route path="/maintenance/reports" element={<Navigate to="/reports" replace />} />

        {/* INVENTORY */}
        <Route path="/inventory" element={<Navigate to="/inventory/directory" replace />} />
        <Route path="/inventory/directory" element={<StockDirectory />} />
        <Route path="/inventory/stock-in-out" element={<StockInOut />} />
        <Route path="/inventory/adjustments" element={<StockAdjustments />} />
        <Route path="/inventory/low-stock" element={<LowStock />} />
        <Route path="/inventory/reports" element={<InventoryReports />} />

        {/* PROCUREMENT */}
        <Route path="/procurement" element={<ProcurementPage />} />

        {/* ACCOUNTS */}
        <Route path="/accounts" element={<AccountsPortalPage />} />
        <Route path="/accounts/salary-payout" element={<SalaryPayoutPage />} />
        <Route path="/accounts/salary-advances" element={<SalaryAdvancesPage />} />
        <Route path="/accounts/expenses" element={<ExpensesPage />} />

        {/* STAFF / HR */}
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/directory" element={<StaffDirectoryPage />} />
        <Route path="/staff/attendance" element={<StaffAttendancePage />} />
        <Route path="/staff/salary-structure" element={<StaffSalaryPage />} />
        <Route path="/staff/salaries" element={<StaffPayrollPage />} />
        <Route path="/staff/leaves" element={<StaffLeavePage />} />
        <Route path="/staff/biometric-logs" element={<BiometricLogsPage />} />
        <Route path="/staff/portal-access" element={<EmployeePortalAccessPage />} />

        {/* REPORTS, SETTINGS & ALERTS */}
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/alerts" element={<AlertsListPage />} />
        <Route path="/alerts/details" element={<AlertDetailPage />} />
      </Route>

      {/* --- SUPER ADMIN --- */}
      <Route
        path="/super-admin"
        element={
          <SuperAdminRoute>
            <SuperAdminLayout />
          </SuperAdminRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<SuperAdminDashboardPage />} />
        <Route path="hotel-onboard" element={<HotelOnboardPage />} />
        <Route path="create-credential" element={<CreateCredentialPage />} />
        <Route path="subscriptions" element={<SubscriptionManagementPage />} />
        <Route path="assign-module" element={<AssignModulePage />} />
        <Route path="hotels" element={<HotelsDirectoryPage />} />
        <Route path="users" element={<HotelUsersPage />} />
        <Route path="settings" element={<SuperAdminSettingsPage />} />
      </Route>

      {/* FALLBACKS */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}