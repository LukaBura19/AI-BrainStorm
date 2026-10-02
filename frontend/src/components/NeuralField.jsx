import { useEffect, useRef } from "react";
import "./NeuralField.css";

/**
 * Decorative, mouse-reactive neural network drawn on a fixed canvas.
 * Nodes drift slowly, link to their neighbours and send small "impulses" along the links.
 * The pointer lights up and gently pulls nearby nodes. Pauses when the tab is hidden and
 * renders a single static frame for users who prefer reduced motion.
 */
export default function NeuralField({ hue = 320, density = 1, className = "" }) {
  const canvasRef = useRef(null);
  const hueRef = useRef(hue);

  useEffect(() => { hueRef.current = hue; }, [hue]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -9999, y: -9999, active: false };
    let width = 0, height = 0, dpr = 1, frame = 0, nodes = [], impulses = [], currentHue = hueRef.current;

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth; height = canvas.clientHeight;
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, Math.max(28, (width * height) / 16000)) * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: Math.random() * height,
        vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
        r: Math.random() * 1.6 + .6, glow: 0,
      }));
      impulses = [];
    };

    const linkDistance = () => Math.min(170, Math.max(110, width / 11));

    const draw = () => {
      currentHue += (hueRef.current - currentHue) * .03;
      const h = currentHue;
      ctx.clearRect(0, 0, width, height);
      const maxDist = linkDistance();

      for (const node of nodes) {
        if (!reduced) {
          node.x += node.vx; node.y += node.vy;
          if (node.x < -20) node.x = width + 20; else if (node.x > width + 20) node.x = -20;
          if (node.y < -20) node.y = height + 20; else if (node.y > height + 20) node.y = -20;
        }
        const dx = pointer.x - node.x, dy = pointer.y - node.y;
        const d = Math.hypot(dx, dy);
        const near = pointer.active && d < 190;
        node.glow += ((near ? 1 - d / 190 : 0) - node.glow) * .12;
        if (near && !reduced) { node.x += dx * .0035; node.y += dy * .0035; }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > maxDist) continue;
          const strength = 1 - d / maxDist;
          const lit = Math.max(a.glow, b.glow);
          ctx.strokeStyle = `hsla(${h + lit * 30}, 85%, ${68 + lit * 15}%, ${strength * (.09 + lit * .45)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (!reduced && impulses.length < 26 && Math.random() < .00045 * strength) impulses.push({ a, b, t: 0, speed: .008 + Math.random() * .014 });
        }
      }

      for (let k = impulses.length - 1; k >= 0; k--) {
        const p = impulses[k];
        p.t += p.speed;
        if (p.t >= 1) { p.b.glow = Math.min(1, p.b.glow + .6); impulses.splice(k, 1); continue; }
        const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, `hsla(${h + 20}, 100%, 85%, .95)`);
        g.addColorStop(1, `hsla(${h + 20}, 100%, 70%, 0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }

      for (const node of nodes) {
        ctx.fillStyle = `hsla(${h + node.glow * 30}, 90%, ${72 + node.glow * 20}%, ${.35 + node.glow * .65})`;
        ctx.beginPath(); ctx.arc(node.x, node.y, node.r + node.glow * 2.2, 0, Math.PI * 2); ctx.fill();
      }

      if (pointer.active) {
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 220);
        g.addColorStop(0, `hsla(${h}, 90%, 70%, .07)`);
        g.addColorStop(1, `hsla(${h}, 90%, 70%, 0)`);
        ctx.fillStyle = g; ctx.fillRect(pointer.x - 220, pointer.y - 220, 440, 440);
      }
    };

    const loop = () => { draw(); frame = requestAnimationFrame(loop); };
    const start = () => { cancelAnimationFrame(frame); if (reduced) draw(); else frame = requestAnimationFrame(loop); };
    const onMove = (event) => {
      const box = canvas.getBoundingClientRect();
      pointer.x = event.clientX - box.left; pointer.y = event.clientY - box.top; pointer.active = true;
      if (reduced) draw();
    };
    const onLeave = () => { pointer.active = false; };
    const onVisibility = () => { if (document.hidden) cancelAnimationFrame(frame); else start(); };
    let resizeTimer = 0;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { build(); start(); }, 120); };

    build(); start();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame); clearTimeout(resizeTimer);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, [density]);

  return <div className={`neural-field ${className}`} aria-hidden="true" style={{ "--field-hue": hue }}>
    <span className="neural-field-aurora neural-field-aurora--one" />
    <span className="neural-field-aurora neural-field-aurora--two" />
    <span className="neural-field-aurora neural-field-aurora--three" />
    <canvas ref={canvasRef} />
    <span className="neural-field-grain" />
  </div>;
}
