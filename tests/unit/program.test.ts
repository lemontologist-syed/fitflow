import { describe, expect, it } from "vitest";
import { defaultCycle } from "@/lib/defaults";
import {
  buildSession,
  dayTypeFor,
  effectiveWeek,
  newCycle,
  programPosition,
  resolveExerciseKey,
  type ExerciseStep,
} from "@/lib/program";
import { EXERCISES } from "@/lib/exercises";
import type { WorkoutSession } from "@/lib/types";

const cycles = [defaultCycle()];
const ex = (steps: ReturnType<typeof buildSession>["steps"]) =>
  steps.filter((s): s is ExerciseStep => s.kind === "exercise" && s.phase === "main");

describe("program calendar", () => {
  it("maps dates to program weeks (9 Nov – 5 Dec 2026)", () => {
    expect(programPosition("2026-11-08", cycles).status).toBe("before");
    expect(programPosition("2026-11-09", cycles)).toMatchObject({ status: "active", week: 1 });
    expect(programPosition("2026-11-15", cycles).week).toBe(1);
    expect(programPosition("2026-11-16", cycles).week).toBe(2);
    expect(programPosition("2026-11-22", cycles).week).toBe(2);
    expect(programPosition("2026-11-23", cycles).week).toBe(3);
    expect(programPosition("2026-11-30", cycles).week).toBe(4);
    expect(programPosition("2026-12-05", cycles)).toMatchObject({ status: "active", week: 4, daysLeft: 0 });
    expect(programPosition("2026-12-06", cycles)).toMatchObject({ status: "after", week: 4 });
  });

  it("assigns the weekly structure", () => {
    expect(dayTypeFor("2026-11-09")).toBe("strength"); // Mon
    expect(dayTypeFor("2026-11-10")).toBe("conditioning");
    expect(dayTypeFor("2026-11-11")).toBe("strength");
    expect(dayTypeFor("2026-11-12")).toBe("conditioning");
    expect(dayTypeFor("2026-11-13")).toBe("strength");
    expect(dayTypeFor("2026-11-14")).toBe("mixed");
    expect(dayTypeFor("2026-11-15")).toBe("rest");
  });

  it("starts a new cycle on the next Monday", () => {
    const c = newCycle("2026-12-06", 2, "2026-12-06T00:00:00Z");
    expect(c).toMatchObject({ start_date: "2026-12-07", end_date: "2027-01-02", label: "Cycle 2" });
    expect(programPosition("2026-12-08", [defaultCycle(), c])).toMatchObject({ status: "active", week: 1 });
  });
});

