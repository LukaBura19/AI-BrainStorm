import { useState } from "react";
import { PencilLine, Plus } from "lucide-react";
import api from "../../services/api";
import Alert from "../../components/Alert";
import Badge from "../../components/Badge";
import { pluralLatn } from "../../utils/bookings";

function SubjectRow({ subject, teacherCount, onChanged, onNotice }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (patch, message) => {
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/subjects/${subject.id}`, patch);
      setEditing(false);
      onNotice({ type: "success", text: message });
      await onChanged();
    } catch (err) {
      setError(err.message || "Izmena nije sačuvana.");
    } finally {
      setBusy(false);
    }
  };

  const rename = (event) => {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === subject.name) { setEditing(false); return; }
    save({ name: next }, `Predmet je preimenovan u „${next}“.`);
  };

  return <li className={`item-row ${subject.is_active ? "" : "item-inactive"}`}>
    <div className="item-main">
      {editing ? <form className="subject-rename" onSubmit={rename}>
        <label className="form-label" htmlFor={`subject-name-${subject.id}`}>Novi naziv</label>
        <input id={`subject-name-${subject.id}`} className="input" value={name} autoFocus onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { setEditing(false); setName(subject.name); } }} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Čuvam…" : "Sačuvaj"}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setName(subject.name); }} disabled={busy}>Odustani</button>
      </form> : <div className="item-info">
        <div className="item-name"><span className={`status-dot ${subject.is_active ? "active" : "inactive"}`} />{subject.name}</div>
        <div className="item-sub">{teacherCount ? pluralLatn(teacherCount, "profesor", "profesora", "profesora") : "Nijedan profesor ga ne drži"}</div>
      </div>}
      {!editing && <>
        <div className="item-badges"><Badge type={subject.is_active ? "success" : "error"}>{subject.is_active ? "Aktivan" : "Neaktivan"}</Badge></div>
        <div className="item-actions">
          <button type="button" className="btn-action" onClick={() => { setName(subject.name); setEditing(true); }}><PencilLine size={14} aria-hidden="true" /> Preimenuj</button>
          <button type="button" className={`btn-action ${subject.is_active ? "btn-action-warning" : "btn-action-success"}`} disabled={busy}
            onClick={() => save({ is_active: !subject.is_active }, subject.is_active ? `${subject.name} više nije u ponudi za zakazivanje.` : `${subject.name} je ponovo u ponudi.`)}>
            {subject.is_active ? "Deaktiviraj" : "Aktiviraj"}
          </button>
        </div>
      </>}
    </div>
    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
  </li>;
}

/** Predmeti koje učenici biraju pri zakazivanju. */
export default function SubjectsTab({ subjects, teachers, onChanged, onNotice }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const add = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError("");
    try {
      await api.post("/admin/subjects", { name: name.trim() });
      onNotice({ type: "success", text: `Predmet „${name.trim()}“ je dodat. Dodelite ga profesorima u tabu Profesori.` });
      setName("");
      await onChanged();
    } catch (err) {
      setError(err.message || "Predmet nije dodat.");
    } finally {
      setAdding(false);
    }
  };

  const teacherCount = (subjectId) => teachers.filter((teacher) => teacher.is_active && teacher.subjects?.some((subject) => subject.id === subjectId)).length;

  return <div className="admin-section">
    <div className="section-top">
      <div>
        <h2 className="section-title">Predmeti</h2>
        <p className="section-sub">Deaktiviran predmet se ne nudi pri zakazivanju; postojeći časovi ostaju.</p>
      </div>
    </div>
    <form className="inline-form" onSubmit={add}>
      <label className="form-label" htmlFor="new-subject">Novi predmet</label>
      <input id="new-subject" className="input" placeholder="Npr. Biologija" value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={adding || !name.trim()}>{adding ? "Dodajem…" : <><Plus size={16} aria-hidden="true" /> Dodaj</>}</button>
    </form>
    {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
    <ul className="items-list">
      {subjects.map((subject) => <SubjectRow key={subject.id} subject={subject} teacherCount={teacherCount(subject.id)} onChanged={onChanged} onNotice={onNotice} />)}
    </ul>
  </div>;
}
