import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, CalendarCheck, CalendarPlus, History, MapPin, PlayCircle, Video } from "lucide-react";
import api from "../services/api";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import DashboardHero from "../components/ui/DashboardHero";
import { formatTimeLatn, formatTimestampDateLatn } from "../utils/srLatnDates";
import { plural } from "../utils/plural";
import "./StudentDashboardPage.css";

const CATEGORY_LABELS = { osnovna: "Osnovna škola", srednja: "Srednja škola", faks: "Fakultet", drugo: "Drugo" };

function LessonCard({ booking, upcoming }) {
  const online = booking.delivery_mode === "online";
  const cancelled = booking.status === "cancelled";
  return <article className={`student-lesson ${cancelled ? "is-cancelled" : ""}`}>
    <div className="student-lesson-date">
      <strong>{formatTimeLatn(booking.start_time)}</strong>
      <span>{formatTimestampDateLatn(booking.start_time, true)}</span>
    </div>
    <div className="student-lesson-body">
      <h3>{booking.subject_name}</h3>
      <p>sa profesorom {booking.teacher_name} · {booking.duration_minutes} min</p>
      <p className="student-lesson-place">{online ? <Video size={15} aria-hidden="true" /> : <MapPin size={15} aria-hidden="true" />}{online ? "Online, Google Meet" : `Uživo, učionica ${booking.classroom_number}`}</p>
    </div>
    <div className="student-lesson-side">
      {cancelled ? <span className="student-lesson-status">Otkazan</span>
        : upcoming && booking.client_cancel_token ? <Link className="student-lesson-cancel" to={`/cancel/${booking.client_cancel_token}`}>Otkaži čas</Link> : <span className="student-lesson-status is-done">Održan</span>}
    </div>
  </article>;
}

function PrepCard({ item }) {
  const { slug, title, lecture_count, video_count, price_eur, purchased, purchase } = item;
  return <article className={`student-prep ${purchased ? "is-paid" : ""}`}>
    <div className="student-prep-head">
      <h3>{title}</h3>
      {purchased
        ? <span className="student-prep-chip"><BadgeCheck size={14} aria-hidden="true" /> Pristup aktivan</span>
        : <span className="student-prep-price">{price_eur} €</span>}
    </div>
    <p className="student-prep-count"><PlayCircle size={15} aria-hidden="true" />{lecture_count} {plural(lecture_count, "snimak", "snimka", "snimaka")}{video_count > 0 && `, ${video_count} sa videom`}</p>
    {purchased
      ? <>
        <p className="student-prep-receipt">Račun {purchase.receipt_number} · {purchase.card_brand} •••• {purchase.card_last4} · {formatTimestampDateLatn(purchase.paid_at, true)}</p>
        <Link to={`/${slug}`} className="btn btn-primary">Otvori snimke <ArrowRight size={15} aria-hidden="true" /></Link>
      </>
      : <>
        <p className="student-prep-receipt">Svi snimci, zadaci i AI asistent uz svaki snimak.</p>
        <Link to={`/${slug}/kupovina`} className="btn btn-accent">Kupi pristup <ArrowRight size={15} aria-hidden="true" /></Link>
        <small className="student-prep-once">jednokratno, bez pretplate</small>
      </>}
  </article>;
}

/** Učenički panel: profil i časovi zakazani dok je učenik bio prijavljen. */
export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [prep, setPrep] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/ucenik/prijava");
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem("token") || localStorage.getItem("role") !== "student") {
      navigate("/ucenik/prijava");
      return;
    }
    Promise.all([api.get("/student/me"), api.get("/student/bookings"), api.get("/student/prep")])
      .then(([me, list, prepList]) => { setStudent(me); setBookings(list.items || []); setPrep(prepList.items || []); })
      .catch((err) => {
        if (err.status === 401) logout();
        else setError(err.message || "Greška pri učitavanju naloga.");
      })
      .finally(() => setLoading(false));
  }, [navigate, logout]);

  if (loading) return <Spinner size="lg" text="Učitavanje naloga…" />;
  if (error) return <div className="student-dashboard"><Alert type="error">{error}</Alert></div>;

  const now = Date.now();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && new Date(b.start_time).getTime() >= now).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const past = bookings.filter((b) => !upcoming.includes(b));
  const paidPrep = prep.filter((p) => p.purchased).length;

  return (
    <div className="student-dashboard dash-page">
      <DashboardHero
        name={student?.full_name}
        role="Učenik"
        onLogout={logout}
        aside={<div className="dash-hero-meta"><span>{student?.email}</span>{student?.category && <span className="dash-hero-chip">{CATEGORY_LABELS[student.category] || student.category}</span>}</div>}
        stats={[
          { label: "Predstojeći časovi", value: upcoming.length, icon: CalendarCheck, tone: "pink" },
          { label: "Prethodni časovi", value: past.length, icon: History, tone: "violet" },
          { label: "Plaćene pripreme", value: paidPrep, icon: PlayCircle, tone: "mint" },
        ]}
      />

      {prep.length > 0 && <section className="student-section" aria-labelledby="prep-title">
        <header><h2 id="prep-title">Moje pripreme</h2><span className="student-section-note">{paidPrep === prep.length ? "Imaš pristup svim snimcima" : paidPrep === 0 ? "Snimci se otključavaju jednokratnom uplatom" : `${paidPrep} od ${prep.length} plaćeno`}</span></header>
        <div className="student-preps">{prep.map((item) => <PrepCard key={item.slug} item={item} />)}</div>
      </section>}

      <section className="student-section" aria-labelledby="upcoming-title">
        <header><h2 id="upcoming-title">Predstojeći časovi</h2><Link to="/booking" className="btn btn-primary"><CalendarPlus size={17} aria-hidden="true" /> Zakaži čas</Link></header>
        {upcoming.length === 0
          ? <div className="student-empty"><p>Još nemaš zakazanih časova.</p><Link to="/booking" className="btn btn-secondary">Zakaži prvi čas</Link></div>
          : <div className="student-lessons">{upcoming.map((b) => <LessonCard key={b.id} booking={b} upcoming />)}</div>}
      </section>

      {past.length > 0 && <section className="student-section" aria-labelledby="past-title">
        <header><h2 id="past-title">Prethodni i otkazani časovi</h2></header>
        <div className="student-lessons">{past.map((b) => <LessonCard key={b.id} booking={b} />)}</div>
      </section>}

      <p className="student-note">U panelu se vide časovi zakazani dok si prijavljen na svoj nalog.</p>
    </div>
  );
}
