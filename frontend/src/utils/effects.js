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

/** Full-screen confetti celebration on a temporary canvas. */
export function confettiBurst({ particles = 170, duration = 3200 } = {}) {
  if (typeof document === "undefined" || prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "fx-confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth, height = window.innerHeight;
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const colors = ["#1f4d3a", "#2e6b52", "#c8643b", "#e39a78", "#6f8f62", "#efe8dc", "#a8701c"];
  const glyphs = ["∑", "π", "√", "∞", "Δ", "λ", "{ }", "✦"];
  const pieces = Array.from({ length: particles }, (_, i) => {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? -10 : width + 10,
      y: height * (.55 + Math.random() * .35),
      vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 9),
      vy: -(11 + Math.random() * 10),
      size: 5 + Math.random() * 7,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - .5) * .3,
      color: colors[i % colors.length],
      glyph: i % 9 === 0 ? glyphs[i % glyphs.length] : null,
      shape: i % 3,
    };
  });
  const started = performance.now();
  const tick = (now) => {
    const elapsed = now - started;
    ctx.clearRect(0, 0, width, height);
    const fade = Math.max(0, 1 - Math.max(0, elapsed - duration * .65) / (duration * .35));
    for (const p of pieces) {
      p.vy += .32; p.vx *= .985; p.vy *= .985;
      p.x += p.vx; p.y += p.vy; p.rotation += p.spin;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.glyph) {
        ctx.font = `${p.size * 2.4}px Georgia, serif`;
        ctx.fillText(p.glyph, 0, 0);
      } else if (p.shape === 0) {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 1) {
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(0, -p.size / 2); ctx.lineTo(p.size / 2, p.size / 2); ctx.lineTo(-p.size / 2, p.size / 2); ctx.fill();
      }
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
