import { useEffect, useRef, useState } from "react";
import "./MouseScrubVideo.css";

export default function MouseScrubVideo({ visibilityRef }) {
  const videoRef = useRef(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    const video = videoRef.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let inView = true;
    let reduced = media.matches;
    let duration = 0;
    let target = 0;
    let seeking = false;
    let previousX = null;
    let touch = null;
    const active = () => !disposed && inView && !document.hidden;

    // Only seeked releases the in-flight seek. Mouse/touch events replace the
    // target while it is pending, so the browser never receives a seek backlog.
    const drain = () => {
      if (
        !active() ||
        seeking ||
        video.seeking ||
        !Number.isFinite(duration) ||
        duration <= 0
      )
        return;
      if (Math.abs(video.currentTime - target) < 0.009) return;
      seeking = true;
      try {
        video.currentTime = target;
      } catch {
        seeking = false;
      }
    };
    const queue = (seconds) => {
      if (!active() || !Number.isFinite(duration) || duration <= 0) return;
      target = Math.max(0, Math.min(duration - 0.001, seconds));
      drain();
    };
    const seeked = () => {
      seeking = false;
      drain();
    };
    const metadata = () => {
      duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      target = Math.min(target, duration - 0.001);
      setState("ready");
      drain();
    };
    const error = () => {
      duration = 0;
      seeking = false;
      video.pause();
      setState("error");
    };
    const stopPlayback = () => video.pause();
    const visibility = () => {
      previousX = null;
      touch = null;
      video.pause();
      if (active()) drain();
    };
    const motion = () => {
      reduced = media.matches;
      previousX = null;
    };
    const mousemove = (event) => {
      if (
        !active() ||
        reduced ||
        touch ||
        event.sourceCapabilities?.firesTouchEvents
      ) {
        previousX = null;
        return;
      }
      if (previousX === null) {
        previousX = event.clientX;
        return;
      }
      const delta = event.clientX - previousX;
      previousX = event.clientX;
      queue(target + (delta / Math.max(innerWidth, 1)) * 0.8 * duration);
    };
    const pointerdown = (event) => {
      if (
        !active() ||
        event.pointerType === "mouse" ||
        !event.isPrimary ||
        touch
      )
        return;
      if (
        !visibilityRef.current?.contains(event.target) ||
        event.target.closest("a,button,input,nav")
      )
        return;
      touch = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        previous: event.clientX,
        horizontal: false,
      };
    };
    const pointermove = (event) => {
      if (!active() || !touch || event.pointerId !== touch.id) return;
      const dx = event.clientX - touch.x;
      const dy = event.clientY - touch.y;
      if (!touch.horizontal) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          touch = null;
          return;
        }
        if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
        touch.horizontal = true;
      }
      queue(
        target +
          ((event.clientX - touch.previous) / Math.max(innerWidth, 1)) *
            0.8 *
            duration,
      );
      touch.previous = event.clientX;
    };
    const pointerend = (event) => {
      if (touch?.id === event.pointerId) {
        touch = null;
        previousX = null;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      visibility();
    });
    if (visibilityRef.current) observer.observe(visibilityRef.current);

    if (!video.getAttribute("src"))
      video.src = "/assets/brainstorm-interface.mp4";
    video.pause();
    video.addEventListener("loadedmetadata", metadata);
    video.addEventListener("durationchange", metadata);
    video.addEventListener("seeked", seeked);
    video.addEventListener("error", error);
    video.addEventListener("play", stopPlayback);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    window.addEventListener("mousemove", mousemove, { passive: true });
    window.addEventListener("pointerdown", pointerdown, { passive: true });
    window.addEventListener("pointermove", pointermove, { passive: true });
    window.addEventListener("pointerup", pointerend, { passive: true });
    window.addEventListener("pointercancel", pointerend, { passive: true });
    if (video.readyState >= 1) metadata();
    return () => {
      disposed = true;
      observer.disconnect();
      video.removeEventListener("loadedmetadata", metadata);
      video.removeEventListener("durationchange", metadata);
      video.removeEventListener("seeked", seeked);
      video.removeEventListener("error", error);
      video.removeEventListener("play", stopPlayback);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
      window.removeEventListener("mousemove", mousemove);
      window.removeEventListener("pointerdown", pointerdown);
      window.removeEventListener("pointermove", pointermove);
      window.removeEventListener("pointerup", pointerend);
      window.removeEventListener("pointercancel", pointerend);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [visibilityRef]);

  return (
    <>
      <div
        className={`home-video-backdrop ${state === "error" ? "has-media-error" : ""}`}
        data-media-state={state}
        aria-hidden="true"
      >
        <img
          className="home-video-poster"
          src="/assets/brainstorm-interface-poster.jpg"
          alt=""
        />
        <video
          ref={videoRef}
          className="home-background-video"
          src="/assets/brainstorm-interface.mp4"
          poster="/assets/brainstorm-interface-poster.jpg"
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
        />
        <div className="home-video-grade" />
      </div>

    </>
  );
}
