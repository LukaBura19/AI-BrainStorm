import { useEffect, useState } from "react";

/** Trenutno vreme (ms) koje se osvežava periodično, da "U toku" / "Održan" pređu sami od sebe. */
export default function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
