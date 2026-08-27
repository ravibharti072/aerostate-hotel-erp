import React from "react";
import { ArrowRight } from "lucide-react";
import styles from "./ModuleCard.module.css";

export default function ModuleCard({ title, Icon, onClick, colorTheme = "blue" }) {
  // Dynamically select colors based on the passed prop, defaulting to blue
  const bgClass = styles[`bg-${colorTheme}`] || styles["bg-blue"];
  const colorClass = styles[`color-${colorTheme}`] || styles["color-blue"];

  return (
    <div className={styles["module-card"]} onClick={onClick}>
      <div className={`${styles["icon-wrapper"]} ${bgClass}`}>
        {Icon && <Icon size={26} className={colorClass} />}
      </div>
      
      <div className={styles.content}>
        <h4>{title}</h4>
      </div>
      
      <ArrowRight size={20} className={styles.arrow} />
    </div>
  );
}