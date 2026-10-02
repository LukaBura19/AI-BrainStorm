import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "../components/Reveal";
import "./PricingPage.css";

const schoolPrices = [
  ["45", "1.500", "Za jedno konkretno pitanje"],
  ["60", "2.000", "Standardni čas", true],
  ["90", "2.500", "Za temeljnu pripremu"],
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
          {schoolPrices.map(([minutes, amount, description, featured], index) => (
            <Reveal as="article" key={minutes} className={`liquid-glass ${featured ? "featured" : ""}`} delay={index * .1}>
              {featured && <span className="pricing-popular">Najčešći izbor</span>}
              <p><strong>{minutes}</strong> minuta</p>
              <div><b>{amount}</b><small>RSD / čas</small></div>
              <span className="pricing-description">{description}</span>
              <ul className="pricing-includes"><li><Check size={13} aria-hidden="true" /> Individualni rad sa profesorom</li><li><Check size={13} aria-hidden="true" /> U centru ili online</li></ul>
              <Link to="/booking" className={`btn ${featured ? "btn-primary" : "btn-secondary"}`}>Izaberi ovaj čas <ArrowRight size={15} aria-hidden="true" /></Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="pricing-faculty" aria-labelledby="faculty-pricing">
        <div><p>Fakultet</p><h2 id="faculty-pricing">90 minuta fokusiranog rada</h2><span>Za zahtevnije oblasti, kolokvijume i ispite.</span></div>
        <strong>3.000 <small>RSD</small></strong>
        <Link to="/booking" className="btn btn-primary">Zakaži termin →</Link>
      </section>

      <p className="pricing-footnote">Za grupne časove, pakete i posebne aranžmane kontaktirajte BrainStorm tim preko glavnog sajta.</p>
    </div>
  );
}

export default PricingPage;
