import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, BookOpen, CalendarClock, CalendarDays, CalendarPlus, CalendarRange, ChevronDown, ClipboardList, Clock3,
  Inbox, ShieldCheck, Trash2, X,
} from "lucide-react";
import api from "../services/api";
import { endSession, getSession, isSignedInAs, switchRole } from "../services/session";
import useNow from "../hooks/useNow";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import DashboardHero from "../components/ui/DashboardHero";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import InlineConfirm from "../components/ui/InlineConfirm";
import { AttachmentButtons, AttachmentCount, DayGroup, LessonFacts, LessonRow } from "../components/lessons/LessonList";
import {
  CANCELLED_BY_LABELS, CATEGORY_LABELS, SESSION_LABELS, canCancel, cancelDeadline, cancelNoticeFor,
  groupByDay, isAhead, isConfirmed, isInProgress, lessonsLabel, placeLabel, sortByStart, timeRange, writtenReason,
} from "../utils/bookings";
import {
  APP_TIME_ZONE, dayKeyLatn, formatDayHeadingLatn, formatDayKeyHeadingLatn, formatDayKeyShortLatn, formatTimeLatn,
  formatTimestampDateLatn, getBookingDatesIncludingToday, shiftDayKey, timeOptions, todayKeyLatn,
} from "../utils/srLatnDates";
import "./TeacherDashboardPage.css";

const SCHEDULE_DAYS = 7;
const WEEKDAYS = ["pon", "uto", "sre", "čet", "pet", "sub", "ned"];
const AVAILABILITY_DAYS = 28;
const MIN_RANGE_MINUTES = 45;
const START_TIMES = timeOptions("08:00", "21:30");
const END_TIMES = timeOptions("08:30", "22:30");
const PRESETS = [
  { label: "Prepodne", hint: "08–14", start: "08:00", end: "14:00" },
  { label: "Popodne", hint: "14–20", start: "14:00", end: "20:00" },
  { label: "Ceo dan", hint: "08–20", start: "08:00", end: "20:00" },
];
const FILTERS = [
  { key: "ahead", label: "Predstojeći", empty: "Nemate predstojećih časova." },
  { key: "held", label: "Održani", empty: "Još nema održanih časova." },
  { key: "cancelled", label: "Otkazani", empty: "Nema otkazanih časova." },
];

const toMinutes = (time) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };
const mergeById = (...lists) => [...new Map(lists.flat().map((item) => [item.id, item])).values()];
const overlaps = (lesson, range) => new Date(lesson.start_time) < new Date(range.end_time) && new Date(lesson.end_time) > new Date(range.start_time);
const rangeLabel = (range) => `${formatTimeLatn(range.start_time)}–${formatTimeLatn(range.end_time)}`;
const firstName = (name = "") => name.trim().split(/\s+/)[0] || name;
const shortDay = (iso) => formatDayKeyShortLatn(dayKeyLatn(iso));

function nowMinutesInCenter() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type) => Number(parts.find((part) => part.type === type)?.value);
  return value("hour") * 60 + value("minute");
}

/* -------------------------------------------------------------------------- */
/*  Detalji časa i otkazivanje                                                 */
/* -------------------------------------------------------------------------- */

