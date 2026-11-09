import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  localDate,
  localTime,
  mondayOf,
  tzOffsetMinutes,
  weekdayOf,
  zonedTimeToUtc,
} from "@shared/zoned.ts";

describe("timezone handling", () => {
  it("converts Seoul wall-clock time to UTC (UTC+9, no DST)", () => {
    expect(zonedTimeToUtc("2026-11-09", "07:00", "Asia/Seoul").toISOString()).toBe("2026-11-08T22:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-09", "00:30", "Asia/Seoul").toISOString()).toBe("2026-11-08T15:30:00.000Z");
    expect(tzOffsetMinutes(new Date("2026-07-01T00:00:00Z"), "Asia/Seoul")).toBe(540);
  });

  it("reports local date and time of an instant", () => {
    const d = new Date("2026-11-08T22:00:00Z");
    expect(localDate(d, "Asia/Seoul")).toBe("2026-11-09");
    expect(localTime(d, "Asia/Seoul")).toBe("07:00");
    expect(localDate(d, "America/New_York")).toBe("2026-11-08");
  });

  it("handles a spring-forward gap by moving forward (New York, 8 Mar 2026)", () => {
    // 02:30 does not exist on 2026-03-08 in New York; it becomes 03:30 EDT.
    const t = zonedTimeToUtc("2026-03-08", "02:30", "America/New_York");
    expect(t.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(localTime(t, "America/New_York")).toBe("03:30");
    // 07:00 the same morning is plain EDT (UTC-4)
    expect(zonedTimeToUtc("2026-03-08", "07:00", "America/New_York").toISOString()).toBe("2026-03-08T11:00:00.000Z");
  });

  it("uses the first occurrence in a fall-back overlap (New York, 1 Nov 2026)", () => {
    const t = zonedTimeToUtc("2026-11-01", "01:30", "America/New_York");
    expect(t.toISOString()).toBe("2026-11-01T05:30:00.000Z"); // 01:30 EDT
    expect(zonedTimeToUtc("2026-11-01", "07:00", "America/New_York").toISOString()).toBe("2026-11-01T12:00:00.000Z");
  });

  it("handles Europe/London DST and half-hour zones", () => {
    expect(zonedTimeToUtc("2026-07-01", "07:00", "Europe/London").toISOString()).toBe("2026-07-01T06:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "07:00", "Europe/London").toISOString()).toBe("2026-12-01T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-01", "07:00", "Asia/Kolkata").toISOString()).toBe("2026-12-01T01:30:00.000Z");
  });

  it("does calendar arithmetic", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-11-09", "2026-12-05")).toBe(26);
    expect(weekdayOf("2026-11-09")).toBe(1); // Monday
    expect(weekdayOf("2026-12-05")).toBe(6); // Saturday
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
  });
});
