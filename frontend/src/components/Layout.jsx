import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import BrandLogo from "./BrandLogo";
import RoleIcon from "./RoleIcon";

// Pages that paint their own background (home video, booking studio, panels).
const SELF_BACKGROUND_ROUTES = new Set(["/", "/booking", "/teacher/dashboard", "/admin/dashboard"]);
import "./Layout.css";

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const loginWrapRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const mobile = window.matchMedia("(max-width: 760px)");
    if (!mobile.matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      menuRef.current?.querySelector("a")?.focus(),
    );
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const items = [
        toggleRef.current,
        ...menuRef.current.querySelectorAll("a, button"),
      ].filter((node) => node && node.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const resized = () => {
      if (!mobile.matches) setMobileOpen(false);
    };
    window.addEventListener("keydown", trapFocus);
    mobile.addEventListener("change", resized);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", trapFocus);
      mobile.removeEventListener("change", resized);
      if (
        document.activeElement &&
        menuRef.current?.contains(document.activeElement)
      )
        toggleRef.current?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    setLoginOpen(false);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    const onDocumentPointerDown = (event) => {
      if (loginWrapRef.current && !loginWrapRef.current.contains(event.target))
        setLoginOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setLoginOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocumentPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const teacherLoggedIn = Boolean(token && role === "teacher");
  const adminLoggedIn = Boolean(token && role === "admin");
  const studentLoggedIn = Boolean(token && role === "student");
  const loggedIn = teacherLoggedIn || adminLoggedIn || studentLoggedIn;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    setLoginOpen(false);
    navigate("/");
  };

  return (
    <div
      className={`app-layout ${location.pathname === "/" ? "app-layout--home" : ""} ${location.pathname === "/booking" ? "app-layout--booking" : ""} ${SELF_BACKGROUND_ROUTES.has(location.pathname) ? "" : "app-layout--ambient"}`}
    >
      <a className="skip-link" href="#main-content">
        Preskoči na sadržaj
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link
            to="/"
            className="app-header-brand"
            aria-label="BrainStorm početna"
          >
            <BrandLogo header />
          </Link>

          <button
            type="button"
            ref={toggleRef}
            className={`app-mobile-toggle ${mobileOpen ? "open" : ""}`}
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="main-navigation"
            aria-label={mobileOpen ? "Zatvori meni" : "Otvori meni"}
          >
            <span />
            <span />
            <span />
          </button>

          <div
            ref={menuRef}
            className={`app-header-menu ${mobileOpen ? "open" : ""}`}
            id="main-navigation"
          >
            <nav className="app-header-nav" aria-label="Glavna navigacija">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "active" : ""}`
                }
              >
                Početna
              </NavLink>
              <NavLink
                to="/booking"
                className={({ isActive }) =>
                  `app-nav-link app-nav-link--booking ${isActive ? "active" : ""}`
                }
              >
                Zakaži čas
              </NavLink>
              <NavLink
                to="/cenovnik"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "active" : ""}`
                }
              >
                Cenovnik
              </NavLink>
              <NavLink
                to="/mala-matura"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "active" : ""}`
                }
              >
                Mala matura
              </NavLink>
              <NavLink
                to="/velika-matura"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "active" : ""}`
                }
              >
                Velika matura
              </NavLink>
              <NavLink
                to="/o-nama"
                className={({ isActive }) =>
                  `app-nav-link ${isActive ? "active" : ""}`
                }
              >
                O nama
              </NavLink>
            </nav>

            <div className="app-header-actions" ref={loginWrapRef}>
              <button
                type="button"
                className={`app-login-trigger ${loginOpen ? "open" : ""}`}
                onClick={() => setLoginOpen((open) => !open)}
                aria-expanded={loginOpen}
                aria-haspopup="menu"
                aria-controls="login-panel"
                id="login-menu-button"
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"
                    fill="currentColor"
                  />
                </svg>
                <span>{loggedIn ? "Moj panel" : "Prijava"}</span>
                <svg
                  className="app-login-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                >
                  <path
                    d="m3 5 4 4 4-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <AnimatePresence>
                {loginOpen && (
                  <motion.div
                    className="app-login-panel"
                    id="login-panel"
                    role="menu"
                    aria-labelledby="login-menu-button"
                    initial={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reducedMotion ? 0 : -5 }}
                    transition={{ duration: 0.18 }}
                  >
                    <p className="app-login-panel-title">Pristup sistemu</p>
                    <Link
                      to={studentLoggedIn ? "/ucenik/panel" : "/ucenik/prijava"}
                      className="app-login-panel-item"
                      role="menuitem"
                    >
                      <span className="app-login-panel-icon app-login-panel-icon--student"><RoleIcon role="student" /></span>
                      <span>
                        <strong>Učenik</strong>
                        <small>
                          {studentLoggedIn ? "Moji časovi" : "Prijavi se ili napravi nalog"}
                        </small>
                      </span>
                    </Link>
                    <Link
                      to={
                        teacherLoggedIn
                          ? "/teacher/dashboard"
                          : "/teacher/login"
                      }
                      className="app-login-panel-item"
                      role="menuitem"
                    >
                      <span className="app-login-panel-icon"><RoleIcon role="teacher" /></span>
                      <span>
                        <strong>Profesor</strong>
                        <small>
                          {teacherLoggedIn ? "Otvori svoj panel" : "Prijavi se"}
                        </small>
                      </span>
                    </Link>
                    <Link
                      to={adminLoggedIn ? "/admin/dashboard" : "/admin/login"}
                      className="app-login-panel-item"
                      role="menuitem"
                    >
                      <span className="app-login-panel-icon app-login-panel-icon--blue"><RoleIcon role="admin" /></span>
                      <span>
                        <strong>Administrator</strong>
                        <small>
                          {adminLoggedIn
                            ? "Otvori kontrolni panel"
                            : "Prijavi se"}
                        </small>
                      </span>
                    </Link>
                    {loggedIn && (
                      <button
                        type="button"
                        className="app-login-panel-logout"
                        role="menuitem"
                        onClick={handleLogout}
                      >
                        Odjavi se
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main" id="main-content">
        <div key={location.pathname} className="route-surface">
          <Outlet />
        </div>
      </main>


    </div>
  );
}

export default Layout;
