import { motion } from "motion/react";
import "./ui.css";

/** Tab bar with a sliding highlight. `tabs`: [{ key, label, icon: LucideIcon, count? }]. */
export default function AnimatedTabs({ tabs, active, onChange, id = "tabs", className = "", buttonClassName = "" }) {
  return <div className={`animated-tabs ${className}`}>
    {tabs.map(({ key, label, icon: Icon, count }) => {
      const selected = key === active;
      return <button key={key} type="button" aria-pressed={selected} className={`animated-tab ${buttonClassName} ${selected ? "active" : ""}`} onClick={() => onChange(key)}>
        {selected && <motion.span layoutId={`${id}-pill`} className="animated-tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
        {Icon && <Icon size={17} strokeWidth={1.8} aria-hidden="true" />}
        <span>{label}</span>
        {typeof count === "number" && <em>{count}</em>}
      </button>;
    })}
  </div>;
}
