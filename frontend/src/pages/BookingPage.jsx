import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, FileText, GraduationCap, Mail, Moon, RefreshCw, School, Sparkles, Sun, Sunrise, UserRound, Users, Video } from "lucide-react";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import api from "../services/api";
import BrandLogo from "../components/BrandLogo";
import JourneyProgress from "../components/JourneyProgress";
import LiveTicket from "../components/LiveTicket";
import NeuralField from "../components/NeuralField";
import ScienceCard from "../components/ScienceCard";
import SubjectBackdrop from "../components/SubjectBackdrop";
import LessonFormatVisual from "../components/LessonFormatVisual";
import TeacherPreviewCards from "../components/TeacherPreviewCards";
import BookingDetailsForm from "../components/BookingDetailsForm";
import TypewriterText from "../components/TypewriterText";
import TeacherAvatar from "../components/TeacherAvatar";
import { confettiBurst, sparkBurst } from "../utils/effects";
import {
  compareSrLatn,
  formatTimeLatn,
  formatTimestampDateLatn,
  getNextBookingDates,
} from "../utils/srLatnDates";
import "./BookingStudio.css";

const STEPS = ["Predmet", "Profesor", "Trajanje", "Vrsta časa", "Datum", "Termin", "Tvoji podaci", "Pregled"];
// Each step tints the living background a little differently.
const STEP_HUES = [322, 286, 305, 262, 334, 292, 314, 328];
const DURATIONS = [
  { value: 45, title: "45 minuta", accent: "quick", tagline: "Brzi fokus", description: "Jedno konkretno pitanje ili zadatak", price: 1500 },
  { value: 60, title: "60 minuta", accent: "standard", tagline: "Najčešći izbor", description: "Standardni čas — objašnjenje i vežba", price: 2000, popular: true },
  { value: 90, title: "90 minuta", accent: "deep", tagline: "Dubinski rad", description: "Više oblasti ili intenzivna priprema", price: 2500 },
];
const FACULTY_PRICE_90 = 3000;
const DELIVERY_OPTIONS = [
  { value: "in_person", title: "U centru", description: "Čas uživo u BrainStorm učionici", icon: School },
  { value: "online", title: "Online", description: "Čas na daljinu iz svog prostora", icon: Video },
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
const WEEK_HEADERS = ["pon", "uto", "sre", "čet", "pet", "sub", "ned"];
const DAY_PARTS = [
  { key: "morning", label: "Jutro", hint: "08–12h", icon: Sunrise, test: (hour) => hour < 12 },
  { key: "afternoon", label: "Popodne", hint: "12–17h", icon: Sun, test: (hour) => hour >= 12 && hour < 17 },
  { key: "evening", label: "Veče", hint: "17–20h", icon: Moon, test: (hour) => hour >= 17 },
];
const WORK_START = 8 * 60;
const WORK_END = 20 * 60;
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ATTACHMENT_EXT_RE = /\.(pdf|png|jpg|jpeg|webp)$/i;
const ATTACHMENT_MIME_OK = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

const deliveryLabel = (value) => DELIVERY_OPTIONS.find((option) => option.value === value)?.title || value;
const sessionLabel = (value) => SESSION_OPTIONS.find((option) => option.value === value)?.title || value;
const categoryLabel = (value) => CATEGORIES.find((option) => option.value === value)?.label || value;
const formatBookingDate = (value) => formatTimestampDateLatn(`${value}T12:00:00Z`, true);
const formatRsd = (amount) => `${amount.toLocaleString("sr-Latn-RS").replace(/,/g, ".")} RSD`;
const minutesOfDay = (iso) => { const [h, m] = formatTimeLatn(iso).split(":").map(Number); return h * 60 + m; };

/** Serbian plural for "slobodan termin" (1, 21… / 2–4, 22–24… / rest). */
function slotCountLabel(count) {
  const mod10 = count % 10, mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} slobodan termin`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} slobodna termina`;
  return `${count} slobodnih termina`;
}

function subjectSymbol(name) {
  const normalized = String(name || "").toLocaleLowerCase("sr-Latn");
  if (normalized.includes("matemat")) return "∑";
  if (normalized.includes("informat") || normalized.includes("program")) return "</>";
  if (normalized.includes("fizik")) return "ƒ";
  if (normalized.includes("hemij")) return "⚗";
  if (normalized.includes("filoz")) return "φ";
  if (normalized.includes("jezik")) return "Aa";
  return "✦";
}

