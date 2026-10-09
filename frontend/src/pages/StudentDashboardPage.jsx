import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, Calculator, CalendarCheck, CalendarClock, CalendarPlus, CalendarX, Clock3, GraduationCap,
  History, MapPin, MessageSquareText, Paperclip, PencilLine, Phone, RotateCcw, Video,
} from "lucide-react";
import api from "../services/api";
import { endSession, isSignedInAs } from "../services/session";
import useNow from "../hooks/useNow";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import LessonStatusBadge from "../components/LessonStatusBadge";
import DashboardHero from "../components/ui/DashboardHero";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import InlineConfirm from "../components/ui/InlineConfirm";
import {
  CATEGORY_LABELS, CATEGORY_OPTIONS, CENTER_ADDRESS, CENTER_PHONE, DELIVERY_LABELS, SESSION_LABELS,
  canCancel, cancelDeadline, cancelNoticeFor, isAhead, isHeld, isInProgress, isOnline, placeLabel,
  sortByStart, timeRange, writtenReason,
} from "../utils/bookings";
import { dayKeyLatn, daysBetweenKeys, formatDayHeadingLatn, formatDayKeyShortLatn, formatTimeLatn, formatTimestampDateLatn, todayKeyLatn } from "../utils/srLatnDates";
import "./StudentDashboardPage.css";

const CANCELLED_BY = { client: "Otkazano na tvoj zahtev", teacher: "Otkazao profesor", admin: "Otkazao centar" };

const firstName = (fullName = "") => fullName.trim().split(/\s+/)[0] || fullName;
const shortDay = (iso) => formatDayKeyShortLatn(dayKeyLatn(iso));
const rebookLink = (booking) => `/booking?predmet=${booking.subject_id}&profesor=${booking.teacher_id}`;

/** "danas u 17:00", "sutra u 10:00", "za 3 dana", "uto 21. okt". */
function nextLessonLabel(booking, now) {
  if (!booking) return "nema";
  if (isInProgress(booking, now)) return `u toku do ${formatTimeLatn(booking.end_time)}`;
  const days = daysBetweenKeys(todayKeyLatn(new Date(now)), dayKeyLatn(booking.start_time));
  const time = formatTimeLatn(booking.start_time);
  if (days === 0) return `danas u ${time}`;
  if (days === 1) return `sutra u ${time}`;
  if (days > 1 && days < 7) return `za ${days} dana`;
  return shortDay(booking.start_time);
}

function deadlineText(booking) {
  const deadline = cancelDeadline(booking).toISOString();
  return `${shortDay(deadline)} u ${formatTimeLatn(deadline)}`;
}

/** Otkazivanje do roka, potvrda u kartici, ili objašnjenje kad je rok prošao. */
function CancelArea({ booking, now, open, busy, onOpen, onClose, onConfirm }) {
  if (!isAhead(booking, now) || !booking.client_cancel_token) return null;
  if (!canCancel(booking, now)) {
    return <p className="student-deadline is-late">
      <CalendarX size={15} aria-hidden="true" />
      <span>Rok za besplatno otkazivanje je istekao. Za izmene pozovi centar: <a href={CENTER_PHONE.href}>{CENTER_PHONE.label}</a>.</span>
    </p>;
  }
  return <>
    <p className="student-deadline"><Clock3 size={15} aria-hidden="true" /> Besplatno otkazivanje do {deadlineText(booking)}</p>
    {open ? <InlineConfirm
      title={`Otkazati čas: ${booking.subject_name}, ${shortDay(booking.start_time)} u ${formatTimeLatn(booking.start_time)}?`}
      description="Termin se odmah oslobađa, a profesor i centar dobijaju email."
      confirmLabel="Da, otkaži"
      cancelLabel="Ne, zadrži"
      withReason
      reasonPlaceholder="Razlog (opciono), vide ga profesor i centar"
      busy={busy}
      onConfirm={(reason) => onConfirm(booking, reason)}
      onCancel={onClose}
    /> : <button type="button" className="btn btn-danger btn-sm student-cancel-btn" onClick={() => onOpen(booking.id)}>Otkaži čas</button>}
  </>;
}

