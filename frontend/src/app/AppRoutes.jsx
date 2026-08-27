import { Navigate, Route, Routes } from "react-router-dom";

import PublicRoute from "./routeGuards/PublicRoute";
import ProtectedRoute from "./routeGuards/ProtectedRoute";
import SuperAdminRoute from "./routeGuards/SuperAdminRoute";

import LoginPage from "../modules/auth/LoginPage";
import SuperAdminLoginPage from "../modules/auth/SuperAdminLoginPage";

import Sidebar from "../layouts/Sidebar";

import DashboardPage from "../modules/dashboard/DashboardPage";

// FRONT DESK IMPORTS
import FrontDeskPage from "../modules/departments/frontDesk/FrontDeskPage";
import GuestsPage from "../modules/departments/frontDesk/guests/GuestsPage";
import BookingsPage from "../modules/departments/frontDesk/bookings/BookingsPage";
import CheckInOutPage from "../modules/departments/frontDesk/checkInOut/CheckInOutPage";
import InvoicesPage from "../modules/departments/frontDesk/invoices/InvoicesPage";
import PaymentsPage from "../modules/departments/frontDesk/payments/PaymentsPage";
import GuestServicesPage from "../modules/departments/frontDesk/guestServices/GuestServicesPage";
import FrontDeskReportsPage from "../modules/departments/frontDesk/reports/FrontDeskReportsPage.jsx";
import AllBookingsReport from "../modules/departments/frontDesk/reports/AllBookingsReport.jsx";

// ROOMS IMPORTS
import RoomsPage from "../modules/departments/rooms/RoomsPage";
import AddRoomPage from "../modules/departments/rooms/add/AddRoomPage.jsx";
import RoomStatusPage from "../modules/departments/rooms/status/RoomStatusPage.jsx";

// REPORTS IMPORTS
import ReportsPage from "../modules/departments/reports/ReportsPage";

// RESTAURANT IMPORTS (Organized into Respective Folders)
import RestaurantPage from "../modules/departments/restaurant/RestaurantPage.jsx";
import RestaurantMenuItemsPage from "../modules/departments/restaurant/menuItems/RestaurantMenuItemsPage.jsx";
import RestaurantOrdersPage from "../modules/departments/restaurant/orders/RestaurantOrdersPage.jsx";
import RestaurantRoomServicePage from "../modules/departments/restaurant/roomService/RestaurantRoomServicePage.jsx";
import RestaurantKitchenPage from "../modules/departments/restaurant/kitchen/RestaurantKitchenPage.jsx";
import RestaurantTableManagementPage from "../modules/departments/restaurant/tables/RestaurantTableManagementPage.jsx";
import RestaurantBillingPage from "../modules/departments/restaurant/billing/RestaurantBillingPage.jsx";
import RestaurantReportsPage from "../modules/departments/restaurant/reports/RestaurantReportsPage.jsx";

// HOUSEKEEPING IMPORTS
import HousekeepingPortalPage from "../modules/departments/housekeeping/HousekeepingPortalPage.jsx";
import HousekeepingPage from "../modules/departments/housekeeping/tasks/HousekeepingPage.jsx";
import CheckoutCleaningPage from "../modules/departments/housekeeping/checkoutCleaning/CheckoutCleaningPage.jsx";
import HousekeepingMaintenancePage from "../modules/departments/housekeeping/maintenance/HousekeepingMaintenancePage.jsx";
import HousekeepingReportsPage from "../modules/departments/housekeeping/reports/HousekeepingReportsPage.jsx";
import HousekeepingAssignedWorkPage from "../modules/departments/housekeeping/assignedWork/HousekeepingAssignedWorkPage.jsx";

// MAINTENANCE PORTAL & SUB-MODULES
import MaintenancePortalPage from "../modules/departments/maintenance/MaintenancePortalPage.jsx";

// STAFF IMPORTS
import StaffPage from "../modules/staff/StaffPage.jsx";
import StaffDirectoryPage from "../modules/staff/directory/StaffDirectoryPage.jsx";
import StaffAttendancePage from "../modules/staff/attendance/StaffAttendancePage.jsx";
import StaffPayrollPage from "../modules/staff/payroll/StaffPayrollPage.jsx";
import StaffSalaryPage from "../modules/staff/payroll/StaffSalaryPage.jsx"; 
import StaffLeavePage from "../modules/staff/leave/StaffLeavePage.jsx";
import BiometricLogsPage from "../modules/staff/biometric/BiometricLogsPage.jsx"; // <-- NEW IMPORT

// ACCOUNTS IMPORTS
import AccountsPortalPage from "../modules/accounts/AccountsPortalPage.jsx";
import SalaryPayoutPage from "../modules/accounts/SalaryPayoutPage.jsx";
import SalaryAdvancesPage from "../modules/accounts/SalaryAdvancesPage.jsx";

// SETTINGS & ALERTS IMPORTS
import SettingsPage from "../modules/settings/SettingsPage.jsx";
import AlertsListPage from "../modules/alerts/AlertsListPage.jsx";
import AlertDetailPage from "../modules/alerts/AlertDetailPage.jsx";

