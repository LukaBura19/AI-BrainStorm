import { useState } from "react";
import { CalendarDays, Check, PencilLine, Plus, UserCheck } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Badge from "../../components/Badge";
import InlineConfirm from "../../components/ui/InlineConfirm";
import { formatTimestampDateLatn } from "../../utils/srLatnDates";

const EMPTY_TEACHER = { full_name: "", email: "", password: "", is_approved: true, subject_ids: [] };

function SubjectPicker({ subjects, selected, onToggle, legend }) {
  return <fieldset className="teacher-subject-picker">
    <legend>{legend}</legend>
    <div className="subject-check-grid">
      {subjects.filter((subject) => subject.is_active).map((subject) => (
        <label key={subject.id} className={selected.includes(subject.id) ? "selected" : ""}>
          <input type="checkbox" checked={selected.includes(subject.id)} onChange={() => onToggle(subject.id)} />
          <span>{subject.name}</span>
        </label>
      ))}
    </div>
  </fieldset>;
}

const toggleId = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

function TeacherRow({ teacher, subjects, onChanged, onShowLessons, onNotice }) {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(teacher.full_name);
  const [email, setEmail] = useState(teacher.email);
  const [subjectIds, setSubjectIds] = useState([]);

  const open = (next) => {
    setError("");
    setName(teacher.full_name);
    setEmail(teacher.email);
    setSubjectIds((teacher.subjects || []).map((subject) => subject.id));
    setMode((current) => (current === next ? null : next));
  };

  const run = async (request, message) => {
    setBusy(true);
    setError("");
    try {
      await request();
      setMode(null);
      onNotice({ type: "success", text: message });
      await onChanged();
    } catch (err) {
      setError(err.message || "Izmena nije sačuvana.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = (event) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError("Ime mora imati najmanje 2 karaktera."); return; }
    run(() => api.patch(`/admin/teachers/${teacher.id}`, { full_name: name.trim(), email: email.trim() }), `Podaci profesora ${name.trim()} su sačuvani.`);
  };

  return <li className={`item-row item-row--teacher ${teacher.is_active ? "" : "item-inactive"}`}>
    <div className="item-main">
      <div className="item-info">
        <div className="item-name"><span className={`status-dot ${teacher.is_active ? "active" : "inactive"}`} />{teacher.full_name}</div>
        <div className="item-sub">{teacher.email} · nalog od {formatTimestampDateLatn(teacher.created_at, true)}</div>
        <div className="teacher-subject-tags">
          {teacher.subjects?.length ? teacher.subjects.map((subject) => <span key={subject.id}>{subject.name}</span>) : <em>Nema dodeljenih predmeta, učenici ga ne vide</em>}
        </div>
      </div>
      <div className="item-badges">
        <Badge type={teacher.is_active ? "success" : "error"}>{teacher.is_active ? "Aktivan" : "Neaktivan"}</Badge>
        <Badge type={teacher.is_approved ? "success" : "warning"}>{teacher.is_approved ? "Odobren" : "Čeka odobrenje"}</Badge>
      </div>
      <div className="item-actions">
        {!teacher.is_approved && <button type="button" className="btn-action btn-action-success" disabled={busy} onClick={() => run(() => api.patch(`/admin/teachers/${teacher.id}/approve`), `${teacher.full_name} je odobren i može da se prijavi.`)}><UserCheck size={14} aria-hidden="true" /> Odobri</button>}
        <button type="button" className="btn-action" onClick={() => onShowLessons(teacher)}><CalendarDays size={14} aria-hidden="true" /> Časovi</button>
        <button type="button" className="btn-action" aria-expanded={mode === "edit"} onClick={() => open("edit")}><PencilLine size={14} aria-hidden="true" /> Izmeni</button>
        <button type="button" className="btn-action" aria-expanded={mode === "subjects"} onClick={() => open("subjects")}>Predmeti</button>
        {teacher.is_active
          ? <button type="button" className="btn-action btn-action-warning" onClick={() => open("deactivate")}>Deaktiviraj</button>
          : <button type="button" className="btn-action btn-action-success" disabled={busy} onClick={() => run(() => api.patch(`/admin/teachers/${teacher.id}`, { is_active: true }), `${teacher.full_name} je ponovo aktivan.`)}>Aktiviraj</button>}
      </div>
    </div>

    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    {mode === "edit" && <form className="item-editor" onSubmit={saveProfile}>
      <div className="form-row form-row--two">
        <div className="form-group">
          <label className="form-label" htmlFor={`teacher-name-${teacher.id}`}>Ime i prezime</label>
          <input id={`teacher-name-${teacher.id}`} className="input" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`teacher-email-${teacher.id}`}>Email za prijavu</label>
          <input id={`teacher-email-${teacher.id}`} type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
      </div>
      <div className="item-editor-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode(null)} disabled={busy}>Odustani</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Čuvam…" : "Sačuvaj"}</button>
      </div>
    </form>}
    {mode === "subjects" && <div className="item-editor">
      <SubjectPicker subjects={subjects} selected={subjectIds} onToggle={(id) => setSubjectIds((current) => toggleId(current, id))} legend="Predmeti koje profesor drži" />
      <div className="item-editor-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode(null)} disabled={busy}>Odustani</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => api.post(`/admin/teachers/${teacher.id}/subjects`, { subject_ids: subjectIds }), `Predmeti profesora ${teacher.full_name} su sačuvani.`)}>{busy ? "Čuvam…" : "Sačuvaj predmete"}</button>
      </div>
    </div>}
    {mode === "deactivate" && <InlineConfirm
      title={`Deaktivirati profesora ${teacher.full_name}?`}
      description="Neće moći da se prijavi niti da bude izabran za nove časove. Već zakazani časovi ostaju; prebacite ih ili otkažite u rezervacijama."
      confirmLabel="Deaktiviraj"
      cancelLabel="Odustani"
      busy={busy}
      onConfirm={() => run(() => api.patch(`/admin/teachers/${teacher.id}`, { is_active: false }), `${teacher.full_name} je deaktiviran.`)}
      onCancel={() => setMode(null)}
    />}
  </li>;
}

