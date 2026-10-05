import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./RunningBrain.css";

/** The running-brain mark on its own, cropped from the brand artwork. */
export function BrainMark({ className = "" }) {
  const clip = useId();
  return <svg className={`brain-mark ${className}`} viewBox="395 235 490 300" aria-hidden="true" focusable="false">
    <defs><clipPath id={clip}><rect x="395" y="235" width="490" height="300" /></clipPath></defs>
    <image href="/assets/logo2.png" width="1280" height="1024" clipPath={`url(#${clip})`} />
  </svg>;
}

/**
 * Full-screen "saving" state: the brain runs along a track while the booking is stored.
 * Overlays are portalled to <body> so no transformed ancestor can turn "fixed" into "absolute".
 */
export function BookingSavingOverlay() {
  return createPortal(<div className="brain-overlay" role="status" aria-live="polite">
    <div className="brain-run">
      <div className="brain-run-track" aria-hidden="true">
        <span className="brain-run-runner">
          <span className="brain-run-speedlines"><i /><i /><i /></span>
          <BrainMark className="brain-run-mark" />
          <span className="brain-run-dust"><i /><i /><i /></span>
        </span>
        <span className="brain-run-ground" />
      </div>
      <p>Čuvamo tvoj termin…</p>
    </div>
  </div>, document.body);
}

/** Thank-you dialog shown once the booking is saved. */
export function BookingThanksDialog({ onClose }) {
  const buttonRef = useRef(null);
  useEffect(() => {
    buttonRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
  }, [onClose]);

  return createPortal(<div className="brain-overlay brain-overlay--thanks" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="brain-thanks" role="dialog" aria-modal="true" aria-labelledby="thanks-title">
      <span className="brain-thanks-mark"><BrainMark /></span>
      <h2 id="thanks-title">Hvala vam što ste zakazali čas u Edukativnom centru BrainStorm.</h2>
      <p>Vidimo se!</p>
      <button ref={buttonRef} type="button" className="btn btn-primary" onClick={onClose}>Pogledaj detalje časa</button>
    </div>
  </div>, document.body);
}
