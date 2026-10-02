import React from "react";
import "./moduleWriternHeader.css";

export default function ModuleWriternHeader({
  title,
  description,
  badgeCount,
  badgeLabel = "modules",
}) {
  const displayLabel =
    badgeCount === 1 && badgeLabel === "modules" ? "module" : badgeLabel;

  return (
    <div className="module-writern-header">
      <div>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>

      {badgeCount !== undefined && badgeCount !== null && (
        <div className="module-writern-badge">
          {badgeCount} {displayLabel}
        </div>
      )}
    </div>
  );
}