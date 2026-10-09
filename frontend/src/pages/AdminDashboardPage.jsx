import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Briefcase, CalendarCheck, CalendarDays, CalendarRange, ClipboardList, GraduationCap, Presentation, UserCheck, Users } from "lucide-react";
import api from "../services/api";
import { endSession, getSession, isSignedInAs, switchRole } from "../services/session";
import useNow from "../hooks/useNow";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import DashboardHero from "../components/ui/DashboardHero";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import DayBoard from "./admin/DayBoard";
import BookingsTab from "./admin/BookingsTab";
import TeachersTab from "./admin/TeachersTab";
import StudentsTab from "./admin/StudentsTab";
import SubjectsTab from "./admin/SubjectsTab";
import ApplicationsTab from "./admin/ApplicationsTab";
import { isOnline, pluralLatn } from "../utils/bookings";
import { dayKeyLatn, formatDayKeyShortLatn, todayKeyLatn, weekKeys } from "../utils/srLatnDates";
import "./AdminDashboardPage.css";

/** Kontrolni panel: dan centra, rezervacije, profesori, učenici i predmeti. */
function AdminDashboardPage() {
  const navigate = useNavigate();
  const now = useNow();
  const [admin, setAdmin] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [week, setWeek] = useState([]);
  const [upcomingCount, setUpcomingCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("today");
  const [notice, setNotice] = useState(null);
  const [version, setVersion] = useState(0);
  const [bookingsPreset, setBookingsPreset] = useState(null);
  const noticeRef = useRef(null);
  const linkedTeacher = Boolean(getSession()?.linked?.teacher);

  const loadTeachers = useCallback(async () => setTeachers((await api.get("/admin/teachers")).items || []), []);
  const loadSubjects = useCallback(async () => setSubjects((await api.get("/admin/subjects")).items || []), []);
  const loadStats = useCallback(async () => {
    const { from, to } = weekKeys(todayKeyLatn());
    const [weekData, upcomingData] = await Promise.all([
      api.get(`/admin/bookings?status=confirmed&date_from=${from}&date_to=${to}`),
      api.get("/admin/bookings?status=confirmed&upcoming_only=true"),
    ]);
    setWeek(weekData.items || []);
    setUpcomingCount(upcomingData.total ?? (upcomingData.items || []).length);
  }, []);

  useEffect(() => {
    if (!isSignedInAs("admin")) {
      navigate("/admin/login", { replace: true });
      return;
    }
    (async () => {
      try {
        setAdmin(await api.get("/admin/me"));
        await Promise.all([loadTeachers(), loadSubjects(), loadStats()]);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          endSession();
          navigate("/admin/login", { replace: true });
          return;
        }
        setError(err.message || "Greška pri učitavanju panela.");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, loadTeachers, loadSubjects, loadStats]);

  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [notice]);

  // Posle otkazivanja ili prebacivanja osveži raspored, listu i brojke u zaglavlju.
  const lessonsChanged = useCallback(() => {
    setVersion((value) => value + 1);
    loadStats().catch(() => {});
  }, [loadStats]);

  const showLessons = (preset) => {
    setBookingsPreset({ ...preset, nonce: Date.now() });
    setTab("bookings");
  };

  const handleLogout = () => {
    endSession();
    navigate("/admin/login");
  };

  const openTeacherPanel = () => {
    if (switchRole("teacher")) navigate("/teacher/dashboard");
  };

  if (loading) return <Spinner size="lg" text="Učitavanje panela…" />;
  if (error) return <div className="admin-dashboard"><Alert type="error">{error}</Alert></div>;

  const todayKey = todayKeyLatn(new Date(now));
  const today = week.filter((lesson) => dayKeyLatn(lesson.start_time) === todayKey);
  const todayOnline = today.filter(isOnline).length;
  const { from, to } = weekKeys(todayKey);
  const pending = teachers.filter((teacher) => !teacher.is_approved);
  const teacherSelf = admin && teachers.find((teacher) => teacher.email.toLowerCase() === admin.email.toLowerCase());
  const notify = setNotice;

  return (
    <div className="admin-dashboard dash-page">
      <DashboardHero
        name={admin?.full_name}
        role="Administrator"
        onLogout={handleLogout}
        actions={linkedTeacher && <button type="button" className="btn btn-secondary btn-sm" onClick={openTeacherPanel}><Presentation size={15} aria-hidden="true" /> Profesorski panel</button>}
        aside={<div className="dash-hero-meta">
          <span>{admin?.email}</span>
          {teacherSelf && <span className="dash-hero-chip"><GraduationCap size={13} aria-hidden="true" /> Takođe profesor · {teacherSelf.subjects.map((subject) => subject.name).join(", ")}</span>}
        </div>}
        stats={[
          { label: "Danas", value: today.length, icon: CalendarCheck, tone: "pink", hint: today.length ? `${today.length - todayOnline} uživo · ${todayOnline} online` : "nema zakazanih časova" },
          { label: "Ove nedelje", value: week.length, icon: CalendarRange, tone: "violet", hint: `${formatDayKeyShortLatn(from)} – ${formatDayKeyShortLatn(to)}` },
          { label: "Predstojeći časovi", value: upcomingCount, icon: ClipboardList, tone: "mint", hint: "svi potvrđeni" },
          { label: "Čekaju odobrenje", value: pending.length, icon: UserCheck, tone: "amber", hint: pending.length ? pluralLatn(pending.length, "profesor", "profesora", "profesora") : "svi profesori su odobreni" },
        ]}
      />

      {pending.length > 0 && tab !== "teachers" && <Alert type="warning">
        <span className="pending-alert">Profesori koji čekaju odobrenje: {pending.length}. Do odobrenja ne mogu da se prijave.
          <button type="button" className="text-button" onClick={() => setTab("teachers")}>Pogledaj</button></span>
      </Alert>}

      <AnimatedTabs
        id="admin-tabs"
        className="admin-tabs"
        active={tab}
        onChange={(key) => { setTab(key); setNotice(null); if (key !== "bookings") setBookingsPreset(null); }}
        tabs={[
          { key: "today", icon: CalendarDays, label: "Raspored" },
          { key: "bookings", icon: ClipboardList, label: "Rezervacije" },
          { key: "teachers", icon: GraduationCap, label: "Profesori", count: pending.length || undefined },
          { key: "students", icon: Users, label: "Učenici" },
          { key: "subjects", icon: BookOpen, label: "Predmeti" },
          { key: "applications", icon: Briefcase, label: "Prijave" },
        ]}
      />

      <div ref={noticeRef}>{notice && <Alert type={notice.type} onClose={() => setNotice(null)}>{notice.text}</Alert>}</div>

      {tab === "today" && <DayBoard now={now} teachers={teachers} teacherSelf={teacherSelf} version={version} onChanged={lessonsChanged} onNotice={notify} />}
      {tab === "bookings" && <BookingsTab now={now} teachers={teachers} subjects={subjects} teacherSelf={teacherSelf} preset={bookingsPreset} version={version} onChanged={lessonsChanged} onNotice={notify} />}
      {tab === "teachers" && <TeachersTab teachers={teachers} subjects={subjects} onChanged={loadTeachers} onNotice={notify}
        onShowLessons={(teacher) => showLessons({ status: "upcoming", filters: { teacherId: String(teacher.id) } })} />}
      {tab === "students" && <StudentsTab onNotice={notify} onShowLessons={(student) => showLessons({ status: "all", search: student.email })} />}
      {tab === "subjects" && <SubjectsTab subjects={subjects} teachers={teachers} onChanged={async () => { await Promise.all([loadSubjects(), loadTeachers()]); }} onNotice={notify} />}
      {tab === "applications" && <ApplicationsTab />}
    </div>
  );
}

export default AdminDashboardPage;
