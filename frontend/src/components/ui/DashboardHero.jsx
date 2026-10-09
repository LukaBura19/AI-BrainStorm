import { LogOut } from "lucide-react";
import TeacherAvatar from "../TeacherAvatar";
import CountUp from "./CountUp";
import TiltSurface from "./TiltSurface";
import "./ui.css";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Belgrade", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 11) return "Dobro jutro";
  if (hour < 18) return "Dobar dan";
  return "Dobro veče";
}

const today = () => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: "Europe/Belgrade", weekday: "long", day: "numeric", month: "long" }).format(new Date());

/**
 * Shared welcome banner for the student, teacher and admin panels, with live stat tiles.
 * `title` replaces the default "Dobrodošli, {name}" heading; `actions` renders before the sign-out button.
 */
export default function DashboardHero({ name, role, onLogout, stats = [], aside, title, actions }) {
  return <section className="dash-hero" data-spotlight>
    <div className="dash-hero-main">
      <TeacherAvatar name={name} />
      <div className="dash-hero-copy">
        <p className="dash-hero-eyebrow"><span>{role}</span>{greeting()} · {today()}</p>
        <h1 className="page-title">{title ?? <>Dobrodošli, <span className="fx-gradient-text">{name}</span></>}</h1>
        {aside}
      </div>
      <div className="dash-hero-actions">
        {actions}
        <button type="button" className="btn btn-secondary btn-sm dash-hero-logout" onClick={onLogout}><LogOut size={15} aria-hidden="true" /> Odjavi se</button>
      </div>
    </div>
    {stats.length > 0 && <div className="dash-stats">
      {stats.map(({ label, value, icon: Icon, hint, tone = "pink" }, index) => (
        <TiltSurface key={label} className={`dash-stat dash-stat--${tone} fx-rise`} style={{ "--i": index }}>
          <span className="dash-stat-icon">{Icon && <Icon size={19} strokeWidth={1.8} aria-hidden="true" />}</span>
          <strong>{typeof value === "number" ? <CountUp value={value} /> : value ?? "—"}</strong>
          <span className="dash-stat-label">{label}</span>
          {hint && <small>{hint}</small>}
        </TiltSurface>
      ))}
    </div>}
  </section>;
}
