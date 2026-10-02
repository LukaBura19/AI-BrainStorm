import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import Stepper from "../components/Stepper";
import api from "../services/api";
import { ArrowUpRight, BookOpen, CalendarDays, Check, Clock3, FileText, GraduationCap, Mail, School, Sparkles, UserRound, Users, Video } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import BookingSummary from "../components/BookingSummary";
import ScienceCard from "../components/ScienceCard";
import SubjectBackdrop from "../components/SubjectBackdrop";
import LessonFormatVisual from "../components/LessonFormatVisual";
import TeacherPreviewCards from "../components/TeacherPreviewCards";
import BookingDetailsForm from "../components/BookingDetailsForm";
import TypewriterText from "../components/TypewriterText";
import TeacherAvatar from "../components/TeacherAvatar";
import {
  compareSrLatn,
  formatTimeLatn,
  formatTimestampDateLatn,
  getNextBookingDates,
} from "../utils/srLatnDates";
import "./BookingPage.css";
import "./BookingRefinements.css";

const STEPS = ["Predmet", "Profesor", "Trajanje", "Vrsta časa", "Datum", "Termin", "Tvoji podaci", "Pregled"];
const DURATIONS = [
  { value: 45, title: "45 minuta", accent: "quick" },
  { value: 60, title: "60 minuta", accent: "standard" },
  { value: 90, title: "90 minuta", description: "Više oblasti ili intenzivna priprema", accent: "deep" },
];
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
const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ATTACHMENT_EXT_RE = /\.(pdf|png|jpg|jpeg|webp)$/i;
const ATTACHMENT_MIME_OK = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

const deliveryLabel = (value) => DELIVERY_OPTIONS.find((option) => option.value === value)?.title || value;
const sessionLabel = (value) => SESSION_OPTIONS.find((option) => option.value === value)?.title || value;
const categoryLabel = (value) => CATEGORIES.find((option) => option.value === value)?.label || value;

const formatBookingDate = (value) => formatTimestampDateLatn(`${value}T12:00:00Z`, true);

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

function StepHeading({ eyebrow, title, description }) {
  return (
    <header className="booking-step-heading">
      {eyebrow && <span>{eyebrow}</span>}
      <h2 tabIndex={-1}><TypewriterText text={title} /></h2>
      {description && <p>{description}</p>}
    </header>
  );
}

function CheckMark() {
  return <span className="booking-choice-check" aria-hidden="true"><Check size={14} strokeWidth={2.5} /></span>;
}

function StepActions({ onBack, onNext, nextDisabled = false, nextLabel = "Nastavi", busy = false }) {
  return (
    <div className="booking-step-actions">
      {onBack ? <button type="button" className="btn btn-secondary" onClick={onBack} disabled={busy}>← Nazad</button> : <span />}
      <button type="button" className="btn btn-primary" onClick={onNext} disabled={nextDisabled || busy}>
        {busy ? <><span className="booking-button-spinner" /> Zakazujem…</> : <>{nextLabel} <span aria-hidden="true">→</span></>}
      </button>
    </div>
  );
}

