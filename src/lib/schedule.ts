import { itemActiveOn } from "@shared/reminders.ts";
import { timeToMinutes } from "@shared/zoned.ts";
import type { ScheduleItem, TaskCompletion } from "./types";

export type ItemState = "upcoming" | "in_progress" | "completed" | "skipped" | "missed";

export interface TimelineEntry {
  item: ScheduleItem;
  state: ItemState;
  minutes: number;
}

/** Items that apply on a date, sorted by time. */
export function itemsForDate(items: ScheduleItem[], date: string): ScheduleItem[] {
  return items
    .filter((i) => !i.deleted && itemActiveOn(i, date))
    .sort((a, b) => timeToMinutes(a.time_local) - timeToMinutes(b.time_local) || a.sort_order - b.sort_order);
}

/** How long after its start an item counts as "in progress" before it is missed. */
export const GRACE_MINUTES = 60;

/**
 * Builds the day timeline.
 * @param nowMinutes minutes since local midnight, or null for a day that is
 *   entirely in the future; Infinity for a day entirely in the past.
 */
export function timeline(
  items: ScheduleItem[],
  completions: TaskCompletion[],
  date: string,
  nowMinutes: number | null,
): TimelineEntry[] {
  const list = itemsForDate(items, date);
  const done = new Map(
    completions.filter((c) => !c.deleted && c.local_date === date).map((c) => [c.item_id, c.status]),
  );
  return list.map((item, i) => {
    const minutes = timeToMinutes(item.time_local);
    const status = done.get(item.id);
    if (status === "completed") return { item, state: "completed", minutes };
    if (status === "skipped") return { item, state: "skipped", minutes };
    if (nowMinutes === null || nowMinutes < minutes) return { item, state: "upcoming", minutes };
    const next = list[i + 1];
    const end = Math.min(minutes + GRACE_MINUTES, next ? timeToMinutes(next.time_local) : 24 * 60);
    if (nowMinutes < Math.max(end, minutes + 1)) return { item, state: "in_progress", minutes };
    return { item, state: "missed", minutes };
  });
}

export function nextUpcoming(entries: TimelineEntry[]): TimelineEntry | null {
  return entries.find((e) => e.state === "in_progress") ?? entries.find((e) => e.state === "upcoming") ?? null;
}

export function completionPercent(entries: TimelineEntry[]): number {
  if (entries.length === 0) return 0;
  const done = entries.filter((e) => e.state === "completed").length;
  return Math.round((done / entries.length) * 100);
}

export const STATE_LABEL: Record<ItemState, string> = {
  upcoming: "Upcoming",
  in_progress: "Now",
  completed: "Done",
  skipped: "Skipped",
  missed: "Missed",
};

export function greeting(hour: number): string {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}
