// The four-week progressive home program and the session builder.
import { addDays, daysBetween, weekdayOf } from "@shared/zoned.ts";
import { EXERCISES } from "./exercises";
import type { DayType, ExercisePreference, TrainingCycle, WorkoutSession } from "./types";

export const DAY_TYPES: Record<number, DayType> = {
  0: "rest",
  1: "strength",
  2: "conditioning",
  3: "strength",
  4: "conditioning",
  5: "strength",
  6: "mixed",
};

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  strength: "Full-body strength",
  conditioning: "Bodyweight conditioning",
  mixed: "Mixed moderate-intensity",
  rest: "Rest and recovery",
};

export const WEEK_OBJECTIVES = [
  "Establish baseline and exercise technique",
  "Increase training volume",
  "Increase workload",
  "Most demanding sustainable week",
];

type Idx = 0 | 1 | 2 | 3;

interface StrengthSpec {
  key: string;
  reps?: [number, number, number, number];
  seconds?: [number, number, number, number];
  perSide?: boolean;
}

export const STRENGTH: StrengthSpec[] = [
  { key: "squat", reps: [15, 18, 18, 18] },
  { key: "pushup", reps: [10, 12, 12, 12] },
  { key: "reverse-lunge", reps: [10, 12, 12, 12], perSide: true },
  { key: "glute-bridge", reps: [15, 18, 18, 18] },
  { key: "mountain-climber", seconds: [30, 40, 40, 40] },
  { key: "plank", seconds: [30, 40, 40, 40] },
];

export const STRENGTH_WEEKS = {
  rounds: [3, 3, 4, 4],
  restBetweenExercises: [30, 30, 30, 25], // week 4: slightly reduced rest
  restBetweenRounds: [90, 90, 90, 75],
  tempoKeys: ["squat", "pushup"],
};

export const CONDITIONING = ["jumping-jack", "high-knees", "mountain-climber", "skater", "burpee"];

export const CONDITIONING_WEEKS = {
  work: [30, 35, 40, 45],
  rest: [30, 25, 20, 15],
  rounds: [4, 5, 5, 6],
  restBetweenRounds: 60,
};

export const WARMUP: Array<{ key: string; seconds: number }> = [
  { key: "warm-march", seconds: 60 },
  { key: "arm-circles", seconds: 30 },
  { key: "hip-circles", seconds: 30 },
  { key: "hip-hinge", seconds: 30 },
  { key: "leg-swings", seconds: 40 },
  { key: "step-jack", seconds: 45 },
];

export const COOLDOWN: Array<{ key: string; seconds: number }> = [
  { key: "quad-stretch", seconds: 60 },
  { key: "hamstring-stretch", seconds: 60 },
  { key: "hip-flexor-stretch", seconds: 60 },
  { key: "chest-stretch", seconds: 30 },
  { key: "childs-pose", seconds: 45 },
  { key: "breathing", seconds: 60 },
];

export type Phase = "warmup" | "main" | "cooldown";

export interface ExerciseStep {
  kind: "exercise";
  phase: Phase;
  /** Standard exercise key; the easier variant is resolved at display time. */
  key: string;
  block: string;
  round: number;
  rounds: number;
  reps?: number;
  seconds?: number;
  perSide?: boolean;
  tempo?: string;
}

export interface RestStep {
  kind: "rest";
  phase: Phase;
  seconds: number;
  label: string;
  nextKey?: string;
}

export type Step = ExerciseStep | RestStep;

