import "./Spinner.css";

function Spinner({ size = "md", text = "" }) {
  return (
    <div className="spinner-wrapper" role="status" aria-live="polite" aria-label={text || "Učitavanje"}>
      <div className={`spinner spinner-${size}`} aria-hidden="true" />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );
}

export default Spinner;
