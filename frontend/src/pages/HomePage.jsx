import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MouseScrubVideo from "../components/MouseScrubVideo";
import useTypewriter from "../hooks/useTypewriter";
import "./HomePage.css";

const greetingLines = ["Dobro došli u", "Edukativni centar", "BrainStorm!"];
const greeting = greetingLines.join(" ");

export default function HomePage() {
  const heroRef = useRef(null);
  const { displayed, done } = useTypewriter(greeting);
  const [actionsVisible, setActionsVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setActionsVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return <div className="home home--video">
    <section ref={heroRef} className="home-hero-layout" aria-labelledby="hero-title">
      <MouseScrubVideo visibilityRef={heroRef} />
      <div className="home-hero-copy">
        <h1 id="hero-title" className="home-typewriter" data-typing={done ? "done" : "typing"}>
          {/* Every line is laid out in full from the start; untyped letters stay invisible, so words never jump lines. */}
          <span className="home-typewriter-lines" aria-hidden="true">
            {greetingLines.map((line, index) => {
              const start = greetingLines.slice(0, index).reduce((sum, previous) => sum + previous.length + 1, 0);
              const typed = Math.max(0, Math.min(line.length, displayed.length - start));
              const caretHere = !done && displayed.length >= start && displayed.length <= start + line.length;
              return <span key={line} className="home-typewriter-line">
                {line.slice(0, typed)}
                {caretHere && <span className="home-typewriter-caret" />}
                <span className="home-typewriter-ghost">{line.slice(typed)}</span>
              </span>;
            })}
          </span>
          <span className="home-sr-only">{greeting}</span>
        </h1>
        <div className={`home-actions ${actionsVisible ? "is-visible" : ""}`}>
          <Link to="/booking" className="home-booking-cta">
            <span className="home-booking-label">Zakaži svoj čas</span>
            <span className="home-booking-arrow" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></span>
          </Link>
        </div>
      </div>
    </section>
  </div>;
}