export interface SessionPlan {
  dayType: DayType;
  week: number;
  title: string;
  objective: string;
  steps: Step[];
  estimatedMinutes: number;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function dayTypeFor(date: string): DayType {
  return DAY_TYPES[weekdayOf(date)];
}

/** The cycle that applies to a date: the latest one that has started. */
export function cycleFor(date: string, cycles: TrainingCycle[]): TrainingCycle | null {
  const live = cycles.filter((c) => !c.deleted).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (live.length === 0) return null;
  let current: TrainingCycle | null = null;
  for (const c of live) if (c.start_date <= date) current = c;
  return current ?? live[0];
}

export interface ProgramPosition {
  status: "before" | "active" | "after";
  /** Program week 1-4 (after the program ends this stays at 4 = maintenance). */
  week: number;
  dayIndex: number; // days since cycle start
  daysLeft: number;
  cycle: TrainingCycle | null;
}

export function programPosition(date: string, cycles: TrainingCycle[]): ProgramPosition {
  const cycle = cycleFor(date, cycles);
  if (!cycle) return { status: "before", week: 1, dayIndex: 0, daysLeft: 0, cycle: null };
  const d = daysBetween(cycle.start_date, date);
  if (d < 0) return { status: "before", week: 1, dayIndex: d, daysLeft: daysBetween(date, cycle.end_date), cycle };
  if (date > cycle.end_date) return { status: "after", week: 4, dayIndex: d, daysLeft: 0, cycle };
  return {
    status: "active",
    week: Math.min(4, Math.floor(d / 7) + 1),
    dayIndex: d,
    daysLeft: daysBetween(date, cycle.end_date),
    cycle,
  };
}

/** New 4-week cycle starting the Monday on/after `from` and ending Saturday of week 4. */
export function newCycle(from: string, number: number, now: string): TrainingCycle {
  const wd = weekdayOf(from);
  const start = wd === 1 ? from : addDays(from, (8 - wd) % 7);
  return {
    id: `cycle-${start}`,
    label: `Cycle ${number}`,
    start_date: start,
    end_date: addDays(start, 26),
    status: "active",
    updated_at: now,
  };
}

// ---------------------------------------------------------------------------
// Safety: never progress automatically after fatigue, pain or poor recovery
// ---------------------------------------------------------------------------

export interface EffectiveWeek {
  week: number;
  held: boolean;
  reason?: string;
}

export function effectiveWeek(calendarWeek: number, sessions: WorkoutSession[], date: string): EffectiveWeek {
  const recent = sessions
    .filter(
      (s) =>
        !s.deleted &&
        s.status === "completed" &&
        s.local_date < date &&
        daysBetween(s.local_date, date) <= 7,
    )
    .sort((a, b) => (a.local_date + (a.completed_at ?? "")).localeCompare(b.local_date + (b.completed_at ?? "")));
  const last = recent[recent.length - 1];
  if (!last) return { week: calendarWeek, held: false };
  const reasons: string[] = [];
  if ((last.fatigue ?? 0) >= 5) reasons.push("excessive fatigue");
  if (last.pain) reasons.push("pain");
  if (last.recovery === "poor") reasons.push("poor recovery");
  if (reasons.length > 0 && last.effective_week < calendarWeek) {
    return {
      week: Math.max(1, last.effective_week),
      held: true,
      reason: `Intensity held at Week ${last.effective_week} because your last session (${last.local_date}) reported ${reasons.join(" and ")}.`,
    };
  }
  return { week: calendarWeek, held: false };
}

// ---------------------------------------------------------------------------
// Session builder
// ---------------------------------------------------------------------------

function timed(list: Array<{ key: string; seconds: number }>, phase: Phase, block: string): Step[] {
  return list.map((w) => ({ kind: "exercise", phase, key: w.key, block, round: 1, rounds: 1, seconds: w.seconds }));
}

function strengthBlock(
  specs: StrengthSpec[],
  w: Idx,
  rounds: number,
  restEx: number,
  restRound: number,
  block: string,
  tempo: boolean,
): Step[] {
  const steps: Step[] = [];
  for (let r = 1; r <= rounds; r++) {
    specs.forEach((s, i) => {
      steps.push({
        kind: "exercise",
        phase: "main",
        key: s.key,
        block,
        round: r,
        rounds,
        reps: s.reps?.[w],
        seconds: s.seconds?.[w],
        perSide: s.perSide,
        tempo: tempo && STRENGTH_WEEKS.tempoKeys.includes(s.key) ? "3-second lowering" : undefined,
      });
      const lastOfRound = i === specs.length - 1;
      if (lastOfRound && r === rounds) return;
      steps.push({
        kind: "rest",
        phase: "main",
        seconds: lastOfRound ? restRound : restEx,
        label: lastOfRound ? `Round ${r} done — rest` : "Rest",
        nextKey: lastOfRound ? specs[0].key : specs[i + 1].key,
      });
    });
  }
  return steps;
}

function intervalBlock(keys: string[], work: number, rest: number, rounds: number, roundRest: number, block: string): Step[] {
  const steps: Step[] = [];
  for (let r = 1; r <= rounds; r++) {
    keys.forEach((key, i) => {
      steps.push({ kind: "exercise", phase: "main", key, block, round: r, rounds, seconds: work });
      const lastOfRound = i === keys.length - 1;
      if (lastOfRound && r === rounds) return;
      steps.push({
        kind: "rest",
        phase: "main",
        seconds: lastOfRound ? Math.max(rest, roundRest) : rest,
        label: lastOfRound ? `Round ${r} done — rest` : "Rest",
        nextKey: lastOfRound ? keys[0] : keys[i + 1],
      });
    });
  }
  return steps;
}

export function buildSession(dayType: DayType, week: number): SessionPlan {
  const wk = Math.min(4, Math.max(1, Math.round(week)));
  const w = (wk - 1) as Idx;
  let main: Step[] = [];
  let title = "";
  switch (dayType) {
    case "strength":
      title = "Full-body strength";
      main = strengthBlock(
        STRENGTH,
        w,
        STRENGTH_WEEKS.rounds[w],
        STRENGTH_WEEKS.restBetweenExercises[w],
        STRENGTH_WEEKS.restBetweenRounds[w],
        "Strength circuit",
        wk === 4,
      );
      break;
    case "conditioning":
      title = "Bodyweight conditioning";
      main = intervalBlock(
        CONDITIONING,
        CONDITIONING_WEEKS.work[w],
        CONDITIONING_WEEKS.rest[w],
        CONDITIONING_WEEKS.rounds[w],
        CONDITIONING_WEEKS.restBetweenRounds,
        "Intervals",
      );
      break;
    case "mixed": {
      title = "Mixed moderate-intensity";
      const subset = STRENGTH.filter((s) => ["squat", "pushup", "glute-bridge", "plank"].includes(s.key));
      main = [
        ...strengthBlock(subset, w, 2, STRENGTH_WEEKS.restBetweenExercises[w], 60, "Strength part", wk === 4),
        { kind: "rest", phase: "main", seconds: 60, label: "Switch to cardio — rest", nextKey: "jumping-jack" },
        ...intervalBlock(
          ["jumping-jack", "skater", "high-knees"],
          CONDITIONING_WEEKS.work[w],
          CONDITIONING_WEEKS.rest[w] + 10,
          3,
          60,
          "Cardio part",
        ),
      ];
      break;
    }
    case "rest":
      title = "Rest and recovery";
      main = [
        { kind: "exercise", phase: "main", key: "march", block: "Easy walk / march", round: 1, rounds: 1, seconds: 600 },
      ];
      break;
  }
  const steps: Step[] = [
    ...timed(WARMUP, "warmup", "Warm-up"),
    { kind: "rest", phase: "warmup", seconds: 30, label: "Get ready", nextKey: (main[0] as ExerciseStep).key },
    ...main,
    { kind: "rest", phase: "cooldown", seconds: 30, label: "Main set done — slow down", nextKey: COOLDOWN[0].key },
    ...timed(COOLDOWN, "cooldown", "Cooldown"),
  ];
  const seconds = steps.reduce((sum, s) => {
    if (s.kind === "rest") return sum + s.seconds;
    if (s.seconds) return sum + s.seconds;
    const reps = (s.reps ?? 0) * (s.perSide ? 2 : 1);
    return sum + reps * (s.tempo ? 5 : 3);
  }, 0);
  return {
    dayType,
    week: wk,
    title,
    objective: WEEK_OBJECTIVES[w],
    steps,
    estimatedMinutes: Math.round(seconds / 60),
  };
}

export function resolveExerciseKey(
  baseKey: string,
  prefs: Record<string, ExercisePreference | undefined>,
  sessionVariants?: Record<string, "standard" | "easier">,
): { key: string; variant: "standard" | "easier" } {
  const variant = sessionVariants?.[baseKey] ?? (prefs[baseKey]?.deleted ? undefined : prefs[baseKey]?.variant) ?? "standard";
  const easier = EXERCISES[baseKey]?.easier;
  if (variant === "easier" && easier) return { key: easier, variant };
  return { key: baseKey, variant: "standard" };
}

export function describeTarget(step: ExerciseStep): string {
  if (step.reps) return `${step.reps} reps${step.perSide ? " per leg" : ""}`;
  if (step.seconds) return step.seconds >= 120 ? `${Math.round(step.seconds / 60)} min` : `${step.seconds} s`;
  return "";
}

/** Human summary of a week's prescription (shown on the Workout screen). */
export function weekSummary(week: number): { strength: string; conditioning: string } {
  const w = (Math.min(4, Math.max(1, week)) - 1) as Idx;
  const s = STRENGTH.map((x) =>
    x.reps ? `${EXERCISES[x.key].name} ${x.reps[w]}${x.perSide ? "/leg" : ""}` : `${EXERCISES[x.key].name} ${x.seconds![w]} s`,
  ).join(" · ");
  return {
    strength: `${STRENGTH_WEEKS.rounds[w]} rounds: ${s}${w === 3 ? " · 3-second lowering on squats and push-ups" : ""} · rest ${STRENGTH_WEEKS.restBetweenExercises[w]} s between exercises, ${STRENGTH_WEEKS.restBetweenRounds[w]} s between rounds`,
    conditioning: `${CONDITIONING_WEEKS.rounds[w]} rounds of ${CONDITIONING.map((k) => EXERCISES[k].name).join(", ")} · ${CONDITIONING_WEEKS.work[w]} s work / ${CONDITIONING_WEEKS.rest[w]} s rest`,
  };
}
