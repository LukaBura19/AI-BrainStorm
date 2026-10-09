import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, MessageCircleQuestion, Play } from "lucide-react";
import api from "../services/api";
import Alert from "../components/Alert";
import Spinner from "../components/Spinner";
import LectureChat from "../components/LectureChat";
import "./LecturePage.css";

function LectureVideo({ lecture, exam, subjectSlug, lectureSlug }) {
  const access = lecture.access ?? {};
  const buyTo = `/${exam}/kupovina`;
  if (lecture.has_video && !access.purchased) {
    return (
      <div className="lecture-video lecture-video--soon lecture-video--locked" role="region" aria-label="Zaključan snimak">
        <span className="lecture-video-play lecture-video-lock" aria-hidden="true"><Lock size={28} strokeWidth={2} /></span>
        <strong>Snimak je zaključan</strong>
        <p>Otključaj sve snimke iz paketa {lecture.exam.name} za {access.price_eur} €, jednokratno.</p>
        <div className="lecture-video-actions">
          <Link to={buyTo} className="btn btn-accent">Kupi pristup <ArrowRight size={16} aria-hidden="true" /></Link>
          {!access.signed_in && <Link to={`/ucenik/prijava?dalje=/${exam}/${subjectSlug}/${lectureSlug}`} className="btn lecture-video-login">Prijavi se</Link>}
        </div>
      </div>
    );
  }
  if (lecture.youtube_id) {
    return (
      <div className="lecture-video">
        <iframe src={`https://www.youtube-nocookie.com/embed/${lecture.youtube_id}?rel=0`} title={lecture.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
      </div>
    );
  }
  if (lecture.video_url) {
    return <div className="lecture-video"><video src={lecture.video_url} controls preload="metadata" /></div>;
  }
  return (
    <div className="lecture-video lecture-video--soon">
      <span className="lecture-video-play" aria-hidden="true"><Play size={26} fill="currentColor" /></span>
      <strong>Snimak stiže uskoro</strong>
      <p>{lecture.chat_available ? "Zadaci su već ovde, a asistent može odmah da ti pomogne oko njih." : "Zadaci su već ovde, pa možeš da kreneš od njih."}</p>
      {!access.purchased && access.price_eur && <Link to={buyTo} className="lecture-video-offer">Pristup svim snimcima · {access.price_eur} € <ArrowRight size={15} aria-hidden="true" /></Link>}
    </div>
  );
}

/** Jedan snimak: video, zadaci sa snimka i asistent kome učenik postavlja pitanja. */
export default function LecturePage({ exam }) {
  const { subjectSlug, lectureSlug } = useParams();
  const [lecture, setLecture] = useState(null);
  const [error, setError] = useState("");
  const chatRef = useRef(null);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLecture(null);
    setError("");
    api.get(`/public/prep/${exam}/${subjectSlug}/${lectureSlug}`)
      .then((data) => { if (active) setLecture(data); })
      .catch((err) => { if (active) setError(err.status === 404 ? "Ovaj snimak ne postoji ili je premešten." : err.message); });
    return () => { active = false; };
  }, [exam, subjectSlug, lectureSlug]);

  const backTo = `/${exam}${subjectSlug ? `?predmet=${subjectSlug}` : ""}`;

  if (error) {
    return (
      <div className="lecture-page lecture-page--state">
        <Alert type="error">{error}</Alert>
        <Link to={backTo} className="btn btn-secondary"><ArrowLeft size={16} aria-hidden="true" /> Nazad na snimke</Link>
      </div>
    );
  }
  if (!lecture) return <div className="lecture-page lecture-page--state"><Spinner text="Učitavam snimak…" /></div>;

  const askAbout = (index) => {
    chatRef.current?.prefill(`Objasni mi ${index + 1}. zadatak.`);
    chatBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="lecture-page">
      <nav className="lecture-crumbs" aria-label="Putanja">
        <Link to={backTo}><ArrowLeft size={16} aria-hidden="true" /> {lecture.exam.name}</Link>
        <span aria-hidden="true">/</span>
        <span>{lecture.subject.name}</span>
        <span aria-hidden="true">/</span>
        <span>{lecture.group.name}</span>
      </nav>

      <header className="lecture-head">
        <h1>{lecture.title}</h1>
        {lecture.summary && <p>{lecture.summary}</p>}
      </header>

      <div className="lecture-layout">
        <div className="lecture-area lecture-area--video"><LectureVideo lecture={lecture} exam={exam} subjectSlug={subjectSlug} lectureSlug={lectureSlug} /></div>

        <aside className="lecture-area lecture-area--chat" ref={chatBoxRef} aria-label="Asistent">
          <LectureChat key={`${exam}/${subjectSlug}/${lectureSlug}`} ref={chatRef} exam={exam} subject={subjectSlug} lecture={lectureSlug} available={lecture.chat_available} />
        </aside>

        {lecture.tasks.length > 0 && (
          <section className="lecture-area lecture-area--tasks lecture-tasks" aria-labelledby="lecture-tasks-title">
            <h2 id="lecture-tasks-title">Zadaci sa snimka</h2>
            <ol>
              {lecture.tasks.map((task, index) => (
                <li key={task}>
                  <span className="lecture-task-number" aria-hidden="true">{index + 1}</span>
                  <p>{task}</p>
                  {lecture.chat_available && (
                    <button type="button" onClick={() => askAbout(index)} aria-label={`Pitaj asistenta o ${index + 1}. zadatku`}>
                      <MessageCircleQuestion size={16} strokeWidth={1.9} aria-hidden="true" /> Pitaj
                    </button>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {(lecture.previous || lecture.next) && (
          <nav className="lecture-area lecture-area--pager lecture-pager" aria-label="Ostali snimci">
            {lecture.previous && (
              <Link to={`/${exam}/${subjectSlug}/${lecture.previous.slug}`} className="lecture-pager-link">
                <ArrowLeft size={18} aria-hidden="true" />
                <span><small>Prethodni snimak</small><strong>{lecture.previous.title}</strong></span>
              </Link>
            )}
            {lecture.next && (
              <Link to={`/${exam}/${subjectSlug}/${lecture.next.slug}`} className="lecture-pager-link lecture-pager-link--next">
                <span><small>Sledeći snimak</small><strong>{lecture.next.title}</strong></span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
