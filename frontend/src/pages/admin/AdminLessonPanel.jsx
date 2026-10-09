import { useEffect, useState } from "react";
import { ArrowRightLeft, X } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import InlineConfirm from "../../components/ui/InlineConfirm";
import { AttachmentButtons, LessonFacts } from "../../components/lessons/LessonList";
import {
  CANCELLED_BY_LABELS, CATEGORY_LABELS, SESSION_LABELS, cancelNoticeFor, deliveryNoticeFor, isAhead, isUpcoming,
  placeLabel, timeRange, writtenReason,
} from "../../utils/bookings";
import { dayKeyLatn, formatDayKeyShortLatn, formatTimeLatn, formatTimestampDateLatn, timeOptions, todayKeyLatn } from "../../utils/srLatnDates";

const START_TIMES = timeOptions("08:00", "21:30");
const DURATIONS = [45, 60, 90];
const shortDay = (iso) => formatDayKeyShortLatn(dayKeyLatn(iso));

/** Prebacivanje časa drugom profesoru, u drugi termin ili na drugo trajanje. Server proverava sva pravila. */
function ReassignForm({ booking, teachers, onDone, onClose }) {
  const currentDay = dayKeyLatn(booking.start_time);
  const currentTime = formatTimeLatn(booking.start_time);
  const eligible = teachers.filter((teacher) => teacher.id === booking.teacher_id
    || (teacher.is_active && teacher.is_approved && teacher.subjects?.some((subject) => subject.id === booking.subject_id)));
  const [teacherId, setTeacherId] = useState(String(booking.teacher_id));
  const [day, setDay] = useState(currentDay);
  const [time, setTime] = useState(currentTime);
  const [duration, setDuration] = useState(booking.duration_minutes);
  const [free, setFree] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const today = todayKeyLatn();
  const times = START_TIMES.includes(currentTime) ? START_TIMES : [...START_TIMES, currentTime].sort();
  const sameSlot = Number(teacherId) === booking.teacher_id && day === currentDay;

  // Slobodni počeci za izabranog profesora i dan (sopstveni termin časa se vodi kao zauzet).
  useEffect(() => {
    if (!teacherId || !day || day < today) { setFree([]); return undefined; }
    const controller = new AbortController();
    setFree(null);
    const params = new URLSearchParams({ teacher_id: teacherId, date: day, duration: String(duration), delivery_mode: booking.delivery_mode });
    api.get(`/public/available-slots?${params}`, { signal: controller.signal })
      .then((data) => setFree((data.slots || []).map((slot) => formatTimeLatn(slot.start_time))))
      .catch(() => { if (!controller.signal.aborted) setFree([]); });
    return () => controller.abort();
  }, [teacherId, day, duration, booking.delivery_mode, today]);

  const submit = async (event) => {
    event.preventDefault();
    const payload = {};
    if (Number(teacherId) !== booking.teacher_id) payload.teacher_id = Number(teacherId);
    if (day !== currentDay || time !== currentTime) payload.start_time = `${day}T${time}:00`;
    if (duration !== booking.duration_minutes) payload.duration = duration;
    if (!Object.keys(payload).length) { setError("Niste ništa promenili."); return; }
    setSaving(true);
    setError("");
    try {
      onDone(await api.patch(`/admin/bookings/${booking.id}/reassign`, payload));
    } catch (err) {
      setError(err.message || "Čas nije prebačen.");
    } finally {
      setSaving(false);
    }
  };

  return <form className="reassign-form" onSubmit={submit}>
    <p className="reassign-title">Prebaci čas #{booking.id}</p>
    <div className="reassign-grid">
      <div className="form-group">
        <label className="form-label" htmlFor={`reassign-teacher-${booking.id}`}>Profesor</label>
        <select id={`reassign-teacher-${booking.id}`} className="select" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
          {eligible.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}{teacher.id === booking.teacher_id ? " (sada)" : ""}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor={`reassign-day-${booking.id}`}>Datum</label>
        <input id={`reassign-day-${booking.id}`} type="date" className="input" min={today} value={day} onChange={(event) => event.target.value && setDay(event.target.value)} />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor={`reassign-time-${booking.id}`}>Početak</label>
        <select id={`reassign-time-${booking.id}`} className="select" value={time} onChange={(event) => setTime(event.target.value)}>
          {times.map((item) => <option key={item} value={item}>{item}{sameSlot && item === currentTime ? " (sada)" : free?.includes(item) ? " · slobodno" : ""}</option>)}
        </select>
      </div>
      <fieldset className="form-group reassign-duration">
        <legend className="form-label">Trajanje</legend>
        <div className="reassign-chips">
          {DURATIONS.map((value) => <button key={value} type="button" aria-pressed={duration === value} className={`filter-chip ${duration === value ? "active" : ""}`} onClick={() => setDuration(value)}>{value} min</button>)}
        </div>
      </fieldset>
    </div>
    <div className="reassign-free" aria-live="polite">
      {free === null ? "Proveravam slobodne termine…" : free.length ? <>
        <span>Slobodni počeci:</span>
        {free.slice(0, 24).map((item) => <button key={item} type="button" aria-pressed={time === item} className={`time-pill ${time === item ? "is-on" : ""}`} onClick={() => setTime(item)}>{item}</button>)}
      </> : <span>Izabrani profesor nema drugih slobodnih termina tog dana. Server će ipak proveriti izbor.</span>}
    </div>
    <p className="reassign-hint">Učenik, profesor i administracija dobijaju email sa novim detaljima.</p>
    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    <div className="lesson-actions">
      <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Odustani</button>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Prebacujem…" : "Sačuvaj izmenu"}</button>
    </div>
  </form>;
}

