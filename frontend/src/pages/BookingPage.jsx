import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Atom, BookOpen, Brain, Calculator, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, CodeXml, FileText, FlaskConical, GraduationCap, Languages, Mail, MapPin, Paperclip, PenLine, RefreshCw, School, UserRound, Users, Video } from "lucide-react";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import api from "../services/api";
import { getSession, isSignedInAs } from "../services/session";
import JourneyProgress from "../components/JourneyProgress";
import LiveTicket from "../components/LiveTicket";
import ScienceCard from "../components/ScienceCard";
import LessonFormatVisual from "../components/LessonFormatVisual";
import TeacherPreviewCards from "../components/TeacherPreviewCards";
import BookingDetailsForm from "../components/BookingDetailsForm";
import TypewriterText from "../components/TypewriterText";
import TeacherAvatar from "../components/TeacherAvatar";
import TimeWheel from "../components/TimeWheel";
import { sparkBurst } from "../utils/effects";
import { BookingSavingOverlay } from "../components/RunningBrain";
import {
  compareSrLatn,
  formatTimeLatn,
  formatTimestampDateLatn,
  getNextBookingDates,
} from "../utils/srLatnDates";
import "./BookingStudio.css";

const STEPS = ["Predmet", "Profesor", "Trajanje", "Vrsta časa", "Datum", "Termin", "Tvoji podaci", "Pregled"];
const DURATIONS = [
  { value: 45, title: "45 minuta", accent: "quick", tagline: "Brzi fokus", description: "Jedno konkretno pitanje ili zadatak", price: 1500 },
  { value: 60, title: "60 minuta", accent: "standard", tagline: "Najčešći izbor", description: "Standardni čas, objašnjenje i vežba", price: 2000, popular: true },
  { value: 90, title: "90 minuta", accent: "deep", tagline: "Dubinski rad", description: "Više oblasti ili intenzivna priprema", price: 2500 },
];
const FACULTY_PRICE_90 = 3000;
const DELIVERY_OPTIONS = [
  { value: "in_person", title: "Uživo", description: "Čas uživo u našem edukativnom centru", icon: School },
  { value: "online", title: "Online", description: "Online čas preko Google Meet-a", icon: Video },
];
const SESSION_OPTIONS = [
  { value: "individual", title: "Individualni", description: "Profesor je posvećen samo tebi", icon: UserRound },
  { value: "group", title: "Grupni", description: "Učenje u dogovorenoj grupi", icon: Users },
];
const CATEGORIES = [
  { value: "osnovna", label: "Osnovna škola" },
  { value: "srednja", label: "Srednja škola" },
  { value: "faks", label: "Fakultet" },
  { value: "drugo", label: "Drugo" },
];
const SUBJECT_ORDER = ["Srpski jezik", "Matematika", "Informatika", "Fizika", "Hemija", "Filozofija", "Engleski jezik", "Nemački jezik", "Nemacki jezik", "Ruski jezik", "Italijanski jezik"];
const CENTER_ADDRESS = "Bože Jankovića 49, Beograd";
const SLOT_STEP_MINUTES = 30;
const WORK_START = 8 * 60;
const WORK_END = 20 * 60;
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ATTACHMENT_EXT_RE = /\.(pdf|png|jpg|jpeg|webp)$/i;
const ATTACHMENT_MIME_OK = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

const isFeaturedTeacher = (teacher) => teacher.full_name?.trim().toLocaleLowerCase("sr-Latn") === "luka bura";
const deliveryLabel = (value) => DELIVERY_OPTIONS.find((option) => option.value === value)?.title || value;
const sessionLabel = (value) => SESSION_OPTIONS.find((option) => option.value === value)?.title || value;
const categoryLabel = (value) => CATEGORIES.find((option) => option.value === value)?.label || value;
const formatBookingDate = (value) => formatTimestampDateLatn(`${value}T12:00:00Z`, true);
const formatRsd = (amount) => `${amount.toLocaleString("sr-Latn-RS").replace(/,/g, ".")} RSD`;
const minutesOfDay = (iso) => { const [h, m] = formatTimeLatn(iso).split(":").map(Number); return h * 60 + m; };
const clockLabel = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Serbian plural for "slobodan termin" (1, 21… / 2–4, 22–24… / rest). */
function slotCountLabel(count) {
  const mod10 = count % 10, mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} slobodan termin`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} slobodna termina`;
  return `${count} slobodnih termina`;
}

