import { useEffect, useState } from "react";
import { ClipboardList, Search, UserRound } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Spinner from "../../components/Spinner";
import { AttachmentCount, DayGroup, LessonRow } from "../../components/lessons/LessonList";
import AdminLessonPanel from "./AdminLessonPanel";
import { CLASSROOM_LABELS, groupByDay, lessonsLabel, placeLabel, pluralLatn } from "../../utils/bookings";

const STATUSES = [
  { key: "upcoming", label: "Predstojeće" },
  { key: "confirmed", label: "Potvrđene" },
  { key: "cancelled", label: "Otkazane" },
  { key: "all", label: "Sve" },
];
export const EMPTY_FILTERS = { teacherId: "", subjectId: "", place: "", from: "", to: "" };
const PAGE = 120;

function bookingsUrl(status, filters) {
  const params = new URLSearchParams();
  if (status === "upcoming") { params.set("status", "confirmed"); params.set("upcoming_only", "true"); }
  else if (status !== "all") params.set("status", status);
  if (filters.teacherId) params.set("teacher_id", filters.teacherId);
  if (filters.subjectId) params.set("subject_id", filters.subjectId);
  if (filters.place !== "") params.set("classroom", filters.place);
  const [from, to] = filters.from && filters.to && filters.from > filters.to ? [filters.to, filters.from] : [filters.from, filters.to];
  if (from) params.set("date_from", from);
  if (to) params.set("date_to", to);
  return `/admin/bookings?${params}`;
}

function matches(booking, query) {
  if (!query) return true;
  if (String(booking.id) === query) return true;
  return [booking.client_full_name, booking.client_email, booking.teacher_name, booking.subject_name]
    .some((value) => value?.toLocaleLowerCase("sr-Latn").includes(query));
}

/** Sve rezervacije sa filterima koje backend podržava i brzom pretragom po imenu, emailu ili broju. */
export default function BookingsTab({ now, teachers, subjects, teacherSelf, preset, version, onChanged, onNotice }) {
  const [status, setStatus] = useState("upcoming");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [limit, setLimit] = useState(PAGE);

  // Drugi tabovi otvaraju rezervacije sa već postavljenim filterom (profesor, učenik).
  useEffect(() => {
    if (!preset) return;
    setStatus(preset.status || "all");
    setFilters({ ...EMPTY_FILTERS, ...preset.filters });
    setSearch(preset.search || "");
  }, [preset]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setLimit(PAGE);
    api.get(bookingsUrl(status, filters), { signal: controller.signal })
      .then((data) => setItems(data.items || []))
      .catch((err) => { if (!controller.signal.aborted) setError(err.message || "Rezervacije nisu učitane."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, filters, version]);

  // Novi filter je nova lista: ništa ne ostaje otvoreno iz prethodne.
  useEffect(() => { setExpandedId(null); }, [status, filters]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const query = search.trim().toLocaleLowerCase("sr-Latn").replace(/^#/, "");
  const visible = items.filter((booking) => matches(booking, query));
  const shown = visible.slice(0, limit);
  const filtered = search || Object.values(filters).some(Boolean);
  const mineOn = teacherSelf && filters.teacherId === String(teacherSelf.id);

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">Rezervacije</h2>
        <p className="section-sub">{loading ? "Učitavanje…" : pluralLatn(visible.length, "rezervacija", "rezervacije", "rezervacija")}</p>
      </div>
      <div className="bookings-filter" role="group" aria-label="Status rezervacija">
        {STATUSES.map((item) => <button key={item.key} type="button" aria-pressed={status === item.key} className={`filter-chip ${status === item.key ? "active" : ""}`} onClick={() => setStatus(item.key)}>{item.label}</button>)}
      </div>
    </div>

    <div className="filter-bar">
      <div className="filter-field filter-field--search">
        <label className="form-label" htmlFor="bookings-search">Pretraga</label>
        <span className="filter-search"><Search size={16} aria-hidden="true" /><input id="bookings-search" type="search" className="input" placeholder="Ime, email ili #broj" value={search} onChange={(event) => setSearch(event.target.value)} /></span>
      </div>
      <div className="filter-field">
        <label className="form-label" htmlFor="bookings-teacher">Profesor</label>
        <select id="bookings-teacher" className="select" value={filters.teacherId} onChange={(event) => setFilter("teacherId", event.target.value)}>
          <option value="">Svi profesori</option>
          {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}{teacher.is_active ? "" : " (neaktivan)"}</option>)}
        </select>
      </div>
      <div className="filter-field">
        <label className="form-label" htmlFor="bookings-subject">Predmet</label>
        <select id="bookings-subject" className="select" value={filters.subjectId} onChange={(event) => setFilter("subjectId", event.target.value)}>
          <option value="">Svi predmeti</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </div>
      <div className="filter-field">
        <label className="form-label" htmlFor="bookings-place">Mesto</label>
        <select id="bookings-place" className="select" value={filters.place} onChange={(event) => setFilter("place", event.target.value)}>
          <option value="">Sva mesta</option>
          {[1, 2, 0].map((room) => <option key={room} value={room}>{CLASSROOM_LABELS[room]}</option>)}
        </select>
      </div>
      <div className="filter-field">
        <label className="form-label" htmlFor="bookings-from">Od</label>
        <input id="bookings-from" type="date" className="input" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} />
      </div>
      <div className="filter-field">
        <label className="form-label" htmlFor="bookings-to">Do</label>
        <input id="bookings-to" type="date" className="input" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} />
      </div>
    </div>
    {(teacherSelf || filtered) && <div className="filter-quick">
      {teacherSelf && <button type="button" aria-pressed={Boolean(mineOn)} className={`filter-chip ${mineOn ? "active" : ""}`} onClick={() => setFilter("teacherId", mineOn ? "" : String(teacherSelf.id))}><UserRound size={14} aria-hidden="true" /> Moji časovi</button>}
      {filtered && <button type="button" className="text-button" onClick={() => { setFilters(EMPTY_FILTERS); setSearch(""); }}>Obriši filtere</button>}
    </div>}

    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    {loading ? <Spinner text="Učitavanje rezervacija…" /> : visible.length === 0 ? (
      <div className="empty-state">
        <div className="empty-state-icon"><ClipboardList size={30} strokeWidth={1.5} aria-hidden="true" /></div>
        <p>{filtered ? "Nijedna rezervacija ne odgovara filterima." : "Nema rezervacija."}</p>
      </div>
    ) : <>
      {groupByDay(shown).map((group) => (
        <DayGroup key={group.key} label={group.label} count={lessonsLabel(group.items.length)}>
          <ul className="lesson-list">
            {group.items.map((booking) => <LessonRow key={booking.id} booking={booking} now={now}
              title={`${booking.subject_name} · ${booking.client_full_name}`}
              meta={[booking.teacher_name, placeLabel(booking), `${booking.duration_minutes} min`, `#${booking.id}`, booking.attachments?.length ? <AttachmentCount booking={booking} /> : null]}
              expanded={expandedId === booking.id}
              onToggle={() => setExpandedId((current) => (current === booking.id ? null : booking.id))}>
              <AdminLessonPanel booking={booking} now={now} teachers={teachers} onChanged={onChanged} onNotice={onNotice} />
            </LessonRow>)}
          </ul>
        </DayGroup>
      ))}
      {visible.length > shown.length && <div className="list-more">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLimit((value) => value + PAGE)}>Prikaži još ({visible.length - shown.length})</button>
      </div>}
    </>}
  </div>;
}