/** Detalji časa u admin panelu, sa otkazivanjem (bez roka od 24h) i prebacivanjem. */
export default function AdminLessonPanel({ booking, now, teachers, onChanged, onNotice }) {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const reason = writtenReason(booking);
  const started = new Date(booking.start_time).getTime() <= now;

  const cancel = async (text) => {
    setBusy(true);
    try {
      const response = await api.patch(`/admin/bookings/${booking.id}/cancel${text ? `?reason=${encodeURIComponent(text)}` : ""}`);
      onNotice(cancelNoticeFor(response, `Čas #${booking.id}`));
      setMode(null);
      onChanged();
    } catch (err) {
      onNotice({ type: "error", text: err.message || "Otkazivanje nije uspelo." });
    } finally {
      setBusy(false);
    }
  };

  const reassigned = (updated) => {
    onNotice(deliveryNoticeFor(updated, `Čas #${updated.id} je prebačen: ${updated.teacher_name}, ${shortDay(updated.start_time)} u ${formatTimeLatn(updated.start_time)}, ${placeLabel(updated)}.`));
    setMode(null);
    onChanged();
  };

  return <>
    <LessonFacts items={[
      ["Učenik", `${booking.client_full_name} · ${CATEGORY_LABELS[booking.client_category] || booking.client_category}`],
      ["Email", <a href={`mailto:${booking.client_email}`}>{booking.client_email}</a>],
      ["Profesor", booking.teacher_name],
      ["Termin", `${formatTimestampDateLatn(booking.start_time)} · ${timeRange(booking)} (${booking.duration_minutes} min)`],
      ["Mesto i vrsta", `${placeLabel(booking)} · ${SESSION_LABELS[booking.session_type] || booking.session_type}`],
      ["Rezervacija", `#${booking.id} · zakazano ${formatTimestampDateLatn(booking.created_at, true)}`],
      booking.client_note && ["Napomena učenika", booking.client_note, true],
      booking.status === "cancelled" && ["Otkazano", `Otkazao: ${CANCELLED_BY_LABELS[booking.cancelled_by] || "nepoznato"}${reason ? ` · „${reason}“` : ""}`, true],
    ]} />
    <AttachmentButtons booking={booking} basePath="/admin" onError={(text) => onNotice({ type: "error", text })} />
    {isAhead(booking, now) && mode === null && <div className="lesson-actions">
      {isUpcoming(booking, now) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("reassign")}><ArrowRightLeft size={15} aria-hidden="true" /> Prebaci čas</button>}
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setMode("cancel")}><X size={15} aria-hidden="true" /> {started ? "Otkaži (već počeo)" : "Otkaži čas"}</button>
    </div>}
    {mode === "cancel" && <InlineConfirm
      title={`Otkazati čas #${booking.id}: ${booking.subject_name}, ${booking.client_full_name}?`}
      description="Učenik i profesor odmah dobijaju email. Administracija može da otkaže čas i manje od 24 sata pre početka."
      withReason
      reasonPlaceholder="Razlog (opciono), šalje se učeniku i profesoru"
      busy={busy}
      onConfirm={cancel}
      onCancel={() => setMode(null)}
    />}
    {mode === "reassign" && <ReassignForm booking={booking} teachers={teachers} onDone={reassigned} onClose={() => setMode(null)} />}
  </>;
}
