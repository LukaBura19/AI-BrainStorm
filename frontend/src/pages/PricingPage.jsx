import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import Reveal from "../components/Reveal";
import CountUp from "../components/ui/CountUp";
import TiltSurface from "../components/ui/TiltSurface";
import "./PricingPage.css";

const SECTIONS = [
  {
    id: "skola",
    title: "Osnovna i srednja škola",
    note: "45, 60 ili 90 minuta",
    prices: [
      { minutes: 45, amount: 1500, description: "Za jedno konkretno pitanje", tone: "#c8643b" },
      { minutes: 60, amount: 2000, description: "Standardni čas", featured: true, tone: "#1f4d3a" },
      { minutes: 90, amount: 2500, description: "Za temeljnu pripremu", tone: "#6f8f62" },
    ],
  },
  {
    id: "fakultet",
    title: "Fakultet",
    note: "Čas od 90 minuta",
    prices: [
      { minutes: 90, amount: 3000, description: "Za kolokvijume i ispite", tone: "#1f4d3a" },
    ],
  },
];

function PriceCard({ minutes, amount, description, featured, tone }) {
  return <TiltSurface as="article" className={`pricing-card ${featured ? "featured" : ""}`} style={{ "--tone": tone, "--fill": minutes / 90 }}>
    {featured && <span className="pricing-popular">Najčešći izbor</span>}
    <div className="pricing-ring" aria-hidden="true">
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" className="pricing-ring-track" /><circle cx="50" cy="50" r="44" pathLength="100" className="pricing-ring-fill" /></svg>
    </div>
    <p><strong>{minutes}</strong> minuta</p>
    <div><b><CountUp value={amount} /></b><small>RSD / čas</small></div>
    <span className="pricing-description">{description}</span>
    <ul className="pricing-includes"><li><Check size={13} aria-hidden="true" /> Individualni rad sa profesorom</li><li><Check size={13} aria-hidden="true" /> Uživo ili online</li></ul>
    <Link to="/booking" className={`btn ${featured ? "btn-primary" : "btn-secondary"}`}>Izaberi ovaj čas <ArrowRight size={15} aria-hidden="true" /></Link>
  </TiltSurface>;
}

function PricingPage() {
  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <h1>Cenovnik</h1>
        <span>Cene su izražene u dinarima i važe za individualne časove.</span>
      </header>

      <div className="pricing-sections">
        {SECTIONS.map((section, sectionIndex) => (
          <section key={section.id} className={`pricing-main pricing-main--${section.id}`} aria-labelledby={`pricing-${section.id}`}>
            <header className="pricing-section-head">
              <h2 id={`pricing-${section.id}`}>{section.title}</h2>
              <span>{section.note}</span>
            </header>
            <div className="pricing-grid">
              {section.prices.map((price, index) => (
                <Reveal key={price.minutes} delay={(sectionIndex * 3 + index) * .07}><PriceCard {...price} /></Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="pricing-footnote">Za grupne časove, pakete i posebne aranžmane kontaktirajte BrainStorm tim.</p>
    </div>
  );
}

export default PricingPage;
