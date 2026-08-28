import { Outlet } from "react-router-dom";
import SuperAdminSidebar from "../modules/superAdmin/SuperAdminSidebar"; // Adjust this path if your sidebar is somewhere else
import "../components/ReusableSidebar.css"; // Import the CSS we created

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