import { useEffect, useState } from "react";

export default function useTypewriter(text, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState(() =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ? text : "",
  );
  const [done, setDone] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    let timer = 0;
    let index = 0;
    let finished = false;
    let remaining = Math.max(0, startDelay);
    let deadline = 0;

    const schedule = () => {
      if (finished || document.hidden) return;
      deadline = performance.now() + remaining;
      timer = window.setTimeout(tick, remaining);
    };
    function tick() {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        finished = true;
        setDone(true);
      } else {
        remaining = Math.max(0, speed);
        schedule();
      }
    }
    const reveal = () => {
      window.clearTimeout(timer);
      finished = true;
      setDisplayed(text);
      setDone(true);
    };
    const visibility = () => {
      if (document.hidden) {
        window.clearTimeout(timer);
        remaining = Math.max(0, deadline - performance.now());
      } else schedule();
    };
    const motion = () => {
      if (media.matches) reveal();
    };

    setDisplayed("");
    setDone(false);
    if (media.matches || !text.length) reveal();
    else schedule();
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      finished = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}
