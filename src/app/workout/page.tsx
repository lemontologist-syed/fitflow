"use client";
import { ChevronRight, Info, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { addDays, mondayOf } from "@shared/zoned.ts";
import ExerciseDetails from "@/components/ExerciseDetails";
import { Button, Card, Field, Notice, Page, SectionTitle, Sheet, Stat, Toggle, cx, inputClass } from "@/components/ui";
import { EXERCISES, MAIN_EXERCISES, type Exercise } from "@/lib/exercises";
import { formatDateShort, useClock } from "@/lib/hooks";
import {
  DAY_TYPE_LABEL,
  WEEK_OBJECTIVES,
  buildSession,
  dayTypeFor,
  effectiveWeek,
  programPosition,
  weekSummary,
} from "@/lib/program";
import { liveList } from "@/lib/state";
import { save, useAppState } from "@/lib/store";

export default function WorkoutPage() {
  const state = useAppState();
  const { today } = useClock();
  const cycles = liveList(state, "training_cycles");
  const sessions = liveList(state, "workout_sessions");
  const pos = programPosition(today, cycles);
  const eff = effectiveWeek(pos.week, sessions, today);
  const [override, setOverride] = useState<number | null>(null);
  const week = override ?? eff.week;
  const dayType = dayTypeFor(today);
  const plan = buildSession(dayType, week);
  const todaySession = sessions.find((s) => s.local_date === today);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(pos.week);

  // Weekly completion statistics (this calendar week, Monday–today).
  const monday = mondayOf(today);
  const daysSoFar: string[] = [];
  for (let d = monday; d <= today; d = addDays(d, 1)) daysSoFar.push(d);
  const scheduled = daysSoFar.filter((d) => dayTypeFor(d) !== "rest" && (!pos.cycle || d >= pos.cycle.start_date)).length;
  const doneThisWeek = sessions.filter((s) => s.status === "completed" && s.local_date >= monday && s.local_date <= today).length;
  const totalDone = sessions.filter((s) => s.status === "completed").length;
  const history = [...sessions].sort((a, b) => b.local_date.localeCompare(a.local_date)).slice(0, 12);

  const startHref = `/workout/play/?week=${week}`;

  return (
    <Page title="Workout" subtitle={pos.status === "active" ? `${pos.cycle?.label} · Week ${pos.week} of 4` : pos.status === "before" ? `Program starts ${pos.cycle?.start_date}` : "Program finished · maintenance"}>
      <Card>
        <p className="text-sm text-muted">Today · {formatDateShort(today)}</p>
        <h2 className="text-xl font-bold">{plan.title}</h2>
        <p className="text-sm text-muted">
          Week {week}: {plan.objective} · about {plan.estimatedMinutes} min incl. warm-up and cooldown
        </p>
        {eff.held && override === null && <Notice tone="warn">{eff.reason} You can still choose a week below.</Notice>}
        {dayType === "rest" && (
          <p className="mt-2 text-sm">Sunday is rest and recovery. An optional easy walk/march and stretching session is available.</p>
        )}
        <div className="mt-3">
          <Field label="Intensity" hint="Never increases automatically after you report pain, excessive fatigue or poor recovery.">
            <select
              className={inputClass}
              value={week}
              onChange={(e) => setOverride(Number(e.target.value) === eff.week ? null : Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={w} disabled={w > pos.week}>
                  Week {w}
                  {w === eff.week ? " (planned)" : ""}
                  {w > pos.week ? " (locked until that week)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Link href={startHref} className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-accentfg">
          <Play size={20} aria-hidden />
          {todaySession?.status === "in_progress" ? "Resume workout" : todaySession?.status === "completed" ? "Do it again" : "Start workout"}
        </Link>
      </Card>

      <Card>
        <SectionTitle>This week</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Completed" value={`${doneThisWeek}/${scheduled}`} sub="sessions so far" />
          <Stat label="All time" value={totalDone} sub="sessions" />
          <Stat label="Adherence" value={scheduled ? `${Math.round((Math.min(doneThisWeek, scheduled) / scheduled) * 100)}%` : "—"} sub="this week" />
        </div>
      </Card>

      <Card>
        <SectionTitle>Four-week program</SectionTitle>
        <ul className="space-y-2">
          {[1, 2, 3, 4].map((w) => {
            const start = pos.cycle ? addDays(pos.cycle.start_date, (w - 1) * 7) : "";
            const end = pos.cycle ? (w === 4 ? pos.cycle.end_date : addDays(start, 6)) : "";
            const sum = weekSummary(w);
            const open = openWeek === w;
            return (
              <li key={w} className={cx("rounded-2xl bg-card2", w === pos.week && pos.status === "active" && "ring-2 ring-accent")}>
                <button type="button" aria-expanded={open} onClick={() => setOpenWeek(open ? null : w)} className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left">
                  <span>
                    <span className="font-semibold">Week {w}</span>
                    {start && <span className="text-sm text-muted"> · {formatDateShort(start)} – {formatDateShort(end)}</span>}
                    <span className="block text-sm text-muted">{WEEK_OBJECTIVES[w - 1]}</span>
                  </span>
                  <ChevronRight size={18} className={cx("shrink-0 transition", open && "rotate-90")} aria-hidden />
                </button>
                {open && (
                  <div className="space-y-2 px-3 pb-3 text-sm">
                    <p><strong>Mon/Wed/Fri — strength:</strong> {sum.strength}</p>
                    <p><strong>Tue/Thu — conditioning:</strong> {sum.conditioning}</p>
                    <p><strong>Sat — mixed moderate:</strong> 2 strength rounds (squats, push-ups, bridges, plank) + 3 cardio rounds.</p>
                    <p><strong>Sun — rest and recovery.</strong> Every session includes a warm-up, rest periods and a cooldown.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle>Exercises and easier options</SectionTitle>
        <p className="mb-2 text-sm text-muted">No equipment needed. Choose the easier version of any exercise; you can also switch during a workout.</p>
        <ul className="divide-y divide-line">
          {MAIN_EXERCISES.map((ex) => {
            const pref = state.data.exercise_preferences[ex.key];
            const easier = pref?.variant === "easier" && !pref.deleted;
            return (
              <li key={ex.key} className="py-2">
                <Toggle
                  label={ex.name}
                  description={easier ? `Using: ${EXERCISES[ex.easier!].name}` : `Easier: ${EXERCISES[ex.easier!].name}`}
                  checked={easier}
                  onChange={(v) => save("exercise_preferences", { id: ex.key, variant: v ? "easier" : "standard", notes: pref?.notes ?? null, deleted: false })}
                />
                <button type="button" onClick={() => setDetail(ex)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-accent">
                  <Info size={16} aria-hidden /> Instructions and form tips
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-muted">No workouts yet. Your sessions will appear here.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {history.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{formatDateShort(s.local_date)}</span> · {DAY_TYPE_LABEL[s.day_type]} · W{s.effective_week}
                  {s.fatigue ? ` · fatigue ${s.fatigue}/5` : ""}
                  {s.pain ? " · pain reported" : ""}
                </span>
                <span className="shrink-0 text-muted">
                  {s.status === "completed" ? `✓ ${Math.round((s.duration_seconds ?? 0) / 60)} min` : s.status === "in_progress" ? "In progress" : "Stopped"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail && <ExerciseDetails ex={detail} />}
        <Button className="mt-4 w-full" variant="secondary" onClick={() => setDetail(null)}>
          Close
        </Button>
      </Sheet>
    </Page>
  );
}