function TeacherLessonPanel({ booking, now, confirmOpen, busy, onAskCancel, onCloseCancel, onCancel, onError }) {
  const reason = writtenReason(booking);
  const deadline = cancelDeadline(booking).toISOString();
  return <>
    <LessonFacts items={[
      ["Učenik", `${booking.client_full_name} · ${CATEGORY_LABELS[booking.client_category] || booking.client_category}`],
      ["Email", <a href={`mailto:${booking.client_email}`}>{booking.client_email}</a>],
      ["Termin", `${formatTimestampDateLatn(booking.start_time)} · ${timeRange(booking)}`],
      ["Mesto i vrsta", `${placeLabel(booking)} · ${SESSION_LABELS[booking.session_type] || booking.session_type}`],
      booking.client_note && ["Napomena učenika", booking.client_note, true],
      booking.status === "cancelled" && ["Otkazano", `Otkazao: ${CANCELLED_BY_LABELS[booking.cancelled_by] || "nepoznato"}${reason ? ` · „${reason}“` : ""}`, true],
      ["Zakazano", formatTimestampDateLatn(booking.created_at, true)],
    ]} />
    <AttachmentButtons booking={booking} basePath="/teacher" onError={onError} />
    {isAhead(booking, now) && !isInProgress(booking, now) && (canCancel(booking, now)
      ? (confirmOpen
        ? <InlineConfirm
          title={`Otkazati čas sa ${booking.client_full_name}, ${shortDay(booking.start_time)} u ${formatTimeLatn(booking.start_time)}?`}
          description="Učenik i administracija odmah dobijaju email o otkazivanju."
          withReason
          reasonPlaceholder="Razlog (opciono), šalje se učeniku i administraciji"
          busy={busy}
          onConfirm={(text) => onCancel(booking, text)}
          onCancel={onCloseCancel}
        />
        : <div className="lesson-actions"><button type="button" className="btn btn-danger btn-sm" onClick={() => onAskCancel(booking.id)}><X size={15} aria-hidden="true" /> Otkaži čas</button></div>)
      : <p className="lesson-deadline"><AlertTriangle size={15} aria-hidden="true" /> Rok za otkazivanje je istekao ({shortDay(deadline)} u {formatTimeLatn(deadline)}). Za izmenu se javite administraciji.</p>)}
  </>;
}

function lessonMeta(booking) {
  return [
    `${booking.duration_minutes} min`,
    placeLabel(booking),
    SESSION_LABELS[booking.session_type],
    booking.attachments?.length ? <AttachmentCount booking={booking} /> : null,
    booking.client_note ? <span className="lesson-note-preview">„{booking.client_note}“</span> : null,
  ];
}

/* -------------------------------------------------------------------------- */
/*  Dostupnost: više dana odjednom, prečice i pregled zakazanih unutar bloka   */
/* -------------------------------------------------------------------------- */

