import React from "react";
import "./ModuleWriternHeader.css";

export default function ModuleWriternHeader({ 
  title, 
  description, 
  badgeCount, 
  badgeLabel = "modules" 
}) {
  return (
    <div className="module-writern-header">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {badgeCount !== undefined && (
        <div className="module-writern-badge">
          {badgeCount} {badgeLabel}
        </div>
      )}
    </div>
  );
}