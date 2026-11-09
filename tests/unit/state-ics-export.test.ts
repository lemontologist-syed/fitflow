import { describe, expect, it } from "vitest";
import { defaultCycle, defaultSchedule } from "@/lib/defaults";
import { exportCombinedCsv, exportJson, toCsv } from "@/lib/exporters";
import { buildIcs, foldLine } from "@/lib/ics";
import {
  countDirty,
  deleteRow,
  emptyState,
  markUploaded,
  mergeRemote,
  migrateState,
  pendingUploads,
  seedState,
  upsertRow,
} from "@/lib/state";

const T0 = new Date("2026-11-10T00:00:00Z");
const T1 = new Date("2026-11-10T01:00:00Z");

describe("local persistence and sync merge", () => {
  it("seeds defaults once and never overwrites user data", () => {
    let s = seedState(emptyState());
    expect(Object.keys(s.data.schedule_items)).toHaveLength(10);
    s = upsertRow(s, "schedule_items", { ...s.data.schedule_items.lunch, time_local: "13:00" }, T0);
    const again = seedState(migrateState(JSON.parse(JSON.stringify(s))));
    expect(again.data.schedule_items.lunch.time_local).toBe("13:00");
  });

  it("deterministic ids prevent duplicate records", () => {
    let s = emptyState();
    const w = { id: "2026-11-10", local_date: "2026-11-10", weight_kg: 80 };
    s = upsertRow(s, "weight_logs", w, T0);
    s = upsertRow(s, "weight_logs", { ...w, weight_kg: 79.6 }, T1);
    expect(Object.keys(s.data.weight_logs)).toEqual(["2026-11-10"]);
    expect(s.data.weight_logs["2026-11-10"].weight_kg).toBe(79.6);
  });

  it("uploads dirty rows and clears them only if unchanged since", () => {
    let s = upsertRow(emptyState(), "weight_logs", { id: "d1", local_date: "2026-11-10", weight_kg: 80 }, T0);
    const up = pendingUploads(s, "u1").weight_logs!;
    expect(up[0]).toMatchObject({ id: "d1", user_id: "u1", deleted: false });
    // edited again while the upload was in flight
    s = upsertRow(s, "weight_logs", { ...s.data.weight_logs.d1, weight_kg: 79.9 }, T1);
    s = markUploaded(s, "weight_logs", up as Array<{ id: string; updated_at: string }>);
    expect(countDirty(s)).toBe(1);
    s = markUploaded(s, "weight_logs", pendingUploads(s, "u1").weight_logs as Array<{ id: string; updated_at: string }>);
    expect(countDirty(s)).toBe(0);
  });

  it("last write wins on merge; newer local edits survive", () => {
    let s = upsertRow(emptyState(), "schedule_items", { ...defaultSchedule()[5], time_local: "13:00" }, T1);
    const older = { ...defaultSchedule()[5], time_local: "12:45", updated_at: T0.toISOString(), server_updated_at: "2026-11-10T00:00:01Z" };
    s = mergeRemote(s, "schedule_items", [older]);
    expect(s.data.schedule_items.lunch.time_local).toBe("13:00");
    expect(s.sync.dirty.schedule_items).toContain("lunch");
    const newer = { ...older, time_local: "12:15", updated_at: "2026-11-10T02:00:00Z", server_updated_at: "2026-11-10T02:00:01Z" };
    s = mergeRemote(s, "schedule_items", [newer]);
    expect(s.data.schedule_items.lunch.time_local).toBe("12:15");
    expect(s.sync.dirty.schedule_items).not.toContain("lunch");
    expect(s.sync.cursors.schedule_items).toBe("2026-11-10T02:00:01Z");
  });

  it("deletes are tombstones that sync", () => {
    let s = upsertRow(emptyState(), "weight_logs", { id: "d1", local_date: "2026-11-10", weight_kg: 80 }, T0);
    s = markUploaded(s, "weight_logs", pendingUploads(s, "u").weight_logs as Array<{ id: string; updated_at: string }>);
    s = deleteRow(s, "weight_logs", "d1", T1);
    expect(pendingUploads(s, "u").weight_logs?.[0]).toMatchObject({ id: "d1", deleted: true });
  });

  it("timestamps strictly increase even with a fast clock on another device", () => {
    let s = emptyState();
    s = mergeRemote(s, "weight_logs", [{ id: "x", updated_at: "2030-01-01T00:00:00.000Z", local_date: "2026-11-10", weight_kg: 80 } as never]);
    s = upsertRow(s, "weight_logs", { ...s.data.weight_logs.x, weight_kg: 79 }, T0);
    expect(s.data.weight_logs.x.updated_at > "2030-01-01T00:00:00.000Z").toBe(true);
  });
});

describe(".ics calendar export", () => {
  const ics = buildIcs({
    items: defaultSchedule(),
    timeZone: "Asia/Seoul",
    startDate: "2026-11-09",
    cycles: [defaultCycle()],
    includeWorkouts: true,
    now: new Date("2026-11-09T00:00:00Z"),
  });
  const lines = ics.split("\r\n");

  it("is a valid calendar with a Seoul VTIMEZONE and CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("TZID:Asia/Seoul");
    expect(ics).toContain("TZOFFSETTO:+0900");
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(ics.split("END:VEVENT").length - 1);
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });

  it("has one recurring event per routine item with stable UIDs and alarms", () => {
    expect(ics).toContain("UID:fitflow-wake@fitflow.app");
    expect(ics).toContain("DTSTART;TZID=Asia/Seoul:20261109T070000");
    expect(ics).toContain("DTSTART;TZID=Asia/Seoul:20261109T123000");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA");
    expect(ics.split("BEGIN:VALARM").length - 1).toBe(10);
    expect(ics).toContain("TRIGGER:PT0M");
  });

  it("includes the program workouts (no events on rest days)", () => {
    expect(ics).toContain("UID:fitflow-workout-2026-11-09@fitflow.app");
    expect(ics).toContain("SUMMARY:Week 4: Full-body strength");
    expect(ics).not.toContain("fitflow-workout-2026-11-15@");
  });

  it("folds long lines and escapes text", () => {
    const long = `DESCRIPTION:${"a".repeat(200)}`;
    expect(foldLine(long).split("\r\n").every((l) => l.length <= 75)).toBe(true);
    expect(buildIcs({ items: [{ ...defaultSchedule()[0], title: "Wake, stretch; go" }], timeZone: "Asia/Seoul", startDate: "2026-11-09" })).toContain(
      "SUMMARY:Wake\\, stretch\\; go",
    );
  });
});

describe("data export", () => {
  it("escapes CSV and exports JSON/CSV backups", () => {
    expect(toCsv([{ a: 'x,"y"', b: 1 }])).toBe('a,b\r\n"x,""y""",1\r\n');
    let s = seedState(emptyState());
    s = upsertRow(s, "weight_logs", { id: "2026-11-10", local_date: "2026-11-10", weight_kg: 79.8 }, T0);
    const json = JSON.parse(exportJson(s));
    expect(json.weight_logs).toEqual([{ id: "2026-11-10", local_date: "2026-11-10", weight_kg: 79.8, updated_at: T0.toISOString() }]);
    expect(exportCombinedCsv(s)).toContain("2026-11-10,79.8");
  });
});
