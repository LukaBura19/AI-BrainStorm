import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Alert from "../components/Alert";
import "./TeacherLoginPage.css";

function TeacherLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/teacher/login", { email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", "teacher");
      navigate("/teacher/dashboard");
    } catch (err) {
      setError(err.message || "Greška pri prijavi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-visual" aria-hidden="true">
        <span className="login-visual-badge">P</span>
        <p>PROFESORSKI PANEL</p>
        <h1>Raspored koji radi za tebe.</h1>
        <div className="login-visual-card"><span>✓</span><strong>Termini i rezervacije<br /><small>na jednom mestu</small></strong></div>
      </section>
      <div className="card login-card liquid-glass" data-spotlight>
        <div className="card-header">
          <span className="login-kicker">Dobrodošli nazad</span>
          <h2 className="card-title">Prijava profesora</h2>
          <p className="login-subtitle">Unesite podatke svog BrainStorm naloga.</p>
        </div>

        {error && (
          <Alert type="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email <span className="required">*</span>
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="profesor@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Lozinka <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg login-btn"
            disabled={loading}
          >
            {loading ? "Prijavljivanje…" : "Otvori moj panel"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TeacherLoginPage;
