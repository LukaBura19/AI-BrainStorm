import { Check } from "lucide-react";
import "./JourneyProgress.css";

/**
 * Horizontal "synapse" progress: nodes connected by a line that fills with a travelling impulse.
 * Completed nodes show the chosen value and are clickable to jump back.
 */
export default function JourneyProgress({ steps, currentStep, values = [], onStepClick }) {
  const total = steps.length;
  const current = Math.min(Math.max(currentStep, 1), total);
  const progress = total > 1 ? (current - 1) / (total - 1) : 1;
  const label = steps[current - 1] || "";

  return <nav className="journey" aria-label={`Korak ${current} od ${total}: ${label}`} style={{ "--journey-progress": progress }}>
    <div className="journey-compact" aria-hidden="true">
      <span className="journey-compact-count"><strong>{String(current).padStart(2, "0")}</strong>/{String(total).padStart(2, "0")}</span>
      <span className="journey-compact-label">{label}</span>
    </div>
    <div className="journey-track">
      <span className="journey-rail" aria-hidden="true" />
      <span className="journey-fill" aria-hidden="true"><i className="journey-impulse" key={current} /></span>
      <ol>
        {steps.map((step, index) => {
          const number = index + 1;
          const completed = number < current;
          const active = number === current;
          const clickable = completed && Boolean(onStepClick);
          return <li key={step} className={`journey-node ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}>
            <button type="button" disabled={!clickable} onClick={() => clickable && onStepClick(number)} aria-current={active ? "step" : undefined}
              aria-label={`${step}${completed ? `, završeno${values[index] ? `: ${values[index]}` : ""}` : active ? ", trenutni korak" : ""}`}>
              <span className="journey-dot" aria-hidden="true">
                {active && <><i className="journey-pulse" /><i className="journey-pulse journey-pulse--late" /></>}
                <span className="journey-dot-core">{completed ? <Check size={13} strokeWidth={3} /> : number}</span>
              </span>
              <span className="journey-label" aria-hidden="true">
                <span>{step}</span>
                <small>{completed ? values[index] || "✓" : active ? "Sada" : " "}</small>
              </span>
            </button>
          </li>;
        })}
      </ol>
    </div>
  </nav>;
}