function LessonDetails({ booking }) {
  const reason = writtenReason(booking);
  return <details className="student-lesson-details">
    <summary>Detalji</summary>
    <dl>
      <div><dt>Vrsta časa</dt><dd>{DELIVERY_LABELS[booking.delivery_mode] || booking.delivery_mode} · {SESSION_LABELS[booking.session_type] || booking.session_type}</dd></div>
      <div><dt>Vreme</dt><dd>{timeRange(booking)} ({booking.duration_minutes} min)</dd></div>
      {booking.client_note && <div><dt>Tvoja napomena</dt><dd>{booking.client_note}</dd></div>}
      {booking.attachments?.length > 0 && <div><dt>Prilozi</dt><dd>{booking.attachments.map((item) => item.original_name).join(", ")}</dd></div>}
      {reason && <div><dt>Razlog otkazivanja</dt><dd>„{reason}“</dd></div>}
      <div><dt>Zakazano</dt><dd>{formatTimestampDateLatn(booking.created_at, true)}</dd></div>
    </dl>
  </details>;
}

/** Prvi predstojeći čas: sve što treba da znaš pre nego što dođeš. */
function NextLessonCard({ booking, now, cancel }) {
  const running = isInProgress(booking, now);
  const online = isOnline(booking);
  return <article className={`student-lesson student-lesson--next ${running ? "is-now" : ""}`} aria-labelledby="next-lesson-title">
    <p className="student-next-eyebrow">{running ? "Čas je u toku" : "Tvoj sledeći čas"} <LessonStatusBadge booking={booking} now={now} /></p>
    <h3 id="next-lesson-title">{formatDayHeadingLatn(booking.start_time)} <span>· {timeRange(booking)}</span></h3>
    <p className="student-next-subject">{booking.subject_name} <span>· {booking.duration_minutes} min · {SESSION_LABELS[booking.session_type] || "Individualni"}</span></p>
    <ul className="student-next-facts">
      <li><GraduationCap size={16} aria-hidden="true" /> Profesor {booking.teacher_name}</li>
      <li>{online ? <Video size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
        {online ? <span>Online · link za Google Meet šalje profesor pre časa</span> : <span>{placeLabel(booking)} · {CENTER_ADDRESS}</span>}
      </li>
      {booking.client_note && <li><MessageSquareText size={16} aria-hidden="true" /> <span>Tvoja napomena: {booking.client_note}</span></li>}
      {booking.attachments?.length > 0 && <li><Paperclip size={16} aria-hidden="true" /> <span>{booking.attachments.map((item) => item.original_name).join(", ")}</span></li>}
    </ul>
    <div className="student-next-actions"><CancelArea booking={booking} now={now} {...cancel} /></div>
  </article>;
}

function LessonCard({ booking, now, cancel }) {
  const cancelled = booking.status === "cancelled";
  const online = isOnline(booking);
  const reason = writtenReason(booking);
  const futureCancelled = cancelled && new Date(booking.start_time).getTime() > now;
  return <article className={`student-lesson ${cancelled ? "is-cancelled" : ""}`}>
    <div className="student-lesson-date">
      <strong>{formatTimeLatn(booking.start_time)}</strong>
      <span>{shortDay(booking.start_time)}</span>
    </div>
    <div className="student-lesson-body">
      <h3>{booking.subject_name} <LessonStatusBadge booking={booking} now={now} /></h3>
      <p>sa profesorom {booking.teacher_name} · {booking.duration_minutes} min</p>
      <p className="student-lesson-place">{online ? <Video size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}{placeLabel(booking)}</p>
      {cancelled && <p className="student-lesson-cancelled">{CANCELLED_BY[booking.cancelled_by] || "Otkazan"}{reason && <> · „{reason}“</>}</p>}
      <CancelArea booking={booking} now={now} {...cancel} />
      <LessonDetails booking={booking} />
    </div>
    {(isHeld(booking, now) || futureCancelled) && <div className="student-lesson-side">
      <Link className="btn btn-secondary btn-sm" to={rebookLink(booking)}><RotateCcw size={15} aria-hidden="true" /> {futureCancelled ? "Zakaži zamenu" : "Zakaži ponovo"}</Link>
    </div>}
  </article>;
}

/** Ime i nivo obrazovanja; nivo bira pripreme ispod i popunjava formu za zakazivanje. */
function ProfileEditor({ student, onSaved }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.full_name);
  const [category, setCategory] = useState(student.category || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const start = () => { setName(student.full_name); setCategory(student.category || ""); setError(""); setOpen(true); };
  const save = async (event) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError("Ime i prezime mora imati najmanje 2 karaktera."); return; }
    setSaving(true);
    setError("");
    try {
      onSaved(await api.patch("/student/me", { full_name: name.trim(), category: category || null }));
      setOpen(false);
    } catch (err) {
      setError(err.message || "Izmene nisu sačuvane.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <>
      {student.category
        ? <span className="dash-hero-chip">{CATEGORY_LABELS[student.category] || student.category}</span>
        : <button type="button" className="student-chip-add" onClick={start}>Dodaj nivo obrazovanja</button>}
      <button type="button" className="student-profile-edit" onClick={start}><PencilLine size={14} aria-hidden="true" /> Izmeni profil</button>
    </>;
  }
  return <form className="student-profile-form" onSubmit={save}>
    <div className="form-group">
      <label className="form-label" htmlFor="profile-name">Ime i prezime</label>
      <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required minLength={2} />
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor="profile-category">Nivo obrazovanja</label>
      <select id="profile-category" className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Nije izabran</option>
        {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
    <div className="student-profile-actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)} disabled={saving}>Odustani</button>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Čuvam…" : "Sačuvaj"}</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}

const PREP = [
  { exam: "mala-matura", for: "osnovna", title: "Mala matura", text: "Srpski i matematika po nivoima, sa snimcima rešenih zadataka.", icon: BookOpen },
  { exam: "velika-matura", for: "srednja", title: "Velika matura", text: "Matematika po oblastima za prijemne na PMF, ETF, FON i druge fakultete.", icon: Calculator },
];

function PrepSection({ category }) {
  return <section className="student-prep" aria-labelledby="prep-title">
    <header>
      <h2 id="prep-title">Pripremi se za maturu</h2>
      <p>Uz svaki snimak je asistent kome možeš da postaviš pitanje o zadatku.</p>
    </header>
    <div className="student-prep-grid">
      {PREP.map(({ exam, for: level, title, text, icon: Icon }) => {
        const recommended = category === level;
        return <Link key={exam} to={`/${exam}`} className={`student-prep-card ${recommended ? "is-recommended" : ""}`}>
          <span className="student-prep-icon"><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
          <span className="student-prep-copy">
            <strong>{title} {recommended && <em>Za tebe</em>}</strong>
            <span>{text}</span>
          </span>
          <ArrowRight size={18} className="student-prep-arrow" aria-hidden="true" />
        </Link>;
      })}
    </div>
  </section>;
}

const EMPTY = {
  ahead: { icon: CalendarPlus, text: "Još nemaš zakazanih časova." },
  held: { icon: History, text: "Još nema održanih časova." },
  cancelled: { icon: CalendarX, text: "Nema otkazanih časova." },
};

/** Učenički panel: sledeći čas, svi časovi zakazani sa naloga, otkazivanje i pripreme za maturu. */
export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [student, setStudent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("ahead");
  const [notice, setNotice] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const noticeRef = useRef(null);

  const logout = useCallback(() => {
    endSession();
    navigate("/ucenik/prijava");
  }, [navigate]);

  useEffect(() => {
    if (!isSignedInAs("student")) {
      navigate("/ucenik/prijava", { replace: true });
      return;
    }
    Promise.all([api.get("/student/me"), api.get("/student/bookings")])
      .then(([me, list]) => { setStudent(me); setBookings(list.items || []); })
      .catch((err) => {
        if (err.status === 401) {
          endSession();
          navigate("/ucenik/prijava?razlog=istekla", { replace: true });
        } else setError(err.message || "Greška pri učitavanju naloga.");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notice]);

  const cancelLesson = async (booking, reason) => {
    setCancellingId(booking.id);
    setNotice(null);
    try {
      const response = await api.post("/public/bookings/cancel", { token: booking.client_cancel_token, reason: reason || null });
      setBookings((items) => items.map((item) => (item.id === booking.id
        ? { ...item, status: "cancelled", cancelled_by: "client", cancellation_reason: reason || null }
        : item)));
      setNotice(cancelNoticeFor(response, "Čas"));
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Otkazivanje nije uspelo. Pokušaj ponovo." });
    } finally {
      setCancellingId(null);
      setConfirmId(null);
    }
  };

  if (loading) return <Spinner size="lg" text="Učitavanje naloga…" />;
  if (error) return <div className="student-dashboard"><Alert type="error">{error}</Alert></div>;

  const ahead = sortByStart(bookings.filter((item) => isAhead(item, now)));
  const held = sortByStart(bookings.filter((item) => isHeld(item, now)), -1);
  const cancelled = sortByStart(bookings.filter((item) => item.status === "cancelled"), -1);
  const lists = { ahead, held, cancelled };
  const next = ahead[0];
  const cancel = {
    onOpen: setConfirmId,
    onClose: () => setConfirmId(null),
    onConfirm: cancelLesson,
  };
  const cancelFor = (booking) => ({ ...cancel, open: confirmId === booking.id, busy: cancellingId === booking.id });
  const empty = EMPTY[tab];
  const EmptyIcon = empty.icon;

  return (
    <div className="student-dashboard dash-page">
      <DashboardHero
        name={student?.full_name}
        title={<>Zdravo, <span className="fx-gradient-text">{firstName(student?.full_name)}</span></>}
        role="Učenik"
        onLogout={logout}
        actions={<Link to="/booking" className="btn btn-primary btn-sm"><CalendarPlus size={15} aria-hidden="true" /> Zakaži čas</Link>}
        aside={<div className="dash-hero-meta"><span>{student?.email}</span><ProfileEditor student={student} onSaved={setStudent} /></div>}
        stats={[
          { label: "Sledeći čas", value: <span className="dash-stat-text">{nextLessonLabel(next, now)}</span>, icon: CalendarClock, tone: "pink", hint: next ? `${next.subject_name} · ${next.teacher_name}` : "zakaži kad ti odgovara" },
          { label: "Predstojeći časovi", value: ahead.length, icon: CalendarCheck, tone: "violet" },
          { label: "Održani časovi", value: held.length, icon: History, tone: "mint" },
        ]}
      />

      <div ref={noticeRef}>{notice && <Alert type={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert>}</div>

      <AnimatedTabs
        id="student-tabs"
        className="dashboard-tabs"
        active={tab}
        onChange={(key) => { setTab(key); setConfirmId(null); }}
        tabs={[
          { key: "ahead", label: "Predstojeći", icon: CalendarCheck, count: ahead.length },
          { key: "held", label: "Održani", icon: History, count: held.length },
          { key: "cancelled", label: "Otkazani", icon: CalendarX, count: cancelled.length },
        ]}
      />

      <section className="student-lessons-section" aria-live="polite">
        {lists[tab].length === 0 ? (
          <div className="student-empty">
            <span className="empty-state-icon"><EmptyIcon size={28} strokeWidth={1.5} aria-hidden="true" /></span>
            <p>{empty.text}</p>
            {tab === "ahead" && <>
              <Link to="/booking" className="btn btn-primary">{bookings.length ? "Zakaži čas" : "Zakaži prvi čas"}</Link>
              <small>Ovde se vide časovi zakazani sa ovog naloga. Za časove zakazane bez prijave potvrda stiže samo emailom.</small>
            </>}
          </div>
        ) : (
          <div className="student-lessons">
            {lists[tab].map((booking, index) => (tab === "ahead" && index === 0
              ? <NextLessonCard key={booking.id} booking={booking} now={now} cancel={cancelFor(booking)} />
              : <LessonCard key={booking.id} booking={booking} now={now} cancel={cancelFor(booking)} />))}
          </div>
        )}
      </section>

      <PrepSection category={student?.category} />

      <p className="student-help"><Phone size={14} aria-hidden="true" /> <span>Pitanje o času ili terminu? Pozovi centar na <a href={CENTER_PHONE.href}>{CENTER_PHONE.label}</a>.</span></p>
    </div>
  );
}
