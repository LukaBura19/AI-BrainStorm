import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Code2, DoorOpen, GraduationCap, Languages, MapPin, NotebookPen, Phone, Star } from "lucide-react";
import Reveal from "../components/Reveal";
import "./AboutPage.css";

const ADDRESS = "Bože Jankovića 49, Beograd";
const MAPS_QUERY = encodeURIComponent(ADDRESS);
const PHONE_DISPLAY = "064 546 7246";
const PHONE_LINK = "tel:+381645467246";
const INSTAGRAM_URL = "https://www.instagram.com/ec.brainstorm/";

/** Instagram glyph drawn in the same 2px stroke style as the lucide icons. */
function InstagramIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </svg>;
}

const offers = [
  { icon: NotebookPen, title: "Privatni časovi", text: "Matematika, informatika, fizika, hemija i jezici. Individualno ili u maloj grupi, uživo u centru ili online." },
  { icon: GraduationCap, title: "Pripreme za malu maturu i prijemne", text: "Plan rada prema testu koji te čeka, zadaci sa prethodnih ispita i mirna glava pred sam ispit." },
  { icon: Languages, title: "Kursevi stranih jezika", text: "Engleski, nemački i ruski, od prvih reči do sigurne konverzacije." },
  { icon: Code2, title: "Kursevi programiranja", text: "Od prvog programa do projekata, tempom koji odgovara učeniku." },
  { icon: DoorOpen, title: "Učionica za iznajmljivanje", text: "Tražiš prostor za svoje časove ili radionicu? Naša učionica je dostupna i za tebe." },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <h1 id="about-title">Učimo zajedno, <em>korak po korak.</em></h1>
          <p>Edukativni centar BrainStorm je mesto u Beogradu gde đaci i studenti dobijaju podršku koja im zaista treba: privatne časove, pripremu za malu maturu i prijemne ispite, kao i kurseve stranih jezika i programiranja.</p>
          <div className="about-hero-actions">
            <Link to="/booking" className="btn btn-primary">Zakaži čas <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link to="/cenovnik" className="btn btn-secondary">Pogledaj cenovnik</Link>
          </div>
        </div>
        <aside className="about-hero-facts" aria-label="Ukratko">
          <a className="about-rating" href={`https://www.google.com/maps/search/?api=1&query=Edukativni+centar+BrainStorm+${MAPS_QUERY}`} target="_blank" rel="noreferrer">
            <span className="about-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill="currentColor" strokeWidth={0} />)}</span>
            <strong>5.0</strong>
            <span>ocena na Google-u</span>
          </a>
          <ul>
            <li><MapPin size={18} aria-hidden="true" /><span>{ADDRESS}</span></li>
            <li><Clock3 size={18} aria-hidden="true" /><span>Svakog dana od 9 do 21h</span></li>
            <li><Phone size={18} aria-hidden="true" /><a href={PHONE_LINK}>{PHONE_DISPLAY}</a></li>
            <li><InstagramIcon /><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@ec.brainstorm</a></li>
          </ul>
        </aside>
      </section>

      <section className="about-offers" aria-labelledby="offers-title">
        <h2 id="offers-title">Šta radimo</h2>
        <div className="about-offer-list">
          {offers.map(({ icon: Icon, title, text }, index) => (
            <Reveal as="div" key={title} delay={index * .06} className="about-offer">
              <span className="about-offer-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="about-quote" aria-label="Naša poruka">
        <p>Prijemni je nikad bliže? <span>Ne paniči, čekamo te.</span></p>
        <Link to="/booking" className="about-quote-link">Zakaži prvi čas <ArrowRight size={18} aria-hidden="true" /></Link>
      </Reveal>

      <section className="about-visit" aria-labelledby="visit-title">
        <div className="about-visit-copy">
          <h2 id="visit-title">Dođi da se upoznamo</h2>
          <p>Centar se nalazi na Voždovcu, blizu Kumodraške ulice. Javi se telefonom ili porukom na Instagramu, ili odmah izaberi termin online.</p>
          <dl>
            <div><dt>Adresa</dt><dd><a href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer">{ADDRESS}</a></dd></div>
            <div><dt>Telefon</dt><dd><a href={PHONE_LINK}>{PHONE_DISPLAY}</a></dd></div>
            <div><dt>Radno vreme</dt><dd>Ponedeljak – nedelja, 9–21h</dd></div>
            <div><dt>Instagram</dt><dd><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@ec.brainstorm</a></dd></div>
          </dl>
        </div>
        <div className="about-map">
          <iframe title={`Mapa: ${ADDRESS}`} src={`https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>
    </div>
  );
}
