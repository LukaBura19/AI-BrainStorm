import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Briefcase, Check, ChevronDown, Clock3, FileText, Upload, User, Code2, DoorOpen, GraduationCap, Languages, Mail, MapPin, NotebookPen, Phone, Speech, Star } from "lucide-react";
import Reveal from "../components/Reveal";
import api from "../services/api";
import "./AboutPage.css";

const ADDRESS = "Bože Jankovića 49, Beograd";
const MAPS_QUERY = encodeURIComponent(ADDRESS);
const PHONE_DISPLAY = "064 546 7246";
const PHONE_LINK = "tel:+381645467246";
const INSTAGRAM_URL = "https://www.instagram.com/ec.brainstorm/";
const EMAIL = "edukativni.centar.brainstorm@gmail.com";
// On narrow screens the address may wrap, and it should wrap before the "@", not mid-word.
const EMAIL_LABEL = <>edukativni.centar.brainstorm<wbr />@gmail.com</>;

/** Instagram glyph drawn in the same 2px stroke style as the lucide icons. */
function InstagramIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </svg>;
}

const offers = [
  {
    icon: NotebookPen,
    title: "Privatni časovi",
    text: "Predmeti: Matematika, Programiranje, Srpski jezik, Hemija, Fizika, Engleski, Nemački, Ruski, Španski, Italijanski i Filozofija. Časovi mogu biti individualni ili grupni, uživo ili online.",
  },
  {
    icon: GraduationCap,
    title: "Pripreme za malu i veliku maturu",
    text: "Za malu maturu nudimo individualne časove i grupne pripreme iz srpskog jezika i matematike. Za veliku maturu spremamo prijemni ispit iz matematike za PMF, ETF, FON, Mašinski, Građevinski i Ekonomski fakultet.",
    links: [{ to: "/mala-matura", label: "Mala matura" }, { to: "/velika-matura", label: "Velika matura" }],
  },
  { icon: Languages, title: "Kursevi stranih jezika", text: "Nudimo kurseve engleskog, nemačkog i ruskog jezika po nivoima, od A1 do C2. Možeš da kreneš od samog početka ili da nastaviš od nivoa do kog si već stigao." },
  { icon: Code2, title: "Kursevi programiranja", text: "Učimo programske jezike C, C++, C#, Python, Java i JavaScript, kao i alate i frameworke koji se koriste u praksi. Za naprednije tu su algoritmi, strukture podataka i dizajn paterni. Tempo prilagođavamo svakom učeniku." },
  { icon: DoorOpen, title: "Iznajmljivanje učionica", text: "Ako ti treba prostor za časove ili radionicu, možeš da iznajmiš učionicu u centru." },
  { icon: Speech, title: "Debatno veče", text: "Veče posvećeno raspravi o jednoj temi. Vežbaš kako da izneseš svoje mišljenje i kako da saslušaš drugu stranu. Kada je sledeće, pitaj nas na Instagramu." },
];

const PATH_STEPS = ["Osnovna škola", "Srednja škola", "Fakultet"];