function AvailabilityTab({ availabilities, lessons, preset, onChanged }) {
  const dates = useMemo(() => getBookingDatesIncludingToday(AVAILABILITY_DAYS), []);
  const [selected, setSelected] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [listError, setListError] = useState("");
  const [showExisting, setShowExisting] = useState(false);

  useEffect(() => {
    if (preset?.dates?.length) { setSelected(preset.dates); setResult(null); }
  }, [preset]);

  const todayKey = dates[0]?.value;
  const onlyToday = selected.length === 1 && selected[0] === todayKey;
  const startTimes = onlyToday ? START_TIMES.filter((time) => toMinutes(time) > nowMinutesInCenter()) : START_TIMES;
  const endTimes = startTime ? END_TIMES.filter((time) => toMinutes(time) >= toMinutes(startTime) + MIN_RANGE_MINUTES) : [];
  const sortedSelected = [...selected].sort();

  const toggleDate = (value) => {
    setResult(null);
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };
  const applyPreset = (item) => { setStartTime(item.start); setEndTime(item.end); setResult(null); };

  const add = async () => {
    setAdding(true);
    setResult(null);
    const failures = [];
    let added = 0;
    // Redom, jer backend zaključava raspoloživost profesora po zahtevu.
    for (const date of sortedSelected) {
      try {
        await api.post("/teacher/availabilities", { start_time: `${date}T${startTime}:00`, end_time: `${date}T${endTime}:00` });
        added += 1;
      } catch (err) {
        failures.push({ date, message: err.message || "Termin nije dodat." });
      }
    }
    setResult({ added, total: sortedSelected.length, failures, range: `${startTime}–${endTime}` });
    if (added) {
      setSelected(failures.map((item) => item.date));
      await onChanged();
    }
    setAdding(false);
  };

  const remove = async (range) => {
    setDeletingId(range.id);
    setListError("");
    try {
      await api.delete(`/teacher/availabilities/${range.id}`);
      setConfirmId(null);
      await onChanged();
    } catch (err) {
      setListError(err.message || "Termin nije uklonjen.");
    } finally {
      setDeletingId(null);
    }
  };

  const groups = groupByDay(sortByStart(availabilities));

  // Kalendar i koraci su u uskoj koloni na sredini kartice; postojeći termini se otvaraju po potrebi.
  return <div className="section-card avail-card">
    <div className="section-header">
      <h2 className="section-title">Dodaj slobodne termine</h2>
      <p className="section-desc">Izaberite jedan ili više dana i vreme. Učenici zakazuju časove samo unutar vaše dostupnosti.</p>
    </div>

    <div className="avail-step">
      <div className="avail-step-label">
        <span className="avail-step-num">1</span> Dani
        {selected.length > 0 && <span className="avail-step-extra">Izabrano: {selected.length} · <button type="button" className="text-button" onClick={() => setSelected([])}>Poništi</button></span>}
      </div>
      <div className="avail-calendar" role="group" aria-label="Izaberite dane">
        {WEEKDAYS.map((day) => <span key={day} className="avail-calendar-head" aria-hidden="true">{day}</span>)}
        {Array.from({ length: Math.max(0, WEEKDAYS.indexOf(dates[0]?.weekday)) }, (_, index) => <span key={`pad-${index}`} aria-hidden="true" />)}
        {dates.map((date) => {
          const on = selected.includes(date.value);
          const weekend = date.weekday === "sub" || date.weekday === "ned";
          return <button key={date.value} type="button" aria-pressed={on} className={`date-chip ${on ? "selected" : ""} ${date.isToday ? "today" : ""} ${weekend ? "is-weekend" : ""}`} onClick={() => toggleDate(date.value)}
            aria-label={`${date.weekdayLong}, ${date.day}. ${date.month}${date.isToday ? ", danas" : ""}`}>
            <span className="date-chip-num">{date.day}</span>
            <span className="date-chip-month">{date.isToday ? "danas" : date.month}</span>
          </button>;
        })}
      </div>
    </div>

    {selected.length > 0 && <div className="avail-step">
      <div className="avail-step-label"><span className="avail-step-num">2</span> Vreme</div>
      <div className="avail-presets" role="group" aria-label="Brzi izbor vremena">
        {PRESETS.map((item) => {
          const on = startTime === item.start && endTime === item.end;
          return <button key={item.label} type="button" aria-pressed={on} className={`filter-chip ${on ? "active" : ""}`} onClick={() => applyPreset(item)}>{item.label} <em>{item.hint}</em></button>;
        })}
      </div>
      <p className="avail-sub">Početak</p>
      <div className="time-grid" role="group" aria-label="Početno vreme">
        {startTimes.map((time) => <button key={time} type="button" aria-pressed={startTime === time} className={`time-chip ${startTime === time ? "selected" : ""}`} onClick={() => { setStartTime(time); if (endTime && toMinutes(endTime) < toMinutes(time) + MIN_RANGE_MINUTES) setEndTime(""); }}>{time}</button>)}
        {startTimes.length === 0 && <p className="empty-text">Za danas više nema početnih vremena. Izaberite drugi dan.</p>}
      </div>
      {startTime && <>
        <p className="avail-sub">Kraj</p>
        <div className="time-grid" role="group" aria-label="Završno vreme">
          {endTimes.map((time) => <button key={time} type="button" aria-pressed={endTime === time} className={`time-chip ${endTime === time ? "selected" : ""}`} onClick={() => setEndTime(time)}>{time}</button>)}
        </div>
      </>}
    </div>}

    {sortedSelected.length > 0 && startTime && endTime && <div className="avail-summary">
      <div className="avail-summary-text">
        <span className="avail-summary-icon"><CalendarPlus size={18} aria-hidden="true" /></span>
        <span>
          <strong>{sortedSelected.length === 1 ? formatDayKeyHeadingLatn(sortedSelected[0]) : `${sortedSelected.length} dana · ${startTime}–${endTime}`}</strong>
          <br />
          {sortedSelected.length === 1 ? `${startTime}–${endTime}` : sortedSelected.map(formatDayKeyShortLatn).join(", ")}
        </span>
      </div>
      <button type="button" className="btn btn-primary btn-add-avail" onClick={add} disabled={adding}>{adding ? "Dodajem…" : "Dodaj dostupnost"}</button>
    </div>}

    {result && (result.failures.length === 0
      ? <Alert type="success" onClose={() => setResult(null)}>Dostupnost {result.range} je dodata za {result.added === 1 ? "1 dan" : `${result.added} dana`}.</Alert>
      : <Alert type={result.added ? "warning" : "error"} onClose={() => setResult(null)}>
        Dodato {result.added} od {result.total}.
        <ul className="avail-failures">{result.failures.map((item) => <li key={item.date}><strong>{formatDayKeyShortLatn(item.date)}:</strong> {item.message}</li>)}</ul>
      </Alert>)}

    <div className="avail-existing">
      <button type="button" className={`filter-chip avail-toggle ${showExisting ? "active" : ""}`} aria-expanded={showExisting} aria-controls="avail-existing-list" onClick={() => setShowExisting((open) => !open)}>
        <CalendarRange size={16} aria-hidden="true" /> Vaši slobodni termini <em>{availabilities.length}</em>
        <ChevronDown size={16} className="avail-toggle-chevron" aria-hidden="true" />
      </button>
      {showExisting && <div id="avail-existing-list" className="avail-existing-list">
        <p className="avail-existing-hint">Periodi u kojima učenici mogu da zakažu čas kod vas. Uklonite period kada više niste dostupni; već zakazani časovi ostaju.</p>
        {listError && <Alert type="error" onClose={() => setListError("")}>{listError}</Alert>}
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Inbox size={30} strokeWidth={1.5} aria-hidden="true" /></div>
            <p>Nemate otvorenih termina. Dodajte dostupnost iznad.</p>
          </div>
        ) : groups.map((group) => (
          <DayGroup key={group.key} label={group.label}>
            <ul className="avail-blocks">
              {group.items.map((range) => {
                const booked = sortByStart(lessons.filter((lesson) => isConfirmed(lesson) && overlaps(lesson, range)));
                return <li key={range.id} className="avail-block">
                  <div className="avail-block-row">
                    <span className="avail-block-time">{rangeLabel(range)}</span>
                    <span className="avail-block-booked">
                      {booked.length ? <>Zakazano: {lessonsLabel(booked.length)} · {booked.map((lesson) => `${formatTimeLatn(lesson.start_time)} ${firstName(lesson.client_full_name)}`).join(", ")}</> : "Još nema zakazanih časova"}
                    </span>
                    {confirmId !== range.id && <button type="button" className="avail-block-close" onClick={() => setConfirmId(range.id)} aria-label={`Ukloni slobodan termin ${group.label}, ${rangeLabel(range)}`}><Trash2 size={15} aria-hidden="true" /> Ukloni termin</button>}
                  </div>
                  {confirmId === range.id && <InlineConfirm
                    title={`Ukloniti slobodan termin ${rangeLabel(range)}?`}
                    description={booked.length ? `Učenici više neće moći da zakažu nove časove u tom periodu. Već zakazani časovi (${booked.length}) ostaju i ne otkazuju se.` : "Učenici više neće moći da zakažu čas u tom periodu."}
                    confirmLabel="Ukloni termin"
                    cancelLabel="Odustani"
                    busy={deletingId === range.id}
                    onConfirm={() => remove(range)}
                    onCancel={() => setConfirmId(null)}
                  />}
                </li>;
              })}
            </ul>
          </DayGroup>
        ))}
      </div>}
    </div>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*  Stranica                                                                   */
