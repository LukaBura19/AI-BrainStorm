import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BadgeCheck, BookOpen, Calculator, Check, ListChecks, Lock, MessagesSquare, Play, PlayCircle } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import Reveal from "../components/Reveal";
import Spinner from "../components/Spinner";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import { plural } from "../utils/plural";
import "./PrepPage.css";

const TITLES = { "mala-matura": "Mala matura", "velika-matura": "Velika matura" };
const SUBJECT_ICONS = { matematika: Calculator, "srpski-jezik": BookOpen };
const LEVELS = { "osnovni-nivo": 1, "srednji-nivo": 2, "napredni-nivo": 3 };

function LectureCard({ exam, subjectSlug, lecture, purchased }) {
  const locked = lecture.has_video && !purchased;
  const playable = purchased && lecture.youtube_id;
  return (
    <Link to={`/${exam}/${subjectSlug}/${lecture.slug}`} className="prep-card">
      <span className={`prep-card-thumb ${playable ? "" : "is-soon"} ${locked ? "is-locked" : ""}`}>
        {playable && <img src={`https://i.ytimg.com/vi/${lecture.youtube_id}/hqdefault.jpg`} alt="" loading="lazy" />}
        <span className="prep-card-play" aria-hidden="true">{locked ? <Lock size={18} strokeWidth={2} /> : <Play size={18} fill="currentColor" />}</span>
        {locked && <span className="prep-card-soon prep-card-locked">Uz plaćen pristup</span>}
        {!lecture.has_video && <span className="prep-card-soon">Snimak uskoro</span>}
      </span>
      <span className="prep-card-body">
        <strong>{lecture.title}</strong>
        {lecture.summary && <span className="prep-card-summary">{lecture.summary}</span>}
        <span className="prep-card-meta">
          <ListChecks size={15} strokeWidth={1.9} aria-hidden="true" />
          {lecture.task_count} {plural(lecture.task_count, "zadatak", "zadatka", "zadataka")}
          {lecture.duration_minutes && <> · {lecture.duration_minutes} min</>}
          {/* Na telefonu nema mesta za natpis na sličici, pa „zaključano“ ide u ovaj red. */}
          {locked && <span className="prep-card-lock-note"><Lock size={13} strokeWidth={2.2} aria-hidden="true" />Zaključano</span>}
          <ArrowRight size={16} className="prep-card-arrow" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

/** Zeleni panel ponude dok pristup nije plaćen: cena, šta se dobija i kupovina. */
function OfferPanel({ exam, access, lectureCount }) {
  return (
    <aside className="prep-offer" aria-labelledby="prep-offer-title">
      <h2 id="prep-offer-title">Otključaj sve snimke</h2>
      <p className="prep-offer-price"><strong>{access.price_eur} €</strong><span>jednokratno, bez pretplate</span></p>
      <ul className="prep-offer-list">
        {access.includes.map((item) => <li key={item}><Check size={16} strokeWidth={2.4} aria-hidden="true" />{item}</li>)}
      </ul>
      <p className="prep-offer-count"><PlayCircle size={16} strokeWidth={1.9} aria-hidden="true" />{lectureCount} {plural(lectureCount, "snimak", "snimka", "snimaka")} sa zadacima</p>
      <Link to={`/${exam}/kupovina`} className="btn btn-accent btn-lg prep-offer-btn">Kupi pristup <ArrowRight size={17} aria-hidden="true" /></Link>
      {!access.signed_in && <p className="prep-offer-login">Već si platio? <Link to={`/ucenik/prijava?dalje=/${exam}`}>Prijavi se</Link></p>}
    </aside>
  );
}

function LevelMeter({ level }) {
  return (
    <span className="prep-level" role="img" aria-label={`Nivo ${level} od 3`}>
      {[1, 2, 3].map((step) => <i key={step} className={step <= level ? "on" : ""} />)}
    </span>
  );
}

/** Snimci za malu ili veliku maturu, po predmetima i oblastima. */
export default function PrepPage({ exam }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api.get(`/public/prep/${exam}`)
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [exam]);

  const subjects = data?.subjects ?? [];
  const access = data?.access;
  const lectureCount = subjects.reduce((sum, item) => sum + item.groups.reduce((inner, group) => inner + group.lectures.length, 0), 0);
  const requested = params.get("predmet");
  const subject = subjects.find((item) => item.slug === requested) ?? subjects[0];
  const chooseSubject = (slug) => setParams(slug === subjects[0]?.slug ? {} : { predmet: slug }, { replace: true, preventScrollReset: true });

  return (
    <div className="prep-page">
      <header className={`prep-hero ${access && !access.purchased ? "has-offer" : ""}`}>
        <div className="prep-hero-text">
          <h1>{TITLES[exam]}</h1>
          {data?.lead && <p>{data.lead}</p>}
          <div className="prep-hero-actions">
            {access?.purchased && <span className="prep-access-chip"><BadgeCheck size={18} strokeWidth={2} aria-hidden="true" /> Pristup aktivan</span>}
            <Link to="/booking" className="btn btn-primary">Zakaži čas pripreme <ArrowRight size={16} aria-hidden="true" /></Link>
            {data?.chat_available && <span className="prep-hero-note"><MessagesSquare size={18} strokeWidth={1.8} aria-hidden="true" /> Uz svaki snimak je asistent kome možeš da postaviš pitanje o zadacima.</span>}
          </div>
        </div>
        {access && !access.purchased && <OfferPanel exam={exam} access={access} lectureCount={lectureCount} />}
      </header>

      {error && <Alert type="error">{error}</Alert>}
      {!data && !error && <Spinner text="Učitavam snimke…" />}

      {subject && (
        <>
          {subjects.length > 1 && (
            <AnimatedTabs
              id={`prep-${exam}`}
              className="prep-tabs"
              tabs={subjects.map((item) => ({ key: item.slug, label: item.name, icon: SUBJECT_ICONS[item.slug] }))}
              active={subject.slug}
              onChange={chooseSubject}
            />
          )}

          <div className="prep-subject" key={subject.slug}>
            {(subjects.length === 1 || subject.tagline) && (
              <div className="prep-subject-head">
                <h2>{subject.name}</h2>
                {subject.tagline && <p>{subject.tagline}</p>}
              </div>
            )}

            {subject.groups.map((group, index) => (
              <Reveal as="section" key={group.slug} className="prep-group" delay={index * .06} aria-labelledby={`prep-group-${group.slug}`}>
                <div className="prep-group-head">
                  {LEVELS[group.slug] && <LevelMeter level={LEVELS[group.slug]} />}
                  <h3 id={`prep-group-${group.slug}`}>{group.name}</h3>
                  <span>{group.lectures.length} {plural(group.lectures.length, "snimak", "snimka", "snimaka")}</span>
                </div>
                <div className="prep-cards">
                  {group.lectures.map((lecture) => <LectureCard key={lecture.slug} exam={exam} subjectSlug={subject.slug} lecture={lecture} purchased={Boolean(access?.purchased)} />)}
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
