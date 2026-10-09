import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { isSignedInAs, startSession, switchRole } from "../services/session";
import Alert from "../components/Alert";
import RoleIcon from "../components/RoleIcon";
import "./TeacherLoginPage.css"; // reuse same login styles

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Već prijavljen u ovoj ulozi, ili ima vezani token (profesor koji je i admin): pravo u panel.
  useEffect(() => {
    if (isSignedInAs("admin") || switchRole("admin")) navigate("/admin/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/admin/login", { email, password });
      startSession("admin", data);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message || "Greška pri prijavi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page login-page--admin">
      <section className="login-visual" aria-hidden="true">
        <span className="login-visual-badge"><RoleIcon role="admin" size={26} /></span>
        <p>ADMINISTRACIJA</p>
        <h1>Centar pod kontrolom.</h1>
      </section>
      <div className="card login-card liquid-glass" data-spotlight>
        <div className="card-header">
          <span className="login-kicker">Za BrainStorm tim</span>
          <h2 className="card-title">Admin prijava</h2>
          <p className="login-subtitle">Pristup rezervacijama, profesorima i učionicama.</p>
        </div>

        {error && (
          <Alert type="error" onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">
              Email <span className="required">*</span>
            </label>
            <input
              id="admin-email"
              type="email"
              className="input"
              placeholder="admin@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Lozinka <span className="required">*</span>
            </label>
            <input
              id="admin-password"
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
            {loading ? "Prijavljivanje…" : "Otvori kontrolni panel"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginPage;
