// Apple Calendar / iCalendar (RFC 5545) export of the daily routine.
import { addDays, tzOffsetMinutes, zonedTimeToUtc } from "@shared/zoned.ts";
import { dayTypeFor, DAY_TYPE_LABEL, programPosition } from "./program";
import { itemsForDate } from "./schedule";
import type { ScheduleItem, TrainingCycle } from "./types";

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds lines longer than 75 octets (UTF-8 safe). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`)).join("\r\n");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

function fmtOffset(min: number): string {
  const sign = min >= 0 ? "+" : "-";
  const a = Math.abs(min);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
}

/**
 * VTIMEZONE block. Exact for zones without daylight saving (Asia/Seoul).
 * For DST zones only the TZID is referenced; Apple and Google Calendar
 * resolve IANA names such as "America/New_York" themselves.
 */
function vtimezone(tz: string, year: number): string[] {
  const jan = tzOffsetMinutes(new Date(Date.UTC(year, 0, 15)), tz);
  const jul = tzOffsetMinutes(new Date(Date.UTC(year, 6, 15)), tz);
  if (jan !== jul) return [];
  const names: Record<string, string> = { "Asia/Seoul": "KST", "Asia/Tokyo": "JST", UTC: "UTC" };
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${fmtOffset(jan)}`,
    `TZOFFSETTO:${fmtOffset(jan)}`,
    `TZNAME:${names[tz] ?? fmtOffset(jan)}`,
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export interface IcsOptions {
  items: ScheduleItem[];
  timeZone: string;
  startDate: string;
  cycles?: TrainingCycle[];
  includeWorkouts?: boolean;
  alarms?: boolean;
  now?: Date;
}

export function buildIcs(opts: IcsOptions): string {
  const { items, timeZone: tz, startDate } = opts;
  const now = opts.now ?? new Date();
  const alarms = opts.alarms ?? true;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FitFlow//Daily Routine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:FitFlow routine",
    `X-WR-TIMEZONE:${tz}`,
    ...vtimezone(tz, Number(startDate.slice(0, 4))),
  ];

  const active = items
    .filter((i) => !i.deleted)
    .sort((a, b) => a.time_local.localeCompare(b.time_local) || a.sort_order - b.sort_order);

  for (const item of active) {
    // First date on/after startDate when the item applies.
    let first = startDate;
    if (item.days && item.days.length > 0) {
      for (let k = 0; k < 7; k++) {
        const d = addDays(startDate, k);
        if (itemsForDate([item], d).length) {
          first = d;
          break;
        }
      }
    }
    const rrule =
      item.days && item.days.length > 0 && item.days.length < 7
        ? `RRULE:FREQ=WEEKLY;BYDAY=${[...item.days].sort().map((d) => BYDAY[d]).join(",")}`
        : "RRULE:FREQ=DAILY";
    lines.push(
      "BEGIN:VEVENT",
      `UID:fitflow-${item.id}@fitflow.app`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=${tz}:${local(first, item.time_local)}`,
      "DURATION:PT15M",
      rrule,
      `SUMMARY:${escapeText(item.title)}`,
      `DESCRIPTION:${escapeText(
        `${item.notify_body ?? item.title}\nFitFlow routine item. Times are ${tz} wall-clock times.`,
      )}`,
      "TRANSP:TRANSPARENT",
      "CATEGORIES:FitFlow",
    );
    if (alarms && item.reminder_enabled) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:PT0M",
        `DESCRIPTION:${escapeText(item.title)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  // One event per program day naming the workout (useful in Calendar's day view).
  if (opts.includeWorkouts && opts.cycles?.length) {
    const workout = active.find((i) => i.kind === "workout");
    const time = workout?.time_local ?? "07:20";
    for (const c of opts.cycles.filter((c) => !c.deleted && c.end_date >= startDate)) {
      for (let d = c.start_date; d <= c.end_date; d = addDays(d, 1)) {
        const type = dayTypeFor(d);
        if (type === "rest") continue;
        const pos = programPosition(d, [c]);
        lines.push(
          "BEGIN:VEVENT",
          `UID:fitflow-workout-${d}@fitflow.app`,
          `DTSTAMP:${stamp(now)}`,
          `DTSTART;TZID=${tz}:${local(d, time)}`,
          "DURATION:PT55M",
          `SUMMARY:${escapeText(`Week ${pos.week}: ${DAY_TYPE_LABEL[type]}`)}`,
          `DESCRIPTION:${escapeText(`${c.label}, week ${pos.week}. Open FitFlow for the guided session.`)}`,
          "TRANSP:OPAQUE",
          "CATEGORIES:FitFlow",
          "END:VEVENT",
        );
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** UTC instant of the first occurrence (used for display and tests). */
export function firstOccurrenceUtc(item: ScheduleItem, date: string, tz: string): Date {
  return zonedTimeToUtc(date, item.time_local, tz);
}
