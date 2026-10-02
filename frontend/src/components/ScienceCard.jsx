import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

/** A native selection button with separate faces and content in CSS 3D space. */
export default function ScienceCard({ children, className = "", formulas = [], backdrop, style, onPointerMove, onPointerLeave, onPointerCancel, onBlur, ...props }) {
  const reducedMotion = useReducedMotion();
  const cardRef = useRef(null);
  const frameRef = useRef(null);
  const [formulasRunning, setFormulasRunning] = useState(false);
  const hasFormulas = formulas.length > 0;

  const resetPerspective = () => {
    cancelAnimationFrame(frameRef.current);
    const card = cardRef.current;
    if (!card) return;
    card.style.removeProperty("--card-rotate-x");
    card.style.removeProperty("--card-rotate-y");
    card.style.removeProperty("--light-x");
    card.style.removeProperty("--light-y");
  };

  useEffect(() => {
    if (reducedMotion) resetPerspective();
    return () => cancelAnimationFrame(frameRef.current);
  }, [reducedMotion]);

  useEffect(() => {
    if (!hasFormulas || reducedMotion) {
      setFormulasRunning(false);
      return undefined;
    }
    let inView = false;
    const updateMotion = () => setFormulasRunning(inView && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateMotion();
    }, { threshold: 0.05 });
    if (cardRef.current) observer.observe(cardRef.current);
    document.addEventListener("visibilitychange", updateMotion);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateMotion);
    };
  }, [hasFormulas, reducedMotion]);

  return <button {...props} ref={cardRef} type="button" className={`science-card ${className}`} style={style} data-formula-motion={hasFormulas ? formulasRunning ? "running" : "paused" : undefined}
    onPointerMove={(event) => {
      onPointerMove?.(event);
      // Read the media query live so a preference change applies without a remount.
      if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const card = event.currentTarget;
      const box = card.getBoundingClientRect();
      const horizontal = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
      const vertical = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        card.style.setProperty("--card-rotate-x", `${vertical * -6}deg`);
        card.style.setProperty("--card-rotate-y", `${horizontal * 7}deg`);
        card.style.setProperty("--light-x", `${(horizontal + 1) * 50}%`);
        card.style.setProperty("--light-y", `${(vertical + 1) * 50}%`);
      });
    }}
    onPointerLeave={(event) => { resetPerspective(); onPointerLeave?.(event); }}
    onPointerCancel={(event) => { resetPerspective(); onPointerCancel?.(event); }}
    onBlur={(event) => { resetPerspective(); onBlur?.(event); }}>
    {hasFormulas && <span className="science-card-background" aria-hidden="true">
      {backdrop}
      {formulas.map((formula, index) => <span key={formula} className={`science-card-formula science-card-formula--${index + 1}`} aria-hidden="true"><span>{formula}</span></span>)}
    </span>}
    {children}
  </button>;
}
