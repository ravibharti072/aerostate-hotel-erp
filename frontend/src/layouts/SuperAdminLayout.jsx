import { Outlet } from "react-router-dom";
import SuperAdminSidebar from "../modules/superAdmin/SuperAdminSidebar";
import "../components/navigation/ReusableSidebar.css";

export default function SuperAdminLayout() {
  return (
    <div className="lrs-layout">
      {/* 1. The Sidebar Component */}
      <SuperAdminSidebar />

      {/* 2. Main Content Area (Where Dashboard, etc. will render) */}
      <main className="lrs-main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  );
}