import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Spinner from "../components/Spinner";
import Alert from "../components/Alert";
import Badge from "../components/Badge";
import NeuralField from "../components/NeuralField";
import DashboardHero from "../components/ui/DashboardHero";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import { AlertTriangle, BookOpen, CalendarClock, CalendarPlus, ClipboardList, Clock3, Inbox, Paperclip, X } from "lucide-react";
import {
  APP_TIME_ZONE,
  formatDateFullLatn,
  formatTimeLatn,
  formatTimestampDateLatn,
  getBookingDatesIncludingToday,
} from "../utils/srLatnDates";
import "./TeacherDashboardPage.css";

/* -------------------------------------------------- */
/*  Helpers                                            */
/* -------------------------------------------------- */
function pad(n) {
  return String(n).padStart(2, "0");
}

/** Generiši time slotove od startH:startM do endH:endM na 30 min */
function generateTimeSlots(startH = 8, startM = 0, endH = 21, endM = 30) {
  const slots = [];
  let h = startH, m = startM;
  while (h < endH || (h === endH && m <= endM)) {
    slots.push(`${pad(h)}:${pad(m)}`);
    m += 30;
    if (m >= 60) { m = 0; h++; }
  }
  return slots;
}

const CATEGORY_LABELS = { osnovna: "Osnovna škola", srednja: "Srednja škola", faks: "Fakultet", drugo: "Drugo" };

const START_TIME_SLOTS = generateTimeSlots(8, 0, 21, 30);
const END_TIME_SLOTS = generateTimeSlots(8, 30, 22, 30);

