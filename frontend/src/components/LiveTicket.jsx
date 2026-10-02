import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, CalendarDays, Check, ChevronDown, Clock3, GraduationCap, MapPin, Timer, Wallet } from "lucide-react";
import BrandLogo from "./BrandLogo";
import "./LiveTicket.css";

const icons = [BookOpen, GraduationCap, Timer, MapPin, CalendarDays, Clock3];
const BARS = 34;

/** A boarding-pass style summary that "prints" itself as the visitor makes choices. */
export default function LiveTicket({ rows, step, totalSteps = 8, symbol = "✦", price }) {
  const [expanded, setExpanded] = useState(false);
  const filled = rows.filter(([, value]) => value).length;
  const ratio = filled / rows.length;
  const current = rows.slice(0, Math.min(step, rows.length)).filter(([, value]) => value).at(-1)?.[1];
  const circumference = 2 * Math.PI * 26;

  return <aside className={`booking-summary live-ticket ${expanded ? "is-expanded" : ""}`} aria-label="Pregled izbora" data-spotlight>
    <div className="live-ticket-head">
      <span className="live-ticket-symbol" aria-hidden="true"><AnimatePresence mode="popLayout"><motion.span key={symbol} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: -90, opacity: 0 }} transition={{ duration: .45 }}>{symbol}</motion.span></AnimatePresence></span>
      <div className="live-ticket-title"><small>Tvoja karta za čas</small><p>Tvoj izbor</p></div>
      <span className="live-ticket-ring" aria-hidden="true">
        <svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" className="live-ticket-ring-track" /><circle cx="30" cy="30" r="26" className="live-ticket-ring-fill" style={{ strokeDasharray: circumference, strokeDashoffset: circumference * (1 - step / totalSteps) }} /></svg>
        <strong>{String(step).padStart(2, "0")}<small>/{String(totalSteps).padStart(2, "0")}</small></strong>
      </span>
    </div>

    <button type="button" className="booking-summary-toggle" aria-expanded={expanded} aria-controls="booking-summary-content" onClick={() => setExpanded((value) => !value)}>
      <span><strong>Tvoj izbor <small>{step}/{totalSteps}</small></strong><span>{current || "Izaberi predmet za početak"}</span></span><ChevronDown size={19} aria-hidden="true" />
    </button>

    <div id="booking-summary-content" className="booking-summary-content">
      <dl>{rows.map(([label, value], index) => {
        const Icon = icons[index] || Check;
        return <div key={label} className={`live-ticket-row ${value ? "filled" : ""}`}>
          <span className="live-ticket-row-icon"><Icon size={16} strokeWidth={1.7} aria-hidden="true" /></span>
          <div>
            <dt>{label}</dt>
            <AnimatePresence mode="wait" initial={false}>
              <motion.dd key={value || "empty"} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .3 }}>
                {value || "Još nije izabrano"}
              </motion.dd>
            </AnimatePresence>
          </div>
          {value && <motion.span className="live-ticket-check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 16 }}><Check size={12} strokeWidth={3} aria-hidden="true" /></motion.span>}
        </div>;
      })}</dl>

      <div className="live-ticket-perforation" aria-hidden="true"><i /><span /><i /></div>

      <div className="live-ticket-price">
        <span><Wallet size={16} strokeWidth={1.7} aria-hidden="true" /> Okvirna cena</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.strong key={price || "none"} initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .85 }} transition={{ duration: .25 }}>{price || "—"}</motion.strong>
        </AnimatePresence>
      </div>

      <div className="live-ticket-barcode" aria-hidden="true">
        {Array.from({ length: BARS }, (_, index) => <i key={index} className={index / BARS < ratio ? "on" : ""} style={{ "--bar-w": `${1 + ((index * 7) % 4)}px`, "--d": `${index * 18}ms` }} />)}
      </div>
      <div className="booking-summary-logo live-ticket-logo"><BrandLogo /></div>
    </div>
  </aside>;
}
