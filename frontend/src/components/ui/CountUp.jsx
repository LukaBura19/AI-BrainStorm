import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import "./ui.css";

/** Animates a number from its previous value to `value` when it scrolls into view. */
export default function CountUp({ value, duration = 1100, format = (n) => n.toLocaleString("sr-Latn-RS").replace(/,/g, ".") }) {
  const reducedMotion = useReducedMotion();
  const ref = useRef(null);
  const fromRef = useRef(0);
  const [display, setDisplay] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion || typeof value !== "number") { setDisplay(value); return undefined; }
    let frame = 0;
    let started = false;
    const run = () => {
      started = true;
      const from = fromRef.current;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        setDisplay(Math.round(from + (value - from) * eased));
        if (t < 1) frame = requestAnimationFrame(tick);
        else fromRef.current = value;
      };
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !started) run(); }, { threshold: .3 });
    if (ref.current) observer.observe(ref.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value, duration, reducedMotion]);

  return <span ref={ref} className="count-up">{typeof display === "number" ? format(display) : display}</span>;
}
