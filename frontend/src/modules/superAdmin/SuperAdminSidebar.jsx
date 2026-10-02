import { useNavigate } from "react-router-dom";
import { ShieldCheck, Hotel, Key, UserCog, Settings, Calendar, ListOrdered } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ReusableSidebar from "../../components/navigation/ReusableSidebar";

export default function SuperAdminSidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/super-admin-login");
  }

  const menuSections = [
    {
      section: "MAIN",
      items: [{ label: "Dashboard", icon: ShieldCheck, path: "/super-admin/dashboard" }]
    },
    {
      section: "MANAGEMENT",
      items: [
        { label: "Hotel Onboard", icon: Hotel, path: "/super-admin/hotel-onboard" },
        { label: "Create Credential", icon: Key, path: "/super-admin/create-credential" },
        { label: "Subscriptions", icon: Calendar, path: "/super-admin/subscriptions" },
        { label: "Assign Module", icon: UserCog, path: "/super-admin/assign-module" },
        { label: "Hotels Directory", icon: ListOrdered, path: "/super-admin/hotels" },
      ]
    },
    {
      section: "SYSTEM",
      items: [{ label: "Settings", icon: Settings, path: "/super-admin/settings" }]
    }
  ];

  return (
    <ReusableSidebar
      appTitle="Aerostate"
      appVersion="v1.0"
      appSubtitle="Platform Management"
      logoImg="/logo.png"
      menuSections={menuSections}
      userName={user?.username || "superadmin"}
      userInitials={(user?.username || "S")[0].toUpperCase()}
      onLogout={handleLogout}
    />
  );
}