function subjectFormulas(name) {
  const text = String(name || "").toLocaleLowerCase("sr-Latn");
  if (text.includes("matemat")) return ["∑", "π", "x² + y²", "√x", "a² + b² = c²", "∞", "Δ"];
  if (text.includes("informat") || text.includes("program")) return ["if / else", "{ }", "const", "return", "</>", "true", "01"];
  if (text.includes("fizik")) return ["F = ma", "E = mc²", "λ", "Δt", "v = s/t", "ω", "hν"];
  if (text.includes("hemij")) return ["H₂O", "CO₂", "NaCl", "CH₄", "C₆H₁₂O₆", "O₂", "pH"];
  if (text.includes("filoz")) return ["λόγος", "φ", "zašto?", "ideja", "cogito", "etika", "? →"];
  if (text.includes("srpsk")) return ["Aa · Аа", "č · ć", "ko? šta?", "reč", "N · G · D", "ž · š", "! ?"];
  if (text.includes("engles")) return ["hello", "be · was", "a / the", "word", "if · then", "ABC", "why?"];
  if (text.includes("nema")) return ["der · die", "ä · ö · ü", "ich bin", "Wort", "das · ß", "ABC", "ja"];
  if (text.includes("rusk")) return ["А · Я", "привет", "я · ты", "слово", "мир", "Ж · Ш", "да"];
  if (text.includes("italij")) return ["ciao", "io · tu", "essere", "parola", "à · è", "ABC", "sì"];
  return ["Aa", "reč", "?", "znanje", "→", "ABC", "!"];
}

