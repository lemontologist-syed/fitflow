// Decides which reminders are due. Shared by the Edge Function (production
// scheduler) and the unit tests. No I/O here: callers pass rows in.
import { addDays, weekdayOf, zonedTimeToUtc, localDate } from "./zoned.ts";

export interface ReminderItem {
  id: string;
  title: string;
  time_local: string; // "HH:MM" wall-clock time in the user's timezone
  reminder_enabled: boolean;
  /** Weekdays the item applies to, 0 = Sunday. Empty/null = every day. */
  days?: number[] | null;
  notify_body?: string | null;
  deleted?: boolean | null;
  updated_at?: string | null;
}

export interface Completion {
  local_date: string;
  item_id: string;
  status: "completed" | "skipped";
  deleted?: boolean | null;
}

export interface DueReminder {
  itemId: string;
  title: string;
  body: string;
  localDate: string;
  time: string;
  fireAt: Date;
  dedupeKey: string;
}

/**
 * Stable identifier of one reminder occurrence. Includes the scheduled time,
 * so editing a time creates a new occurrence and the old one can never match
 * again; the database enforces uniqueness of this key, so the same occurrence
 * can only be claimed (and sent) once even if the scheduler runs twice.
 */
export function reminderKey(userId: string, itemId: string, date: string, time: string): string {
  return `r:${userId}:${itemId}:${date}:${time}`;
}

export function snoozeKey(userId: string, snoozeId: string): string {
  return `s:${userId}:${snoozeId}`;
}

export function itemActiveOn(item: Pick<ReminderItem, "days">, date: string): boolean {
  if (!item.days || item.days.length === 0) return true;
  return item.days.includes(weekdayOf(date));
}

export interface DueOptions {
  userId: string;
  now: Date;
  timeZone: string;
  items: ReminderItem[];
  completions: Completion[];
  /** How late a reminder may still be sent if a scheduler tick was missed. */
  catchUpMinutes?: number;
}

export function dueReminders(opts: DueOptions): DueReminder[] {
  const { userId, now, timeZone, items, completions } = opts;
  const windowMs = (opts.catchUpMinutes ?? 10) * 60000;
  const today = localDate(now, timeZone);
  const done = new Set(
    completions.filter((c) => !c.deleted).map((c) => `${c.local_date}|${c.item_id}`),
  );
  const out: DueReminder[] = [];
  // Yesterday is included so reminders just before midnight are not lost.
  for (const date of [addDays(today, -1), today]) {
    for (const item of items) {
      if (item.deleted || !item.reminder_enabled) continue;
      if (!itemActiveOn(item, date)) continue;
      if (done.has(`${date}|${item.id}`)) continue;
      let fireAt: Date;
      try {
        fireAt = zonedTimeToUtc(date, item.time_local, timeZone);
      } catch {
        continue; // malformed time: never crash the scheduler
      }
      const age = now.getTime() - fireAt.getTime();
      if (age < 0 || age >= windowMs) continue;
      // An edit made after this occurrence's time sets up future days only;
      // it must not fire a "late" reminder for a time that already passed.
      if (item.updated_at && Date.parse(item.updated_at) > fireAt.getTime()) continue;
      out.push({
        itemId: item.id,
        title: item.title,
        body: item.notify_body || `${item.title} — scheduled for ${formatTime12(item.time_local)}`,
        localDate: date,
        time: item.time_local,
        fireAt,
        dedupeKey: reminderKey(userId, item.id, date, item.time_local),
      });
    }
  }
  return out;
}

export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
