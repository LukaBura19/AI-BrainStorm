import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MouseScrubVideo from "../components/MouseScrubVideo";
import useTypewriter from "../hooks/useTypewriter";
import "./HomePage.css";

const greeting = "Dobro došli u Edukativni centar BrainStorm! Znanje otvara mogućnosti. Svet je tvoj — napravi prvi korak.";

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
          <span className="home-typewriter-reserve" aria-hidden="true">{greeting}</span>
          <span className="home-typewriter-displayed" aria-hidden="true">{displayed}<span className={`home-typewriter-caret ${done ? "is-done" : ""}`} /></span>
          <span className="home-sr-only">{greeting}</span>
        </h1>
        <div className={`home-actions ${actionsVisible ? "is-visible" : ""}`}>
          <Link to="/booking" className="home-booking-cta">
            <span>Zakaži svoj čas</span>
            <span className="home-booking-arrow" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16m-6-6 6 6-6 6" /></svg></span>
          </Link>
        </div>
      </div>
    </section>
  </div>;
}