function StepHeading({ eyebrow, title, description, onMounted }) {
  // Runs once the incoming step is in the DOM (after AnimatePresence finished the exit).
  useEffect(() => { onMounted?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <header className="booking-step-heading">
      {eyebrow && <span className="studio-eyebrow"><i aria-hidden="true" />{eyebrow}</span>}
      <h2 tabIndex={-1}><TypewriterText text={title} /></h2>
      {description && <p>{description}</p>}
    </header>
  );
}

function CheckMark() {
  return <span className="booking-choice-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>;
}

function StepActions({ onBack, onNext, nextDisabled = false, nextLabel = "Nastavi", busy = false, hint }) {
  return (
    <div className="booking-step-actions">
      {onBack ? <button type="button" className="btn btn-secondary studio-back" onClick={onBack} disabled={busy}><ArrowLeft size={16} aria-hidden="true" /> Nazad</button> : <span />}
      {hint && <span className="studio-hint" aria-live="polite">{hint}</span>}
      <button type="button" className={`btn btn-primary studio-next ${nextDisabled ? "" : "is-ready"}`} onClick={onNext} disabled={nextDisabled || busy}>
        {busy ? <><span className="booking-button-spinner" /> Zakazujem…</> : <>{nextLabel} <span className="studio-next-arrow" aria-hidden="true"><ArrowRight size={16} /></span></>}
      </button>
    </div>
  );
}

const stepVariants = {
  enter: (direction) => ({ opacity: 0, x: direction > 0 ? 70 : -70, filter: "blur(10px)", scale: .985 }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", scale: 1 },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? -50 : 50, filter: "blur(8px)", scale: .99 }),
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
  const displayedTeachers = teachers.filter((teacher) => teacher.full_name?.trim().toLocaleLowerCase("sr-Latn") === "luka bura");

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
    if (!selectedSubject) {
      setTeachers([]);
      return undefined;
    }
    const controller = new AbortController();
    setTeachersLoading(true);
    setTeachers([]);
    setError("");
    api.get(`/public/teachers?subject_id=${selectedSubject.id}`, { signal: controller.signal })
      .then((data) => setTeachers(data.items || []))
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
      setBookingResult(await api.postFormData("/public/bookings", payload));
      confettiBurst();
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

  // Calendar: pad the first week so weekdays line up under their headers.
  const calendarCells = useMemo(() => {
    const first = new Date(`${dateOptions[0].value}T12:00:00Z`);
    const leading = (first.getUTCDay() + 6) % 7;
    return [...Array.from({ length: leading }, (_, index) => ({ empty: true, key: `pad-${index}` })), ...dateOptions];
  }, [dateOptions]);

  const slotGroups = useMemo(() => DAY_PARTS.map((part) => ({
    ...part,
    slots: sortedSlots.filter((slot) => part.test(Math.floor(minutesOfDay(slot.start_time) / 60))),
  })).filter((group) => group.slots.length > 0), [sortedSlots]);

  const hue = STEP_HUES[step - 1];

  if (bookingResult) {
    const mailStatus = bookingResult.notification_delivery?.status;
    return (
      <div ref={pageRef} className="booking-page studio booking-page--success">
        <NeuralField hue={150} />
        <section className="booking-success" aria-labelledby="success-title">
          <div className="booking-success-hero">
            <div className="booking-success-brand"><BrandLogo compact /><span className="booking-success-status"><Check size={14} aria-hidden="true" /> Potvrđeno</span></div>
            <span className="booking-success-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52"><circle className="success-ring" cx="26" cy="26" r="24" /><path className="success-tick" d="M15 27l7 7 15-16" /></svg>
            </span>
            <p className="studio-eyebrow"><i aria-hidden="true" />Rezervacija #{bookingResult.id}</p>
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
              {bookingResult.client_cancel_token && <Link className="btn btn-secondary" to={`/cancel/${bookingResult.client_cancel_token}`}>Otvori link za otkazivanje</Link>}
            </div>
            <p className="booking-cancel-note">Besplatno otkazivanje moguće je najkasnije 24 sata pre časa.</p>
          </div>

          <motion.div className="booking-success-ticket" data-spotlight initial={reducedMotion ? false : { opacity: 0, y: 60, rotateX: 25 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: .35, duration: .9, ease: [.2, .8, .2, 1] }}>
            <div className="booking-ticket-date">
              <span className="booking-ticket-symbol" aria-hidden="true">{subjectSymbol(bookingResult.subject_name)}</span>
              <span>{formatTimestampDateLatn(bookingResult.start_time, true)}</span>
              <strong>{formatTimeLatn(bookingResult.start_time)}</strong>
              <small>do {formatTimeLatn(bookingResult.end_time)}</small>
            </div>
            <dl>
              <div><dt><BookOpen size={14} aria-hidden="true" /> Predmet</dt><dd>{bookingResult.subject_name}</dd></div>
              <div><dt><GraduationCap size={14} aria-hidden="true" /> Profesor</dt><dd>{bookingResult.teacher_name}</dd></div>
              <div><dt>Vrsta časa</dt><dd>{deliveryLabel(bookingResult.delivery_mode)} · {sessionLabel(bookingResult.session_type)}</dd></div>
              <div><dt>Učionica</dt><dd>{bookingResult.delivery_mode === "online" ? "Online" : `Učionica ${bookingResult.classroom_number}`}</dd></div>
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

  const renderStep = () => {
    switch (step) {
      case 1: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Počnimo" title="Izaberi predmet" description="Izaberi oblast u kojoj želiš više sigurnosti — ostalo slažemo zajedno." />
        {subjectsLoading ? <Spinner text="Učitavamo predmete…" /> : subjects.length === 0 ? (
          <div className="booking-empty"><p>Nismo pronašli dostupne predmete.</p><button type="button" className="btn btn-secondary" onClick={() => loadSubjects()}>Pokušaj ponovo</button></div>
        ) : <div className="booking-subject-grid">
          {subjects.map((subject, index) => {
            const selected = subject.id === selectedSubject?.id;
            return <ScienceCard key={subject.id} type="button" className={`booking-subject-card fx-rise ${selected ? "selected" : ""}`} style={{ "--i": index }} data-tone={index % 5} formulas={subjectFormulas(subject.name)} backdrop={<SubjectBackdrop name={subject.name} />} aria-pressed={selected} onClick={(event) => {
              sparkBurst(event.currentTarget, event);
              setSelectedSubject(subject); setSelectedTeacher(null); setSelectedDate(""); setSelectedSlot(null);
            }}><span className="booking-subject-glyph" aria-hidden="true">{subjectSymbol(subject.name)}</span><strong>{subject.name}</strong><ArrowUpRight className="booking-subject-arrow" size={18} aria-hidden="true" />{selected && <CheckMark />}</ScienceCard>;
          })}
        </div>}
        <StepActions onNext={goNext} nextDisabled={!selectedSubject} hint={selectedSubject ? `Odlično — ${selectedSubject.name}!` : "Klikni na predmet"} />
      </>;

      case 2: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow={selectedSubject?.name} title="Izaberi profesora" description="Profesor koji vodi tvoj čas od prvog pitanja do poslednjeg zadatka." />
        {teachersLoading ? <Spinner text="Tražimo profesore…" /> : displayedTeachers.length === 0 ? (
          <div className="booking-empty"><span aria-hidden="true">⌁</span><p>Trenutno nema aktivnog profesora za ovaj predmet.</p><button type="button" className="btn btn-secondary" onClick={goBack}>Izaberi drugi predmet</button></div>
        ) : <div className="booking-teacher-grid">{displayedTeachers.map((teacher) => {
          const selected = teacher.id === selectedTeacher?.id;
          return <ScienceCard key={teacher.id} type="button" className={`booking-teacher-card booking-teacher-featured fx-rise ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={(event) => { sparkBurst(event.currentTarget, event); setSelectedTeacher(teacher); setSelectedDate(""); setSelectedSlot(null); }}>
            <TeacherAvatar name={teacher.full_name} />
            <span className="booking-teacher-copy">
              <span className="booking-teacher-note">Tvoj BrainStorm profesor</span>
              <strong>{teacher.full_name}</strong>
              <span className="booking-teacher-subjects"><span>Informatika</span><span>Matematika</span></span>
              <span className="booking-teacher-perks" aria-hidden="true"><span><School size={14} /> U centru</span><span><Video size={14} /> Online</span><span><Users size={14} /> Individualno i grupno</span></span>
            </span>
            <span className="booking-teacher-arrow" aria-hidden="true">{selected ? <Check size={21} /> : <ArrowUpRight size={21} />}</span>
          </ScienceCard>;
        })}<div className="booking-teacher-previews"><p className="booking-teacher-previews-title">Uskoro u timu</p><TeacherPreviewCards /></div></div>}
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedTeacher} hint={selectedTeacher ? null : "Izaberi profesora"} />
      </>;

      case 3: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Tvoj tempo" title="Koliko vremena ti treba?" description="Cene važe za individualni čas u osnovnoj i srednjoj školi." />
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
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDuration} hint={selectedDuration ? null : "Izaberi trajanje"} />
      </>;

      case 4: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Čas po tvojoj meri" title="Podesi vrstu časa" description="Uživo u učionici ili online — sam ili u grupi." />
        <div className="booking-format-grid">
          {[["delivery", "Način održavanja", "01 / 02", DELIVERY_OPTIONS, deliveryMode, (value) => { setDeliveryMode(value); setSelectedSlot(null); }],
            ["session", "Tip časa", "02 / 02", SESSION_OPTIONS, sessionType, setSessionType]].map(([kind, title, index, options, value, onChange], panelIndex) => (
            <section key={kind} className="booking-format-panel fx-rise" style={{ "--i": panelIndex }} data-spotlight aria-labelledby={`${kind}-heading`}>
              <header><h3 id={`${kind}-heading`}>{title}</h3><span className="booking-format-index">{index}</span></header>
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
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Naredne dve nedelje" title="Izaberi dan" description="Ispod svakog dana vidiš koliko slobodnih termina ima za tvoj izbor." />
        <div className="booking-calendar">
          <div className="booking-calendar-head" aria-hidden="true">{WEEK_HEADERS.map((day) => <span key={day} className={day === "sub" || day === "ned" ? "is-weekend" : ""}>{day}</span>)}</div>
          <div className="booking-date-grid">{calendarCells.map((date, index) => {
            if (date.empty) return <span key={date.key} className="booking-date-empty" aria-hidden="true" />;
            const selected = date.value === selectedDate;
            const free = dayAvailability[date.value];
            const loading = free === undefined;
            const full = free === 0;
            const weekend = date.weekday === "sub" || date.weekday === "ned";
            return <ScienceCard key={date.value} type="button" className={`booking-date-card fx-rise ${selected ? "selected" : ""} ${weekend ? "is-weekend" : ""} ${full ? "is-full" : ""}`} style={{ "--i": index * .5 }} aria-pressed={selected}
              aria-label={`${date.weekdayLong}, ${date.day}. ${date.month}${loading ? "" : full ? ", nema slobodnih termina" : free ? `, ${slotCountLabel(free)}` : ""}`}
              onClick={(event) => { sparkBurst(event.currentTarget, event, { count: 8 }); setSelectedDate(date.value); setSelectedSlot(null); }}>
              {selected && <motion.span layoutId="date-glow" className="booking-date-glow" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="booking-date-weekday">{index === calendarCells.findIndex((cell) => !cell.empty) ? "sutra" : date.weekday}</span>
              <strong>{date.day}</strong>
              <small>{date.month}</small>
              <span className={`booking-date-availability ${loading ? "is-loading" : ""}`} aria-hidden="true">
                {loading ? <i /> : full ? "popunjeno" : free == null ? "" : <><b style={{ "--fill": Math.min(1, free / 24) }} />{free}</>}
              </span>
              {selected && <CheckMark />}
            </ScienceCard>;
          })}</div>
        </div>
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDate} hint={selectedDate ? formatBookingDate(selectedDate) : "Izaberi dan"} />
      </>;

      case 6: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow={selectedDate ? formatBookingDate(selectedDate) : "Termin"} title="Izaberi vreme" description="Termini su prilagođeni trajanju časa koje si izabrao." />
        {slotsLoading ? <Spinner text="Proveravamo slobodne termine…" /> : sortedSlots.length === 0 ? (
          <div className="booking-empty"><span aria-hidden="true">◷</span><p>Za ovu kombinaciju nema slobodnih termina.</p><div><button type="button" className="btn btn-secondary" onClick={goBack}>Promeni datum</button><button type="button" className="btn btn-secondary" onClick={() => loadSlots()}>Osveži</button></div></div>
        ) : <>
          <div className="booking-day-timeline" aria-hidden="true">
            <div className="booking-day-timeline-bar">
              {sortedSlots.map((slot) => <i key={slot.start_time} style={{ "--at": (minutesOfDay(slot.start_time) - WORK_START) / (WORK_END - WORK_START) }} />)}
              {selectedSlot && <span className="booking-day-timeline-pick" data-anchor={minutesOfDay(selectedSlot.start_time) - WORK_START < 120 ? "start" : WORK_END - minutesOfDay(selectedSlot.end_time) < 120 ? "end" : "center"} style={{ "--from": (minutesOfDay(selectedSlot.start_time) - WORK_START) / (WORK_END - WORK_START), "--to": (minutesOfDay(selectedSlot.end_time) - WORK_START) / (WORK_END - WORK_START) }}><b>{slotLabel}</b></span>}
            </div>
            <div className="booking-day-timeline-hours">{[8, 10, 12, 14, 16, 18, 20].map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}h</span>)}</div>
          </div>
          <div className="booking-slots-heading"><span><i /> {slotCountLabel(sortedSlots.length)}</span><button type="button" onClick={() => loadSlots()} disabled={slotsLoading}><RefreshCw size={13} aria-hidden="true" /> Osveži</button></div>
          <div className="booking-slot-groups">{slotGroups.map((group, groupIndex) => {
            const Icon = group.icon;
            return <section key={group.key} className={`booking-slot-group booking-slot-group--${group.key} fx-rise`} style={{ "--i": groupIndex }} aria-label={group.label}>
              <header><span className="booking-slot-group-icon"><Icon size={17} aria-hidden="true" /></span><strong>{group.label}</strong><small>{group.hint}</small><em>{group.slots.length}</em></header>
              <div className="booking-slot-grid">{group.slots.map((slot) => {
                const selected = selectedSlot?.start_time === slot.start_time;
                return <ScienceCard key={`${slot.start_time}-${slot.end_time}`} type="button" className={`booking-slot-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={(event) => { sparkBurst(event.currentTarget, event, { count: 8 }); setSelectedSlot(slot); }}>
                  {selected && <motion.span layoutId="slot-glow" className="booking-slot-glow" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  <span className="booking-slot-start"><small>Početak časa</small><strong>{formatTimeLatn(slot.start_time)}</strong></span>
                  <span className="booking-slot-end"><small>Završetak</small><strong>{formatTimeLatn(slot.end_time)}</strong></span>
                  {selected && <CheckMark />}
                </ScienceCard>;
              })}</div>
            </section>;
          })}</div>
        </>}
        <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedSlot} hint={slotLabel || "Izaberi termin"} />
      </>;

      case 7: return <>
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Još samo malo" title="Unesi svoje podatke" description="Podatke koristimo samo za ovu rezervaciju i obaveštenja o času." />
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
        <StepHeading onMounted={navigatedRef.current ? focusScreen : undefined} eyebrow="Sve je spremno" title="Potvrdi rezervaciju" description="Termin se rezerviše tek kada pritisneš dugme za potvrdu." />
        <div className="booking-review" data-spotlight>
          <div className="booking-review-banner">
            <span className="booking-review-symbol" aria-hidden="true">{subjectSymbol(selectedSubject?.name)}</span>
            <div><small>Tvoj sledeći čas</small><strong>{selectedSubject?.name}</strong><span>sa profesorom · {selectedTeacher?.full_name}</span></div>
            <span className="booking-review-duration"><Clock3 size={16} aria-hidden="true" />{selectedDuration} min</span>
          </div>
          <div className="booking-review-when">
            <div><CalendarDays size={18} aria-hidden="true" /><span>{formatBookingDate(selectedDate)}</span></div>
            <strong>{formatTimeLatn(selectedSlot?.start_time)}<span aria-hidden="true">→</span>{formatTimeLatn(selectedSlot?.end_time)}</strong>
            <div className="booking-review-price"><small>Okvirna cena</small><b>{price}</b></div>
          </div>
          <div className="booking-review-perforation" aria-hidden="true"><i /><span /><i /></div>
          <div className="booking-review-sections">
            <section><h3><Sparkles size={16} aria-hidden="true" /> Detalji časa</h3><dl>
              <div><dt>Datum</dt><dd>{formatBookingDate(selectedDate)}</dd></div><div><dt>Vreme</dt><dd>{slotLabel}</dd></div>
              <div><dt>Trajanje</dt><dd>{selectedDuration} min</dd></div><div><dt>Vrsta</dt><dd>{deliveryLabel(deliveryMode)} · {sessionLabel(sessionType)}</dd></div>
            </dl></section>
            <section><h3><UserRound size={16} aria-hidden="true" /> Tvoji podaci</h3><dl><div><dt>Ime</dt><dd>{clientName}</dd></div><div><dt>Email</dt><dd>{clientEmail}</dd></div><div><dt>Nivo</dt><dd>{categoryLabel(clientCategory)}</dd></div>{clientNote && <div><dt>Napomena</dt><dd>{clientNote}</dd></div>}{attachmentFiles.length > 0 && <div><dt>Prilozi</dt><dd>{attachmentFiles.map((file) => file.name).join(", ")}</dd></div>}</dl></section>
          </div>
        </div>
        <p className="booking-review-note"><span aria-hidden="true"><Check size={13} strokeWidth={3} /></span> Potvrdom rezervacije, obaveštenje se šalje tebi, profesoru i BrainStorm timu.</p>
        <StepActions onBack={goBack} onNext={handleSubmit} nextLabel="Potvrdi rezervaciju" busy={submitting} />
      </>;
    }
  };

  return (
    <div ref={pageRef} className="booking-page studio" style={{ "--step-hue": hue }}>
      <NeuralField hue={hue} />
      <header className="booking-intro">
        <div>
          <p className="studio-eyebrow"><Sparkles size={13} aria-hidden="true" /> Online zakazivanje</p>
          <h1>Tvoj sledeći čas <em>počinje ovde.</em></h1>
        </div>
        <JourneyProgress steps={STEPS} currentStep={step} values={journeyValues} onStepClick={goTo} />
      </header>

      <div className="booking-shell">
        <div className="booking-workspace">
          <section className="booking-panel" data-step={step} data-spotlight>
            <span className="studio-watermark" aria-hidden="true"><AnimatePresence mode="popLayout" initial={false}><motion.span key={step} initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} transition={{ duration: .5 }}>{String(step).padStart(2, "0")}</motion.span></AnimatePresence></span>
            {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div key={step} className="booking-step" data-step={step} custom={direction} variants={reducedMotion ? undefined : stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: .42, ease: [.2, .8, .2, 1] }}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>

        <LiveTicket rows={summaryRows} step={step} totalSteps={STEPS.length} symbol={subjectSymbol(selectedSubject?.name)} price={price} />
      </div>
    </div>
  );
}

export default BookingPage;
