import { useRef } from "react";
import { useReducedMotion } from "motion/react";
import "./ui.css";

/** Any element that leans toward the pointer in 3D and exposes --light-x/--light-y for a glare. */
export default function TiltSurface({ as: Tag = "div", className = "", strength = 6, children, ...props }) {
  const reducedMotion = useReducedMotion();
  const frame = useRef(0);
  const reset = (element) => {
    cancelAnimationFrame(frame.current);
    element.style.removeProperty("--tilt-x");
    element.style.removeProperty("--tilt-y");
  };
  return <Tag {...props} className={`tilt-surface ${className}`}
    onPointerMove={(event) => {
      props.onPointerMove?.(event);
      if (reducedMotion || event.pointerType !== "mouse") return;
      const element = event.currentTarget;
      const box = element.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        element.style.setProperty("--tilt-x", `${(y - .5) * -strength}deg`);
        element.style.setProperty("--tilt-y", `${(x - .5) * strength * 1.2}deg`);
        element.style.setProperty("--light-x", `${x * 100}%`);
        element.style.setProperty("--light-y", `${y * 100}%`);
      });
    }}
    onPointerLeave={(event) => { props.onPointerLeave?.(event); reset(event.currentTarget); }}>
    {children}
  </Tag>;
}
