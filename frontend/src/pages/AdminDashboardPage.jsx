import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import Badge from "../components/Badge";
import { APP_TIME_ZONE, formatTimeLatn, formatTimestampDateLatn } from "../utils/srLatnDates";
import DashboardHero from "../components/ui/DashboardHero";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import { BookOpen, CalendarCheck, ClipboardList, GraduationCap, Paperclip, School, X } from "lucide-react";
import "./AdminDashboardPage.css";

/* ---- Helpers ---- */
const fmtTime = formatTimeLatn;
const fmtDateFull = (iso) => formatTimestampDateLatn(iso, true);

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const CATEGORY_MAP = {
  osnovna: "Osnovna škola",
  srednja: "Srednja škola",
  faks: "Fakultet",
  drugo: "Drugo",
};

/* ================================================ */
/*  AdminDashboardPage                               */
/* ================================================ */
function AdminDashboardPage() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState("bookings");

  // ---- Bookings state ----
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingsNotice, setBookingsNotice] = useState(null);
  const [bookingsFilter, setBookingsFilter] = useState("upcoming");
  const [cancellingId, setCancellingId] = useState(null);
  const [attachmentDownloadingKey, setAttachmentDownloadingKey] = useState(null);

  // ---- Subjects state ----
  const [subjects, setSubjects] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState("");
  const [subjectsSuccess, setSubjectsSuccess] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);

  // ---- Teachers state ----
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachersError, setTeachersError] = useState("");
  const [teachersSuccess, setTeachersSuccess] = useState("");

  // New teacher form
  const [showNewTeacher, setShowNewTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ full_name: "", email: "", password: "", is_approved: true, subject_ids: [] });
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingSubjectIds, setEditingSubjectIds] = useState([]);
  const [savingTeacherSubjects, setSavingTeacherSubjects] = useState(false);

  // ---- Classroom state ----
  const [classroomDate, setClassroomDate] = useState(todayISO());
  const [classroomData, setClassroomData] = useState(null);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomError, setClassroomError] = useState("");

  /* ======================================= */
  /*  Fetch admin profile                     */
  /* ======================================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "admin") {
      navigate("/admin/login");
      return;
    }

    (async () => {
      try {
        const data = await api.get("/admin/me");
        setAdmin(data);
      } catch (err) {
        setError(err.message || "Greška pri učitavanju profila.");
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          navigate("/admin/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ======================================= */
  /*  PREGLED (statistika u zaglavlju)         */
  /* ======================================= */
  const [overview, setOverview] = useState(null);
  const fetchOverview = useCallback(async () => {
    const count = (promise) => promise.then((data) => data.items || []).catch(() => null);
    const [upcoming, allTeachers, allSubjects, cancelled] = await Promise.all([
      count(api.get("/admin/bookings?status=confirmed&upcoming_only=true")),
      count(api.get("/admin/teachers")),
      count(api.get("/admin/subjects")),
      count(api.get("/admin/bookings?status=cancelled")),
    ]);
    setOverview({
      upcoming: upcoming?.length ?? null,
      teachers: allTeachers ? allTeachers.filter((teacher) => teacher.is_active !== false).length : null,
      subjects: allSubjects ? allSubjects.filter((subject) => subject.is_active !== false).length : null,
      cancelled: cancelled?.length ?? null,
    });
  }, []);

  useEffect(() => {
    if (admin) fetchOverview();
  }, [admin, fetchOverview]);

  /* ======================================= */
  /*  BOOKINGS                                */
  /* ======================================= */
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      let url = "/admin/bookings";
      if (bookingsFilter === "upcoming") url += "?status=confirmed&upcoming_only=true";
      else if (bookingsFilter) url += `?status=${bookingsFilter}`;
      const data = await api.get(url);
      setBookings(data.items || []);
    } catch (err) {
      setBookingsError(err.message || "Greška.");
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingsFilter]);

  useEffect(() => {
    if (admin && activeTab === "bookings") fetchBookings();
  }, [admin, activeTab, fetchBookings]);

  const handleCancelBooking = async (id) => {
    const reason = window.prompt("Razlog otkazivanja (opciono):");
    if (reason === null) return; // user cancelled prompt
    setCancellingId(id);
    setBookingsError("");
    setBookingsNotice(null);
    try {
      const url = reason
        ? `/admin/bookings/${id}/cancel?reason=${encodeURIComponent(reason)}`
        : `/admin/bookings/${id}/cancel`;
      const response = await api.patch(url);
      const mailStatus = response.notification_delivery?.status;
      setBookingsNotice({
        type: mailStatus === "sent" ? "success" : "warning",
        text: mailStatus === "failed"
          ? "Rezervacija je otkazana, ali email obaveštenja nisu poslata."
          : mailStatus === "partial"
            ? "Rezervacija je otkazana, ali deo email obaveštenja nije isporučen."
            : mailStatus === "captured"
              ? "Rezervacija je otkazana, ali slanje email obaveštenja još nije podešeno."
              : mailStatus === "sent"
                ? "Rezervacija je otkazana i email obaveštenja su poslata."
                : "Rezervacija je otkazana. Slanje email obaveštenja nije potvrđeno.",
      });
      await Promise.all([fetchBookings(), fetchOverview()]);
    } catch (err) {
      setBookingsError(err.message || "Greška pri otkazivanju.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleDownloadAttachment = async (bookingId, attachmentId, originalName) => {
    const key = `${bookingId}-${attachmentId}`;
    setAttachmentDownloadingKey(key);
    setBookingsError("");
    try {
      await api.downloadBlob(
        `/admin/bookings/${bookingId}/attachments/${attachmentId}`,
        originalName || "prilog",
      );
    } catch (err) {
      setBookingsError(err.message || "Preuzimanje priloga nije uspelo.");
    } finally {
      setAttachmentDownloadingKey(null);
    }
  };

  /* ======================================= */
  /*  SUBJECTS                                */
  /* ======================================= */
  const fetchSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    setSubjectsError("");
    try {
      const data = await api.get("/admin/subjects");
      setSubjects(data.items || []);
    } catch (err) {
      setSubjectsError(err.message || "Greška.");
    } finally {
      setSubjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin && (activeTab === "subjects" || activeTab === "teachers")) fetchSubjects();
  }, [admin, activeTab, fetchSubjects]);

  const handleAddSubject = async () => {
    if (!newSubjectName.trim()) return;
    setAddingSubject(true);
    setSubjectsError("");
    try {
      await api.post("/admin/subjects", { name: newSubjectName.trim() });
      setNewSubjectName("");
      setSubjectsSuccess("Predmet dodat!");
      fetchSubjects();
      setTimeout(() => setSubjectsSuccess(""), 3000);
    } catch (err) {
      setSubjectsError(err.message || "Greška.");
    } finally {
      setAddingSubject(false);
    }
  };

  const handleToggleSubject = async (id, currentActive) => {
    try {
      await api.patch(`/admin/subjects/${id}`, { is_active: !currentActive });
      fetchSubjects();
    } catch (err) {
      setSubjectsError(err.message || "Greška.");
    }
  };

  /* ======================================= */
  /*  TEACHERS                                */
  /* ======================================= */
  const fetchTeachers = useCallback(async () => {
    setTeachersLoading(true);
    setTeachersError("");
    try {
      const data = await api.get("/admin/teachers");
      setTeachers(data.items || []);
    } catch (err) {
      setTeachersError(err.message || "Greška.");
    } finally {
      setTeachersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin && activeTab === "teachers") fetchTeachers();
  }, [admin, activeTab, fetchTeachers]);

  const handleApproveTeacher = async (id) => {
    try {
      await api.patch(`/admin/teachers/${id}/approve`);
      setTeachersSuccess("Profesor odobren!");
      fetchTeachers();
      setTimeout(() => setTeachersSuccess(""), 3000);
    } catch (err) {
      setTeachersError(err.message || "Greška.");
    }
  };

  const handleToggleTeacher = async (id, currentActive) => {
    try {
      await api.patch(`/admin/teachers/${id}`, { is_active: !currentActive });
      fetchTeachers();
    } catch (err) {
      setTeachersError(err.message || "Greška.");
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacher.full_name || !newTeacher.email || !newTeacher.password) {
      setTeachersError("Sva polja su obavezna.");
      return;
    }
    if (newTeacher.subject_ids.length === 0) {
      setTeachersError("Izaberite najmanje jedan predmet da bi profesor bio dostupan za zakazivanje.");
      return;
    }
    setAddingTeacher(true);
    setTeachersError("");
    try {
      await api.post("/admin/teachers", newTeacher);
      setNewTeacher({ full_name: "", email: "", password: "", is_approved: true, subject_ids: [] });
      setShowNewTeacher(false);
      setTeachersSuccess("Profesor kreiran!");
      fetchTeachers();
      setTimeout(() => setTeachersSuccess(""), 3000);
    } catch (err) {
      setTeachersError(err.message || "Greška.");
    } finally {
      setAddingTeacher(false);
    }
  };

  const toggleNewTeacherSubject = (subjectId) => {
    setNewTeacher((current) => ({
      ...current,
      subject_ids: current.subject_ids.includes(subjectId)
        ? current.subject_ids.filter((id) => id !== subjectId)
        : [...current.subject_ids, subjectId],
    }));
  };

  const beginSubjectEdit = (teacher) => {
    setEditingTeacherId(teacher.id);
    setEditingSubjectIds((teacher.subjects || []).map((subject) => subject.id));
    setTeachersError("");
  };

  const toggleEditingSubject = (subjectId) => {
    setEditingSubjectIds((current) => current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId]);
  };

  const saveTeacherSubjects = async (teacherId) => {
    setSavingTeacherSubjects(true);
    setTeachersError("");
    try {
      await api.post(`/admin/teachers/${teacherId}/subjects`, { subject_ids: editingSubjectIds });
      setEditingTeacherId(null);
      setTeachersSuccess("Predmeti profesora su sačuvani.");
      await fetchTeachers();
      setTimeout(() => setTeachersSuccess(""), 3000);
    } catch (err) {
      setTeachersError(err.message || "Predmeti nisu sačuvani.");
    } finally {
      setSavingTeacherSubjects(false);
    }
  };

  /* ======================================= */
  /*  CLASSROOMS                              */
  /* ======================================= */
  const fetchClassroom = useCallback(async () => {
    setClassroomLoading(true);
    setClassroomError("");
    try {
      const data = await api.get(`/admin/classrooms/schedule?date=${classroomDate}`);
      setClassroomData(data);
    } catch (err) {
      setClassroomError(err.message || "Greška.");
    } finally {
      setClassroomLoading(false);
    }
  }, [classroomDate]);

  useEffect(() => {
    if (admin && activeTab === "classrooms") fetchClassroom();
  }, [admin, activeTab, fetchClassroom]);

  /* ======================================= */
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/admin/login");
  };

  if (loading) return <Spinner size="lg" text="Učitavanje..." />;
  if (error) return <Alert type="error">{error}</Alert>;

  /* ======================================= */
  /*  RENDER                                   */
  /* ======================================= */
  return (
    <div className="admin-dashboard dash-page">
      <DashboardHero
        name={admin?.full_name}
        role="Administrator"
        onLogout={handleLogout}
        stats={[
          { label: "Predstojeći časovi", value: overview?.upcoming, icon: CalendarCheck, tone: "pink", hint: "potvrđene rezervacije" },
          { label: "Aktivni profesori", value: overview?.teachers, icon: GraduationCap, tone: "violet" },
          { label: "Aktivni predmeti", value: overview?.subjects, icon: BookOpen, tone: "mint" },
          { label: "Otkazani časovi", value: overview?.cancelled, icon: X, tone: "amber", hint: "ukupno" },
        ]}
      />

      {/* Tabs */}
      <AnimatedTabs
        id="admin-tabs"
        className="admin-tabs"
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "bookings", icon: ClipboardList, label: "Rezervacije" },
          { key: "subjects", icon: BookOpen, label: "Predmeti" },
          { key: "teachers", icon: GraduationCap, label: "Profesori" },
          { key: "classrooms", icon: School, label: "Učionice" },
        ]}
      />

      {/* ============ BOOKINGS TAB ============ */}
      {activeTab === "bookings" && (
        <div className="admin-section">
          <div className="section-top">
            <h2 className="section-title">Sve rezervacije</h2>
            <div className="bookings-filter">
              {[
                { val: "upcoming", label: "Predstojeće" },
                { val: "confirmed", label: "Sve potvrđene" },
                { val: "cancelled", label: "Otkazane" },
                { val: "", label: "Sve" },
              ].map((f) => (
                <button
                  key={f.val}
                  className={`filter-chip ${bookingsFilter === f.val ? "active" : ""}`}
                  onClick={() => setBookingsFilter(f.val)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {bookingsError && <Alert type="error" onClose={() => setBookingsError("")}>{bookingsError}</Alert>}
          {bookingsNotice && <Alert type={bookingsNotice.type} onClose={() => setBookingsNotice(null)}>{bookingsNotice.text}</Alert>}

          {bookingsLoading ? (
            <Spinner text="Učitavanje..." />
          ) : bookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ClipboardList size={30} strokeWidth={1.5} aria-hidden="true" /></div>
              <p>Nema rezervacija.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Predmet</th>
                    <th>Profesor</th>
                    <th>Klijent</th>
                    <th>Datum</th>
                    <th>Vreme</th>
                    <th>Trajanje</th>
                    <th>Način / tip</th>
                    <th>Učionica</th>
                    <th>Status</th>
                    <th>Prilog</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className={b.status === "cancelled" ? "row-cancelled" : ""}>
                      <td className="td-id" data-label="ID">#{b.id}</td>
                      <td data-label="Predmet">{b.subject_name}</td>
                      <td data-label="Profesor">{b.teacher_name}</td>
                      <td data-label="Klijent">
                        <div>{b.client_full_name}</div>
                        <div className="td-sub">{b.client_email}</div>
                      </td>
                      <td data-label="Datum">{fmtDateFull(b.start_time)}</td>
                      <td data-label="Vreme">{fmtTime(b.start_time)}–{fmtTime(b.end_time)}</td>
                      <td data-label="Trajanje">{b.duration_minutes} min</td>
                      <td data-label="Način / tip">
                        <div>{b.delivery_mode === "online" ? "Online" : "Uživo"}</div>
                        <div className="td-sub">
                          {b.session_type === "group" ? "Grupni" : "Individualni"}
                        </div>
                      </td>
                      <td data-label="Učionica">
                        {b.classroom_number === 0 ? "—" : b.classroom_number}
                      </td>
                      <td data-label="Status">
                        <Badge type={b.status === "confirmed" ? "success" : "error"}>
                          {b.status === "confirmed" ? "Aktivna" : "Otkazana"}
                        </Badge>
                      </td>
                      <td data-label="Prilog">
                        {b.attachments?.length ? (
                          <div className="attachment-cell">
                            {b.attachments.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="btn-action btn-action-attach"
                                title={a.original_name}
                                onClick={() =>
                                  handleDownloadAttachment(b.id, a.id, a.original_name)
                                }
                                disabled={attachmentDownloadingKey === `${b.id}-${a.id}`}
                              >
                                {attachmentDownloadingKey === `${b.id}-${a.id}`
                                  ? "..."
                                  : <><Paperclip size={13} aria-hidden="true" /> {a.original_name.length > 18 ? `${a.original_name.slice(0, 16)}…` : a.original_name}</>}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="td-sub">—</span>
                        )}
                      </td>
                      <td data-label="Akcije">
                        {b.status === "confirmed" && (
                          <button
                            className="btn-action btn-action-danger"
                            onClick={() => handleCancelBooking(b.id)}
                            disabled={cancellingId === b.id}
                            title="Otkaži"
                            aria-label={`Otkaži rezervaciju #${b.id}`}
                          >
                            {cancellingId === b.id ? "..." : <X size={15} aria-hidden="true" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ SUBJECTS TAB ============ */}
      {activeTab === "subjects" && (
        <div className="admin-section">
          <div className="section-top">
            <h2 className="section-title">Predmeti</h2>
          </div>

          {/* Add subject */}
          <div className="inline-form">
            <input
              type="text"
              className="input"
              placeholder="Naziv novog predmeta..."
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
            />
            <button
              className="btn btn-primary"
              onClick={handleAddSubject}
              disabled={addingSubject || !newSubjectName.trim()}
            >
              {addingSubject ? "Dodajem..." : "+ Dodaj"}
            </button>
          </div>

          {subjectsError && <Alert type="error" onClose={() => setSubjectsError("")}>{subjectsError}</Alert>}
          {subjectsSuccess && <Alert type="success" onClose={() => setSubjectsSuccess("")}>{subjectsSuccess}</Alert>}

          {subjectsLoading ? (
            <Spinner text="Učitavanje..." />
          ) : (
            <div className="items-list">
              {subjects.map((s) => (
                <div key={s.id} className={`item-row ${!s.is_active ? "item-inactive" : ""}`}>
                  <div className="item-name">
                    <span className={`status-dot ${s.is_active ? "active" : "inactive"}`} />
                    {s.name}
                  </div>
                  <div className="item-actions">
                    <Badge type={s.is_active ? "success" : "error"}>
                      {s.is_active ? "Aktivan" : "Neaktivan"}
                    </Badge>
                    <button
                      className={`btn-action ${s.is_active ? "btn-action-warning" : "btn-action-success"}`}
                      onClick={() => handleToggleSubject(s.id, s.is_active)}
                      title={s.is_active ? "Deaktiviraj" : "Aktiviraj"}
                    >
                      {s.is_active ? "Deaktiviraj" : "Aktiviraj"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ TEACHERS TAB ============ */}
      {activeTab === "teachers" && (
        <div className="admin-section">
          <div className="section-top">
            <h2 className="section-title">Profesori</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowNewTeacher(!showNewTeacher)}
            >
              {showNewTeacher ? "Zatvori" : "+ Novi profesor"}
            </button>
          </div>

          {/* New teacher form */}
          {showNewTeacher && (
            <div className="new-teacher-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-teacher-name">Ime i prezime</label>
                  <input
                    id="new-teacher-name"
                    type="text"
                    className="input"
                    value={newTeacher.full_name}
                    onChange={(e) => setNewTeacher({ ...newTeacher, full_name: e.target.value })}
                    placeholder="Ime Prezime"
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-teacher-email">Email</label>
                  <input
                    id="new-teacher-email"
                    type="email"
                    className="input"
                    value={newTeacher.email}
                    onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })}
                    placeholder="email@brainstorm.com"
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-teacher-password">Lozinka</label>
                  <input
                    id="new-teacher-password"
                    type="password"
                    className="input"
                    value={newTeacher.password}
                    onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
                    placeholder="Najmanje 6 karaktera"
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <fieldset className="teacher-subject-picker">
                <legend>Predmeti koje profesor drži</legend>
                {subjectsLoading ? <span className="item-sub">Učitavanje predmeta…</span> : (
                  <div className="subject-check-grid">
                    {subjects.filter((subject) => subject.is_active).map((subject) => (
                      <label key={subject.id} className={newTeacher.subject_ids.includes(subject.id) ? "selected" : ""}>
                        <input type="checkbox" checked={newTeacher.subject_ids.includes(subject.id)} onChange={() => toggleNewTeacherSubject(subject.id)} />
                        <span>{subject.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <div className="form-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newTeacher.is_approved}
                    onChange={(e) => setNewTeacher({ ...newTeacher, is_approved: e.target.checked })}
                  />
                  Odmah odobren
                </label>
                <button
                  className="btn btn-primary"
                  onClick={handleAddTeacher}
                  disabled={addingTeacher}
                >
                  {addingTeacher ? "Kreiranje..." : "Kreiraj profesora"}
                </button>
              </div>
            </div>
          )}

          {teachersError && <Alert type="error" onClose={() => setTeachersError("")}>{teachersError}</Alert>}
          {teachersSuccess && <Alert type="success" onClose={() => setTeachersSuccess("")}>{teachersSuccess}</Alert>}

          {teachersLoading ? (
            <Spinner text="Učitavanje..." />
          ) : (
            <div className="items-list">
              {teachers.map((t) => (
                <div key={t.id} className={`item-row ${!t.is_active ? "item-inactive" : ""}`}>
                  <div className="item-info">
                    <div className="item-name">
                      <span className={`status-dot ${t.is_active ? "active" : "inactive"}`} />
                      {t.full_name}
                    </div>
                    <div className="item-sub">{t.email}</div>
                    <div className="teacher-subject-tags">
                      {t.subjects?.length ? t.subjects.map((subject) => <span key={subject.id}>{subject.name}</span>) : <em>Nema dodeljenih predmeta</em>}
                    </div>
                    {editingTeacherId === t.id && (
                      <div className="teacher-subject-editor">
                        <strong>Izmeni predmete</strong>
                        <div className="subject-check-grid">
                          {subjects.filter((subject) => subject.is_active).map((subject) => (
                            <label key={subject.id} className={editingSubjectIds.includes(subject.id) ? "selected" : ""}>
                              <input type="checkbox" checked={editingSubjectIds.includes(subject.id)} onChange={() => toggleEditingSubject(subject.id)} />
                              <span>{subject.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="teacher-subject-editor-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingTeacherId(null)} disabled={savingTeacherSubjects}>Odustani</button>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => saveTeacherSubjects(t.id)} disabled={savingTeacherSubjects}>{savingTeacherSubjects ? "Čuvam…" : "Sačuvaj"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="item-badges">
                    <Badge type={t.is_active ? "success" : "error"}>
                      {t.is_active ? "Aktivan" : "Neaktivan"}
                    </Badge>
                    <Badge type={t.is_approved ? "success" : "warning"}>
                      {t.is_approved ? "Odobren" : "Čeka"}
                    </Badge>
                  </div>
                  <div className="item-actions">
                    <button className="btn-action" onClick={() => editingTeacherId === t.id ? setEditingTeacherId(null) : beginSubjectEdit(t)}>
                      Predmeti
                    </button>
                    {!t.is_approved && (
                      <button
                        className="btn-action btn-action-success"
                        onClick={() => handleApproveTeacher(t.id)}
                      >
                        Odobri
                      </button>
                    )}
                    <button
                      className={`btn-action ${t.is_active ? "btn-action-warning" : "btn-action-success"}`}
                      onClick={() => handleToggleTeacher(t.id, t.is_active)}
                    >
                      {t.is_active ? "Deaktiviraj" : "Aktiviraj"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ CLASSROOMS TAB ============ */}
      {activeTab === "classrooms" && (
        <div className="admin-section">
          <div className="section-top">
            <h2 className="section-title">Raspored učionica</h2>
            <div className="classroom-date-pick">
              <input
                type="date"
                className="input input-date"
                value={classroomDate}
                onChange={(e) => setClassroomDate(e.target.value)}
              />
            </div>
          </div>

          {classroomError && <Alert type="error" onClose={() => setClassroomError("")}>{classroomError}</Alert>}

          {classroomLoading ? (
            <Spinner text="Učitavanje..." />
          ) : !classroomData ? (
            <div className="empty-state">
              <div className="empty-state-icon"><School size={30} strokeWidth={1.5} aria-hidden="true" /></div>
              <p>Izaberite datum da vidite raspored.</p>
            </div>
          ) : (
            <div className="classrooms-grid">
              {classroomData.classrooms?.map((cr) => (
                <div key={cr.classroom_number} className="classroom-card">
                  <div className="classroom-card-header">
                    <h3>{cr.classroom_label}</h3>
                    <div className="classroom-stats">
                      <span>{cr.total_slots} čas{cr.total_slots === 1 ? "" : cr.total_slots < 5 ? "a" : "ova"}</span>
                      <span className="stat-sep">·</span>
                      <span>{cr.total_minutes} min</span>
                    </div>
                  </div>

                  {cr.slots.length === 0 ? (
                    <div className="classroom-empty">Nema časova</div>
                  ) : (
                    <div className="classroom-slots">
                      {cr.slots.map((s) => (
                        <div key={s.booking_id} className="classroom-slot">
                          <div className="slot-time">
                            {fmtTime(s.start_time)}–{fmtTime(s.end_time)}
                          </div>
                          <div className="slot-info">
                            <strong>{s.subject_name}</strong>
                            <span className="slot-teacher">{s.teacher_name}</span>
                            <span className="slot-client">{s.client_full_name}</span>
                          </div>
                          <div className="slot-duration">{s.duration_minutes} min</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
