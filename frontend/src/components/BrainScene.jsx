import { useEffect, useId, useRef, useState } from "react";
import { MoveHorizontal, RotateCcw } from "lucide-react";
import "./BrainScene.css";

export default function BrainScene({
  paused = false,
  compact = false,
  variant = "logo",
}) {
  const sceneRef = useRef(null);
  const canvasRef = useRef(null);
  const runtime = useRef(null);
  const drag = useRef(null);
  const activity = useRef({
    paused,
    visible: !document.hidden,
    inView: true,
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
  const [state, setState] = useState("loading");
  const [dragging, setDragging] = useState(false);
  const hintId = useId();
  const fallbackClipId = useId();

  useEffect(() => {
    activity.current.paused = paused;
    runtime.current?.setActivity(activity.current);
    if (paused) {
      drag.current = null;
      setDragging(false);
      runtime.current?.setDragging(false);
    }
  }, [paused]);

  useEffect(() => {
    const controller = new AbortController();
    const loadTimeout = setTimeout(() => {
      setState("error");
      controller.abort();
    }, 25000);
    const scene = sceneRef.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => runtime.current?.setActivity(activity.current);
    const visibility = () => {
      activity.current.visible = !document.hidden;
      update();
    };
    const motion = () => {
      activity.current.reduced = media.matches;
      update();
    };
    const observer = new IntersectionObserver(([entry]) => {
      activity.current.inView = entry.isIntersecting;
      update();
    });
    observer.observe(scene);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    setState("loading");
    import("./brain3d/createBrainScene.js")
      .then(({ createBrainScene }) => {
        if (controller.signal.aborted) return;
        runtime.current = createBrainScene({
          canvas: canvasRef.current,
          container: scene,
          compact,
          variant,
          signal: controller.signal,
          onState: (next) => {
            clearTimeout(loadTimeout);
            if (!controller.signal.aborted) setState(next);
          },
        });
        update();
      })
      .catch(() => {
        clearTimeout(loadTimeout);
        if (!controller.signal.aborted) setState("error");
      });
    return () => {
      clearTimeout(loadTimeout);
      controller.abort();
      runtime.current?.dispose();
      runtime.current = null;
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, [compact, variant]);

  const endDrag = (event) => {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    runtime.current?.setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div
      ref={sceneRef}
      className={`brain-scene ${compact ? "brain-scene--compact" : ""} ${dragging ? "is-dragging" : ""}`}
      data-renderer={state === "error" ? "fallback" : "webgl"}
      data-state={state}
      data-angle-y="0"
      data-character="brand-runner"
      data-variant={variant}
      data-run-phase="0"
      role="group"
      aria-label={
        variant === "logo"
          ? "Logo u pokretu — interaktivni 3D prikaz"
          : "Realističan mozak — interaktivni 3D prikaz"
      }
    >
      <div className="brain-halo" aria-hidden="true" />
      <button
        type="button"
        className="brain-sculpture"
        aria-label="Okreni 3D mozak: prevuci mišem ili prstom, ili koristi strelice na tastaturi"
        disabled={state !== "ready" || paused}
        tabIndex={state !== "ready" || paused ? -1 : 0}
        aria-describedby={compact ? undefined : hintId}
        onPointerDown={(event) => {
          if (
            paused ||
            state !== "ready" ||
            drag.current ||
            !event.isPrimary ||
            event.button !== 0
          )
            return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          runtime.current?.setDragging(true);
        }}
        onPointerMove={(event) => {
          if (
            paused ||
            state !== "ready" ||
            (drag.current && drag.current.id !== event.pointerId)
          )
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          runtime.current?.point(
            (event.clientX - bounds.left) / bounds.width - 0.5,
            (event.clientY - bounds.top) / bounds.height - 0.5,
          );
          if (!drag.current || drag.current.id !== event.pointerId) return;
          runtime.current?.rotate(
            (event.clientX - drag.current.x) * 0.012,
            (event.clientY - drag.current.y) * 0.006,
          );
          drag.current.x = event.clientX;
          drag.current.y = event.clientY;
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => runtime.current?.point(0, 0)}
        onKeyDown={(event) => {
          if (
            paused ||
            state !== "ready" ||
            ![
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
            ].includes(event.key)
          )
            return;
          event.preventDefault();
          if (event.key === "Home") runtime.current?.reset();
          else
            runtime.current?.rotate(
              event.key === "ArrowLeft"
                ? -0.26
                : event.key === "ArrowRight"
                  ? 0.26
                  : 0,
              event.key === "ArrowUp"
                ? -0.15
                : event.key === "ArrowDown"
                  ? 0.15
                  : 0,
            );
        }}
        onClick={(event) => {
          if (!paused && state === "ready" && event.detail === 0)
            runtime.current?.rotate(0.35, 0);
        }}
      >
        <canvas ref={canvasRef} aria-hidden="true" />
        {state === "error" && (
          <svg
            className="brain-fallback"
            viewBox="395 235 490 300"
            role="img"
            aria-label="BrainStorm mozak u trku"
          >
            <defs>
              <clipPath id={fallbackClipId}>
                <rect x="395" y="235" width="490" height="300" />
              </clipPath>
            </defs>
            <image
              href="/assets/logo2.png"
              width="1280"
              height="1024"
              clipPath={`url(#${fallbackClipId})`}
            />
          </svg>
        )}
      </button>
      {!compact && (
        <div className="brain-science-notes" aria-hidden="true">
          <div className="brain-math-note">
            <span>IDEJE U POKRETU</span>
            <strong>F = m · a</strong>
            <small>Jedno pitanje pokreće sledeće.</small>
          </div>
          <div className="brain-code-panel">
            <span className="brain-code-language">JavaScript</span>
            <pre>
              <code>
                <span className="code-keyword">const</span>
                {" hour = new Date().getHours();\n"}
                <span className="code-keyword">if</span>
                {" (hour >= 8 && hour < 20) {\n  console.log("}
                <span className="code-string">{'"Open"'}</span>
                {");\n} "}
                <span className="code-keyword">else</span>
                {" {\n  console.log("}
                <span className="code-string">{'"Closed"'}</span>
                {");\n}"}
              </code>
            </pre>
          </div>
        </div>
      )}
      {state === "loading" && (
        <span className="brain-load-status" role="status">
          Oblikujemo ideje…
        </span>
      )}
      {!compact && (
        <div className="brain-controls">
          <p id={hintId} className="brain-caption">
            <MoveHorizontal size={15} aria-hidden="true" />
            Prevuci i istraži. Strelice okreću mozak.
          </p>
          <button
            type="button"
            className="brain-reset"
            aria-label="Vrati početni položaj mozga"
            onClick={() => runtime.current?.reset()}
            disabled={paused || state !== "ready"}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      )}
      {state === "error" && !compact && (
        <span className="brain-fallback-status" role="status">
          3D prikaz trenutno nije dostupan.
        </span>
      )}
    </div>
  );
}
