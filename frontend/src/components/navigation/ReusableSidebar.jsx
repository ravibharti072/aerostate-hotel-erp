import React, { useState, useEffect, useMemo } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, Search, LogOut, X } from "lucide-react";
import "./reusableSidebar.css";

const renderIcon = (Icon) => {
  if (!Icon) return null;
  if (React.isValidElement(Icon)) return Icon;
  if (typeof Icon === "function" || typeof Icon === "object") {
    const Component = Icon;
    return <Component size={18} />;
  }
  return null;
};

const NavItem = ({ item, currentPath, isSearching, onClose }) => {
  const hasChildren = Boolean(item.children && item.children.length > 0);

  const isChildActive = useMemo(() => {
    if (!hasChildren) return false;
    return item.children.some(
      (c) => currentPath === c.path || currentPath.startsWith(`${c.path}/`)
    );
  }, [hasChildren, item.children, currentPath]);

  const [isOpen, setIsOpen] = useState(isChildActive);

  useEffect(() => {
    if (isSearching && hasChildren) {
      setIsOpen(true);
    } else if (isChildActive) {
      setIsOpen(true);
    }
  }, [isSearching, isChildActive, hasChildren]);

  const toggleDropdown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  if (hasChildren) {
    return (
      <div className="rs-dropdown-group">
        <button
          type="button"
          className={`rs-item ${isOpen ? "is-open-parent" : ""} ${
            isChildActive && !isOpen ? "active" : ""
          }`}
          onClick={toggleDropdown}
          aria-expanded={isOpen}
        >
          {item.icon && (
            <span className="rs-item-icon">{renderIcon(item.icon)}</span>
          )}
          <span className="rs-item-label">{item.label}</span>
          <ChevronDown
            className={`rs-chevron ${isOpen ? "open" : ""}`}
            size={16}
          />
        </button>

        {isOpen && (
          <div className="rs-submenu">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end={child.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `rs-subitem ${isActive ? "active" : ""}`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.path}
      onClick={() => {
        if (item.onClick) item.onClick();
        if (onClose) onClose();
      }}
      className={({ isActive }) => `rs-item ${isActive ? "active" : ""}`}
    >
      {item.icon && (
        <span className="rs-item-icon">{renderIcon(item.icon)}</span>
      )}
      <span className="rs-item-label">{item.label}</span>
      {item.badge && <span className="rs-nav-badge">{item.badge}</span>}
    </NavLink>
  );
};

export default function ReusableSidebar({
  appTitle = "AeroState PMS",
  appVersion = "v1.0",
  appSubtitle = "Property Management System",
  logoImg,
  menuSections = [],
  userName = "Admin",
  userSubtitle = "",
  userInitials = "A",
  onLogout,
  showSearch = true,
  isOpen = true,
  onClose,
}) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return menuSections;
    const q = searchQuery.toLowerCase();

    return menuSections
      .map((sec) => {
        const filteredItems = (sec.items || [])
          .map((item) => {
            const matchesLabel = item.label?.toLowerCase().includes(q);
            if (item.children) {
              const matchedChildren = item.children.filter((child) =>
                child.label?.toLowerCase().includes(q)
              );
              if (matchesLabel || matchedChildren.length > 0) {
                return {
                  ...item,
                  children: matchesLabel ? item.children : matchedChildren,
                };
              }
              return null;
            }
            return matchesLabel ? item : null;
          })
          .filter(Boolean);

        if (filteredItems.length > 0) {
          return { ...sec, items: filteredItems };
        }
        return null;
      })
      .filter(Boolean);
  }, [menuSections, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <>
      {isOpen && onClose && <div className="rs-backdrop" onClick={onClose} />}

      <aside className={`rs-container ${isOpen ? "is-open" : ""}`}>
        {/* Brand / Logo Header */}
        <div className="rs-header">
          <div className="rs-header-content">
            <div className="rs-logo">
              {logoImg ? (
                <img src={logoImg} alt={appTitle} />
              ) : (
                <div className="rs-css-logo-grid">
                  <span className="rs-sq blue" />
                  <span className="rs-sq cyan" />
                  <span className="rs-sq navy" />
                  <span className="rs-sq teal" />
                </div>
              )}
            </div>

            <div className="rs-brand-details">
              <div className="rs-brand-header">
                <h2 className="rs-brand-name">{appTitle}</h2>
                {appVersion && (
                  <span className="rs-version-badge">{appVersion}</span>
                )}
              </div>
              {appSubtitle && <p className="rs-brand-sub">{appSubtitle}</p>}
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              className="rs-mobile-close"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search Bar with Gradient Dividers */}
        {showSearch && (
          <div className="rs-search-wrap">
            <div className="rs-search-divider-top" />
            <div className="rs-search-box">
              <Search className="rs-search-icon" size={16} />
              <input
                type="text"
                placeholder="Search modules, items, customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && (
                <X
                  size={16}
                  className="rs-search-clear"
                  onClick={() => setSearchQuery("")}
                />
              )}
            </div>
            <div className="rs-search-divider" />
          </div>
        )}

        {/* Nav Sections */}
        <nav className="rs-nav">
          {filteredSections.map((sec, idx) => (
            <div key={idx} className="rs-section-block">
              {idx > 0 && <div className="rs-section-divider" />}
              {sec.section && (
                <div className="rs-section-title">{sec.section}</div>
              )}
              {sec.items.map((item, itemIdx) => (
                <NavItem
                  key={item.label || item.path || itemIdx}
                  item={item}
                  currentPath={location.pathname}
                  isSearching={isSearching}
                  onClose={onClose}
                />
              ))}
            </div>
          ))}

          {isSearching && filteredSections.length === 0 && (
            <div className="rs-no-results">No modules match "{searchQuery}"</div>
          )}
        </nav>

        {/* Footer User Block */}
        <div className="rs-footer-divider" />
        <div className="rs-footer">
          <div className="rs-user-left">
            <div className="rs-avatar">{userInitials}</div>
            <div className="rs-user-info">
              <span className="rs-username">{userName}</span>
              {userSubtitle && (
                <span
                  className="rs-user-subtitle"
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    display: "block",
                    lineHeight: "1.2",
                    marginTop: "2px",
                    textTransform: "capitalize",
                  }}
                >
                  {userSubtitle}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="rs-logout-btn"
            onClick={onLogout}
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}