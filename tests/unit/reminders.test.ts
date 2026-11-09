import { describe, expect, it } from "vitest";
import { dueReminders, reminderKey, type ReminderItem } from "@shared/reminders.ts";
import { defaultSchedule } from "@/lib/defaults";

const TZ = "Asia/Seoul";
const U = "user-1";
const items = (): ReminderItem[] => defaultSchedule();
// 2026-11-10 (Tuesday) 12:30 Seoul = 03:30 UTC
const at = (iso: string) => new Date(iso);

describe("reminder selection", () => {
  it("fires lunch at 12:30 Seoul time with a stable key", () => {
    const due = dueReminders({ userId: U, now: at("2026-11-10T03:30:20Z"), timeZone: TZ, items: items(), completions: [] });
    expect(due.map((d) => d.itemId)).toEqual(["lunch"]);
    expect(due[0].dedupeKey).toBe(reminderKey(U, "lunch", "2026-11-10", "12:30"));
    expect(due[0].fireAt.toISOString()).toBe("2026-11-10T03:30:00.000Z");
  });

  it("is idempotent: the same occurrence gives the same key on every tick", () => {
    const k1 = dueReminders({ userId: U, now: at("2026-11-10T03:30:05Z"), timeZone: TZ, items: items(), completions: [] });
    const k2 = dueReminders({ userId: U, now: at("2026-11-10T03:31:05Z"), timeZone: TZ, items: items(), completions: [] });
    expect(k1[0].dedupeKey).toBe(k2[0].dedupeKey);
  });

  it("does not fire before the time or after the catch-up window", () => {
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:29:59Z"), timeZone: TZ, items: items(), completions: [] })).toHaveLength(0);
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:40:00Z"), timeZone: TZ, items: items(), completions: [] })).toHaveLength(0);
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:39:59Z"), timeZone: TZ, items: items(), completions: [] })).toHaveLength(1);
  });

  it("skips disabled, deleted and already completed/skipped items", () => {
    const list = items().map((i) => (i.id === "lunch" ? { ...i, reminder_enabled: false } : i));
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:30:00Z"), timeZone: TZ, items: list, completions: [] })).toHaveLength(0);
    const done = dueReminders({
      userId: U,
      now: at("2026-11-10T03:30:00Z"),
      timeZone: TZ,
      items: items(),
      completions: [{ local_date: "2026-11-10", item_id: "lunch", status: "skipped" }],
    });
    expect(done).toHaveLength(0);
  });

  it("Test C: moving lunch from 12:30 to 13:00 invalidates the old occurrence", () => {
    const edited = items().map((i) =>
      i.id === "lunch" ? { ...i, time_local: "13:00", updated_at: "2026-11-10T02:00:00Z" } : i,
    );
    // nothing at 12:30 any more
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:30:00Z"), timeZone: TZ, items: edited, completions: [] })).toHaveLength(0);
    // fires once at 13:00 with a new key
    const due = dueReminders({ userId: U, now: at("2026-11-10T04:00:00Z"), timeZone: TZ, items: edited, completions: [] });
    expect(due.map((d) => d.dedupeKey)).toEqual([reminderKey(U, "lunch", "2026-11-10", "13:00")]);
  });

  it("an edit made after the scheduled time never fires a late reminder", () => {
    const edited = items().map((i) =>
      i.id === "lunch" ? { ...i, time_local: "12:25", updated_at: "2026-11-10T03:28:00Z" } : i,
    );
    expect(dueReminders({ userId: U, now: at("2026-11-10T03:29:00Z"), timeZone: TZ, items: edited, completions: [] })).toHaveLength(0);
  });

  it("respects weekdays: no workout reminder on Sunday (rest day)", () => {
    // Sunday 2026-11-15 07:20 Seoul = 2026-11-14T22:20Z
    const sun = dueReminders({ userId: U, now: at("2026-11-14T22:20:00Z"), timeZone: TZ, items: items(), completions: [] });
    expect(sun).toHaveLength(0);
    const mon = dueReminders({ userId: U, now: at("2026-11-15T22:20:00Z"), timeZone: TZ, items: items(), completions: [] });
    // prep (07:15) is still inside the 10-minute catch-up window; it was claimed at 07:15 in a real run
    expect(mon.map((d) => d.itemId)).toEqual(["prep", "workout"]);
  });

  it("follows the user's timezone, including DST elsewhere", () => {
    // 07:00 New York on 2026-03-09 (EDT) = 11:00Z
    const ny = dueReminders({ userId: U, now: at("2026-03-09T11:00:00Z"), timeZone: "America/New_York", items: items(), completions: [] });
    expect(ny.map((d) => d.itemId)).toEqual(["wake"]);
  });

  it("catches a reminder just before midnight across the date change", () => {
    const list: ReminderItem[] = [{ id: "late", title: "Late", time_local: "23:58", reminder_enabled: true }];
    // 00:03 Seoul on 11 Nov -> occurrence belongs to 10 Nov
    const due = dueReminders({ userId: U, now: at("2026-11-10T15:03:00Z"), timeZone: TZ, items: list, completions: [] });
    expect(due[0]?.localDate).toBe("2026-11-10");
  });
});