/** Three steps that light up one after another, with a cap hopping onto each. */
function SchoolPath() {
  return (
    <div className="about-path" role="img" aria-label="Od osnovne škole, preko srednje škole, do fakulteta">
      {PATH_STEPS.map((label, index) => (
        <div key={label} className={`about-path-step about-path-step--${index}`}>
          <span className="about-path-mark"><GraduationCap size={18} strokeWidth={1.9} /></span>
          <span className="about-path-bar" />
          <span className="about-path-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

const DEGREES = ["Student", "Osnovne studije", "Master studije", "Doktorske studije", "Drugo"];
const EXPERIENCE = ["Bez iskustva", "Do godinu dana", "1 do 3 godine", "Više od 3 godine"];
const SUBJECTS = ["Matematika", "Programiranje", "Srpski jezik", "Hemija", "Fizika", "Engleski", "Nemački", "Ruski", "Španski", "Italijanski", "Filozofija"];
const CV_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const EMPTY_FORM = { name: "", phone: "", degree: "", subjects: [], experience: "", about: "" };

/** Polje sa labelom koja stoji u polju dok je prazno, a podigne se kad se upiše ili izabere vrednost. */
function Field({ id, label, icon: Icon, filled, required, wide, children }) {
  return (
    <div className={`join-field ${filled ? "filled" : ""} ${wide ? "wide" : ""}`}>
      {children}
      <label htmlFor={id}><Icon size={16} strokeWidth={1.9} aria-hidden="true" />{label}{required && <span className="required"> *</span>}</label>
    </div>
  );
}

/** Padajući meni sa više izbora (predmeti). */
function SubjectsDropdown({ value, onChange }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const toggle = (subject) => onChange(value.includes(subject) ? value.filter((item) => item !== subject) : [...value, subject]);

  return (
    <div ref={ref} className={`join-field join-multi wide ${value.length ? "filled" : ""} ${open ? "open" : ""}`}>
      <button id="join-subjects" type="button" className="join-control" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{value.join(", ")}</span><ChevronDown size={18} aria-hidden="true" />
      </button>
      <label htmlFor="join-subjects"><BookOpen size={16} strokeWidth={1.9} aria-hidden="true" />Predmeti koje bi predavao/la<span className="required"> *</span></label>
      {open && (
        <div className="join-multi-menu" role="listbox" aria-multiselectable="true">
          {SUBJECTS.map((subject) => (
            <label key={subject} className={value.includes(subject) ? "on" : ""}>
              <input type="checkbox" checked={value.includes(subject)} onChange={() => toggle(subject)} />
              <span className="join-check" aria-hidden="true">{value.includes(subject) && <Check size={13} strokeWidth={3} />}</span>{subject}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Prijava za posao: upitnik i CV (PDF ili slika) idu na server, a centar dobija email sa CV-om. */
function JoinTeam() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [cv, setCv] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const bind = (key) => ({ id: `join-${key}`, value: form[key], onChange: (event) => set(key)(event.target.value) });

  const pickFile = (file) => {
    if (!file) return;
    if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name)) return setError("CV može biti PDF ili slika (JPG, PNG, WEBP).");
    if (file.size > 25 * 1024 * 1024) return setError("CV može imati najviše 25 MB.");
    setError("");
    setCv(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.degree) return setError("Izaberi stručnu spremu.");
    if (!form.subjects.length) return setError("Izaberi bar jedan predmet.");
    if (!cv) return setError("Priloži svoj CV.");
    const data = new FormData();
    Object.entries({ full_name: form.name, phone: form.phone, degree: form.degree, subjects: form.subjects.join(", "), experience: form.experience, about: form.about })
      .forEach(([key, value]) => value && data.append(key, value));
    data.append("cv", cv);
    setSending(true);
    setError("");
    try {
      await api.postFormData("/public/job-applications", data);
      setSent(true);
    } catch (err) {
      setError(err.message || "Prijava nije poslata. Pokušaj ponovo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={`about-join ${sent ? "is-sent" : ""}`} aria-labelledby="join-title">
      <div className="about-join-intro">
        <span className="about-join-badge"><Briefcase size={22} strokeWidth={1.8} aria-hidden="true" /></span>
        <h2 id="join-title">Želiš da nam se pridružiš?</h2>
        <p>Popuni upitnik i pošalji nam svoj CV.</p>
        <ol className="about-join-steps">
          <li><span>1</span>Popuni upitnik</li>
          <li><span>2</span>Priloži CV</li>
          <li><span>3</span>Dobićeš poziv od nas za razgovor za posao</li>
        </ol>
      </div>

      <form className="about-join-form" onSubmit={submit} {...(sent ? { inert: "" } : {})}>
        <Field id="join-name" label="Ime i prezime" icon={User} filled={form.name} required>
          <input {...bind("name")} className="join-control" required minLength={2} autoComplete="name" />
        </Field>
        <Field id="join-phone" label="Broj telefona" icon={Phone} filled={form.phone} required>
          <input {...bind("phone")} className="join-control" type="tel" required minLength={6} autoComplete="tel" />
        </Field>
        <Field id="join-degree" label="Stručna sprema" icon={GraduationCap} filled={form.degree} required>
          <select {...bind("degree")} className="join-control"><option value="" />{DEGREES.map((item) => <option key={item}>{item}</option>)}</select>
          <ChevronDown className="join-select-arrow" size={18} aria-hidden="true" />
        </Field>
        <Field id="join-experience" label="Iskustvo u radu sa učenicima" icon={Clock3} filled={form.experience}>
          <select {...bind("experience")} className="join-control"><option value="" />{EXPERIENCE.map((item) => <option key={item}>{item}</option>)}</select>
          <ChevronDown className="join-select-arrow" size={18} aria-hidden="true" />
        </Field>
        <SubjectsDropdown value={form.subjects} onChange={set("subjects")} />
        <Field id="join-about" label="Nešto o sebi" icon={NotebookPen} filled={form.about} wide>
          <textarea {...bind("about")} className="join-control" rows={3} maxLength={3000} />
        </Field>

        <label className={`about-join-drop ${dragging ? "is-over" : ""} ${cv ? "has-file" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); pickFile(event.dataTransfer.files[0]); }}>
          <input type="file" accept={CV_TYPES} onChange={(event) => { pickFile(event.target.files[0]); event.target.value = ""; }} />
          <span className="about-join-drop-icon">{cv ? <FileText size={22} aria-hidden="true" /> : <Upload size={22} aria-hidden="true" />}</span>
          {cv ? (
            <span><strong>{cv.name}</strong><small>{cv.size < 1024 * 1024 ? `${Math.max(1, Math.round(cv.size / 1024))} KB` : `${(cv.size / 1024 / 1024).toFixed(1)} MB`} · klikni da zameniš</small></span>
          ) : (
            <span><strong>Priloži CV <span className="required">*</span></strong><small>Prevuci fajl ovde ili klikni · PDF ili slika, do 25 MB</small></span>
          )}
        </label>

        {error && <p className="about-join-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary about-join-submit" disabled={sending}>{sending ? "Šaljem…" : <>Pošalji prijavu <ArrowRight size={17} aria-hidden="true" /></>}</button>
      </form>

      {/* After sending, the green panel sweeps over the whole card and thanks the applicant. */}
      <div className="about-join-cover" aria-hidden="true" />
      <div className="about-join-thanks" role="status">
        {sent && <>
          <span className="about-join-thanks-icon"><Check size={34} strokeWidth={2.4} aria-hidden="true" /></span>
          <h3>Hvala na interesovanju!</h3>
          <p>Prijava je stigla. Pregledaćemo je i javićemo ti se u najkraćem roku.</p>
        </>}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <h1 id="about-title">Učimo zajedno, <em>korak po korak.</em></h1>
          <p>BrainStorm je edukativni centar u Beogradu koji okuplja mlade, stručne i ambiciozne profesore koji umeju da znanje prenesu na jasan i učenicima blizak način. Pružamo podršku u učenju od osnovne škole do fakulteta, uz strpljenje, jasna objašnjenja i razumevanje za ono što svakom učeniku predstavlja poteškoću.</p>
          <p>Na časovima ima prostora za pitanja, razgovor i samostalno rešavanje zadataka. Koristimo savremene tehnologije, praktične primere, a kada gradivo to dozvoljava, i igru, da učenje bude zanimljivije! Želimo da učenici razumeju ono što uče i steknu više sigurnosti u svoje znanje.</p>
          <div className="about-hero-actions">
            <Link to="/booking" className="btn btn-primary">Zakaži čas <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link to="/cenovnik" className="btn btn-secondary">Pogledaj cenovnik</Link>
          </div>
        </div>
        <div className="about-hero-side">
        <SchoolPath />
        <aside className="about-hero-facts" aria-label="Ukratko">
          <a className="about-rating" href={`https://www.google.com/maps/search/?api=1&query=Edukativni+centar+BrainStorm+${MAPS_QUERY}`} target="_blank" rel="noreferrer">
            <span className="about-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill="currentColor" strokeWidth={0} />)}</span>
            <strong>5.0</strong>
            <span>ocena na Google-u</span>
          </a>
          <ul>
            <li><MapPin size={18} aria-hidden="true" /><span>{ADDRESS}</span></li>
            <li><Clock3 size={18} aria-hidden="true" /><span>Svakog dana od 9 do 21h</span></li>
            <li><Phone size={18} aria-hidden="true" /><a href={PHONE_LINK}>{PHONE_DISPLAY}</a></li>
            <li><InstagramIcon /><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@ec.brainstorm</a></li>
            <li><Mail size={18} aria-hidden="true" /><a href={`mailto:${EMAIL}`}>{EMAIL_LABEL}</a></li>
          </ul>
        </aside>
        </div>
      </section>

      <section className="about-offers" aria-labelledby="offers-title">
        <h2 id="offers-title">Šta nudimo</h2>
        <div className="about-offer-list">
          {offers.map(({ icon: Icon, title, text, links }, index) => (
            <Reveal as="div" key={title} delay={index * .06} className="about-offer">
              <span className="about-offer-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <div className="about-offer-text">
                <p>{text}</p>
                {links && (
                  <div className="about-offer-links">
                    {links.map((link) => <Link key={link.to} to={link.to}>{link.label} <ArrowRight size={15} aria-hidden="true" /></Link>)}
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="about-quote" aria-label="Naša poruka">
        <p>Prijemni je nikad bliže? <span>Ne paniči, čekamo te.</span></p>
        <Link to="/booking" className="about-quote-link">Zakaži prvi čas <ArrowRight size={18} aria-hidden="true" /></Link>
      </Reveal>

      <JoinTeam />

      <section className="about-visit" aria-labelledby="visit-title">
        <div className="about-visit-copy">
          <h2 id="visit-title">Dođi da se upoznamo</h2>
          <p>Edukativni centar se nalazi na Voždovcu, u blizini Autokomande. Za detalje nam se javi preko društvenih mreža ili na email.</p>
          <dl>
            <div><dt>Adresa</dt><dd><a href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer">{ADDRESS}</a></dd></div>
            <div><dt>Telefon</dt><dd><a href={PHONE_LINK}>{PHONE_DISPLAY}</a></dd></div>
            <div><dt>Radno vreme</dt><dd>Ponedeljak – nedelja, 9–21h</dd></div>
            <div><dt>Instagram</dt><dd><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@ec.brainstorm</a></dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL_LABEL}</a></dd></div>
          </dl>
        </div>
        <div className="about-map">
          <iframe title={`Mapa: ${ADDRESS}`} src={`https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>
    </div>
  );
}