/** Profesori: odobravanje, novi nalozi, predmeti, izmena podataka i aktivnost. */
export default function TeachersTab({ teachers, subjects, onChanged, onShowLessons, onNotice }) {
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState(EMPTY_TEACHER);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const pending = teachers.filter((teacher) => !teacher.is_approved);
  const approved = teachers.filter((teacher) => teacher.is_approved);

  const create = async (event) => {
    event.preventDefault();
    if (draft.subject_ids.length === 0) { setError("Izaberite bar jedan predmet da bi učenici mogli da zakažu kod profesora."); return; }
    setCreating(true);
    setError("");
    try {
      await api.post("/admin/teachers", { ...draft, full_name: draft.full_name.trim(), email: draft.email.trim() });
      onNotice({ type: "success", text: `Profesor ${draft.full_name.trim()} je dodat.` });
      setDraft(EMPTY_TEACHER);
      setShowNew(false);
      await onChanged();
    } catch (err) {
      setError(err.message || "Profesor nije dodat.");
    } finally {
      setCreating(false);
    }
  };

  const rowProps = { subjects, onChanged, onShowLessons, onNotice };

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">Profesori</h2>
        <p className="section-sub">{teachers.filter((teacher) => teacher.is_active).length} aktivnih od {teachers.length}</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" aria-expanded={showNew} onClick={() => { setShowNew((value) => !value); setError(""); }}>
        {showNew ? "Zatvori" : <><Plus size={15} aria-hidden="true" /> Novi profesor</>}
      </button>
    </div>

    {showNew && <form className="new-teacher-form" onSubmit={create}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="new-teacher-name">Ime i prezime</label>
          <input id="new-teacher-name" type="text" className="input" value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} placeholder="Ime Prezime" autoComplete="off" required minLength={2} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="new-teacher-email">Email</label>
          <input id="new-teacher-email" type="email" className="input" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="ime@brainstorm.com" autoComplete="off" required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="new-teacher-password">Početna lozinka</label>
          <input id="new-teacher-password" type="password" className="input" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="Najmanje 6 karaktera" minLength={6} autoComplete="new-password" required />
        </div>
      </div>
      <SubjectPicker subjects={subjects} selected={draft.subject_ids} onToggle={(id) => setDraft((current) => ({ ...current, subject_ids: toggleId(current.subject_ids, id) }))} legend="Predmeti koje profesor drži" />
      {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="form-actions">
        <label className="checkbox-label"><input type="checkbox" checked={draft.is_approved} onChange={(event) => setDraft({ ...draft, is_approved: event.target.checked })} /> Odmah odobren</label>
        <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Dodajem…" : <><Check size={16} aria-hidden="true" /> Dodaj profesora</>}</button>
      </div>
    </form>}

    {pending.length > 0 && <>
      <h3 className="items-heading">Čekaju odobrenje</h3>
      <ul className="items-list">{pending.map((teacher) => <TeacherRow key={teacher.id} teacher={teacher} {...rowProps} />)}</ul>
      <h3 className="items-heading">Odobreni</h3>
    </>}
    <ul className="items-list">{approved.map((teacher) => <TeacherRow key={teacher.id} teacher={teacher} {...rowProps} />)}</ul>
  </div>;
}
