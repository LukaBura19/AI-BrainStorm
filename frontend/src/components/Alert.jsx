import "./Alert.css";

function Alert({ type = "info", children, onClose }) {
  const isUrgent = type === "error" || type === "warning";
  return (
    <div
      className={`alert alert-${type}`}
      role={isUrgent ? "alert" : "status"}
      aria-live={isUrgent ? "assertive" : "polite"}
    >
      <div className="alert-content">{children}</div>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Zatvori">
          &times;
        </button>
      )}
    </div>
  );
}

export default Alert;
