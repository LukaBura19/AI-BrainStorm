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
