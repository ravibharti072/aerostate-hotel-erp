// src/components/StatCard.jsx
import React from "react";
import styles from "./StatCard.module.css";

export default function StatCard({ title, value, Icon, colorTheme = "blue" }) {
  // Dynamically assign color classes based on the passed prop
  const bgClass = styles[`bg-light-${colorTheme}`] || styles["bg-light-blue"];
  const colorClass = styles[`color-${colorTheme}`] || styles["color-blue"];

  return (
    <div className={styles["stat-card"]}>
      <div className={`${styles["stat-icon-wrapper"]} ${bgClass}`}>
        {/* Render the icon dynamically if passed */}
        {Icon && <Icon size={22} className={colorClass} />}
      </div>
      <div className={styles["stat-info"]}>
        <p>{title}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}