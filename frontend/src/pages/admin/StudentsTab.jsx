import { useEffect, useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Badge from "../../components/Badge";
import Spinner from "../../components/Spinner";
import InlineConfirm from "../../components/ui/InlineConfirm";
import { CATEGORY_LABELS, lessonsLabel, pluralLatn } from "../../utils/bookings";
import { formatTimestampDateLatn } from "../../utils/srLatnDates";

/** Učenički nalozi: ko se registrovao, koliko časova ima i aktivnost naloga. */
export default function StudentsTab({ onShowLessons, onNotice }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setStudents((await api.get("/admin/students")).items || []);
    } catch (err) {
      setError(err.message || "Učenici nisu učitani.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const setActive = async (student, isActive) => {
    setBusyId(student.id);
    try {
      const updated = await api.patch(`/admin/students/${student.id}`, { is_active: isActive });
      setStudents((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      onNotice({ type: "success", text: isActive ? `Nalog ${student.full_name} je ponovo aktivan.` : `Nalog ${student.full_name} je deaktiviran.` });
      setConfirmId(null);
    } catch (err) {
      setError(err.message || "Izmena nije sačuvana.");
    } finally {
      setBusyId(null);
    }
  };

  const query = search.trim().toLocaleLowerCase("sr-Latn");
  const visible = query ? students.filter((student) => [student.full_name, student.email].some((value) => value.toLocaleLowerCase("sr-Latn").includes(query))) : students;

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">Učenici</h2>
        <p className="section-sub">{pluralLatn(students.length, "registrovan nalog", "registrovana naloga", "registrovanih naloga")}</p>
      </div>
      <div className="filter-field filter-field--search filter-field--inline">
        <label className="form-label" htmlFor="students-search">Pretraga</label>
        <span className="filter-search"><Search size={16} aria-hidden="true" /><input id="students-search" type="search" className="input" placeholder="Ime ili email" value={search} onChange={(event) => setSearch(event.target.value)} /></span>
      </div>
    </div>
    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    {loading ? <Spinner text="Učitavanje učenika…" /> : visible.length === 0 ? (
      <div className="empty-state">
        <div className="empty-state-icon"><Users size={30} strokeWidth={1.5} aria-hidden="true" /></div>
        <p>{query ? "Nijedan učenik ne odgovara pretrazi." : "Još nema registrovanih učenika."}</p>
      </div>
    ) : <ul className="items-list">
      {visible.map((student) => <li key={student.id} className={`item-row ${student.is_active ? "" : "item-inactive"}`}>
        <div className="item-main">
          <div className="item-info">
            <div className="item-name"><span className={`status-dot ${student.is_active ? "active" : "inactive"}`} />{student.full_name}</div>
            <div className="item-sub">{student.email} · nalog od {formatTimestampDateLatn(student.created_at, true)}</div>
            <div className="item-sub item-sub--strong">
              {student.bookings_total ? `${lessonsLabel(student.bookings_total)} ukupno · ${student.bookings_upcoming} predstoji` : "Još nema časova zakazanih sa naloga"}
            </div>
          </div>
          <div className="item-badges">
            {student.category && <Badge type="default">{CATEGORY_LABELS[student.category] || student.category}</Badge>}
            {!student.is_active && <Badge type="error">Deaktiviran</Badge>}
          </div>
          <div className="item-actions">
            <button type="button" className="btn-action" onClick={() => onShowLessons(student)} disabled={!student.bookings_total}><CalendarDays size={14} aria-hidden="true" /> Časovi</button>
            {student.is_active
              ? <button type="button" className="btn-action btn-action-warning" onClick={() => setConfirmId(student.id)}>Deaktiviraj</button>
              : <button type="button" className="btn-action btn-action-success" disabled={busyId === student.id} onClick={() => setActive(student, true)}>Aktiviraj</button>}
          </div>
        </div>
        {confirmId === student.id && <InlineConfirm
          title={`Deaktivirati nalog ${student.full_name}?`}
          description="Učenik neće moći da se prijavi. Zakazani časovi ostaju i mogu se otkazati u rezervacijama."
          confirmLabel="Deaktiviraj"
          cancelLabel="Odustani"
          busy={busyId === student.id}
          onConfirm={() => setActive(student, false)}
          onCancel={() => setConfirmId(null)}
        />}
      </li>)}
    </ul>}
    <p className="section-note">Broje se samo časovi zakazani dok je učenik bio prijavljen na nalog. Časove zakazane bez naloga pronađite u rezervacijama po imenu ili emailu.</p>
  </div>;
}