/** Drawn icon for each subject (one stroke family instead of unicode glyphs). */
function SubjectIcon({ name, size = 20 }) {
  const text = String(name || "").toLocaleLowerCase("sr-Latn");
  let Icon = BookOpen;
  if (text.includes("matemat")) Icon = Calculator;
  else if (text.includes("informat") || text.includes("program")) Icon = CodeXml;
  else if (text.includes("fizik")) Icon = Atom;
  else if (text.includes("hemij")) Icon = FlaskConical;
  else if (text.includes("filoz")) Icon = Brain;
  else if (text.includes("srpsk")) Icon = PenLine;
  else if (text.includes("jezik")) Icon = Languages;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

function StepHeading({ title, description, onMounted }) {
  // Runs once the incoming step is in the DOM (after AnimatePresence finished the exit).
  useEffect(() => { onMounted?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="booking-step-heading">
      <h2 tabIndex={-1}><TypewriterText text={title} /></h2>
      {description && <p>{description}</p>}
    </header>
  );
}

function CheckMark() {
  return <span className="booking-choice-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>;
}

function StepActions({ onBack, onNext, nextDisabled = false, nextLabel = "Nastavi", busy = false }) {
  return (
    <div className="booking-step-actions">
      {onBack ? <button type="button" className="btn btn-secondary studio-back" onClick={onBack} disabled={busy}><ArrowLeft size={16} aria-hidden="true" /> Nazad</button> : <span />}
      <button type="button" className={`btn btn-primary studio-next ${nextDisabled ? "" : "is-ready"}`} onClick={onNext} disabled={nextDisabled || busy}>
        {busy ? <><span className="booking-button-spinner" /> Zakazujem…</> : <>{nextLabel} <span className="studio-next-arrow" aria-hidden="true"><ArrowRight size={16} /></span></>}
      </button>
    </div>
  );
}

const stepVariants = {
  enter: (direction) => ({ opacity: 0, x: direction > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -20 : 20 }),
};

function BookingPage() {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayAvailability, setDayAvailability] = useState({});

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(null);
  const [deliveryMode, setDeliveryMode] = useState("in_person");
  const [sessionType, setSessionType] = useState("individual");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCategory, setClientCategory] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const attachmentInputRef = useRef(null);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const pageRef = useRef(null);
  const lastScreen = useRef({ step, bookingResult });
  const submittingRef = useRef(false);
  const dateOptions = useMemo(() => getNextBookingDates(14), []);
  const sortedSlots = useMemo(() => [...slots].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)), [slots]);

  // The current public design features Luka; keep real IDs and subject eligibility from the API.
  const displayedTeachers = teachers.filter(isFeaturedTeacher);

  // "Zakaži ponovo" iz učeničkog panela: /booking?predmet=<id>&profesor=<id> preskače već poznate korake.
  const [searchParams] = useSearchParams();
  const prefill = useRef({ subject: Number(searchParams.get("predmet")) || null, teacher: Number(searchParams.get("profesor")) || null });

  // A signed-in student gets their name, email and level filled in; the lesson is linked to their account.
  const [student, setStudent] = useState(null);
  useEffect(() => {
    if (!isSignedInAs("student")) return undefined;
    const controller = new AbortController();
    api.get("/student/me", { signal: controller.signal })
      .then((me) => {
        setStudent(me);
        setClientName((current) => current || me.full_name);
        setClientEmail((current) => current || me.email);
        if (me.category) setClientCategory((current) => current || me.category);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const loadSubjects = useCallback(async (signal) => {
    setSubjectsLoading(true);
    setError("");
    try {
      const data = await api.get("/public/subjects", { signal });
      const items = [...(data.items || [])].sort((a, b) => {
        const aIndex = SUBJECT_ORDER.indexOf(a.name);
        const bIndex = SUBJECT_ORDER.indexOf(b.name);
        if (aIndex >= 0 || bIndex >= 0) return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
        return compareSrLatn(a.name, b.name);
      });
      setSubjects(items);
    } catch (requestError) {
      if (!signal?.aborted) setError(requestError.message);
    } finally {
      if (!signal?.aborted) setSubjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSubjects(controller.signal);
    return () => controller.abort();
  }, [loadSubjects]);

  useEffect(() => {
    const wanted = prefill.current.subject;
    if (!wanted || subjectsLoading) return;
    prefill.current.subject = null;
    const subject = subjects.find((item) => item.id === wanted);
    if (!subject) { prefill.current.teacher = null; return; }
    setSelectedSubject(subject);
    // Without a teacher to preselect, continue on the teacher step.
    if (!prefill.current.teacher) { setDirection(1); setStep(2); }
  }, [subjects, subjectsLoading]);

  useEffect(() => {
    if (!selectedSubject) {
      setTeachers([]);
      return undefined;
    }
    const controller = new AbortController();
    setTeachersLoading(true);
    setTeachers([]);
    setError("");
    api.get(`/public/teachers?subject_id=${selectedSubject.id}`, { signal: controller.signal })
      .then((data) => {
        const items = data.items || [];
        setTeachers(items);
        const wanted = prefill.current.teacher;
        if (!wanted) return;
        prefill.current.teacher = null;
        const teacher = items.find((item) => item.id === wanted && isFeaturedTeacher(item));
        if (teacher) setSelectedTeacher(teacher);
        else setError("Profesor sa prethodnog časa trenutno ne predaje ovaj predmet. Izaberi profesora.");
        setDirection(1);
        setStep(teacher ? 3 : 2);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTeachersLoading(false);
      });
    return () => controller.abort();
  }, [selectedSubject]);

  const loadSlots = useCallback(async (signal) => {
    if (!selectedTeacher || !selectedDate || !selectedDuration) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    setError("");
    try {
      const params = new URLSearchParams({
        teacher_id: String(selectedTeacher.id), date: selectedDate,
        duration: String(selectedDuration), delivery_mode: deliveryMode,
      });
      const data = await api.get(`/public/available-slots?${params}`, { signal });
      setSlots(data.slots || []);
    } catch (requestError) {
      if (!signal?.aborted) setError(requestError.message);
    } finally {
      if (!signal?.aborted) setSlotsLoading(false);
    }
  }, [deliveryMode, selectedDate, selectedDuration, selectedTeacher]);

  useEffect(() => {
    if (step !== 6) return undefined;
    const controller = new AbortController();
    loadSlots(controller.signal);
    return () => controller.abort();
  }, [loadSlots, step]);

  // On the calendar step, look ahead so every day shows how many free slots it has.
  useEffect(() => {
    if (step !== 5 || !selectedTeacher || !selectedDuration) return undefined;
    const controller = new AbortController();
    setDayAvailability({});
    dateOptions.forEach(({ value }) => {
      const params = new URLSearchParams({ teacher_id: String(selectedTeacher.id), date: value, duration: String(selectedDuration), delivery_mode: deliveryMode });
      api.get(`/public/available-slots?${params}`, { signal: controller.signal })
        .then((data) => setDayAvailability((current) => ({ ...current, [value]: (data.slots || []).length })))
        .catch(() => { if (!controller.signal.aborted) setDayAvailability((current) => ({ ...current, [value]: null })); });
    });
    return () => controller.abort();
  }, [step, selectedTeacher, selectedDuration, deliveryMode, dateOptions]);

  const navigatedRef = useRef(false);
  const goTo = (target) => { navigatedRef.current = true; setError(""); setDirection(target > step ? 1 : -1); setStep(target); };
  const goNext = () => goTo(Math.min(step + 1, STEPS.length));
  const goBack = () => goTo(Math.max(step - 1, 1));

  const validateClient = () => {
    const nextErrors = {};
    if (clientName.trim().length < 2) nextErrors.name = "Unesite ime i prezime (najmanje 2 karaktera).";
    if (!clientEmail.trim()) nextErrors.email = "Unesite email adresu.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) nextErrors.email = "Unesite ispravnu email adresu.";
    if (!clientCategory) nextErrors.category = "Izaberite kategoriju.";
    if (attachmentFiles.length > MAX_ATTACHMENTS) nextErrors.attachment = `Možete dodati najviše ${MAX_ATTACHMENTS} priloga.`;
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const addAttachments = (fileList) => {
    const incoming = Array.from(fileList || []);
    setAttachmentFiles((current) => {
      const next = [...current];
      let attachmentError = "";
      for (const file of incoming) {
        if (next.length >= MAX_ATTACHMENTS) { attachmentError = `Možete dodati najviše ${MAX_ATTACHMENTS} priloga.`; break; }
        if (file.size > ATTACHMENT_MAX_BYTES) { attachmentError = "Svaki prilog može imati najviše 25 MB."; break; }
        if (!ATTACHMENT_EXT_RE.test(file.name) || (file.type && !ATTACHMENT_MIME_OK.has(file.type))) {
          attachmentError = "Dozvoljeni su samo PDF, JPG, PNG i WEBP fajlovi."; break;
        }
        const duplicate = next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!duplicate) next.push(file);
      }
      setFormErrors((errors) => ({ ...errors, attachment: attachmentError || undefined }));
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submittingRef.current || !validateClient() || !selectedSlot) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const payload = new FormData();
      payload.append("subject_id", String(selectedSubject.id));
      payload.append("teacher_id", String(selectedTeacher.id));
      payload.append("start_time", selectedSlot.start_time);
      payload.append("duration", String(selectedDuration));
      payload.append("client_full_name", clientName.trim());
      payload.append("client_email", clientEmail.trim());
      payload.append("client_category", clientCategory);
      payload.append("delivery_mode", deliveryMode);
      payload.append("session_type", sessionType);
      if (clientNote.trim()) payload.append("client_note", clientNote.trim());
      attachmentFiles.forEach((file) => payload.append("attachments", file, file.name));
      // Keep the running brain on screen long enough to be seen, even on a fast connection.
      const minimumRun = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : 1600));
      const [result] = await Promise.all([api.postFormData("/public/bookings", payload), minimumRun]);
      setBookingResult(result);
    } catch (requestError) {
      if (requestError.status === 409 || /zauzet|zakazan/i.test(requestError.message)) {
        setDirection(-1);
        setStep(6);
        await loadSlots();
        setError("Taj termin je upravo zauzet. Prikazali smo ti osveženu listu slobodnih termina.");
      } else {
        setError(requestError.message || "Rezervacija nije sačuvana. Pokušajte ponovo.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const resetBooking = () => {
    setDirection(-1);
    setStep(1); setSelectedSubject(null); setSelectedTeacher(null); setSelectedDuration(null);
    setDeliveryMode("in_person"); setSessionType("individual"); setSelectedDate(""); setSelectedSlot(null);
    setClientName(""); setClientEmail(""); setClientCategory(""); setClientNote(""); setAttachmentFiles([]);
    setFormErrors({}); setError(""); setBookingResult(null);
  };

  // Keep the new screen in view and move focus to its heading once it has mounted.
  const focusScreen = useCallback(() => {
    const panel = pageRef.current?.querySelector(bookingResult ? ".booking-success" : ".booking-panel");
    const heading = bookingResult ? panel?.querySelector("h1") : panel?.querySelector(".booking-step-heading h2");
    heading?.focus({ preventScroll: true });
    const headerOffset = 110;
    if (panel && panel.getBoundingClientRect().top < headerOffset) panel.scrollIntoView({ block: "start", behavior: reducedMotion ? "instant" : "smooth" });
  }, [bookingResult, reducedMotion]);

  useEffect(() => {
    if (lastScreen.current.step === step && lastScreen.current.bookingResult === bookingResult) return;
    const resultChanged = lastScreen.current.bookingResult !== bookingResult;
    lastScreen.current = { step, bookingResult };
    // Step changes are focused by StepHeading on mount; result screens are handled here.
    // The confirmation is a new screen: start it at the top.
    if (resultChanged && bookingResult) window.scrollTo({ top: 0, behavior: "instant" });
    if (resultChanged) {
      const frame = requestAnimationFrame(focusScreen);
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [step, bookingResult, reducedMotion, focusScreen]);

  const price = useMemo(() => {
    if (!selectedDuration) return null;
    if (sessionType === "group") return "Po dogovoru";
    if (clientCategory === "faks") return selectedDuration === 90 ? formatRsd(FACULTY_PRICE_90) : "Po dogovoru";
    return formatRsd(DURATIONS.find((duration) => duration.value === selectedDuration)?.price || 0);
  }, [selectedDuration, sessionType, clientCategory]);

  const slotLabel = selectedSlot ? `${formatTimeLatn(selectedSlot.start_time)}–${formatTimeLatn(selectedSlot.end_time)}` : null;
  const summaryRows = [
    ["Predmet", selectedSubject?.name], ["Profesor", selectedTeacher?.full_name],
    ["Trajanje", selectedDuration ? `${selectedDuration} min` : null],
    ["Čas", `${deliveryLabel(deliveryMode)} · ${sessionLabel(sessionType)}`],
    ["Datum", selectedDate ? formatBookingDate(selectedDate) : null],
    ["Termin", slotLabel],
  ];
  const journeyValues = [selectedSubject?.name, selectedTeacher?.full_name, selectedDuration ? `${selectedDuration} min` : null,
    deliveryLabel(deliveryMode), selectedDate ? formatBookingDate(selectedDate) : null, slotLabel, clientName.trim() || null, null];

  // Free and taken start times for the chosen day, laid out hour by hour like a day planner.
  const timeRows = useMemo(() => {
    if (!selectedDuration) return [];
    const free = new Map(sortedSlots.map((slot) => [minutesOfDay(slot.start_time), slot]));
    const starts = new Set(free.keys());
    for (let minute = WORK_START; minute + selectedDuration <= WORK_END; minute += SLOT_STEP_MINUTES) starts.add(minute);
    const rows = new Map();
    [...starts].sort((a, b) => a - b).forEach((minute) => {
      const hour = Math.floor(minute / 60);
      if (!rows.has(hour)) rows.set(hour, []);
      rows.get(hour).push({ minute, slot: free.get(minute) || null });
    });
    return [...rows.entries()].map(([hour, cells]) => ({ hour, cells }));
  }, [sortedSlots, selectedDuration]);

  const wheelItems = useMemo(() => timeRows.flatMap((row) => row.cells).map(({ minute, slot }) => ({ minute, slot, label: clockLabel(minute) })), [timeRows]);

  const dateIndex = dateOptions.findIndex((date) => date.value === selectedDate);
  const selectedDateInfo = dateOptions[dateIndex];
  const longDate = (value) => formatTimestampDateLatn(`${value}T12:00:00Z`).replace(/\s\d{4}\.$/, "");
  const switchDay = (offset) => {
    const next = dateOptions[dateIndex + offset];
    if (!next) return;
    setSelectedDate(next.value);
    setSelectedSlot(null);
  };

  if (bookingResult) {
    const mailStatus = bookingResult.notification_delivery?.status;
    return (
      <div ref={pageRef} className="booking-page studio booking-page--success">
        <section className="booking-success" aria-labelledby="success-title">
          <div className="booking-success-hero">
            <span className="booking-success-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52"><circle className="success-ring" cx="26" cy="26" r="24" /><path className="success-tick" d="M15 27l7 7 15-16" /></svg>
            </span>
            <span className="booking-success-status"><Check size={14} aria-hidden="true" /> Rezervacija #{bookingResult.id} je potvrđena</span>
            <h1 id="success-title" tabIndex={-1}><TypewriterText text="Vidimo se na času!" /></h1>
            {mailStatus === "sent" ? (
              <p className="booking-success-lead">Potvrda i link za otkazivanje poslati su na <strong>{bookingResult.client_email}</strong>.</p>
            ) : mailStatus === "partial" ? (
              <p className="booking-success-lead booking-mail-warning">Čas je potvrđen, ali nisu sva email obaveštenja isporučena. Sačuvajte detalje ispod.</p>
            ) : mailStatus === "failed" ? (
              <p className="booking-success-lead booking-mail-warning">Čas je potvrđen, ali email trenutno nije mogao da bude poslat. Sačuvajte link za otkazivanje.</p>
            ) : mailStatus === "captured" ? (
              <p className="booking-success-lead booking-mail-warning">Čas je potvrđen, ali slanje email potvrda još nije podešeno. Sačuvajte link za otkazivanje.</p>
            ) : <p className="booking-success-lead">Čas je potvrđen. Sačuvajte detalje rezervacije.</p>}
            <div className="booking-success-actions">
              <button type="button" className="btn btn-primary" onClick={resetBooking}>Zakaži još jedan čas</button>
              {student
                ? <Link className="btn btn-secondary" to="/ucenik/panel">Moji časovi</Link>
                : bookingResult.client_cancel_token && <Link className="btn btn-secondary" to={`/cancel/${bookingResult.client_cancel_token}`}>Otvori link za otkazivanje</Link>}
            </div>
            <p className="booking-cancel-note">Besplatno otkazivanje moguće je najkasnije 24 sata pre časa.</p>
          </div>

          <motion.div className="booking-success-ticket" initial={reducedMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3, duration: .7, ease: [.16, 1, .3, 1] }}>
            <div className="booking-ticket-date">
              <span className="booking-ticket-symbol"><SubjectIcon name={bookingResult.subject_name} size={26} /></span>
              <span>{formatTimestampDateLatn(bookingResult.start_time, true)}</span>
              <strong>{formatTimeLatn(bookingResult.start_time)}</strong>
              <small>do {formatTimeLatn(bookingResult.end_time)}</small>
            </div>
            <dl>
              <div><dt><BookOpen size={14} aria-hidden="true" /> Predmet</dt><dd>{bookingResult.subject_name}</dd></div>
              <div><dt><GraduationCap size={14} aria-hidden="true" /> Profesor</dt><dd>{bookingResult.teacher_name}</dd></div>
              <div><dt>Vrsta časa</dt><dd>{deliveryLabel(bookingResult.delivery_mode)} · {sessionLabel(bookingResult.session_type)}</dd></div>
              <div><dt>Učionica</dt><dd>{bookingResult.delivery_mode === "online" ? "Google Meet" : `Učionica ${bookingResult.classroom_number}`}</dd></div>
              <div><dt>Trajanje</dt><dd>{bookingResult.duration_minutes} minuta</dd></div>
              <div><dt>Nivo obrazovanja</dt><dd>{categoryLabel(bookingResult.client_category)}</dd></div>
            </dl>
            <div className="booking-success-contact">
              <div><span><UserRound size={15} aria-hidden="true" /> Ime i prezime</span><strong>{bookingResult.client_full_name}</strong></div>
              <div><span><Mail size={15} aria-hidden="true" /> Email za potvrdu</span><strong>{bookingResult.client_email}</strong></div>
              {bookingResult.client_note && <div className="booking-contact-wide"><span>Napomena za profesora</span><p>{bookingResult.client_note}</p></div>}
              {bookingResult.attachments?.length > 0 && <div className="booking-contact-wide"><span><FileText size={15} aria-hidden="true" /> Priloženi materijali</span><ul>{bookingResult.attachments.map((attachment) => <li key={attachment.id}>{attachment.original_name}</li>)}</ul></div>}
            </div>
          </motion.div>
        </section>
      </div>
    );
  }

  const heading = (title, description) => <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} title={title} description={description} />;
  const editButton = (target, label) => <button type="button" className="booking-review-edit" onClick={() => goTo(target)} aria-label={`Izmeni: ${label}`}>Izmeni</button>;

  const renderStep = () => {
    switch (step) {
      case 1: return <>
        {heading("Izaberi predmet")}
        {subjectsLoading ? <Spinner text="Učitavamo predmete…" /> : subjects.length === 0 ? (
          <div className="booking-empty"><p>Nismo pronašli dostupne predmete.</p><button type="button" className="btn btn-secondary" onClick={() => loadSubjects()}>Pokušaj ponovo</button></div>
        ) : <div className="booking-subject-grid">
          {subjects.map((subject, index) => {
            const selected = subject.id === selectedSubject?.id;
            return <ScienceCard key={subject.id} type="button" className={`booking-subject-card fx-rise ${selected ? "selected" : ""}`} style={{ "--i": index }} aria-pressed={selected} onClick={(event) => {
              sparkBurst(event.currentTarget, event);
              setSelectedSubject(subject); setSelectedTeacher(null); setSelectedDate(""); setSelectedSlot(null);
            }}><span className="booking-subject-glyph"><SubjectIcon name={subject.name} /></span><strong>{subject.name}</strong>{selected && <CheckMark />}</ScienceCard>;
          })}
        </div>}
        {!getSession() && <p className="booking-student-note booking-signin-hint"><UserRound size={16} aria-hidden="true" /> Imaš učenički nalog? <Link to="/ucenik/prijava?dalje=zakazivanje">Prijavi se</Link> pre zakazivanja i čas će biti u tvom panelu.</p>}
        <StepActions onNext={goNext} nextDisabled={!selectedSubject} />
      </>;

      case 2: return <>
        {heading("Izaberi profesora")}
        {teachersLoading ? <Spinner text="Tražimo profesore…" /> : displayedTeachers.length === 0 ? (
          <div className="booking-empty"><p>Trenutno nema aktivnog profesora za ovaj predmet.</p><button type="button" className="btn btn-secondary" onClick={goBack}>Izaberi drugi predmet</button></div>
        ) : <div className="booking-teacher-grid">{displayedTeachers.map((teacher) => {
          const selected = teacher.id === selectedTeacher?.id;
          const teacherSubjects = [...(teacher.subjects || [])].map((subject) => subject.name).sort(compareSrLatn);
          return <ScienceCard key={teacher.id} type="button" className={`booking-teacher-card booking-teacher-featured fx-rise ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={(event) => { sparkBurst(event.currentTarget, event); setSelectedTeacher(teacher); setSelectedDate(""); setSelectedSlot(null); }}>
            <TeacherAvatar name={teacher.full_name} />
            <span className="booking-teacher-copy">
              <strong>{teacher.full_name}</strong>
              {teacherSubjects.length > 0 && <span className="booking-teacher-subjects">{teacherSubjects.map((name) => <span key={name}>{name}</span>)}</span>}
              <span className="booking-teacher-perks" aria-hidden="true"><span><School size={15} /> Uživo</span><span><Video size={15} /> Online</span><span><Users size={15} /> Individualno i grupno</span></span>
            </span>
            <span className="booking-teacher-arrow" aria-hidden="true">{selected ? <Check size={20} /> : <ArrowUpRight size={20} />}</span>
          </ScienceCard>;
        })}<div className="booking-teacher-previews"><p className="booking-teacher-previews-title">Uskoro u timu</p><TeacherPreviewCards /></div></div>}
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedTeacher} />
      </>;

      case 3: return <>
        {heading("Koliko vremena ti treba?", "Cene važe za individualni čas u osnovnoj i srednjoj školi.")}
        <div className="booking-duration-grid">{DURATIONS.map((duration, index) => {
          const selected = selectedDuration === duration.value;
          return <ScienceCard key={duration.value} type="button" className={`booking-duration-card booking-duration-card--${duration.accent} fx-rise ${selected ? "selected" : ""}`} style={{ "--i": index }} aria-pressed={selected} onClick={(event) => { sparkBurst(event.currentTarget, event); setSelectedDuration(duration.value); setSelectedSlot(null); }}>
            {duration.popular && <span className="booking-duration-badge">{duration.tagline}</span>}
            <span className="booking-duration-clock" style={{ "--duration-progress": duration.value / 90 * 100 }} aria-hidden="true">
              <svg viewBox="0 0 100 100"><circle className="duration-ring-track" cx="50" cy="50" r="44" /><circle className="duration-ring-fill" cx="50" cy="50" r="44" pathLength="100" /><g className="duration-ticks">{Array.from({ length: 12 }, (_, tick) => <line key={tick} x1="50" y1="4" x2="50" y2={tick % 3 === 0 ? 11 : 8} transform={`rotate(${tick * 30} 50 50)`} />)}</g><circle className="duration-comet" cx="50" cy="6" r="3.2" /></svg>
              <span className="booking-duration-number">{duration.value}<small>min</small></span>
            </span>
            <strong>{duration.title}</strong>
            <span className="booking-duration-description">{duration.popular ? duration.description : <><em>{duration.tagline}</em> · {duration.description}</>}</span>
            <span className="booking-duration-price">{formatRsd(duration.price)}</span>
            {selected && <CheckMark />}
          </ScienceCard>;
        })}</div>
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDuration} />
      </>;

      case 4: return <>
        {heading("Podesi vrstu časa")}
        <div className="booking-format-grid">
          {[["delivery", "Način održavanja", DELIVERY_OPTIONS, deliveryMode, (value) => { setDeliveryMode(value); setSelectedSlot(null); }],
            ["session", "Tip časa", SESSION_OPTIONS, sessionType, setSessionType]].map(([kind, title, options, value, onChange], panelIndex) => (
            <section key={kind} className="booking-format-panel fx-rise" style={{ "--i": panelIndex }} aria-labelledby={`${kind}-heading`}>
              <header><h3 id={`${kind}-heading`}>{title}</h3></header>
              <LessonFormatVisual kind={kind} mode={value} />
              <div className="booking-format-choices" role="group" aria-label={title}>{options.map((option) => {
                const selected = option.value === value;
                const Icon = option.icon;
                return <button key={option.value} type="button" className={`booking-option-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => onChange(option.value)}>
                  {selected && <motion.span layoutId={`format-pill-${kind}`} className="booking-option-pill" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <span className="booking-option-icon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span><strong>{option.title}</strong>
                </button>;
              })}</div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={value} className="booking-format-description" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .2 }}>{options.find((option) => option.value === value)?.description}</motion.p>
              </AnimatePresence>
            </section>
          ))}
        </div>
        <StepActions onBack={goBack} onNext={goNext} />
      </>;

      case 5: return <>
        {heading("Izaberi dan")}
        <div className="booking-date-grid">{dateOptions.map((date, index) => {
          const selected = date.value === selectedDate;
          const free = dayAvailability[date.value];
          const loading = free === undefined;
          const full = free === 0;
          const weekend = date.weekday === "sub" || date.weekday === "ned";
          return <ScienceCard key={date.value} type="button" className={`booking-date-card fx-rise ${selected ? "selected" : ""} ${weekend ? "is-weekend" : ""} ${full ? "is-full" : ""}`} style={{ "--i": index * .5 }} aria-pressed={selected}
            aria-label={`${date.weekdayLong}, ${date.day}. ${date.month}${loading ? "" : full ? ", nema slobodnih termina" : free ? `, ${slotCountLabel(free)}` : ""}`}
            onClick={(event) => { sparkBurst(event.currentTarget, event, { count: 8 }); setSelectedDate(date.value); setSelectedSlot(null); }}>
            <span className="booking-date-weekday">{index === 0 ? "sutra" : date.weekday}</span>
            <strong>{date.day}</strong>
            <small>{date.month}</small>
            {full && <span className="booking-date-availability" aria-hidden="true">popunjeno</span>}
            {selected && <CheckMark />}
          </ScienceCard>;
        })}</div>
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDate} />
      </>;

      case 6: return <>
        {heading("Izaberi vreme")}
        <div className="booking-time-toolbar">
          <div className="booking-day-switch">
            <button type="button" onClick={() => switchDay(-1)} disabled={dateIndex <= 0 || slotsLoading} aria-label="Prethodni dan"><ChevronLeft size={18} aria-hidden="true" /></button>
            <span aria-live="polite"><strong>{selectedDateInfo ? longDate(selectedDateInfo.value) : ""}</strong>{!slotsLoading && <small>{slotCountLabel(sortedSlots.length)}</small>}</span>
            <button type="button" onClick={() => switchDay(1)} disabled={dateIndex < 0 || dateIndex >= dateOptions.length - 1 || slotsLoading} aria-label="Sledeći dan"><ChevronRight size={18} aria-hidden="true" /></button>
          </div>
          <button type="button" className="booking-time-refresh" onClick={() => loadSlots()} disabled={slotsLoading}><RefreshCw size={14} aria-hidden="true" /> Osveži</button>
        </div>
        {slotsLoading ? <Spinner text="Proveravamo slobodne termine…" /> : sortedSlots.length === 0 ? (
          <div className="booking-empty"><p>Za ovaj dan nema slobodnih termina.</p><div><button type="button" className="btn btn-secondary" onClick={goBack}>Promeni datum</button><button type="button" className="btn btn-secondary" onClick={() => loadSlots()}>Osveži</button></div></div>
        ) : <div className="booking-time-wheel">
          <TimeWheel items={wheelItems} selected={selectedSlot} onSelect={setSelectedSlot} reducedMotion={reducedMotion} />
          <div className="booking-time-side" aria-live="polite">
            {selectedSlot ? <strong className="booking-time-readout">{slotLabel}</strong> : <strong className="booking-time-readout is-empty">--:--</strong>}
            <p>{selectedSlot ? `${longDate(selectedDate)} · ${selectedDuration} minuta` : "Okreni točkić mišem, prstom ili strelicama. Zauzeti termini su precrtani i preskaču se."}</p>
            <div className="booking-time-keys" aria-hidden="true"><span>↑ ranije</span><span>↓ kasnije</span></div>
            <div className="booking-time-daybar" aria-hidden="true">
              {wheelItems.filter((item) => !item.slot).map((item) => <i key={item.minute} className="is-taken" style={{ "--from": (item.minute - WORK_START) / (WORK_END - WORK_START), "--to": (item.minute + SLOT_STEP_MINUTES - WORK_START) / (WORK_END - WORK_START) }} />)}
              {selectedSlot && <i className="is-picked" style={{ "--from": (minutesOfDay(selectedSlot.start_time) - WORK_START) / (WORK_END - WORK_START), "--to": (minutesOfDay(selectedSlot.end_time) - WORK_START) / (WORK_END - WORK_START) }} />}
            </div>
            <div className="booking-time-daylabels" aria-hidden="true"><span>08h</span><span>12h</span><span>16h</span><span>20h</span></div>
          </div>
        </div>}
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedSlot} />
      </>;

      case 7: return <>
        {heading("Unesi svoje podatke", "Podatke koristimo samo za ovu rezervaciju i obaveštenja o času.")}
        {student && <p className="booking-student-note"><UserRound size={16} aria-hidden="true" /> Zakazuješ sa naloga <strong>{student.full_name}</strong>. Čas će se pojaviti u tvom panelu <Link to="/ucenik/panel">Moji časovi</Link>.</p>}
        <BookingDetailsForm
          clientName={clientName}
          clientEmail={clientEmail}
          clientCategory={clientCategory}
          clientNote={clientNote}
          formErrors={formErrors}
          setClientName={setClientName}
          setClientEmail={setClientEmail}
          setClientCategory={setClientCategory}
          setClientNote={setClientNote}
          setFormErrors={setFormErrors}
          selectedSubject={selectedSubject}
          selectedDuration={selectedDuration}
          categories={CATEGORIES}
          attachmentFiles={attachmentFiles}
          setAttachmentFiles={setAttachmentFiles}
          attachmentInputRef={attachmentInputRef}
          dragActive={dragActive}
          setDragActive={setDragActive}
          addAttachments={addAttachments}
          maxAttachments={MAX_ATTACHMENTS}
        />
        <StepActions onBack={goBack} onNext={() => { if (validateClient()) goNext(); }} nextLabel="Pregledaj" />
      </>;

      default: return <>
        {heading("Potvrdi rezervaciju")}
        <div className="booking-review">
          <section className="booking-review-lesson" aria-labelledby="review-lesson">
            <h3 id="review-lesson" className="sr-only">Čas</h3>
            <div className="booking-review-when">
              <div className="booking-review-datetile" aria-hidden="true">
                <span>{selectedDateInfo?.weekday}</span>
                <strong>{selectedDateInfo?.day}</strong>
                <small>{selectedDateInfo?.month}</small>
              </div>
              <div className="booking-review-time">
                <strong>{formatTimeLatn(selectedSlot?.start_time)}–{formatTimeLatn(selectedSlot?.end_time)}</strong>
                <span>{selectedDate ? longDate(selectedDate) : ""} · {selectedDuration} min</span>
              </div>
            </div>
            <dl>
              <div><dt>Termin</dt><dd>{selectedDate ? formatBookingDate(selectedDate) : ""} u {formatTimeLatn(selectedSlot?.start_time)}</dd>{editButton(5, "datum i vreme")}</div>
              <div><dt>Predmet</dt><dd>{selectedSubject?.name}</dd>{editButton(1, "predmet")}</div>
              <div><dt>Profesor</dt><dd>{selectedTeacher?.full_name}</dd>{editButton(2, "profesor")}</div>
              <div><dt>Trajanje</dt><dd>{selectedDuration} minuta</dd>{editButton(3, "trajanje")}</div>
              <div><dt>Vrsta</dt><dd>{deliveryLabel(deliveryMode)} · {sessionLabel(sessionType)}<small>{deliveryMode === "online" ? "Google Meet" : CENTER_ADDRESS}</small></dd>{editButton(4, "vrsta časa")}</div>
            </dl>
          </section>

          <section className="booking-review-person" aria-labelledby="review-client">
            <header><h3 id="review-client">Tvoji podaci</h3>{editButton(7, "podaci")}</header>
            <dl>
              <div><dt>Ime</dt><dd>{clientName}</dd></div>
              <div><dt>Email</dt><dd>{clientEmail}</dd></div>
              <div><dt>Nivo</dt><dd>{categoryLabel(clientCategory)}</dd></div>
              {clientNote && <div><dt>Napomena</dt><dd>{clientNote}</dd></div>}
              {attachmentFiles.length > 0 && <div><dt>Prilozi</dt><dd>{attachmentFiles.map((file) => file.name).join(", ")}</dd></div>}
            </dl>
            <p className="booking-review-mail"><Mail size={16} aria-hidden="true" /> Potvrda i link za otkazivanje stižu na <strong>{clientEmail}</strong>.</p>
          </section>
        </div>
        <p className="booking-review-note"><CalendarDays size={16} aria-hidden="true" /> Potvrdom rezervacije, obaveštenje se šalje tebi i BrainStorm timu.</p>
        <StepActions onBack={goBack} onNext={handleSubmit} nextLabel="Potvrdi rezervaciju" busy={submitting} />
      </>;
    }
  };

  return (
    <div ref={pageRef} className="booking-page studio">
      {submitting && <BookingSavingOverlay />}
      <JourneyProgress steps={STEPS} currentStep={step} values={journeyValues} onStepClick={goTo} />

      <div className={`booking-shell ${step === STEPS.length ? "booking-shell--solo" : ""}`}>
        <div className="booking-workspace">
          <section className="booking-panel" data-step={step}>
            {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div key={step} className="booking-step" data-step={step} custom={direction} variants={reducedMotion ? undefined : stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: .42, ease: [.16, 1, .3, 1] }}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>

        {/* The review step already shows every choice, so the running summary would only repeat it. */}
        {step !== STEPS.length && <LiveTicket rows={summaryRows} step={step} totalSteps={STEPS.length} price={price} />}
      </div>
    </div>
  );
}

export default BookingPage;
