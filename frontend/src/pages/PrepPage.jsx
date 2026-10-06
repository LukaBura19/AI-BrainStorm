import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle } from "lucide-react";
import Reveal from "../components/Reveal";
import { PREP_PAGES } from "../data/prepLectures";
import "./PrepPage.css";

function Lecture({ lecture }) {
  return <figure className="prep-lecture">
    <div className="prep-lecture-video">
      <iframe src={`https://www.youtube-nocookie.com/embed/${lecture.youtubeId}`} title={lecture.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
    </div>
    <figcaption><strong>{lecture.title}</strong>{lecture.duration && <span>{lecture.duration}</span>}</figcaption>
  </figure>;
}

function ComingSoon({ index }) {
  return <div className="prep-lecture prep-lecture--soon" aria-hidden="true">
    <div className="prep-lecture-video"><PlayCircle size={34} strokeWidth={1.4} /></div>
    <div className="prep-soon-lines"><i style={{ width: `${70 - index * 12}%` }} /><i /></div>
  </div>;
}

/** Stranica sa snimcima predavanja za malu ili veliku maturu. */
export default function PrepPage({ exam }) {
  const page = PREP_PAGES[exam];
  return (
    <div className="prep-page">
      <header className="prep-hero">
        <h1>{page.title}</h1>
        <p>{page.lead}</p>
        <Link to="/booking" className="btn btn-primary">Zakaži čas pripreme <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>

      {page.subjects.map((subject, index) => (
        <Reveal as="section" key={subject.name} className="prep-subject" delay={index * .05} aria-labelledby={`prep-${exam}-${index}`}>
          <div className="prep-subject-head">
            <h2 id={`prep-${exam}-${index}`}>{subject.name}</h2>
            <p>{subject.topics}</p>
            {subject.lectures.length === 0 && <span className="prep-soon-badge">Snimci uskoro</span>}
          </div>
          <div className="prep-lectures">
            {subject.lectures.length > 0
              ? subject.lectures.map((lecture) => <Lecture key={lecture.youtubeId} lecture={lecture} />)
              : [0, 1, 2].map((i) => <ComingSoon key={i} index={i} />)}
          </div>
        </Reveal>
      ))}
    </div>
  );
}
