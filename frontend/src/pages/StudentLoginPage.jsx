import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import RoleIcon from "../components/RoleIcon";
import "./StudentLoginPage.css";

const CATEGORIES = [
  { value: "osnovna", label: "Osnovna škola" },
  { value: "srednja", label: "Srednja škola" },
  { value: "faks", label: "Fakultet" },
  { value: "drugo", label: "Drugo" },
];

/** `dalje=zakazivanje` or a local path such as `/mala-matura/kupovina`; anything else lands on the panel. */
function nextPath(value) {
  if (value === "zakazivanje") return "/booking";
  if (value && /^\/(?!\/)[\w\-/?=&]*$/.test(value)) return value;
  return "/ucenik/panel";
}

// React 18 has no boolean `inert` prop; an empty string sets the attribute, undefined removes it.
const hiddenWhen = (hidden) => (hidden ? { inert: "", "aria-hidden": "true" } : {});

/**
 * Učenik: prijava i novi nalog u jednoj kartici. Na širem ekranu zelena površina klizi preko kartice:
 * raširi se preko obe forme pa se skupi na suprotnu stranu i otkrije drugu formu.
 */
export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("nalog") === "novi" ? "register" : "login");
  const [switched, setSwitched] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registering = mode === "register";
  const shownMode = useRef(mode);
  // After signing in, go back where the student came from (booking, a matura page or its checkout) instead of the panel.
  const next = nextPath(params.get("dalje"));

  const switchTo = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSwitched(true);
    setError("");
  };

  // Move focus into the form that just appeared (after the cover has moved out of the way).
  useEffect(() => {
    if (shownMode.current === mode) return undefined;
    shownMode.current = mode;
    const timer = window.setTimeout(() => document.getElementById(registering ? "student-name" : "student-login-email")?.focus({ preventScroll: true }), 450);
    return () => clearTimeout(timer);
  }, [mode, registering]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (registering && password.length < 8) {
      setError("Lozinka mora imati najmanje 8 karaktera.");
      return;
    }
    setLoading(true);
    try {
      const data = registering
        ? await api.post("/auth/student/register", { full_name: fullName.trim(), email, password, category: category || null })
        : await api.post("/auth/student/login", { email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", "student");
      navigate(next);
    } catch (err) {
      setError(err.message || "Greška pri prijavi.");
    } finally {
      setLoading(false);
    }
  };

  const errorBox = error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>;

  return (
    <div className="student-auth-page">
      <div className={`student-auth ${switched ? "has-switched" : ""}`} data-mode={mode}>
        {/* Phones: a short heading and a two-way switch instead of the sliding cover. */}
        <header className="student-auth-mobile-head">
          <span className="student-auth-badge"><RoleIcon role="student" size={24} /></span>
          <h1>Svi tvoji časovi na jednom mestu.</h1>
        </header>
        <div className="student-auth-switch" role="group" aria-label="Prijava ili novi nalog">
          <button type="button" className={!registering ? "active" : ""} aria-pressed={!registering} onClick={() => switchTo("login")}>Prijava</button>
          <button type="button" className={registering ? "active" : ""} aria-pressed={registering} onClick={() => switchTo("register")}>Novi nalog</button>
        </div>

        <section className="student-auth-pane student-auth-pane--register" aria-labelledby="register-title" {...hiddenWhen(!registering)}>
          <h2 id="register-title">Napravi učenički nalog</h2>
          <p className="student-auth-sub">U nalogu vidiš sve časove koje zakažeš i možeš da ih otkažeš.</p>
          {registering && errorBox}
          <form onSubmit={submit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="student-name">Ime i prezime <span className="required">*</span></label>
              <input id="student-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Npr. Ana Jovanović" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="student-email">Email <span className="required">*</span></label>
              <input id="student-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ana@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="student-password">Lozinka <span className="required">*</span></label>
              <input id="student-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Najmanje 8 karaktera" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="student-category">Nivo obrazovanja</label>
              <select id="student-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Izaberi nivo</option>
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn-primary btn-lg student-auth-submit" disabled={loading}>{loading ? "Pravim nalog…" : "Napravi nalog"}</button>
          </form>
        </section>

        <section className="student-auth-pane student-auth-pane--login" aria-labelledby="login-title" {...hiddenWhen(registering)}>
          <h2 id="login-title">Prijava učenika</h2>
          <p className="student-auth-sub">Unesi email i lozinku svog naloga.</p>
          {!registering && errorBox}
          <form onSubmit={submit} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="student-login-email">Email <span className="required">*</span></label>
              <input id="student-login-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ana@email.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="student-login-password">Lozinka <span className="required">*</span></label>
              <input id="student-login-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
            </div>
            <button type="submit" className="btn btn-primary btn-lg student-auth-submit" disabled={loading}>{loading ? "Prijavljivanje…" : "Prijavi se"}</button>
          </form>
        </section>

        <div className="student-auth-cover" aria-hidden="true" />
        <div className="student-auth-cover-text student-auth-cover-text--login" {...hiddenWhen(registering)}>
          <span className="student-auth-badge"><RoleIcon role="student" size={26} /></span>
          <p className="student-auth-eyebrow">UČENIČKI NALOG</p>
          <h1>Svi tvoji časovi na jednom mestu.</h1>
          <p>Nemaš nalog? Napraviš ga za minut.</p>
          <button type="button" className="student-auth-cover-btn" onClick={() => switchTo("register")}>Napravi nalog <ArrowRight size={17} aria-hidden="true" /></button>
        </div>
        <div className="student-auth-cover-text student-auth-cover-text--register" {...hiddenWhen(!registering)}>
          <span className="student-auth-badge"><RoleIcon role="student" size={26} /></span>
          <p className="student-auth-eyebrow">UČENIČKI NALOG</p>
          <h2>Već imaš nalog?</h2>
          <p>Prijavi se i vidi svoje zakazane časove.</p>
          <button type="button" className="student-auth-cover-btn" onClick={() => switchTo("login")}><ArrowLeft size={17} aria-hidden="true" /> Prijavi se</button>
        </div>
      </div>
    </div>
  );
}