// SUPER ADMIN IMPORTS
import SuperAdminDashboardPage from "../modules/superAdmin/SuperAdminDashboardPage";
import HotelOnboardPage from "../modules/superAdmin/HotelOnboardPage";
import CreateCredentialPage from "../modules/superAdmin/CreateCredentialPage";
import SubscriptionManagementPage from "../modules/superAdmin/SubscriptionManagementPage";
import AssignModulePage from "../modules/superAdmin/AssignModulePage";
import HotelsManagementPage from "../modules/superAdmin/HotelsManagementPage";
import HotelUsersPage from "../modules/superAdmin/users/HotelUsersPage";

function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: "24px" }}>
      <h2>{title}</h2>
      <p>This module will be designed next.</p>
    </div>
  );
}

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

      <Route
        element={
          <ProtectedRoute>
            <Sidebar />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Front Desk */}
        <Route path="/front-desk" element={<FrontDeskPage />} />
        <Route path="/guests" element={<GuestsPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/check-in-out" element={<CheckInOutPage />} />
        <Route path="/guest-services" element={<GuestServicesPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/payments" element={<PaymentsPage />} />

        {/* Front Desk Reports Hub & Sub-Routes */}
        <Route path="/reports/front-desk" element={<FrontDeskReportsPage />} />
        <Route path="/reports/front-desk/bookings" element={<AllBookingsReport />} />
        <Route path="/reports/front-desk/check-ins" element={<PlaceholderPage title="Check-In / Out Report" />} />
        <Route path="/reports/front-desk/invoices" element={<PlaceholderPage title="Invoices & Revenue Report" />} />
        <Route path="/reports/front-desk/payments" element={<PlaceholderPage title="Payments & Collections Report" />} />

        <Route path="/check-in" element={<Navigate to="/check-in-out" replace />} />
        <Route path="/check-out" element={<Navigate to="/check-in-out" replace />} />

        {/* Rooms Portal & Sub-routes */}
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/add" element={<AddRoomPage />} />
        <Route path="/room-status" element={<RoomStatusPage />} />

        {/* Restaurant */}
        <Route path="/restaurant" element={<RestaurantPage />} />
        <Route path="/restaurant/menu-items" element={<RestaurantMenuItemsPage />} />
        <Route path="/restaurant/orders" element={<RestaurantOrdersPage />} />
        <Route path="/restaurant/room-service" element={<RestaurantRoomServicePage />} />
        <Route path="/restaurant/kitchen" element={<RestaurantKitchenPage />} />
        <Route path="/restaurant/tables" element={<RestaurantTableManagementPage />} />
        <Route path="/restaurant/billing" element={<RestaurantBillingPage />} />
        <Route path="/restaurant/reports" element={<RestaurantReportsPage />} />

        {/* Housekeeping Portal & Sub-modules */}
        <Route path="/housekeeping" element={<HousekeepingPortalPage />} />
        <Route path="/housekeeping/tasks" element={<HousekeepingPage />} />
        <Route path="/housekeeping/checkout-cleaning" element={<CheckoutCleaningPage />} />
        <Route path="/housekeeping/maintenance" element={<HousekeepingMaintenancePage />} />
        <Route path="/housekeeping/reports" element={<HousekeepingReportsPage />} />
        <Route path="/housekeeping/assigned-work" element={<HousekeepingAssignedWorkPage />} />

        {/* Maintenance Portal & Sub-modules */}
        <Route path="/maintenance" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/requests" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/create" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/housekeeping-raised" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/guest-raised" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/schedule" element={<MaintenancePortalPage />} />
        <Route path="/maintenance/reports" element={<MaintenancePortalPage />} />

        <Route path="/inventory" element={<PlaceholderPage title="Inventory" />} />
        
        {/* ACCOUNTS & FINANCIALS */}
        <Route path="/accounts" element={<AccountsPortalPage />} />
        <Route path="/accounts/salary-payout" element={<SalaryPayoutPage />} />
        <Route path="/accounts/salary-advances" element={<SalaryAdvancesPage />} />
        
        {/* STAFF & HR */}
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/directory" element={<StaffDirectoryPage />} />
        <Route path="/staff/attendance" element={<StaffAttendancePage />} />
        
        {/* --- SALARY & PAYROLL --- */}
        <Route path="/staff/salary-structure" element={<StaffSalaryPage />} />
        <Route path="/staff/salaries" element={<StaffPayrollPage />} />
        
        <Route path="/staff/leaves" element={<StaffLeavePage />} />
        <Route path="/staff/biometric-logs" element={<BiometricLogsPage />} /> {/* <-- NEW ROUTE */}
        
        <Route path="/procurement" element={<PlaceholderPage title="Procurement" />} />
        <Route path="/reports" element={<ReportsPage />} />

        {/* SYSTEM & SETTINGS */}
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/alerts" element={<AlertsListPage />} />
        <Route path="/alerts/details" element={<AlertDetailPage />} />
      </Route>

      <Route
        path="/super-admin"
        element={
          <SuperAdminRoute>
            <Navigate to="/super-admin/dashboard" replace />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/dashboard"
        element={
          <SuperAdminRoute>
            <SuperAdminDashboardPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/hotel-onboard"
        element={
          <SuperAdminRoute>
            <HotelOnboardPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/create-credential"
        element={
          <SuperAdminRoute>
            <CreateCredentialPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/subscriptions"
        element={
          <SuperAdminRoute>
            <SubscriptionManagementPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/assign-module"
        element={
          <SuperAdminRoute>
            <AssignModulePage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/hotels"
        element={
          <SuperAdminRoute>
            <HotelsManagementPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super-admin/users"
        element={
          <SuperAdminRoute>
            <HotelUsersPage />
          </SuperAdminRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}