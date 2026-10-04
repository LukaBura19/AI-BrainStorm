import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Info } from "lucide-react";
import "./LiveTicket.css";

/** Running summary of the visitor's choices, filled in as they move through the steps. */
export default function LiveTicket({ rows, step, totalSteps = 8, price }) {
  const [expanded, setExpanded] = useState(false);
  const current = rows.slice(0, Math.min(step, rows.length)).filter(([, value]) => value).at(-1)?.[1];

  return <aside className={`booking-summary live-ticket ${expanded ? "is-expanded" : ""}`} aria-label="Pregled izbora">
    <div className="live-ticket-card">
      <div className="live-ticket-head">
        <p>Tvoj čas</p>
        <small>Pregled izbora</small>
      </div>

      <button type="button" className="booking-summary-toggle" aria-expanded={expanded} aria-controls="booking-summary-content" onClick={() => setExpanded((value) => !value)}>
        <span><strong>Tvoj izbor <small>{step}/{totalSteps}</small></strong><span>{current || "Izaberi predmet za početak"}</span></span><ChevronDown size={19} aria-hidden="true" />
      </button>

      <div id="booking-summary-content" className="booking-summary-content">
        <dl>{rows.map(([label, value]) => <div key={label} className={`live-ticket-row ${value ? "filled" : ""}`}>
          <dt>{label}</dt>
          <AnimatePresence mode="wait" initial={false}>
            <motion.dd key={value || "empty"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .22 }}>
              {value || "—"}
            </motion.dd>
          </AnimatePresence>
        </div>)}</dl>

        <div className="live-ticket-price">
          <span>Okvirna cena</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.strong key={price || "none"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .22 }}>{price || "—"}</motion.strong>
          </AnimatePresence>
        </div>
      </div>
    </div>

    <p className="live-ticket-note"><span aria-hidden="true"><Info size={14} strokeWidth={2.4} /></span>Besplatno otkazivanje do 24 sata pre časa. Potvrda stiže na email.</p>
    <Link to="/cenovnik" className="btn btn-accent live-ticket-pricing">Pogledaj cenovnik</Link>
  </aside>;
}
