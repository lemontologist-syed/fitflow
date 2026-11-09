// Timezone helpers shared by the web app and the Supabase Edge Function.
// Pure TypeScript, no dependencies: runs in browsers, Node and Deno.
// Dates are "YYYY-MM-DD" strings (local calendar dates); times are "HH:MM".

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(tz: string): boolean {
  try {
    formatter(tz).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = formatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Local calendar date ("YYYY-MM-DD") of an instant in a timezone. */
export function localDate(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Local wall-clock time ("HH:MM") of an instant in a timezone. */
export function localTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** UTC offset of a timezone at an instant, in minutes (Seoul = +540). */
export function tzOffsetMinutes(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const actual = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((asUtc - actual) / 60000);
}

export function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`Invalid date: ${dateStr}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseTime(time: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${time}`);
  return { hour, minute };
}

/**
 * Converts a local wall-clock date + time in `tz` to the UTC instant.
 * Daylight-saving rules (same convention as Temporal's "compatible"):
 *  - time that does not exist (spring-forward gap) moves forward by the gap;
 *  - time that occurs twice (fall-back overlap) uses the first occurrence.
 */
export function zonedTimeToUtc(dateStr: string, time: string, tz: string): Date {
  const { year, month, day } = parseDate(dateStr);
  const { hour, minute } = parseTime(time);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const HOUR = 3600_000;
  const offsets = Array.from(
    new Set([-14, 0, 14].map((h) => tzOffsetMinutes(new Date(guess + h * HOUR), tz))),
  );
  const valid: number[] = [];
  for (const off of offsets) {
    const t = guess - off * 60000;
    const p = zonedParts(new Date(t), tz);
    if (p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute) {
      valid.push(t);
    }
  }
  if (valid.length > 0) return new Date(Math.min(...valid));
  // Gap: use the offset in force before the transition.
  const before = tzOffsetMinutes(new Date(guess - 14 * HOUR), tz);
  return new Date(guess - before * 60000);
}

export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDate(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  return Math.round(
    (Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86400_000,
  );
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(dateStr: string): number {
  const { year, month, day } = parseDate(dateStr);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday of the ISO week containing the date. */
export function mondayOf(dateStr: string): string {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}

export function timeToMinutes(time: string): number {
  const { hour, minute } = parseTime(time);
  return hour * 60 + minute;
}

export function minutesToTime(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
