/** Zajednička pravila i nazivi za časove, isti u sva tri panela. */
import { dayKeyLatn, formatDayHeadingLatn, formatTimeLatn } from "./srLatnDates";

export const CATEGORY_LABELS = { osnovna: "Osnovna škola", srednja: "Srednja škola", faks: "Fakultet", drugo: "Drugo" };
export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
export const DELIVERY_LABELS = { online: "Online", in_person: "Uživo" };
export const SESSION_LABELS = { individual: "Individualni", group: "Grupni" };
export const CANCELLED_BY_LABELS = { client: "učenik", teacher: "profesor", admin: "administracija" };
// Isti nazivi kao u emailovima i u admin rasporedu (backend CLASSROOM_LABELS).
export const CLASSROOM_LABELS = { 0: "Online", 1: "Učionica 1 (velika)", 2: "Učionica 2 (mala)" };
export const CENTER_ADDRESS = "Bože Jankovića 49, Beograd";
export const CENTER_PHONE = { label: "064 546 7246", href: "tel:+381645467246" };
export const CENTER_EMAIL = "edukativni.centar.brainstorm@gmail.com";
export const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

export const startMs = (booking) => new Date(booking.start_time).getTime();
export const endMs = (booking) => new Date(booking.end_time).getTime();
export const isConfirmed = (booking) => booking.status === "confirmed";
/** Potvrđen čas koji još nije počeo. */
export const isUpcoming = (booking, now = Date.now()) => isConfirmed(booking) && startMs(booking) > now;
export const isInProgress = (booking, now = Date.now()) => isConfirmed(booking) && startMs(booking) <= now && endMs(booking) > now;
/** Održan = potvrđen čas koji se završio (računa se po kraju, ne po početku). */
export const isHeld = (booking, now = Date.now()) => isConfirmed(booking) && endMs(booking) <= now;
/** Predstojeći ili u toku: sve što učenik i profesor još imaju pred sobom. */
export const isAhead = (booking, now = Date.now()) => isConfirmed(booking) && endMs(booking) > now;

/** "upcoming" | "in_progress" | "held" | "cancelled" */
export function lessonState(booking, now = Date.now()) {
  if (!isConfirmed(booking)) return "cancelled";
  if (endMs(booking) <= now) return "held";
  if (startMs(booking) <= now) return "in_progress";
  return "upcoming";
}

/** Isti nazivi i boje statusa u sva tri panela (tipovi iz components/Badge). */
export const STATUS_BADGE = {
  upcoming: { type: "success", label: "Potvrđen" },
  in_progress: { type: "accent", label: "U toku" },
  held: { type: "default", label: "Održan" },
  cancelled: { type: "error", label: "Otkazan" },
};

/** Rok do kog učenik ili profesor mogu besplatno da otkažu (24h pre početka). */
export const cancelDeadline = (booking) => new Date(startMs(booking) - CANCEL_WINDOW_MS);
export const canCancel = (booking, now = Date.now()) => isConfirmed(booking) && startMs(booking) - now >= CANCEL_WINDOW_MS;

/** "Online", "Učionica 1 (velika)" ili "Učionica 2 (mala)". */
export function placeLabel(booking) {
  if (booking.delivery_mode === "online" || booking.classroom_number === 0) return CLASSROOM_LABELS[0];
  return CLASSROOM_LABELS[booking.classroom_number] || "Uživo";
}

// Podrazumevani razlozi koje backend upisuje kada razlog nije unet; ne prikazujemo ih kao razlog.
const DEFAULT_REASON = /^Otkazano od strane (klijenta|profesora|admina)$/;
/** Razlog otkazivanja koji je neko zaista napisao, ili null. */
export const writtenReason = (booking) => {
  const reason = (booking.cancellation_reason || "").trim();
  return reason && !DEFAULT_REASON.test(reason) ? reason : null;
};

export const isOnline = (booking) => booking.delivery_mode === "online" || booking.classroom_number === 0;

/** "10:00–11:30" */
export const timeRange = (booking) => `${formatTimeLatn(booking.start_time)}–${formatTimeLatn(booking.end_time)}`;

export const sortByStart = (items, direction = 1) => [...items].sort((a, b) => (startMs(a) - startMs(b)) * direction);

/** Grupiše časove po danu centra: [{ key: "YYYY-MM-DD", label: "Danas, sreda 8. oktobar", items }]. */
export function groupByDay(items) {
  const groups = new Map();
  for (const booking of items) {
    const key = dayKeyLatn(booking.start_time);
    if (!groups.has(key)) groups.set(key, { key, label: formatDayHeadingLatn(booking.start_time), items: [] });
    groups.get(key).items.push(booking);
  }
  return [...groups.values()];
}

/** Poruka o slanju emailova posle otkazivanja ili izmene, prema notification_delivery.status. */
export function deliveryNoticeFor(response, done) {
  const status = response?.notification_delivery?.status;
  const text = {
    sent: `${done} Email obaveštenja su poslata.`,
    partial: `${done} Deo email obaveštenja nije isporučen.`,
    failed: `${done} Email obaveštenja nisu poslata.`,
    captured: `${done} Slanje email obaveštenja još nije podešeno.`,
  }[status] || `${done} Slanje email obaveštenja nije potvrđeno.`;
  return { type: status === "sent" ? "success" : "warning", text };
}

export const cancelNoticeFor = (response, subject = "Čas") => deliveryNoticeFor(response, `${subject} je otkazan.`);

/** 1 čas, 2 časa, 5 časova. */
export function pluralLatn(count, one, few, many) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} ${one}`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export const lessonsLabel = (count) => pluralLatn(count, "čas", "časa", "časova");
