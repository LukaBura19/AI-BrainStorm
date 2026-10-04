import { useEffect, useId, useRef, useState } from "react";
import "./LessonFormatVisual.css";

/** Decorative, contained artwork. Selection and booking stay in the parent. */
export default function LessonFormatVisual({ kind, mode }) {
  const ref = useRef(null);
  const [running, setRunning] = useState(false);
  const id = `lesson-${useId().replaceAll(":", "")}`;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => setRunning(visible && !document.hidden && !media.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    }, { threshold: 0.05 });
    observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      media.removeEventListener("change", update);
    };
  }, []);

  return <div ref={ref} className="booking-format-visual" data-motion={running ? "running" : "paused"} data-mode={mode} aria-hidden="true">
    <svg viewBox="0 0 420 245" focusable="false">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a5c4b4" stopOpacity=".6" /><stop offset="1" stopColor="#355143" stopOpacity=".85" /></linearGradient>
        <linearGradient id={`${id}-pink`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f3d9ce" /><stop offset="1" stopColor="#cf815f" /></linearGradient>
        <linearGradient id={`${id}-lavender`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dbece3" /><stop offset="1" stopColor="#90b7a3" /></linearGradient>
        <radialGradient id={`${id}-shadow`}><stop stopColor="#5a4630" stopOpacity=".6" /><stop offset="1" stopColor="#5a4630" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="210" cy="216" rx="150" ry="23" fill={`url(#${id}-shadow)`} />
      <g className="format-orbit" fill="none" stroke="#c1d9cd" strokeOpacity=".2"><ellipse cx="210" cy="121" rx="186" ry="92" strokeDasharray="2 8" /><path d="M42 163 360 50M54 59l308 122" strokeOpacity=".13" /></g>
      <g className="format-scene" key={mode}>
        {kind === "delivery" ? mode === "online" ? <>
          <path d="M183 181h49l8 25h-65Z" fill="#7b9488" /><path d="M151 207h108l14 8H138Z" fill={`url(#${id}-lavender)`} />
          <rect x="76" y="25" width="272" height="171" rx="15" fill="#394d43" stroke="#769284" />
          <rect x="70" y="19" width="272" height="171" rx="15" fill={`url(#${id}-glass)`} stroke="#c7e1d4" strokeOpacity=".8" />
          <path d="M71 46h270" stroke="#cbe4d8" strokeOpacity=".3" />
          <g fill="#d0e5db" opacity=".7"><circle cx="86" cy="33" r="3" /><circle cx="98" cy="33" r="3" /><circle cx="110" cy="33" r="3" /></g>
          <rect x="86" y="60" width="140" height="98" rx="9" fill="#2b3f35" />
          <circle cx="156" cy="94" r="18" fill={`url(#${id}-lavender)`} /><path d="M119 150v-5a37 37 0 0 1 74 0v5" fill={`url(#${id}-pink)`} />
          <rect x="237" y="60" width="89" height="63" rx="9" fill="#475f53" stroke="#b4d3c3" strokeOpacity=".3" />
          <text x="281" y="99" textAnchor="middle" fill="#f5dfd5" fontFamily="Georgia,serif" fontSize="25">ƒ(x)</text>
          <g stroke="#afc8bc" strokeWidth="3" strokeLinecap="round"><path d="M245 139h72M245 150h50" /></g>
          <g transform="translate(164 174)"><circle r="7" fill="#d6e6de" /><circle cx="23" r="7" fill="#d6e6de" /><rect x="38" y="-7" width="30" height="14" rx="7" fill="#e3a387" /><path d="M48 1q5-5 10 0" fill="none" stroke="#653c2b" strokeWidth="2" /></g>
          <g className="format-satellite"><rect x="292" y="130" width="59" height="35" rx="10" fill={`url(#${id}-pink)`} /><path d="m310 148 6 5 13-13" fill="none" stroke="#3f594c" strokeWidth="2.5" strokeLinecap="round" /></g>
        </> : <>
          <path d="m77 38 239-15 18 135-239 20Z" fill="#354b40" stroke="#6b8478" />
          <path d="m71 30 239-15 18 135-239 20Z" fill={`url(#${id}-glass)`} stroke="#c1d8cc" strokeOpacity=".75" />
          <path d="m88 49 208-13 11 98-208 14Z" fill="#293b32" />
          <text x="120" y="94" fill="#f4dcd2" fontSize="27" fontFamily="Georgia,serif" transform="rotate(-4 120 94)">a² + b² = c²</text>
          <path d="m116 121 51-3m15-1 63-4" stroke="#bfd6cb" strokeWidth="2" strokeLinecap="round" strokeOpacity=".5" />
          <path d="m97 154 233-16 4 10-234 17Z" fill={`url(#${id}-lavender)`} />
          <path d="m90 181 13 38m191-41-10 39" stroke="#85a696" strokeWidth="8" strokeLinecap="round" />
          <path d="m66 172 182-25 104 27-187 30Z" fill={`url(#${id}-lavender)`} stroke="#d3e6dc" strokeOpacity=".65" />
          <path d="m66 172 99 32 187-30v8l-187 30-99-32Z" fill="#697d73" />
          <g className="format-satellite"><path d="m137 166 57-8 24 8-58 9Z" fill="#eaf2ee" /><path d="m162 167 36-5" stroke="#cea18e" /><path d="m244 153 20-2 2 17-20 3Z" fill={`url(#${id}-pink)`} /><path d="m253 151-3-18" stroke="#d0e6db" strokeWidth="3" strokeLinecap="round" /></g>
        </> : <>
          <g className="format-connection" fill="none" stroke="#bbd4c8" strokeWidth="1.5" strokeDasharray="4 7"><path d="M110 138Q205 13 313 124" /><path d="M91 177Q210 235 335 163" /></g>
          {mode === "group" && <g data-session-person="true" transform="translate(48 46) rotate(-9 73 70)"><rect x="5" y="6" width="118" height="147" rx="16" fill="#3a5145" /><rect width="118" height="147" rx="16" fill={`url(#${id}-glass)`} stroke="#afcabc" /><circle cx="59" cy="56" r="23" fill={`url(#${id}-lavender)`} /><path d="M24 112a35 35 0 0 1 70 0Z" fill="#9ebcad" /><path d="M37 128h44" stroke="#cce0d6" strokeWidth="3" strokeLinecap="round" /></g>}
          <g data-session-person="true" transform={mode === "group" ? "translate(178 25) rotate(5 76 86)" : "translate(136 25) rotate(3 76 86)"}><rect x="5" y="7" width="148" height="175" rx="17" fill="#3a4c43" /><rect width="148" height="175" rx="17" fill={`url(#${id}-pink)`} stroke="#f4dacf" /><circle cx="74" cy="64" r="26" fill="#f6e4dc" /><path d="M31 135a43 43 0 0 1 86 0Z" fill="#7f9b8d" /><path d="M48 153h52" stroke="#faeee8" strokeWidth="3" strokeLinecap="round" /></g>
          {mode === "group" ? <g data-session-person="true" className="format-satellite" transform="translate(294 100) rotate(9 45 50)"><rect x="4" y="5" width="84" height="103" rx="13" fill="#394b42" /><rect width="84" height="103" rx="13" fill={`url(#${id}-lavender)`} stroke="#d5e8de" /><circle cx="42" cy="35" r="16" fill="#ebf5f0" /><path d="M17 78a25 25 0 0 1 50 0Z" fill="#82a393" /></g> : <g className="format-satellite"><circle cx="322" cy="156" r="28" fill="#b7d6c6" stroke="#d3e4dc" /><text x="322" y="163" textAnchor="middle" fill="#3a5447" fontSize="20" fontFamily="Arial,sans-serif">1:1</text></g>}
        </>}
      </g>
      <g className="format-spark" fill="#f0ccbd"><circle cx="54" cy="103" r="3" /><path d="M363 67v12m-6-6h12" fill="none" stroke="#f0ccbd" strokeWidth="1.5" /></g>
    </svg>
  </div>;
}