function BookingPage() {
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

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

  const goNext = () => { setError(""); setStep((value) => Math.min(value + 1, STEPS.length)); };
  const goBack = () => { setError(""); setStep((value) => Math.max(value - 1, 1)); };

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
    } catch (requestError) {
      if (requestError.status === 409 || /zauzet|zakazan/i.test(requestError.message)) {
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
    setStep(1); setSelectedSubject(null); setSelectedTeacher(null); setSelectedDuration(null);
    setDeliveryMode("in_person"); setSessionType("individual"); setSelectedDate(""); setSelectedSlot(null);
    setClientName(""); setClientEmail(""); setClientCategory(""); setClientNote(""); setAttachmentFiles([]);
    setFormErrors({}); setError(""); setBookingResult(null);
  };

  // Keep the new screen in view, including when the preceding form was long.
  useEffect(() => {
    if (lastScreen.current.step === step && lastScreen.current.bookingResult === bookingResult) return;
    lastScreen.current = { step, bookingResult };
    const panel = pageRef.current?.querySelector(bookingResult ? ".booking-success" : ".booking-panel");
    panel?.querySelector(bookingResult ? "h1" : ".booking-step-heading h2")?.focus({ preventScroll: true });
    panel?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step, bookingResult]);

  const summaryRows = [
    ["Predmet", selectedSubject?.name], ["Profesor", selectedTeacher?.full_name],
    ["Trajanje", selectedDuration ? `${selectedDuration} min` : null],
    ["Čas", `${deliveryLabel(deliveryMode)} · ${sessionLabel(sessionType)}`],
    ["Datum", selectedDate ? formatBookingDate(selectedDate) : null],
    ["Termin", selectedSlot ? `${formatTimeLatn(selectedSlot.start_time)}–${formatTimeLatn(selectedSlot.end_time)}` : null],
  ];

  if (bookingResult) {
    const mailStatus = bookingResult.notification_delivery?.status;
    return (
      <div ref={pageRef} className="booking-page booking-page--success">
        <section className="booking-success" aria-labelledby="success-title">
          <div className="booking-success-confetti" aria-hidden="true"><i>∑</i><i>✧</i><i>{"{ }"}</i><i>π</i><i>+</i></div><div className="booking-success-brand"><BrandLogo compact /><span className="booking-success-status"><Check size={14} aria-hidden="true" /> Potvrđeno</span></div>
          <span className="booking-success-icon" aria-hidden="true"><Check size={35} strokeWidth={1.8} /></span>
          <p className="booking-kicker">Rezervacija #{bookingResult.id}</p>
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

          <div className="booking-success-ticket">
            <div className="booking-ticket-date"><CalendarDays size={24} strokeWidth={1.5} aria-hidden="true" /><span>{formatTimestampDateLatn(bookingResult.start_time, true)}</span><strong>{formatTimeLatn(bookingResult.start_time)}</strong><small>do {formatTimeLatn(bookingResult.end_time)}</small></div>
            <dl>
              <div><dt><BookOpen size={14} aria-hidden="true" /> Predmet</dt><dd>{bookingResult.subject_name}</dd></div>
              <div><dt><GraduationCap size={14} aria-hidden="true" /> Profesor</dt><dd>{bookingResult.teacher_name}</dd></div>
              <div><dt>Vrsta časa</dt><dd>{deliveryLabel(bookingResult.delivery_mode)} · {sessionLabel(bookingResult.session_type)}</dd></div>
              <div><dt>Učionica</dt><dd>{bookingResult.delivery_mode === "online" ? "Online" : `Učionica ${bookingResult.classroom_number}`}</dd></div>
              <div><dt>Trajanje</dt><dd>{bookingResult.duration_minutes} minuta</dd></div>
              <div><dt>Nivo obrazovanja</dt><dd>{categoryLabel(bookingResult.client_category)}</dd></div>
            </dl>
          </div>

          <div className="booking-success-contact"><div><span><UserRound size={16} aria-hidden="true" /> Ime i prezime</span><strong>{bookingResult.client_full_name}</strong></div><div><span><Mail size={16} aria-hidden="true" /> Email za potvrdu</span><strong>{bookingResult.client_email}</strong></div>
            {bookingResult.client_note && <div className="booking-contact-wide"><span>Napomena za profesora</span><p>{bookingResult.client_note}</p></div>}
            {bookingResult.attachments?.length > 0 && <div className="booking-contact-wide"><span><FileText size={16} aria-hidden="true" /> Priloženi materijali</span><ul>{bookingResult.attachments.map((attachment) => <li key={attachment.id}>{attachment.original_name}</li>)}</ul></div>}
          </div>
          <div className="booking-success-actions">
            <button type="button" className="btn btn-primary" onClick={resetBooking}>Zakaži još jedan čas</button>
            {bookingResult.client_cancel_token && <Link className="btn btn-secondary" to={`/cancel/${bookingResult.client_cancel_token}`}>Otvori link za otkazivanje</Link>}
          </div>
          <p className="booking-cancel-note">Besplatno otkazivanje moguće je najkasnije 24 sata pre časa.</p>
        </section>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="booking-page">
      <header className="booking-intro">
        <div><p className="booking-kicker"><Sparkles size={14} aria-hidden="true" /> Online zakazivanje</p>
        <h1>Tvoj sledeći čas <em>počinje ovde.</em></h1></div>
      </header>

      <div className="booking-shell">
        <div className="booking-workspace">
          <Stepper steps={STEPS} currentStep={step} onStepClick={(nextStep) => { setError(""); setStep(nextStep); }} />
        <section className="booking-panel" data-step={step}>
          {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}

          {step === 1 && <div className="booking-step">
            <StepHeading eyebrow="Počnimo" title="Izaberi predmet" description="Izaberi oblast u kojoj želiš više sigurnosti." />
            {subjectsLoading ? <Spinner text="Učitavamo predmete…" /> : subjects.length === 0 ? (
              <div className="booking-empty"><p>Nismo pronašli dostupne predmete.</p><button type="button" className="btn btn-secondary" onClick={() => loadSubjects()}>Pokušaj ponovo</button></div>
            ) : <div className="booking-subject-grid">
              {subjects.map((subject, index) => {
                const selected = subject.id === selectedSubject?.id;
                return <ScienceCard key={subject.id} type="button" className={`booking-subject-card ${selected ? "selected" : ""}`} data-tone={index % 5} formulas={subjectFormulas(subject.name)} backdrop={<SubjectBackdrop name={subject.name} />} aria-pressed={selected} onClick={() => {
                  setSelectedSubject(subject); setSelectedTeacher(null); setSelectedDate(""); setSelectedSlot(null);
                }}><strong>{subject.name}</strong><ArrowUpRight className="booking-subject-arrow" size={18} aria-hidden="true" />{selected && <CheckMark />}</ScienceCard>;
              })}
            </div>}
            <StepActions onNext={goNext} nextDisabled={!selectedSubject} />
          </div>}

          {step === 2 && <div className="booking-step">
            <StepHeading eyebrow={selectedSubject?.name} title="Izaberi profesora" />
            {teachersLoading ? <Spinner text="Tražimo profesore…" /> : displayedTeachers.length === 0 ? (
              <div className="booking-empty"><span aria-hidden="true">⌁</span><p>Trenutno nema aktivnog profesora za ovaj predmet.</p><button type="button" className="btn btn-secondary" onClick={goBack}>Izaberi drugi predmet</button></div>
            ) : <div className="booking-teacher-grid">{displayedTeachers.map((teacher) => {
              const selected = teacher.id === selectedTeacher?.id;
              return <ScienceCard key={teacher.id} type="button" className={`booking-teacher-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => { setSelectedTeacher(teacher); setSelectedDate(""); setSelectedSlot(null); }}>
                <TeacherAvatar name={teacher.full_name} />
                <span className="booking-teacher-copy"><span className="booking-teacher-note">Tvoj BrainStorm profesor</span><strong>{teacher.full_name}</strong><span className="booking-teacher-subjects"><span>Informatika</span><span>Matematika</span></span></span>
                <span className="booking-teacher-arrow" aria-hidden="true">{selected ? <Check size={21} /> : <ArrowUpRight size={21} />}</span>
              </ScienceCard>;
            })}<TeacherPreviewCards /></div>}
            <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedTeacher} />
          </div>}

          {step === 3 && <div className="booking-step">
            <StepHeading eyebrow="Tvoj tempo" title="Izaberite dužinu i način časa" />
            <div className="booking-duration-grid">{DURATIONS.map((duration) => {
              const selected = selectedDuration === duration.value;
              return <ScienceCard key={duration.value} type="button" className={`booking-duration-card booking-duration-card--${duration.accent} ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => { setSelectedDuration(duration.value); setSelectedSlot(null); }}>
                <span className="booking-duration-clock" style={{ "--duration-progress": duration.value / 90 * 100 }} aria-hidden="true"><svg viewBox="0 0 100 100"><circle className="duration-ring-track" cx="50" cy="50" r="46" /><circle className="duration-ring-fill" cx="50" cy="50" r="46" pathLength="100" /></svg><span className="booking-duration-number">{duration.value}<small>min</small></span></span>
                <strong>{duration.title}</strong>{selected && <CheckMark />}
              </ScienceCard>;
            })}</div>
            <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDuration} />
          </div>}

          {step === 4 && <div className="booking-step">
            <StepHeading eyebrow="Čas po tvojoj meri" title="Podesi vrstu časa" />
            <div className="booking-format-grid">
            <section className="booking-format-panel" aria-labelledby="delivery-heading"><header><h3 id="delivery-heading">Način održavanja</h3><span className="booking-format-index">01 / 02</span></header>
            <LessonFormatVisual kind="delivery" mode={deliveryMode} />
            <div className="booking-format-choices">{DELIVERY_OPTIONS.map((option) => {
              const selected = option.value === deliveryMode;
              const Icon = option.icon;
              return <button key={option.value} type="button" className={`booking-option-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => { setDeliveryMode(option.value); setSelectedSlot(null); }}><span className="booking-option-icon"><Icon size={18} strokeWidth={1.6} aria-hidden="true" /></span><strong>{option.title}</strong></button>;
            })}</div><p className="booking-format-description">{DELIVERY_OPTIONS.find(option => option.value === deliveryMode)?.description}</p></section>
            <section className="booking-format-panel" aria-labelledby="session-heading"><header><h3 id="session-heading">Tip časa</h3><span className="booking-format-index">02 / 02</span></header>
            <LessonFormatVisual kind="session" mode={sessionType} />
            <div className="booking-format-choices">{SESSION_OPTIONS.map((option) => {
              const selected = option.value === sessionType;
              const Icon = option.icon;
              return <button key={option.value} type="button" className={`booking-option-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => setSessionType(option.value)}><span className="booking-option-icon"><Icon size={18} strokeWidth={1.6} aria-hidden="true" /></span><strong>{option.title}</strong></button>;
            })}</div><p className="booking-format-description">{SESSION_OPTIONS.find(option => option.value === sessionType)?.description}</p></section>
            </div>
            <StepActions onBack={goBack} onNext={goNext} />
          </div>}

          {step === 5 && <div className="booking-step">
            <StepHeading eyebrow="Naredne dve nedelje" title="Izaberi dan" />
            <div className="booking-date-grid">{dateOptions.map((date) => {
              const selected = date.value === selectedDate;
              return <ScienceCard key={date.value} type="button" className={`booking-date-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => { setSelectedDate(date.value); setSelectedSlot(null); }}>
                <span className="booking-date-weekday">{date.weekday}</span><span className="booking-date-bindings" aria-hidden="true"><i /><i /></span><strong>{date.day}</strong><small>{date.month}</small><span className="booking-date-ruling" aria-hidden="true"><i /><i /><i /></span>{selected && <CheckMark />}
              </ScienceCard>;
            })}</div>
            <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedDate} />
          </div>}

          {step === 6 && <div className="booking-step">
            <StepHeading eyebrow="Termin" title="Izaberi vreme" />
            <div className="booking-hours"><Clock3 size={16} aria-hidden="true" /><span>Radno vreme</span><strong>08:00 – 20:00</strong></div>
            {slotsLoading ? <Spinner text="Proveravamo slobodne termine…" /> : sortedSlots.length === 0 ? (
              <div className="booking-empty"><span aria-hidden="true">◷</span><p>Za ovu kombinaciju nema slobodnih termina.</p><div><button type="button" className="btn btn-secondary" onClick={goBack}>Promeni datum</button><button type="button" className="btn btn-secondary" onClick={() => loadSlots()}>Osveži</button></div></div>
            ) : <><div className="booking-slots-heading"><span><i /> {sortedSlots.length} {sortedSlots.length === 1 ? "slobodan termin" : "slobodnih termina"}</span><button type="button" onClick={() => loadSlots()} disabled={slotsLoading}>Osveži ↻</button></div><div className="booking-slot-grid">{sortedSlots.map((slot) => {
              const selected = selectedSlot?.start_time === slot.start_time;
              return <ScienceCard key={`${slot.start_time}-${slot.end_time}`} type="button" className={`booking-slot-card ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => setSelectedSlot(slot)}><span className="booking-slot-orbit" aria-hidden="true"><Clock3 size={16} /></span><span className="booking-slot-start"><small>Početak časa</small><strong>{formatTimeLatn(slot.start_time)}</strong></span><span className="booking-slot-end"><small>Završetak</small><strong>{formatTimeLatn(slot.end_time)}</strong></span>{selected && <CheckMark />}</ScienceCard>;
            })}</div></>}
            <StepActions onBack={goBack} onNext={goNext} nextDisabled={!selectedSlot} />
          </div>}

          {step === 7 && <div className="booking-step">
            <StepHeading eyebrow="Još samo malo" title="Unesite svoje podatke" description="Podatke koristimo samo za ovu rezervaciju i obaveštenja o času." />
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
          </div>}

          {step === 8 && <div className="booking-step">
            <StepHeading eyebrow="Sve je spremno" title="Potvrdi rezervaciju" description="Termin se rezerviše tek kada pritisneš dugme za potvrdu." />
            <div className="booking-review">
              <div className="booking-review-banner"><span className="booking-review-symbol" aria-hidden="true">{subjectSymbol(selectedSubject?.name)}</span><div><small>Tvoj sledeći čas</small><strong>{selectedSubject?.name}</strong><span>sa profesorom · {selectedTeacher?.full_name}</span></div><span className="booking-review-duration"><Clock3 size={16} aria-hidden="true" />{selectedDuration} min</span></div>
              <section><h3><CalendarDays size={18} aria-hidden="true" /> Detalji časa</h3><dl>
                <div><dt>Datum</dt><dd>{formatBookingDate(selectedDate)}</dd></div><div><dt>Vreme</dt><dd>{formatTimeLatn(selectedSlot?.start_time)}–{formatTimeLatn(selectedSlot?.end_time)}</dd></div>
                <div><dt>Trajanje</dt><dd>{selectedDuration} min</dd></div><div><dt>Vrsta</dt><dd>{deliveryLabel(deliveryMode)} · {sessionLabel(sessionType)}</dd></div>
              </dl></section>
              <section><h3><UserRound size={18} aria-hidden="true" /> Tvoji podaci</h3><dl><div><dt>Ime</dt><dd>{clientName}</dd></div><div><dt>Email</dt><dd>{clientEmail}</dd></div><div><dt>Nivo</dt><dd>{categoryLabel(clientCategory)}</dd></div>{clientNote && <div><dt>Napomena</dt><dd>{clientNote}</dd></div>}{attachmentFiles.length > 0 && <div><dt>Prilozi</dt><dd>{attachmentFiles.map((file) => file.name).join(", ")}</dd></div>}</dl></section>
            </div>
            <p className="booking-review-note"><span aria-hidden="true">✓</span> Potvrdom rezervacije, obaveštenje se šalje tebi, profesoru i BrainStorm timu.</p>
            <StepActions onBack={goBack} onNext={handleSubmit} nextLabel="Potvrdi rezervaciju" busy={submitting} />
          </div>}
        </section>
        </div>

        <BookingSummary rows={summaryRows} step={step} />
      </div>
    </div>
  );
}

export default BookingPage;