/* -------------------------------------------------- */
/*  Komponenta                                         */
/* -------------------------------------------------- */
function TeacherDashboardPage() {
  const navigate = useNavigate();

  // ---- Profil ----
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- Dostupnost ----
  const [availabilities, setAvailabilities] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState("");
  const [availSuccess, setAvailSuccess] = useState("");
  const [addingAvail, setAddingAvail] = useState(false);

  // forma
  const [selectedDate, setSelectedDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // ---- Bookings ----
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingsNotice, setBookingsNotice] = useState(null);
  const [bookingsFilter, setBookingsFilter] = useState("upcoming");
  const [cancellingId, setCancellingId] = useState(null);
  const [attachmentDownloadingKey, setAttachmentDownloadingKey] = useState(null);

  // ---- Pregled predstojećih časova (za statistiku u zaglavlju) ----
  const [upcoming, setUpcoming] = useState([]);

  // ---- Active tab ----
  const [activeTab, setActiveTab] = useState("availability");

  // ---- Memo ----
  const nextDays = useMemo(() => getBookingDatesIncludingToday(14), []);

  const endTimeSlots = useMemo(() => {
    if (!startTime) return [];
    // End time mora biti bar 45 min posle starta
    const [sh, sm] = startTime.split(":").map(Number);
    const startMin = sh * 60 + sm + 45; // minimum 45 min later
    return END_TIME_SLOTS.filter((t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m >= startMin;
    });
  }, [startTime]);

  const startTimeSlots = useMemo(() => {
    if (!selectedDate || selectedDate !== nextDays[0]?.value) return START_TIME_SLOTS;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date());
    const value = (type) => Number(parts.find((part) => part.type === type)?.value);
    const nowMinutes = value("hour") * 60 + value("minute");
    return START_TIME_SLOTS.filter((time) => {
      const [hour, minute] = time.split(":").map(Number);
      return hour * 60 + minute > nowMinutes;
    });
  }, [nextDays, selectedDate]);

  /* ======================================= */
  /*  Fetch profil                            */
  /* ======================================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token || role !== "teacher") {
      navigate("/teacher/login");
      return;
    }

    (async () => {
      try {
        const data = await api.get("/teacher/me");
        setTeacher(data);
      } catch (err) {
        setError(err.message || "Greška pri učitavanju profila.");
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          navigate("/teacher/login");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  /* ======================================= */
  /*  Fetch dostupnost                        */
  /* ======================================= */
  const fetchAvailabilities = useCallback(async () => {
    setAvailLoading(true);
    setAvailError("");
    try {
      const now = new Date().toISOString();
      const data = await api.get(`/teacher/availabilities?from_date=${now}`);
      setAvailabilities(data.items || []);
    } catch (err) {
      setAvailError(err.message || "Greška pri učitavanju dostupnosti.");
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (teacher) fetchAvailabilities();
  }, [teacher, fetchAvailabilities]);

  /* ======================================= */
  /*  Dodaj dostupnost                        */
  /* ======================================= */
  const handleAddAvailability = async () => {
    setAvailError("");
    setAvailSuccess("");

    if (!selectedDate) {
      setAvailError("Izaberite datum.");
      return;
    }
    if (!startTime) {
      setAvailError("Izaberite početno vreme.");
      return;
    }
    if (!endTime) {
      setAvailError("Izaberite završno vreme.");
      return;
    }

    const startISO = `${selectedDate}T${startTime}:00`;
    const endISO = `${selectedDate}T${endTime}:00`;

    setAddingAvail(true);
    try {
      await api.post("/teacher/availabilities", {
        start_time: startISO,
        end_time: endISO,
      });
      setAvailSuccess("Dostupnost je uspešno dodata!");
      setSelectedDate("");
      setStartTime("");
      setEndTime("");
      fetchAvailabilities();
      setTimeout(() => setAvailSuccess(""), 4000);
    } catch (err) {
      setAvailError(err.message || "Greška pri dodavanju dostupnosti.");
    } finally {
      setAddingAvail(false);
    }
  };

  /* ======================================= */
  /*  Obriši dostupnost                       */
  /* ======================================= */
  const handleDeleteAvailability = async (id) => {
    if (!window.confirm("Da li ste sigurni da želite da obrišete ovu dostupnost?")) return;
    setAvailError("");
    try {
      await api.delete(`/teacher/availabilities/${id}`);
      setAvailSuccess("Dostupnost je uklonjena.");
      fetchAvailabilities();
      setTimeout(() => setAvailSuccess(""), 3000);
    } catch (err) {
      setAvailError(err.message || "Greška pri brisanju.");
    }
  };

  const fetchUpcoming = useCallback(async () => {
    try {
      const data = await api.get("/teacher/bookings?status=confirmed&upcoming_only=true");
      setUpcoming([...(data.items || [])].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
    } catch {
      setUpcoming([]);
    }
  }, []);

  useEffect(() => {
    if (teacher) fetchUpcoming();
  }, [teacher, fetchUpcoming]);

  /* ======================================= */
  /*  Fetch bookings                          */
  /* ======================================= */
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      let url = "/teacher/bookings";
      if (bookingsFilter === "upcoming") url += "?status=confirmed&upcoming_only=true";
      else if (bookingsFilter) url += `?status=${bookingsFilter}`;
      const data = await api.get(url);
      setBookings(data.items || []);
    } catch (err) {
      setBookingsError(err.message || "Greška pri učitavanju rezervacija.");
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingsFilter]);

  useEffect(() => {
    if (teacher) fetchBookings();
  }, [teacher, fetchBookings]);

  /* ======================================= */
  /*  Otkaži booking                          */
  /* ======================================= */
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Da li ste sigurni da želite da otkažete ovu rezervaciju?")) return;
    setCancellingId(bookingId);
    setBookingsError("");
    setBookingsNotice(null);
    try {
      const response = await api.patch(`/teacher/bookings/${bookingId}/cancel`);
      const mailStatus = response.notification_delivery?.status;
      setBookingsNotice({
        type: mailStatus === "sent" ? "success" : "warning",
        text: mailStatus === "failed"
          ? "Čas je otkazan, ali email obaveštenja nisu poslata."
          : mailStatus === "partial"
            ? "Čas je otkazan, ali deo email obaveštenja nije isporučen."
            : mailStatus === "captured"
              ? "Čas je otkazan, ali slanje email obaveštenja još nije podešeno."
              : mailStatus === "sent"
                ? "Čas je otkazan i email obaveštenja su poslata."
                : "Čas je otkazan. Slanje email obaveštenja nije potvrđeno.",
      });
      await Promise.all([fetchBookings(), fetchUpcoming()]);
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
        `/teacher/bookings/${bookingId}/attachments/${attachmentId}`,
        originalName || "prilog",
      );
    } catch (err) {
      setBookingsError(err.message || "Preuzimanje priloga nije uspelo.");
    } finally {
      setAttachmentDownloadingKey(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/teacher/login");
  };

  /* ======================================= */
  /*  Render                                   */
  /* ======================================= */
  const nextLesson = upcoming[0];
  const availableHours = Math.round(availabilities.reduce((sum, a) => sum + (new Date(a.end_time) - new Date(a.start_time)), 0) / 36e5);

  if (loading) return <Spinner size="lg" text="Učitavanje profila..." />;
  if (error) return <Alert type="error">{error}</Alert>;

  return (
    <div className="teacher-dashboard dash-page">
      <NeuralField hue={300} density={.7} />
      <DashboardHero
        name={teacher?.full_name}
        role="Profesor"
        onLogout={handleLogout}
        aside={<>
          <div className="dash-hero-meta">
            <span>{teacher?.email}</span>
            {teacher?.subjects?.length > 0
              ? teacher.subjects.map((subject) => <span key={subject.id} className="dash-hero-chip"><BookOpen size={13} aria-hidden="true" /> {subject.name}</span>)
              : <span className="empty-text">Nemate dodeljenih predmeta. Kontaktirajte administratora.</span>}
          </div>
          {nextLesson && <p className="dash-hero-next"><i aria-hidden="true" /> Sledeći čas: <b>{formatTimestampDateLatn(nextLesson.start_time, true)} u {formatTimeLatn(nextLesson.start_time)}</b> · {nextLesson.subject_name} · {nextLesson.client_full_name}</p>}
        </>}
        stats={[
          { label: "Predstojeći časovi", value: upcoming.length, icon: CalendarClock, tone: "pink", hint: "potvrđene rezervacije" },
          { label: "Slobodni termini", value: availabilities.length, icon: CalendarPlus, tone: "violet", hint: "u narednom periodu" },
          { label: "Sati dostupnosti", value: availableHours, icon: Clock3, tone: "mint", hint: "ukupno otvoreno" },
          { label: "Predmeti", value: teacher?.subjects?.length || 0, icon: BookOpen, tone: "amber" },
        ]}
      />

      {/* ---- Tabovi ---- */}
      <AnimatedTabs
        id="teacher-tabs"
        className="dashboard-tabs"
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: "availability", label: "Moja dostupnost", icon: CalendarPlus, count: availabilities.length },
          { key: "bookings", label: "Moje rezervacije", icon: ClipboardList, count: upcoming.length },
        ]}
      />

      {/* ================================ */}
      {/*  TAB: Dostupnost                  */}
      {/* ================================ */}
      {activeTab === "availability" && (
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">Dodaj slobodan termin</h2>
            <p className="section-desc">
              Izaberite datum, početno i završno vreme. Klijenti rezervišu časove samo unutar vaše dostupnosti.
            </p>
          </div>

          {/* ---- KORAK 1: Datum ---- */}
          <div className="avail-step">
            <div className="avail-step-label">
              <span className="avail-step-num">1</span>
              Izaberite datum
            </div>
            <div className="dates-scroll">
              <div className="dates-track">
                {nextDays.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`date-chip ${selectedDate === d.value ? "selected" : ""} ${d.isToday ? "today" : ""}`}
                    onClick={() => {
                      setSelectedDate(d.value);
                      setStartTime("");
                      setEndTime("");
                    }}
                  >
                    <span className="date-chip-day">{d.weekday}</span>
                    <span className="date-chip-num">{d.day}</span>
                    <span className="date-chip-month">{d.month}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ---- KORAK 2: Početno vreme ---- */}
          {selectedDate && (
            <div className="avail-step">
              <div className="avail-step-label">
                <span className="avail-step-num">2</span>
                Početno vreme
              </div>
              <div className="time-grid">
                {startTimeSlots.map((t) => (
                  <button
                    key={`s-${t}`}
                    type="button"
                    className={`time-chip ${startTime === t ? "selected" : ""}`}
                    onClick={() => {
                      setStartTime(t);
                      setEndTime("");
                    }}
                  >
                    {t}
                  </button>
                ))}
                {startTimeSlots.length === 0 && <p className="empty-text">Za danas više nema početnih vremena. Izaberite naredni dan.</p>}
              </div>
            </div>
          )}

          {/* ---- KORAK 3: Završno vreme ---- */}
          {startTime && (
            <div className="avail-step">
              <div className="avail-step-label">
                <span className="avail-step-num">3</span>
                Završno vreme
              </div>
              <div className="time-grid">
                {endTimeSlots.map((t) => (
                  <button
                    key={`e-${t}`}
                    type="button"
                    className={`time-chip ${endTime === t ? "selected" : ""}`}
                    onClick={() => setEndTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- Rezime + Dodaj ---- */}
          {selectedDate && startTime && endTime && (
            <div className="avail-summary">
              <div className="avail-summary-text">
                <span className="avail-summary-icon"><CalendarPlus size={18} aria-hidden="true" /></span>
                <span>
                  <strong>{formatDateFullLatn(selectedDate)}</strong>
                  <br />
                  {startTime} — {endTime}
                </span>
              </div>
              <button
                className="btn btn-primary btn-add-avail"
                onClick={handleAddAvailability}
                disabled={addingAvail}
              >
                {addingAvail ? "Dodajem..." : "Dodaj dostupnost"}
              </button>
            </div>
          )}

          {availError && <Alert type="error" onClose={() => setAvailError("")}>{availError}</Alert>}
          {availSuccess && <Alert type="success" onClose={() => setAvailSuccess("")}>{availSuccess}</Alert>}

          {/* ---- Lista postojećih ---- */}
          <div className="avail-existing">
            <h3 className="avail-existing-title">
              Vaši slobodni termini
              <span className="avail-count">{availabilities.length}</span>
            </h3>

            {availLoading ? (
              <Spinner text="Učitavanje..." />
            ) : availabilities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Inbox size={30} strokeWidth={1.5} aria-hidden="true" /></div>
                <p>Nemate definisanih slobodnih termina.</p>
                <p className="text-muted">Koristite formu iznad da dodate dostupnost.</p>
              </div>
            ) : (
              <div className="avail-list">
                {availabilities.map((a, index) => {
                  return (
                    <div key={a.id} className="avail-card fx-rise" style={{ "--i": Math.min(index, 12) }}>
                      <div className="avail-card-date">
                        <span className="avail-card-dayname">{formatTimestampDateLatn(a.start_time)}</span>
                      </div>
                      <div className="avail-card-time">
                        {formatTimeLatn(a.start_time)} — {formatTimeLatn(a.end_time)}
                      </div>
                      <button
                        className="avail-card-delete"
                        onClick={() => handleDeleteAvailability(a.id)}
                        title="Obriši"
                        aria-label={`Obriši termin ${formatTimestampDateLatn(a.start_time)}`}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================ */}
      {/*  TAB: Rezervacije                 */}
      {/* ================================ */}
      {activeTab === "bookings" && (
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">Moje rezervacije</h2>
          </div>

          {/* Filter */}
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

          {bookingsError && <Alert type="error" onClose={() => setBookingsError("")}>{bookingsError}</Alert>}
          {bookingsNotice && <Alert type={bookingsNotice.type} onClose={() => setBookingsNotice(null)}>{bookingsNotice.text}</Alert>}

          {bookingsLoading ? (
            <Spinner text="Učitavanje rezervacija..." />
          ) : bookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><ClipboardList size={30} strokeWidth={1.5} aria-hidden="true" /></div>
              <p>
                {bookingsFilter === "upcoming"
                  ? "Nemate predstojećih rezervacija."
                  : bookingsFilter === "confirmed"
                  ? "Nemate potvrđenih rezervacija."
                  : bookingsFilter === "cancelled"
                  ? "Nemate otkazanih rezervacija."
                  : "Nemate rezervacija."}
              </p>
            </div>
          ) : (
            <div className="bookings-list">
              {bookings.map((b, index) => {
                const isPast = new Date(b.start_time) < new Date();
                const canCancel =
                  b.status === "confirmed" &&
                  !isPast &&
                  new Date(b.start_time) - new Date() > 24 * 60 * 60 * 1000;

                return (
                  <div key={b.id} className={`booking-card fx-rise ${b.status === "cancelled" ? "cancelled" : ""}`} style={{ "--i": Math.min(index, 10) }} data-spotlight>
                    <div className="booking-card-top">
                      <div className="booking-subject">{b.subject_name}</div>
                      <Badge type={b.status === "confirmed" ? "success" : "error"}>
                        {b.status === "confirmed" ? "Potvrđena" : "Otkazana"}
                      </Badge>
                    </div>
                    <div className="booking-card-details">
                      <div className="booking-detail">
                        <span className="booking-detail-label">Datum</span>
                        <span className="booking-detail-value">
                          {formatTimestampDateLatn(b.start_time)}
                        </span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Vreme</span>
                        <span className="booking-detail-value">
                          {formatTimeLatn(b.start_time)} — {formatTimeLatn(b.end_time)} ({b.duration_minutes} min)
                        </span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Način</span>
                        <span className="booking-detail-value">
                          {b.delivery_mode === "online" ? "Online" : "Uživo"} ·{" "}
                          {b.session_type === "group" ? "Grupni" : "Individualni"}
                        </span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Učionica</span>
                        <span className="booking-detail-value">
                          {b.classroom_number === 0
                            ? "— (online)"
                            : `Učionica ${b.classroom_number}`}
                        </span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Klijent</span>
                        <span className="booking-detail-value">{b.client_full_name}</span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Email</span>
                        <span className="booking-detail-value">{b.client_email}</span>
                      </div>
                      <div className="booking-detail">
                        <span className="booking-detail-label">Kategorija</span>
                        <span className="booking-detail-value">{CATEGORY_LABELS[b.client_category] || b.client_category}</span>
                      </div>
                      {b.client_note && (
                        <div className="booking-detail full-width">
                          <span className="booking-detail-label">Napomena</span>
                          <span className="booking-detail-value">{b.client_note}</span>
                        </div>
                      )}
                      {b.attachments?.length > 0 && (
                        <div className="booking-detail full-width">
                          <span className="booking-detail-label">Prilozi</span>
                          <span className="booking-detail-value booking-attachments-list">
                            {b.attachments.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() =>
                                  handleDownloadAttachment(b.id, a.id, a.original_name)
                                }
                                disabled={attachmentDownloadingKey === `${b.id}-${a.id}`}
                              >
                                {attachmentDownloadingKey === `${b.id}-${a.id}`
                                  ? "Preuzimam..."
                                  : <><Paperclip size={13} aria-hidden="true" /> {a.original_name}</>}
                              </button>
                            ))}
                          </span>
                        </div>
                      )}
                      {b.cancellation_reason && (
                        <div className="booking-detail full-width">
                          <span className="booking-detail-label">Razlog otkazivanja</span>
                          <span className="booking-detail-value">{b.cancellation_reason}</span>
                        </div>
                      )}
                    </div>

                    {canCancel && (
                      <div className="booking-card-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancelBooking(b.id)}
                          disabled={cancellingId === b.id}
                        >
                          {cancellingId === b.id ? "Otkazujem..." : "Otkaži čas"}
                        </button>
                      </div>
                    )}

                    {b.status === "confirmed" && !isPast && !canCancel && (
                      <div className="booking-notice">
                        <AlertTriangle size={14} aria-hidden="true" /> Otkazivanje nije moguće — manje od 24h do početka časa.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeacherDashboardPage;