describe("exercise progression", () => {
  it("week 1 strength: 3 rounds, prescribed reps and times", () => {
    const s = buildSession("strength", 1);
    const main = ex(s.steps);
    expect(main).toHaveLength(18);
    const r1 = Object.fromEntries(main.slice(0, 6).map((m) => [m.key, m.reps ?? m.seconds]));
    expect(r1).toEqual({ squat: 15, pushup: 10, "reverse-lunge": 10, "glute-bridge": 15, "mountain-climber": 30, plank: 30 });
    expect(main.find((m) => m.key === "reverse-lunge")?.perSide).toBe(true);
  });

  it("week 2 adds 2–3 reps and 10 s; week 3 adds a round; week 4 adds tempo and less rest", () => {
    const w2 = ex(buildSession("strength", 2).steps);
    expect(w2).toHaveLength(18);
    expect(w2[0].reps! - 15).toBeGreaterThanOrEqual(2);
    expect(w2[1].reps! - 10).toBeGreaterThanOrEqual(2);
    expect(w2.find((m) => m.key === "plank")?.seconds).toBe(40);
    const w3 = ex(buildSession("strength", 3).steps);
    expect(w3).toHaveLength(24);
    expect(w3[0].reps).toBe(w2[0].reps);
    const s4 = buildSession("strength", 4);
    const w4 = ex(s4.steps);
    expect(w4).toHaveLength(24);
    expect(w4.filter((m) => m.tempo).map((m) => m.key).sort()).toEqual(Array(8).fill(0).map((_, i) => (i < 4 ? "pushup" : "squat")));
    const rest3 = buildSession("strength", 3).steps.find((s) => s.kind === "rest" && s.phase === "main");
    const rest4 = s4.steps.find((s) => s.kind === "rest" && s.phase === "main");
    expect((rest4 as { seconds: number }).seconds).toBeLessThan((rest3 as { seconds: number }).seconds);
  });

  it("conditioning work/rest/rounds per week", () => {
    const expectWeek = (w: number, work: number, rest: number, rounds: number) => {
      const s = buildSession("conditioning", w);
      const main = ex(s.steps);
      expect(main).toHaveLength(5 * rounds);
      expect(new Set(main.map((m) => m.seconds))).toEqual(new Set([work]));
      const rests = s.steps.filter((x) => x.kind === "rest" && x.phase === "main" && x.label === "Rest");
      expect(new Set(rests.map((r) => r.seconds))).toEqual(new Set([rest]));
    };
    expectWeek(1, 30, 30, 4);
    expectWeek(2, 35, 25, 5);
    expectWeek(3, 40, 20, 5);
    expectWeek(4, 45, 15, 6);
  });

  it("every session has warm-up, main work, rests and a cooldown, with no equipment", () => {
    for (const type of ["strength", "conditioning", "mixed", "rest"] as const) {
      for (const w of [1, 2, 3, 4]) {
        const s = buildSession(type, w);
        expect(s.steps.some((x) => x.phase === "warmup")).toBe(true);
        expect(s.steps.some((x) => x.phase === "main")).toBe(true);
        expect(s.steps.some((x) => x.phase === "cooldown")).toBe(true);
        expect(s.steps.some((x) => x.kind === "rest")).toBe(true);
        for (const st of s.steps) if (st.kind === "exercise") expect(EXERCISES[st.key]).toBeTruthy();
      }
    }
  });

  it("every main exercise has an easier alternative, instructions and form tips", () => {
    for (const k of ["squat", "pushup", "reverse-lunge", "glute-bridge", "mountain-climber", "plank", "jumping-jack", "high-knees", "skater", "burpee"]) {
      const e = EXERCISES[k];
      expect(EXERCISES[e.easier!]).toBeTruthy();
      expect(e.instructions.length).toBeGreaterThan(1);
      expect(e.mistakes.length).toBeGreaterThan(0);
      expect(e.modifications.length).toBeGreaterThan(0);
    }
    expect(resolveExerciseKey("pushup", { pushup: { id: "pushup", variant: "easier", notes: null, updated_at: "" } }).key).toBe("incline-pushup");
    expect(resolveExerciseKey("pushup", {}, { pushup: "easier" }).key).toBe("incline-pushup");
    expect(resolveExerciseKey("pushup", {}).key).toBe("pushup");
  });
});

describe("safety: no automatic progression after fatigue, pain or poor recovery", () => {
  const session = (p: Partial<WorkoutSession>): WorkoutSession => ({
    id: "s",
    local_date: "2026-11-14",
    cycle_id: "cycle-1",
    program_week: 1,
    effective_week: 1,
    day_type: "mixed",
    status: "completed",
    started_at: null,
    completed_at: "2026-11-14T00:00:00Z",
    duration_seconds: 3000,
    fatigue: 3,
    pain: false,
    recovery: "good",
    notes: null,
    progress: null,
    updated_at: "",
    ...p,
  });

  it("progresses normally after a good session", () => {
    expect(effectiveWeek(2, [session({})], "2026-11-16")).toEqual({ week: 2, held: false });
  });

  it("holds the previous week after pain, fatigue 5 or poor recovery", () => {
    for (const p of [{ pain: true }, { fatigue: 5 }, { recovery: "poor" as const }]) {
      const r = effectiveWeek(2, [session(p)], "2026-11-16");
      expect(r.week).toBe(1);
      expect(r.held).toBe(true);
      expect(r.reason).toMatch(/held at Week 1/);
    }
  });

  it("only looks at recent completed sessions", () => {
    expect(effectiveWeek(2, [session({ pain: true, status: "abandoned" })], "2026-11-16").held).toBe(false);
    expect(effectiveWeek(3, [session({ pain: true, local_date: "2026-11-01" })], "2026-11-23").held).toBe(false);
  });
});
