import useTypewriter from "../hooks/useTypewriter";
import "./TypewriterText.css";

// Reserve the finished title's size and expose its complete accessible name.
export default function TypewriterText({ text }) {
  const { displayed, done } = useTypewriter(text, 34, 140);
  return <span className="typewriter-text" data-typing={done ? "done" : "typing"}>
    <span className="typewriter-reserve" aria-hidden="true">{text}</span>
    <span className="typewriter-displayed" aria-hidden="true">{displayed}{!done && <span className="typewriter-caret" />}</span>
    <span className="typewriter-accessible">{text}</span>
  </span>;
}
