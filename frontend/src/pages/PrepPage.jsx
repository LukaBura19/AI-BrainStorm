import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, BookOpen, Calculator, ListChecks, MessagesSquare, Play } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import Reveal from "../components/Reveal";
import Spinner from "../components/Spinner";
import AnimatedTabs from "../components/ui/AnimatedTabs";
import "./PrepPage.css";

const TITLES = { "mala-matura": "Mala matura", "velika-matura": "Velika matura" };
const SUBJECT_ICONS = { matematika: Calculator, "srpski-jezik": BookOpen };
const LEVELS = { "osnovni-nivo": 1, "srednji-nivo": 2, "napredni-nivo": 3 };

/** 1 zadatak, 2 zadatka, 5 zadataka (11–14 zadataka). */
function plural(count, one, few, many) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function LectureCard({ exam, subjectSlug, lecture }) {
  return (
    <Link to={`/${exam}/${subjectSlug}/${lecture.slug}`} className="prep-card">
      <span className={`prep-card-thumb ${lecture.youtube_id ? "" : "is-soon"}`}>
        {lecture.youtube_id && <img src={`https://i.ytimg.com/vi/${lecture.youtube_id}/hqdefault.jpg`} alt="" loading="lazy" />}
        <span className="prep-card-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
        {!lecture.has_video && <span className="prep-card-soon">Snimak uskoro</span>}
      </span>
      <span className="prep-card-body">
        <strong>{lecture.title}</strong>
        {lecture.summary && <span className="prep-card-summary">{lecture.summary}</span>}
        <span className="prep-card-meta">
          <ListChecks size={15} strokeWidth={1.9} aria-hidden="true" />
          {lecture.task_count} {plural(lecture.task_count, "zadatak", "zadatka", "zadataka")}
          {lecture.duration_minutes && <> · {lecture.duration_minutes} min</>}
          <ArrowRight size={16} className="prep-card-arrow" aria-hidden="true" />
        </span>
      </span>
    </Link>
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
  const requested = params.get("predmet");
  const subject = subjects.find((item) => item.slug === requested) ?? subjects[0];
  const chooseSubject = (slug) => setParams(slug === subjects[0]?.slug ? {} : { predmet: slug }, { replace: true, preventScrollReset: true });

  return (
    <div className="prep-page">
      <header className="prep-hero">
        <h1>{TITLES[exam]}</h1>
        {data?.lead && <p>{data.lead}</p>}
        <div className="prep-hero-actions">
          <Link to="/booking" className="btn btn-primary">Zakaži čas pripreme <ArrowRight size={16} aria-hidden="true" /></Link>
          {data?.chat_available && <span className="prep-hero-note"><MessagesSquare size={18} strokeWidth={1.8} aria-hidden="true" /> Uz svaki snimak je asistent kome možeš da postaviš pitanje o zadacima.</span>}
        </div>
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
                  {group.lectures.map((lecture) => <LectureCard key={lecture.slug} exam={exam} subjectSlug={subject.slug} lecture={lecture} />)}
                </div>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