/* -------------------------------------------------------------------------- */

function TeacherDashboardPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upcoming, setUpcoming] = useState([]);
  const [week, setWeek] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [tab, setTab] = useState("schedule");
  const [filter, setFilter] = useState("ahead");
  const [filterItems, setFilterItems] = useState([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [availabilityPreset, setAvailabilityPreset] = useState(null);
  const noticeRef = useRef(null);
  const linkedAdmin = Boolean(getSession()?.linked?.admin);

  const loadLessons = useCallback(async () => {
    const today = todayKeyLatn();
    const [ahead, days] = await Promise.all([
      api.get("/teacher/bookings?status=confirmed&upcoming_only=true"),
      api.get(`/teacher/bookings?status=confirmed&date_from=${today}&date_to=${shiftDayKey(today, SCHEDULE_DAYS - 1)}`),
    ]);
    setUpcoming(ahead.items || []);
    setWeek(days.items || []);
  }, []);

  const loadAvailabilities = useCallback(async () => {
    const data = await api.get(`/teacher/availabilities?from_date=${encodeURIComponent(new Date().toISOString())}`);
    setAvailabilities(data.items || []);
  }, []);

  useEffect(() => {
    if (!isSignedInAs("teacher")) {
      navigate("/teacher/login", { replace: true });
      return;
    }
    (async () => {
      try {
        setTeacher(await api.get("/teacher/me"));
        await Promise.all([loadLessons(), loadAvailabilities()]);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          endSession();
          navigate("/teacher/login", { replace: true });
          return;
        }
        setError(err.message || "Greška pri učitavanju panela.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, loadLessons, loadAvailabilities]);

  // Održani i otkazani se učitavaju tek kada ih profesor otvori.
  useEffect(() => {
    if (!teacher || tab !== "lessons" || filter === "ahead") return undefined;
    const controller = new AbortController();
    setFilterLoading(true);
    setFilterError("");
    const url = filter === "held" ? `/teacher/bookings?status=confirmed&date_to=${todayKeyLatn()}` : "/teacher/bookings?status=cancelled";
    api.get(url, { signal: controller.signal })
      .then((data) => setFilterItems(data.items || []))
      .catch((err) => { if (!controller.signal.aborted) setFilterError(err.message || "Greška pri učitavanju časova."); })
      .finally(() => { if (!controller.signal.aborted) setFilterLoading(false); });
    return () => controller.abort();
  }, [teacher, tab, filter, reloadKey]);

  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notice]);

  const toggle = (id) => { setExpandedId((current) => (current === id ? null : id)); setConfirmCancelId(null); };

  const cancelLesson = async (booking, reason) => {
    setCancellingId(booking.id);
    setNotice(null);
    try {
      const response = await api.patch(`/teacher/bookings/${booking.id}/cancel${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`);
      setNotice(cancelNoticeFor(response, "Čas"));
      setConfirmCancelId(null);
      setExpandedId(null);
      await loadLessons();
      setReloadKey((key) => key + 1);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Otkazivanje nije uspelo." });
    } finally {
      setCancellingId(null);
    }
  };

  const handleLogout = () => {
    endSession();
    navigate("/teacher/login");
  };

  const openAdmin = () => {
    if (switchRole("admin")) navigate("/admin/dashboard");
  };

  const openAvailabilityFor = (dayKey) => {
    setAvailabilityPreset({ dates: [dayKey] });
    setTab("availability");
  };

  if (loading) return <Spinner size="lg" text="Učitavanje panela…" />;
  if (error) return <div className="teacher-dashboard"><Alert type="error">{error}</Alert></div>;

  const known = mergeById(week, upcoming);
  const ahead = sortByStart(known.filter((lesson) => isAhead(lesson, now)));
  const next = ahead[0];
  const todayKey = todayKeyLatn(new Date(now));
  const today = week.filter((lesson) => dayKeyLatn(lesson.start_time) === todayKey);
  const todayLeft = today.filter((lesson) => isAhead(lesson, now)).length;
  const weekHours = Math.round(week.reduce((sum, lesson) => sum + lesson.duration_minutes, 0) / 6) / 10;
  const openMinutes = availabilities.reduce((sum, range) => sum + Math.max(0, new Date(range.end_time) - Math.max(new Date(range.start_time).getTime(), now)), 0) / 6e4;
  const aheadMinutes = ahead.reduce((sum, lesson) => sum + Math.max(0, new Date(lesson.end_time) - Math.max(new Date(lesson.start_time).getTime(), now)), 0) / 6e4;
  const freeHours = Math.max(0, Math.round((openMinutes - aheadMinutes) / 60));

  const rowProps = (booking) => ({
    booking,
    now,
    title: `${booking.subject_name} · ${booking.client_full_name}`,
    meta: lessonMeta(booking),
    expanded: expandedId === booking.id,
    onToggle: () => toggle(booking.id),
  });
  const panelProps = (booking) => ({
    booking,
    now,
    confirmOpen: confirmCancelId === booking.id,
    busy: cancellingId === booking.id,
    onAskCancel: setConfirmCancelId,
    onCloseCancel: () => setConfirmCancelId(null),
    onCancel: cancelLesson,
    onError: (text) => setNotice({ type: "error", text }),
  });

  const scheduleDays = Array.from({ length: SCHEDULE_DAYS }, (_, index) => {
    const key = shiftDayKey(todayKey, index);
    return {
      key,
      lessons: sortByStart(week.filter((lesson) => dayKeyLatn(lesson.start_time) === key)),
      ranges: sortByStart(availabilities.filter((range) => dayKeyLatn(range.start_time) === key)),
    };
  });

  const filterList = filter === "ahead" ? ahead : sortByStart(filter === "held" ? filterItems.filter((lesson) => new Date(lesson.end_time).getTime() <= now) : filterItems, -1);
  const activeFilter = FILTERS.find((item) => item.key === filter);

  return (
    <div className="teacher-dashboard dash-page">
      <DashboardHero
        name={teacher.full_name}
        role="Profesor"
        onLogout={handleLogout}
        actions={linkedAdmin && <button type="button" className="btn btn-secondary btn-sm" onClick={openAdmin}><ShieldCheck size={15} aria-hidden="true" /> Admin panel</button>}
        aside={<>
          <div className="dash-hero-meta">
            <span>{teacher.email}</span>
            {teacher.subjects?.length > 0
              ? teacher.subjects.map((subject) => <span key={subject.id} className="dash-hero-chip"><BookOpen size={13} aria-hidden="true" /> {subject.name}</span>)
              : <span className="empty-text">Nemate dodeljenih predmeta. Kontaktirajte administratora.</span>}
          </div>
          {next && <p className="dash-hero-next"><i aria-hidden="true" />
            {isInProgress(next, now)
              ? <>U toku do <b>{formatTimeLatn(next.end_time)}</b></>
              : <>Sledeći čas: <b>{formatDayHeadingLatn(next.start_time)} u {formatTimeLatn(next.start_time)}</b></>}
            {" "}· {next.subject_name} · {next.client_full_name} · {placeLabel(next)}
          </p>}
        </>}
        stats={[
          { label: "Danas", value: today.length, icon: CalendarClock, tone: "pink", hint: today.length ? (todayLeft ? `još ${todayLeft} predstoji` : "svi su održani") : "slobodan dan" },
          { label: "Narednih 7 dana", value: week.length, icon: CalendarRange, tone: "violet", hint: `${String(weekHours).replace(".", ",")} h nastave` },
          { label: "Predstojeći časovi", value: ahead.length, icon: ClipboardList, tone: "mint", hint: "svi potvrđeni" },
          { label: "Slobodni sati", value: freeHours, icon: Clock3, tone: "amber", hint: "u vašoj dostupnosti" },
        ]}
      />

      <AnimatedTabs
        id="teacher-tabs"
        className="dashboard-tabs"
        active={tab}
        onChange={(key) => { setTab(key); setExpandedId(null); setConfirmCancelId(null); }}
        tabs={[
          { key: "schedule", label: "Raspored", icon: CalendarDays, count: week.filter((lesson) => isAhead(lesson, now)).length },
          { key: "availability", label: "Dostupnost", icon: CalendarPlus, count: availabilities.length },
          { key: "lessons", label: "Svi časovi", icon: ClipboardList },
        ]}
      />

      <div ref={noticeRef}>{notice && <Alert type={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert>}</div>

      {tab === "schedule" && <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Raspored za narednih 7 dana</h2>
          <p className="section-desc">Kliknite na čas da vidite napomenu, priloge i kontakt učenika.</p>
        </div>
        {scheduleDays.map(({ key, lessons, ranges }) => (
          <DayGroup key={key} label={formatDayKeyHeadingLatn(key)} count={lessons.length ? lessonsLabel(lessons.length) : null}
            aside={ranges.length ? `Dostupnost ${ranges.map(rangeLabel).join(", ")}` : null}>
            {lessons.length ? (
              <ul className="lesson-list">
                {lessons.map((booking) => <LessonRow key={booking.id} {...rowProps(booking)}><TeacherLessonPanel {...panelProps(booking)} /></LessonRow>)}
              </ul>
            ) : (
              <div className="day-empty">
                <span>{ranges.length ? "Nema zakazanih časova." : "Slobodan dan, bez otvorene dostupnosti."}</span>
                {!ranges.length && <button type="button" className="btn btn-secondary btn-sm" onClick={() => openAvailabilityFor(key)}><CalendarPlus size={15} aria-hidden="true" /> Dodaj dostupnost</button>}
              </div>
            )}
          </DayGroup>
        ))}
        {ahead.length > week.filter((lesson) => isAhead(lesson, now)).length && (
          <p className="schedule-more">Kasnije imate još {lessonsLabel(ahead.length - week.filter((lesson) => isAhead(lesson, now)).length)}. <button type="button" className="text-button" onClick={() => { setFilter("ahead"); setTab("lessons"); }}>Prikaži sve predstojeće</button></p>
        )}
      </div>}

      {tab === "availability" && <AvailabilityTab availabilities={availabilities} lessons={known} preset={availabilityPreset} onChanged={async () => { await loadAvailabilities(); }} />}

      {tab === "lessons" && <div className="section-card">
        <div className="section-header section-header--row">
          <h2 className="section-title">Svi časovi</h2>
          <div className="bookings-filter" role="group" aria-label="Filter časova">
            {FILTERS.map((item) => (
              <button key={item.key} type="button" aria-pressed={filter === item.key} className={`filter-chip ${filter === item.key ? "active" : ""}`} onClick={() => { setFilter(item.key); setExpandedId(null); }}>
                {item.label}{item.key === "ahead" && <em>{ahead.length}</em>}
              </button>
            ))}
          </div>
        </div>
        {filterError && <Alert type="error" onClose={() => setFilterError("")}>{filterError}</Alert>}
        {filter !== "ahead" && filterLoading ? <Spinner text="Učitavanje časova…" /> : filterList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ClipboardList size={30} strokeWidth={1.5} aria-hidden="true" /></div>
            <p>{activeFilter.empty}</p>
          </div>
        ) : groupByDay(filterList).map((group) => (
          <DayGroup key={group.key} label={group.label} count={lessonsLabel(group.items.length)}>
            <ul className="lesson-list">
              {group.items.map((booking) => <LessonRow key={booking.id} {...rowProps(booking)}><TeacherLessonPanel {...panelProps(booking)} /></LessonRow>)}
            </ul>
          </DayGroup>
        ))}
      </div>}
    </div>
  );
}

export default TeacherDashboardPage;
