import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { formatTimeLatn } from "../utils/srLatnDates";
import "./TimeWheel.css";

const ROW = 64;
const SETTLE_MS = 140;

/**
 * A scroll-snapping "wheel" of start times. Native scrolling gives mouse wheel, touch and drag for free;
 * rows tilt in 3D by their distance from the centre band. Whatever free time settles in the band is selected.
 * `items`: [{ minute, label, slot | null }] in time order; taken times have `slot: null` and are skipped.
 */
export default function TimeWheel({ items, selected, onSelect, reducedMotion }) {
  const wheelRef = useRef(null);
  const settleRef = useRef(0);
  const frameRef = useRef(0);
  // Only scrolls the visitor makes (wheel, touch, drag) choose a time; centring and snap corrections do not.
  const userTurnRef = useRef(false);
  const markUserTurn = () => { userTurnRef.current = true; };
  const freeIndexes = items.map((item, index) => (item.slot ? index : -1)).filter((index) => index >= 0);
  const selectedIndex = items.findIndex((item) => item.slot && item.slot.start_time === selected?.start_time);

  const paint = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const centre = wheel.scrollTop + wheel.clientHeight / 2;
    for (const row of wheel.querySelectorAll(".time-wheel-row")) {
      const offset = (row.offsetTop + ROW / 2 - centre) / ROW;
      const distance = Math.min(Math.abs(offset), 4);
      row.style.setProperty("--wheel-offset", reducedMotion ? 0 : offset.toFixed(3));
      row.style.setProperty("--wheel-scale", reducedMotion ? 1 : (1 - distance * 0.05).toFixed(3));
      row.style.opacity = String(Math.max(0.12, 1 - distance * 0.22));
      row.classList.toggle("in-band", Math.abs(offset) < 0.5);
    }
  }, [reducedMotion]);

  const scrollToIndex = useCallback((index, smooth = true) => {
    const wheel = wheelRef.current;
    if (!wheel || index < 0) return;
    wheel.scrollTo({ top: index * ROW, behavior: smooth && !reducedMotion ? "smooth" : "instant" });
  }, [reducedMotion]);

  const nearestFree = useCallback((index) => {
    if (!freeIndexes.length) return -1;
    return freeIndexes.reduce((best, candidate) => (Math.abs(candidate - index) < Math.abs(best - index) ? candidate : best), freeIndexes[0]);
  }, [freeIndexes]);

  // When the wheel comes to rest, select the free time in the band (or glide to the nearest free one).
  const rootRef = useRef(null);
  const onScroll = () => {
    // While turning, the band goes light so whatever passes through it stays readable.
    rootRef.current?.classList.add("is-turning");
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(paint);
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      rootRef.current?.classList.remove("is-turning");
      const wheel = wheelRef.current;
      if (!wheel || !userTurnRef.current) return;
      userTurnRef.current = false;
      const index = Math.round(wheel.scrollTop / ROW);
      const item = items[index];
      if (item?.slot) {
        if (item.slot.start_time !== selected?.start_time) onSelect(item.slot);
      } else {
        const free = nearestFree(index);
        if (free >= 0) { onSelect(items[free].slot); scrollToIndex(free); }
      }
    }, SETTLE_MS);
  };

  // Keep the selected time centred when it changes from outside (or on first render).
  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const target = selectedIndex >= 0 ? selectedIndex : Math.max(0, freeIndexes[0] ?? 0);
    if (Math.round(wheel.scrollTop / ROW) !== target) wheel.scrollTop = target * ROW;
    paint();
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(settleRef.current); cancelAnimationFrame(frameRef.current); }, []);

  const step = (direction) => {
    const from = selectedIndex >= 0 ? selectedIndex : Math.round((wheelRef.current?.scrollTop || 0) / ROW);
    const next = direction > 0 ? freeIndexes.find((index) => index > from) : [...freeIndexes].reverse().find((index) => index < from);
    if (next == null) return;
    onSelect(items[next].slot);
    scrollToIndex(next);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); step(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); step(-1); }
    else if (event.key === "Home" && freeIndexes.length) { event.preventDefault(); onSelect(items[freeIndexes[0]].slot); scrollToIndex(freeIndexes[0]); }
    else if (event.key === "End" && freeIndexes.length) { event.preventDefault(); const last = freeIndexes.at(-1); onSelect(items[last].slot); scrollToIndex(last); }
  };

  return <div ref={rootRef} className={`time-wheel ${selectedIndex >= 0 ? "has-selection" : ""}`}>
    <span className="time-wheel-band" aria-hidden="true" />
    <div ref={wheelRef} className="time-wheel-scroll" role="group" aria-label="Slobodni termini, okreni točkić ili koristi strelice gore i dole" tabIndex={0} onScroll={onScroll} onKeyDown={onKeyDown} onWheel={markUserTurn} onTouchStart={markUserTurn} onPointerDown={markUserTurn}>
      {items.map((item, index) => {
        if (!item.slot) return <div key={item.minute} className="time-wheel-row time-wheel-row--taken" aria-label={`${item.label}, zauzeto`}><span className="time-wheel-time">{item.label}</span><small>zauzeto</small></div>;
        const isSelected = index === selectedIndex;
        return <button key={item.slot.start_time} type="button" tabIndex={-1} className={`time-wheel-row booking-slot-card ${isSelected ? "selected" : ""}`} aria-pressed={isSelected}
          onClick={() => { onSelect(item.slot); scrollToIndex(index); }}>
          <span className="booking-slot-start"><small>Početak časa</small><strong className="time-wheel-time">{formatTimeLatn(item.slot.start_time)}</strong></span>
          <span className="booking-slot-end"><small>Završetak</small><strong>{formatTimeLatn(item.slot.end_time)}</strong></span>
        </button>;
      })}
    </div>
  </div>;
}
