import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Spinner from "../../components/Spinner";
import { AttachmentCount, LessonRow } from "../../components/lessons/LessonList";
import AdminLessonPanel from "./AdminLessonPanel";
import { CLASSROOM_LABELS, SESSION_LABELS, isOnline, lessonsLabel, sortByStart } from "../../utils/bookings";
import { formatDayKeyHeadingLatn, shiftDayKey, todayKeyLatn } from "../../utils/srLatnDates";

const ROOMS = [1, 2, 0];

/** Jedan dan centra: obe učionice i online časovi jedan pored drugog. */
export default function DayBoard({ now, teachers, teacherSelf, version, onChanged, onNotice }) {
  const [day, setDay] = useState(() => todayKeyLatn());
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const today = todayKeyLatn(new Date(now));
  const tomorrow = shiftDayKey(today, 1);

  useEffect(() => { setExpandedId(null); }, [day]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api.get(`/admin/bookings?status=confirmed&date_from=${day}&date_to=${day}`, { signal: controller.signal })
      .then((data) => setLessons(sortByStart(data.items || [])))
      .catch((err) => { if (!controller.signal.aborted) setError(err.message || "Raspored nije učitan."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [day, version]);

  const columns = ROOMS.map((room) => ({
    room,
    items: lessons.filter((lesson) => (room === 0 ? isOnline(lesson) : !isOnline(lesson) && lesson.classroom_number === room)),
  }));
  const online = columns[2].items.length;
  const mine = teacherSelf ? lessons.filter((lesson) => lesson.teacher_id === teacherSelf.id).length : 0;

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">{formatDayKeyHeadingLatn(day)}</h2>
        <p className="section-sub">
          {lessons.length ? `${lessonsLabel(lessons.length)} · ${lessons.length - online} uživo, ${online} online` : "Nema zakazanih časova."}
          {teacherSelf && lessons.length > 0 && ` · vaših: ${mine}`}
        </p>
      </div>
      <div className="day-nav" role="group" aria-label="Izbor dana">
        <button type="button" className="day-nav-arrow" onClick={() => setDay(shiftDayKey(day, -1))} aria-label="Prethodni dan"><ChevronLeft size={18} aria-hidden="true" /></button>
        <button type="button" aria-pressed={day === today} className={`filter-chip ${day === today ? "active" : ""}`} onClick={() => setDay(today)}>Danas</button>
        <button type="button" aria-pressed={day === tomorrow} className={`filter-chip ${day === tomorrow ? "active" : ""}`} onClick={() => setDay(tomorrow)}>Sutra</button>
        <button type="button" className="day-nav-arrow" onClick={() => setDay(shiftDayKey(day, 1))} aria-label="Sledeći dan"><ChevronRight size={18} aria-hidden="true" /></button>
        <input type="date" className="input input-date" value={day} onChange={(event) => event.target.value && setDay(event.target.value)} aria-label="Izaberi datum" />
      </div>
    </div>

    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    {loading ? <Spinner text="Učitavanje rasporeda…" /> : <div className="board-grid">
      {columns.map(({ room, items }) => {
        const minutes = items.reduce((sum, lesson) => sum + lesson.duration_minutes, 0);
        return <section key={room} className={`board-column ${room === 0 ? "is-online" : ""}`} aria-label={CLASSROOM_LABELS[room]}>
          <header>
            <h3>{CLASSROOM_LABELS[room]}</h3>
            <span>{items.length ? `${lessonsLabel(items.length)} · ${minutes} min` : room === 0 ? "nema" : "slobodna"}</span>
          </header>
          {items.length ? <ul className="lesson-list">
            {items.map((booking) => <LessonRow key={booking.id} variant="stacked" booking={booking} now={now}
              title={`${booking.subject_name} · ${booking.client_full_name}`}
              meta={[booking.teacher_name, `${booking.duration_minutes} min`, SESSION_LABELS[booking.session_type], booking.attachments?.length ? <AttachmentCount booking={booking} /> : null]}
              expanded={expandedId === booking.id}
              onToggle={() => setExpandedId((current) => (current === booking.id ? null : booking.id))}>
              <AdminLessonPanel booking={booking} now={now} teachers={teachers} onChanged={onChanged} onNotice={onNotice} />
            </LessonRow>)}
          </ul> : <p className="board-empty">Nema časova</p>}
        </section>;
      })}
    </div>}
  </div>;
}
