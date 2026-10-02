import { motion, useReducedMotion } from "motion/react";

/** Scroll reveals decorate content without taking over the page's scroll. */
export default function Reveal({ children, className = "", delay = 0, as = "div", ...props }) {
  const reducedMotion = useReducedMotion();
  const Component = as === "section" ? motion.section : as === "article" ? motion.article : motion.div;

  return (
    <Component
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reducedMotion ? 0 : 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </Component>
  );
}
