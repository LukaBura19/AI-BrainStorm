import { Link } from "react-router-dom";
import { ArrowRight, Check, GraduationCap } from "lucide-react";
import Reveal from "../components/Reveal";
import CountUp from "../components/ui/CountUp";
import TiltSurface from "../components/ui/TiltSurface";
import "./PricingPage.css";

const schoolPrices = [
  { minutes: 45, amount: 1500, description: "Za jedno konkretno pitanje", tone: "#c8643b" },
  { minutes: 60, amount: 2000, description: "Standardni čas", featured: true, tone: "#1f4d3a" },
  { minutes: 90, amount: 2500, description: "Za temeljnu pripremu", tone: "#6f8f62" },
];

function PricingPage() {
  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <p>Jasno, bez sitnih slova</p>
        <h1>Izaberi vreme koje<br /><em>radi za tebe.</em></h1>
        <span>Cene su izražene u dinarima i važe za individualne časove.</span>
      </header>

      <section className="pricing-main" aria-labelledby="school-pricing">
        <div className="pricing-section-heading"><span>Osnovna i srednja škola</span><h2 id="school-pricing">Jedan čas, jedan sledeći korak.</h2></div>
        <div className="pricing-grid">
          {schoolPrices.map(({ minutes, amount, description, featured, tone }, index) => (
            <Reveal key={minutes} delay={index * .1}>
              <TiltSurface as="article" className={`pricing-card ${featured ? "featured" : ""}`} style={{ "--tone": tone, "--fill": minutes / 90 }} data-spotlight>
                {featured && <span className="pricing-popular">Najčešći izbor</span>}
                <div className="pricing-ring" aria-hidden="true">
                  <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" className="pricing-ring-track" /><circle cx="50" cy="50" r="44" pathLength="100" className="pricing-ring-fill" /></svg>
                </div>
                <p><strong>{minutes}</strong> minuta</p>
                <div><b><CountUp value={amount} /></b><small>RSD / čas</small></div>
                <span className="pricing-description">{description}</span>
                <ul className="pricing-includes"><li><Check size={13} aria-hidden="true" /> Individualni rad sa profesorom</li><li><Check size={13} aria-hidden="true" /> U centru ili online</li></ul>
                <Link to="/booking" className={`btn ${featured ? "btn-primary" : "btn-secondary"}`}>Izaberi ovaj čas <ArrowRight size={15} aria-hidden="true" /></Link>
              </TiltSurface>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <TiltSurface as="section" className="pricing-faculty" strength={3} data-spotlight aria-labelledby="faculty-pricing">
          <span className="pricing-faculty-icon" aria-hidden="true"><GraduationCap size={30} strokeWidth={1.5} /></span>
          <div><p>Fakultet</p><h2 id="faculty-pricing">90 minuta fokusiranog rada</h2><span>Za zahtevnije oblasti, kolokvijume i ispite.</span></div>
          <strong><CountUp value={3000} /> <small>RSD</small></strong>
          <Link to="/booking" className="btn btn-primary">Zakaži termin <ArrowRight size={15} aria-hidden="true" /></Link>
        </TiltSurface>
      </Reveal>

      <p className="pricing-footnote">Za grupne časove, pakete i posebne aranžmane kontaktirajte BrainStorm tim preko glavnog sajta.</p>
    </div>
  );
}

export default PricingPage;
