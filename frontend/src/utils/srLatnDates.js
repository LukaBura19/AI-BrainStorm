/** Formatiranje termina centra na srpskom (latinica), u fiksnoj zoni Beograda. */

export const APP_TIME_ZONE = "Europe/Belgrade";

const WEEKDAYS_LONG = [
  "nedelja",
  "ponedeljak",
  "utorak",
  "sreda",
  "četvrtak",
  "petak",
  "subota",
];
const WEEKDAYS_SHORT = ["ned", "pon", "uto", "sre", "čet", "pet", "sub"];
const MONTHS_LONG = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "jun",
  "jul",
  "avgust",
  "septembar",
  "oktobar",
  "novembar",
  "decembar",
];
const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "avg",
  "sep",
  "okt",
  "nov",
  "dec",
];

const pad2 = (value) => String(value).padStart(2, "0");

function centerCalendarParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function parseDateOnly(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function timestampParts(isoStr) {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const year = Number(value("year"));
  const month = Number(value("month"));
  const day = Number(value("day"));
  const calendar = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    year,
    month,
    day,
    hour: value("hour"),
    minute: value("minute"),
    weekdayIndex: calendar.getUTCDay(),
  };
}

/** "YYYY-MM-DD" → "ponedeljak, 15. april 2026." */
export function formatDateFullLatn(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return "";
  return `${WEEKDAYS_LONG[date.getUTCDay()]}, ${date.getUTCDate()}. ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}.`;
}

export function formatTimestampDateLatn(isoStr, short = false) {
  const parts = timestampParts(isoStr);
  if (!parts) return "";
  if (short) return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}.`;
  return `${WEEKDAYS_LONG[parts.weekdayIndex]}, ${parts.day}. ${MONTHS_LONG[parts.month - 1]} ${parts.year}.`;
}

/** "YYYY-MM-DD" dana u kalendaru centra za dati trenutak. */
export function dayKeyLatn(isoStr) {
  const parts = timestampParts(isoStr);
  return parts ? `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}` : "";
}

export function todayKeyLatn(baseDate = new Date()) {
  const { year, month, day } = centerCalendarParts(baseDate);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Naslov dana u agendi: "Danas, sreda 8. oktobar", "Sutra, četvrtak 9. oktobar", "Petak, 10. oktobar" (godina samo ako nije tekuća). */
export function formatDayHeadingLatn(isoStr, baseDate = new Date()) {
  const parts = timestampParts(isoStr);
  if (!parts) return "";
  const key = dayKeyLatn(isoStr);
  const today = centerCalendarParts(baseDate);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day, 12);
  const dayUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 12);
  const diffDays = Math.round((dayUtc - todayUtc) / 864e5);
  const dayMonth = `${WEEKDAYS_LONG[parts.weekdayIndex]} ${parts.day}. ${MONTHS_LONG[parts.month - 1]}`;
  if (diffDays === 0) return `Danas, ${dayMonth}`;
  if (diffDays === 1) return `Sutra, ${dayMonth}`;
  if (diffDays === -1) return `Juče, ${dayMonth}`;
  if (!key) return "";
  const weekday = WEEKDAYS_LONG[parts.weekdayIndex];
  const label = `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${parts.day}. ${MONTHS_LONG[parts.month - 1]}`;
  return parts.year === today.year ? label : `${label} ${parts.year}.`;
}

/** "YYYY-MM-DD" pomeren za `days` kalendarskih dana. */
export function shiftDayKey(key, days) {
  const date = parseDateOnly(key);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Broj kalendarskih dana od `fromKey` do `toKey` ("YYYY-MM-DD"). */
export function daysBetweenKeys(fromKey, toKey) {
  const from = parseDateOnly(fromKey);
  const to = parseDateOnly(toKey);
  return from && to ? Math.round((to - from) / 864e5) : NaN;
}

/** Ponedeljak i nedelja nedelje kojoj pripada dan: { from, to }. */
export function weekKeys(key = todayKeyLatn()) {
  const date = parseDateOnly(key);
  if (!date) return { from: "", to: "" };
  const monday = shiftDayKey(key, -((date.getUTCDay() + 6) % 7));
  return { from: monday, to: shiftDayKey(monday, 6) };
}

/** "pon 13. okt" za dan "YYYY-MM-DD". */
export function formatDayKeyShortLatn(key) {
  const date = parseDateOnly(key);
  return date ? formatDatePickerLabel(date) : "";
}

/** Naslov dana za "YYYY-MM-DD": "Danas, sreda 8. oktobar" / "petak, 10. oktobar 2026." */
export function formatDayKeyHeadingLatn(key, baseDate = new Date()) {
  return parseDateOnly(key) ? formatDayHeadingLatn(`${key}T12:00:00Z`, baseDate) : "";
}

/** Vremena "HH:MM" na svakih `step` minuta, od `from` do `to` uključivo. */
export function timeOptions(from = "08:00", to = "21:30", step = 30) {
  const toMinutes = (value) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const items = [];
  for (let minute = toMinutes(from); minute <= toMinutes(to); minute += step) {
    items.push(`${pad2(Math.floor(minute / 60))}:${pad2(minute % 60)}`);
  }
  return items;
}

export function formatTimeLatn(isoStr) {
  const parts = timestampParts(isoStr);
  return parts ? `${parts.hour}:${parts.minute}` : "";
}

export function formatDatePickerLabel(date) {
  return `${WEEKDAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()}. ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

export function getDatePickerParts(date) {
  return {
    weekday: WEEKDAYS_SHORT[date.getUTCDay()],
    weekdayLong: WEEKDAYS_LONG[date.getUTCDay()],
    day: date.getUTCDate(),
    month: MONTHS_SHORT[date.getUTCMonth()],
    dayMonth: `${date.getUTCDate()}. ${MONTHS_SHORT[date.getUTCMonth()]}`,
  };
}

/** Narednih N kalendarskih dana od sutra, prema kalendaru centra. */
function bookingDates(count, baseDate, startOffset) {
  const { year, month, day } = centerCalendarParts(baseDate);
  const baseUtc = new Date(Date.UTC(year, month - 1, day, 12));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(baseUtc);
    date.setUTCDate(baseUtc.getUTCDate() + index + startOffset);
    return {
      value: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
      ...getDatePickerParts(date),
    };
  });
}

export function getNextBookingDates(count = 14, baseDate = new Date()) {
  return bookingDates(count, baseDate, 1);
}

export function getBookingDatesIncludingToday(count = 14, baseDate = new Date()) {
  return bookingDates(count, baseDate, 0).map((item, index) => ({ ...item, isToday: index === 0 }));
}

export function getNextSevenBookingDates(baseDate = new Date()) {
  return getNextBookingDates(7, baseDate);
}

export function compareSrLatn(a, b) {
  return String(a).localeCompare(String(b), "sr-Latn", { sensitivity: "base" });
}
