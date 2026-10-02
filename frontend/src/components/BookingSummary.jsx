import { useState } from "react";
import { BookOpen, CalendarDays, Check, ChevronDown, Clock3, GraduationCap, MapPin, Sparkles } from "lucide-react";
import BrandLogo from "./BrandLogo";

const icons = [BookOpen, GraduationCap, Clock3, MapPin, CalendarDays, Clock3];

export default function BookingSummary({ rows, step }) {
  const [expanded, setExpanded] = useState(false);
  const current = rows.slice(0, Math.min(step, rows.length)).filter(([, value]) => value).at(-1)?.[1];
  return <aside className={`booking-summary ${expanded ? "is-expanded" : ""}`} aria-label="Pregled izbora">
    <div className="booking-summary-top">
      <span className="booking-summary-emblem"><Sparkles size={20} aria-hidden="true" /></span>
      <div><p>Tvoj izbor</p><span>Jedno mesto za sve detalje.</span></div><strong>{String(step).padStart(2, "0")}<small>/08</small></strong>
    </div>
    <button type="button" className="booking-summary-toggle" aria-expanded={expanded} aria-controls="booking-summary-content" onClick={() => setExpanded((value) => !value)}>
      <span><strong>Tvoj izbor <small>{step}/8</small></strong><span>{current || "Izaberi predmet za početak"}</span></span><ChevronDown size={19} aria-hidden="true" />
    </button>
    <div className="booking-summary-progress" aria-hidden="true"><span style={{ width: `${step / 8 * 100}%` }} /></div>
    <div id="booking-summary-content" className="booking-summary-content">
      <dl>{rows.map(([label, value], index) => {
        const Icon = icons[index];
        return <div key={label} className={value ? "filled" : ""}>
          <span className="booking-summary-row-icon"><Icon size={17} strokeWidth={1.6} aria-hidden="true" /></span>
          <div><dt>{label}</dt><dd key={value || "empty"}>{value || "Još nije izabrano"}</dd></div>
          {value && <Check className="booking-summary-check" size={13} aria-hidden="true" />}
        </div>;
      })}</dl>
    </div>
    <div className="booking-summary-logo"><BrandLogo /></div>
  </aside>;
}
