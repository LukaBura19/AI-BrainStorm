import { Link } from "react-router-dom";
import { ArrowRight, Clock3, Code2, DoorOpen, GraduationCap, Languages, Mail, MapPin, NotebookPen, Phone, Speech, Star } from "lucide-react";
import Reveal from "../components/Reveal";
import "./AboutPage.css";

const ADDRESS = "Bože Jankovića 49, Beograd";
const MAPS_QUERY = encodeURIComponent(ADDRESS);
const PHONE_DISPLAY = "064 546 7246";
const PHONE_LINK = "tel:+381645467246";
const INSTAGRAM_URL = "https://www.instagram.com/ec.brainstorm/";
const EMAIL = "edukativni.centar.brainstorm@gmail.com";
// On narrow screens the address may wrap, and it should wrap before the "@", not mid-word.
const EMAIL_LABEL = <>edukativni.centar.brainstorm<wbr />@gmail.com</>;

/** Instagram glyph drawn in the same 2px stroke style as the lucide icons. */
function InstagramIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" fill="currentColor" />
  </svg>;
}

const offers = [
  {
    icon: NotebookPen,
    title: "Privatni časovi",
    text: "Časovi mogu biti individualni ili grupni, uživo u centru ili online. Predajemo matematiku, programiranje, srpski, hemiju, fiziku i filozofiju, a od stranih jezika engleski, nemački, ruski, španski i italijanski.",
  },
  {
    icon: GraduationCap,
    title: "Pripreme za malu i veliku maturu",
    text: "Za malu maturu spremamo srpski i matematiku, a za veliku matematiku za prijemne na PMF-u, ETF-u, FON-u, Mašinskom, Građevinskom i Ekonomskom fakultetu. Zadatke sa ranijih ispita prolazimo oblast po oblast.",
    links: [{ to: "/mala-matura", label: "Mala matura" }, { to: "/velika-matura", label: "Velika matura" }],
  },
  { icon: Languages, title: "Kursevi stranih jezika", text: "Učimo engleski, nemački i ruski. Možeš da kreneš od nule ili da samo vežbaš razgovor ako jezik već znaš." },
  { icon: Code2, title: "Kursevi programiranja", text: "Kreće se od prvog programa, a stiže do projekata koje učenik pravi sam. Tempo prilagođavamo svakome." },
  { icon: DoorOpen, title: "Iznajmljivanje učionica", text: "Ako ti treba prostor za časove ili radionicu, možeš da iznajmiš učionicu u centru." },
  { icon: Speech, title: "Debatno veče", text: "Veče posvećeno raspravi o jednoj temi. Vežbaš kako da izneseš svoje mišljenje i kako da saslušaš drugu stranu. Kada je sledeće, pitaj nas na Instagramu." },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero-copy">
          <h1 id="about-title">Učimo zajedno, <em>korak po korak.</em></h1>
          <p>BrainStorm je edukativni centar u Beogradu kakvih nema mnogo. Kod nas učenici imaju profesore koji su uz njih kroz celo školovanje, od osnovne škole do fakulteta. Profesore smo pažljivo birali i svi imaju iskustva u radu sa učenicima. Za pitanja i pomoć dostupni su i između časova.</p>
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
            <li><Mail size={18} aria-hidden="true" /><a href={`mailto:${EMAIL}`}>{EMAIL_LABEL}</a></li>
          </ul>
        </aside>
      </section>

      <section className="about-offers" aria-labelledby="offers-title">
        <h2 id="offers-title">Šta nudimo</h2>
        <div className="about-offer-list">
          {offers.map(({ icon: Icon, title, text, links }, index) => (
            <Reveal as="div" key={title} delay={index * .06} className="about-offer">
              <span className="about-offer-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
              <h3>{title}</h3>
              <div className="about-offer-text">
                <p>{text}</p>
                {links && (
                  <div className="about-offer-links">
                    {links.map((link) => <Link key={link.to} to={link.to}>{link.label} <ArrowRight size={15} aria-hidden="true" /></Link>)}
                  </div>
                )}
              </div>
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
          <p>Edukativni centar se nalazi na Voždovcu, u blizini Autokomande. Za detalje nam se javi preko društvenih mreža ili na email.</p>
          <dl>
            <div><dt>Adresa</dt><dd><a href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer">{ADDRESS}</a></dd></div>
            <div><dt>Telefon</dt><dd><a href={PHONE_LINK}>{PHONE_DISPLAY}</a></dd></div>
            <div><dt>Radno vreme</dt><dd>Ponedeljak – nedelja, 9–21h</dd></div>
            <div><dt>Instagram</dt><dd><a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">@ec.brainstorm</a></dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL_LABEL}</a></dd></div>
          </dl>
        </div>
        <div className="about-map">
          <iframe title={`Mapa: ${ADDRESS}`} src={`https://maps.google.com/maps?q=${MAPS_QUERY}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>
    </div>
  );
}
