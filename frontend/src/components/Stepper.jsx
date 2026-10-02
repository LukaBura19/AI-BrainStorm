import "./Stepper.css";

function Stepper({ steps, currentStep, onStepClick }) {
  const total = steps.length;
  const safeCurrent = Math.min(Math.max(currentStep, 1), total);
  const pct = total > 1 ? ((safeCurrent - 1) / (total - 1)) * 100 : 100;
  const currentLabel = steps[safeCurrent - 1] || "";

  return (
    <nav className="stepper" aria-label={`Korak ${safeCurrent} od ${total}: ${currentLabel}`}>
      <div className="stepper-heading">
        <span>Tvoj put do časa</span>
        <strong>{currentLabel}</strong>
      </div>
      <div className="stepper-line" style={{ "--step-progress": `${pct}%` }}>
        <span className="stepper-fill" style={{ width: `${pct}%` }} />
        <ol>
          {steps.map((label, index) => {
            const number = index + 1;
            const completed = number < safeCurrent;
            const active = number === safeCurrent;
            const clickable = completed && Boolean(onStepClick);
            return (
              <li key={label} className={`${completed ? "complete" : ""} ${active ? "active" : ""}`}>
                <button type="button" disabled={!clickable} onClick={() => clickable && onStepClick(number)} aria-current={active ? "step" : undefined} aria-label={`${label}${completed ? ", završeno" : active ? ", trenutni korak" : ""}`}>
                  <span className="stepper-number" aria-hidden="true">{completed ? "✓" : String(number).padStart(2, "0")}</span>
                  <span className="stepper-label">{label}<small>{active ? "Trenutni korak" : completed ? "Promeni izbor" : "Sledeći korak"}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="stepper-note"><span>{String(safeCurrent).padStart(2, "0")}</span> / {String(total).padStart(2, "0")} koraka</p>
    </nav>
  );
}

export default Stepper;
