import { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import api from "../../services/api";
import LessonStatusBadge from "../LessonStatusBadge";
import { lessonState, timeRange } from "../../utils/bookings";

/** Naslov dana sa brojem časova i opcionim dodatkom desno (npr. dostupnost profesora). */
export function DayGroup({ label, count, aside, children }) {
  return <section className="day-group">
    <header className="day-heading">
      <h3>{label}</h3>
      {count && <span className="day-count">{count}</span>}
      {aside && <span className="day-aside">{aside}</span>}
    </header>
    {children}
  </section>;
}

/** Jedan čas u rasporedu. Klik na red otvara detalje i akcije ispod njega. */
export function LessonRow({ booking, now, title, meta = [], expanded = false, onToggle, children, variant }) {
  const panelId = `lesson-panel-${booking.id}`;
  return <li className={`lesson-row is-${lessonState(booking, now)} ${expanded ? "is-open" : ""} ${variant ? `lesson-row--${variant}` : ""}`}>
    <button type="button" className="lesson-row-head" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
      <span className="lesson-row-time">{timeRange(booking)}</span>
      <span className="lesson-row-main">
        <strong>{title}</strong>
        <span className="lesson-row-meta">{meta.filter(Boolean).map((item, index) => <span key={index}>{item}</span>)}</span>
      </span>
      <span className="lesson-row-side">
        <LessonStatusBadge booking={booking} now={now} />
        <ChevronDown size={18} className="lesson-row-chevron" aria-hidden="true" />
      </span>
    </button>
    {expanded && <div className="lesson-row-panel" id={panelId}>{children}</div>}
  </li>;
}

/** Činjenice o času kao lista naziv/vrednost; prazne vrednosti se preskaču. items: [[naziv, vrednost, široko?]] */
export function LessonFacts({ items }) {
  return <dl className="lesson-facts">
    {items.filter((item) => item && item[1] !== null && item[1] !== undefined && item[1] !== "").map(([label, value, wide]) => (
      <div key={label} className={wide ? "is-wide" : ""}><dt>{label}</dt><dd>{value}</dd></div>
    ))}
  </dl>;
}

/** Dugmad za preuzimanje priloga; `basePath` je "/teacher" ili "/admin". */
export function AttachmentButtons({ booking, basePath, onError }) {
  const [busyId, setBusyId] = useState(null);
  if (!booking.attachments?.length) return null;
  const download = async (attachment) => {
    setBusyId(attachment.id);
    try {
      await api.downloadBlob(`${basePath}/bookings/${booking.id}/attachments/${attachment.id}`, attachment.original_name || "prilog");
    } catch (err) {
      onError?.(err.message || "Preuzimanje priloga nije uspelo.");
    } finally {
      setBusyId(null);
    }
  };
  return <div className="lesson-attachments">
    {booking.attachments.map((attachment) => (
      <button key={attachment.id} type="button" className="btn btn-secondary btn-sm" disabled={busyId === attachment.id} onClick={() => download(attachment)}>
        <Paperclip size={13} aria-hidden="true" /> {busyId === attachment.id ? "Preuzimam…" : attachment.original_name}
      </button>
    ))}
  </div>;
}

/** "📎 2" u redu časa kada postoje prilozi. */
export function AttachmentCount({ booking }) {
  const count = booking.attachments?.length || 0;
  return count ? <><Paperclip size={13} aria-hidden="true" /> {count}</> : null;
}
