const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Small radial spark burst at the pointer position inside `element`. Purely decorative. */
export function sparkBurst(element, event, { count = 12, colors = ["#1f4d3a", "#c8643b", "#e3ede6", "#f6e3d8"] } = {}) {
  if (!element || prefersReducedMotion()) return;
  const box = element.getBoundingClientRect();
  const fromKeyboard = !event || (event.clientX === 0 && event.clientY === 0);
  const x = fromKeyboard ? box.width / 2 : event.clientX - box.left;
  const y = fromKeyboard ? box.height / 2 : event.clientY - box.top;
  const layer = document.createElement("span");
  layer.className = "fx-spark-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const spark = document.createElement("i");
    const angle = (Math.PI * 2 * i) / count + Math.random() * .4;
    const distance = 38 + Math.random() * 46;
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--spark-color", colors[i % colors.length]);
    spark.style.animationDelay = `${Math.random() * 60}ms`;
    layer.appendChild(spark);
  }
  const ring = document.createElement("b");
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  layer.appendChild(ring);
  element.appendChild(layer);
  setTimeout(() => layer.remove(), 900);
}
