import React from "react";
import { NavLink } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import "./ReusableSidebar.css";

export default function ReusableSidebar({
  appTitle = "Software Name",
  appVersion = "v1.0",
  appSubtitle = "System",
  logoImg, 
  menuSections = [],
  userName = "Admin",
  userInitials = "A",
  onLogout
}) {
  return (
    <aside className="lrs-sidebar is-open">
      <div className="lrs-sidebar-header">
        <div className="lrs-sidebar-brand-row">
          
          {/* Renders custom image if provided, otherwise defaults to the CSS Grid Logo */}
          <div className="lrs-sidebar-logo-mark" style={logoImg ? { border: 'none', background: '#0f172a', boxShadow: 'none' } : {}}>
            {logoImg ? (
              <img src={logoImg} alt="Logo" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            ) : (
              <div className="css-logo-grid">
                <span className="sq blue"></span>
                <span className="sq gray"></span>
                <span className="sq teal"></span>
              </div>
            )}
          </div>

          <div className="lrs-sidebar-brand-text">
            <h2 className="lrs-sidebar-logo-title">
              <span className="lrs-sidebar-app-name">{appTitle}</span>
              {appVersion && <span className="app-version-badge">{appVersion}</span>}
            </h2>
            <p className="lrs-sidebar-subtitle">{appSubtitle}</p>
          </div>
        </div>
      </div>

      <nav className="lrs-sidebar-nav">
        {menuSections.map((sec, idx) => {
          if (!sec.items || sec.items.length === 0) return null;
          return (
            <div key={idx} className="lrs-sidebar-section">
              {sec.section && <h3 className="lrs-sidebar-section-title">{sec.section}</h3>}
              {sec.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={item.onClick}
                  className={({ isActive }) => `lrs-sidebar-item ${isActive ? "is-active" : ""}`}
                >
                  {({ isActive }) => (
                    <>
                      <span className="lrs-sidebar-icon"><item.icon size={16} /></span>
                      <span className="lrs-sidebar-label">{item.label}</span>
                      {item.badge && <span className="nav-badge">{item.badge}</span>}
                      <ChevronRight className="lrs-sidebar-arrow" />
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="lrs-sidebar-footer">
        <div className="lrs-sidebar-user">
          <span className="lrs-sidebar-user-icon">{userInitials}</span>
          <span className="lrs-sidebar-user-name">{userName}</span>
        </div>
        <button type="button" className="lrs-sidebar-logout" onClick={onLogout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}