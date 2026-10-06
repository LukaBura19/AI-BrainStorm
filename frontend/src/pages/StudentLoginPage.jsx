import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarCheck, GraduationCap } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import "./TeacherLoginPage.css";
import "./StudentLoginPage.css";

const CATEGORIES = [
  { value: "osnovna", label: "Osnovna škola" },
  { value: "srednja", label: "Srednja škola" },
  { value: "faks", label: "Fakultet" },
  { value: "drugo", label: "Drugo" },
];

/** Učenik: prijava ili registracija novog naloga na istoj stranici. */
export default function StudentLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get("nalog") === "novi" ? "register" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registering = mode === "register";
  // After signing in from the booking flow, go back there instead of the panel.
  const next = params.get("dalje") === "zakazivanje" ? "/booking" : "/ucenik/panel";

  const handleSubmit = async (event) => {
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

  return (
    <div className="login-page login-page--student">
      <section className="login-visual" aria-hidden="true">
        <span className="login-visual-badge">U</span>
        <p>UČENIČKI NALOG</p>
        <h1>Svi tvoji časovi na jednom mestu.</h1>
        <div className="login-visual-card"><span><CalendarCheck size={15} /></span><strong>Zakazani časovi<br /><small>i otkazivanje u jednom kliku</small></strong></div>
      </section>
      <div className="card login-card liquid-glass">
        <div className="student-mode" role="group" aria-label="Izaberi prijavu ili registraciju">
          {[["login", "Prijava"], ["register", "Novi nalog"]].map(([value, label]) => (
            <button key={value} type="button" className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => { setMode(value); setError(""); }}>
              {mode === value && <motion.span layoutId="student-mode-pill" className="student-mode-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="card-header">
          <h2 className="card-title">{registering ? "Napravi učenički nalog" : "Prijava učenika"}</h2>
          <p className="login-subtitle">{registering ? "Nalog ti čuva pregled svih časova koje zakažeš dok si prijavljen." : "Unesi email i lozinku svog učeničkog naloga."}</p>
        </div>

        {error && <Alert type="error" onClose={() => setError("")}>{error}</Alert>}

        <form onSubmit={handleSubmit} className="login-form">
          {registering && <div className="form-group">
            <label className="form-label" htmlFor="student-name">Ime i prezime <span className="required">*</span></label>
            <input id="student-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Npr. Ana Jovanović" />
          </div>}
          <div className="form-group">
            <label className="form-label" htmlFor="student-email">Email <span className="required">*</span></label>
            <input id="student-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ana@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="student-password">Lozinka <span className="required">*</span></label>
            <input id="student-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={registering ? 8 : 1} autoComplete={registering ? "new-password" : "current-password"} placeholder={registering ? "Najmanje 8 karaktera" : "••••••••"} />
          </div>
          {registering && <div className="form-group">
            <label className="form-label" htmlFor="student-category">Nivo obrazovanja</label>
            <select id="student-category" className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Izaberi nivo</option>
              {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>}
          <button type="submit" className="btn btn-primary btn-lg login-btn" disabled={loading}>
            <GraduationCap size={18} aria-hidden="true" />
            {loading ? (registering ? "Pravim nalog…" : "Prijavljivanje…") : registering ? "Napravi nalog" : "Prijavi se"}
          </button>
        </form>
      </div>
    </div>
  );
}
