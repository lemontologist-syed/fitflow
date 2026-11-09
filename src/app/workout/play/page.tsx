"use client";
import { ChevronLeft, Info, Minus, Pause, Play, Plus, SkipBack, SkipForward, Square, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExerciseDetails from "@/components/ExerciseDetails";
import Figure from "@/components/Figure";
import WatchLink from "@/components/WatchLink";
import { Button, Card, Field, Notice, ProgressBar, Sheet, Stat, cx, inputClass } from "@/components/ui";
import { setTaskStatus } from "@/lib/actions";
import { EXERCISES } from "@/lib/exercises";
import { useClock } from "@/lib/hooks";
import {
  DAY_TYPE_LABEL,
  buildSession,
  dayTypeFor,
  describeTarget,
  effectiveWeek,
  programPosition,
  resolveExerciseKey,
  type ExerciseStep,
  type Step,
} from "@/lib/program";
import { liveList } from "@/lib/state";
import { getState, save, useAppState } from "@/lib/store";
import type { WorkoutProgress, WorkoutSession } from "@/lib/types";

// ---- audio / vibration cues (only while the app is open and active) ----
let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audioCtx ??= new AC();
    void audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}
function beep(freq: number, dur: number) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch {
    /* ignore */
  }
}
const vibrate = (p: number | number[]) => {
  if ("vibrate" in navigator) navigator.vibrate(p);
};

const stepSeconds = (s: Step) => (s.kind === "rest" ? s.seconds : s.seconds ?? null);
const fmt = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export default function PlayPage() {
  const state = useAppState();
  const router = useRouter();
  const { today } = useClock();
  const sessions = liveList(state, "workout_sessions");
  const cycles = liveList(state, "training_cycles");
  const pos = programPosition(today, cycles);
  const eff = effectiveWeek(pos.week, sessions, today);
  const resumable = sessions.find((s) => s.local_date === today && s.status === "in_progress" && s.progress);

  const [requestedWeek, setRequestedWeek] = useState<number | null>(null);
  useEffect(() => {
    const w = Number(new URLSearchParams(window.location.search).get("week"));
    if (w >= 1 && w <= 4) setRequestedWeek(Math.min(w, pos.week));
  }, [pos.week]);

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const week = session?.effective_week ?? requestedWeek ?? eff.week;
  const dayType = session?.day_type ?? dayTypeFor(today);
  const plan = useMemo(() => buildSession(dayType, week), [dayType, week]);
  const steps = plan.steps;

  const [stepIndex, setStepIndex] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null); // running timer
  const [remaining, setRemaining] = useState<number | null>(null); // paused timer
  const [paused, setPaused] = useState(false);
  const [reps, setReps] = useState<Record<number, number>>({});
  const [skipped, setSkipped] = useState<number[]>([]);
  const [variants, setVariants] = useState<Record<string, "standard" | "easier">>({});
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [summary, setSummary] = useState(false);
  const lastCue = useRef<number>(-1);
  const lastTick = useRef<number>(Date.now());
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const step = steps[stepIndex];
  const secs = step ? stepSeconds(step) : null;
  const timeLeft = endsAt !== null ? endsAt - now : remaining;

  const progressSnapshot = useCallback(
    (): WorkoutProgress => ({
      stepIndex,
      remainingMs: endsAt !== null ? Math.max(0, endsAt - Date.now()) : remaining,
      reps,
      skipped,
      variants,
      elapsedMs: elapsed,
    }),
    [stepIndex, endsAt, remaining, reps, skipped, variants, elapsed],
  );

  const persist = useCallback(
    (patch: Partial<WorkoutSession> = {}) => {
      if (!session) return;
      const next = { ...session, progress: progressSnapshot(), ...patch };
      const { updated_at: _u, ...rest } = next;
      save("workout_sessions", rest);
    },
    [session, progressSnapshot],
  );

  // Start the timer for a step.
  const enterStep = useCallback(
    (i: number, opts: { paused?: boolean; remainingMs?: number | null } = {}) => {
      const s = steps[i];
      if (!s) return;
      setStepIndex(i);
      lastCue.current = -1;
      const total = stepSeconds(s);
      const ms = opts.remainingMs ?? (total !== null ? total * 1000 : null);
      if (ms === null) {
        setEndsAt(null);
        setRemaining(null);
      } else if (opts.paused) {
        setEndsAt(null);
        setRemaining(ms);
      } else {
        setEndsAt(Date.now() + ms);
        setRemaining(null);
      }
      setPaused(!!opts.paused);
    },
    [steps],
  );

  const recordResult = useCallback(
    (i: number, wasSkipped: boolean) => {
      const s = steps[i];
      if (!session || !s || s.kind !== "exercise") return;
      const { key, variant } = resolveExerciseKey(s.key, getState().data.exercise_preferences, variants);
      save("exercise_results", {
        id: `${session.id}:${i}`,
        session_id: session.id,
        exercise_key: key,
        variant,
        round: s.round,
        target_reps: s.reps ?? null,
        actual_reps: s.reps ? (wasSkipped ? 0 : reps[i] ?? s.reps) : null,
        target_seconds: s.seconds ?? null,
        actual_seconds: s.seconds ? (wasSkipped ? 0 : s.seconds) : null,
        skipped: wasSkipped,
        deleted: false,
      });
    },
    [session, steps, reps, variants],
  );

  const goTo = useCallback(
    (i: number, from: "next" | "skip" | "prev" | "auto") => {
      if (from === "skip") {
        setSkipped((x) => (x.includes(stepIndex) ? x : [...x, stepIndex]));
        recordResult(stepIndex, true);
      } else if (from === "next" || from === "auto") {
        recordResult(stepIndex, false);
      }
      if (i >= steps.length) {
        setEndsAt(null);
        setSummary(true);
        return;
      }
      enterStep(Math.max(0, i), { paused: paused && from !== "auto" });
      if (sound && from === "auto") beep(1320, 0.35);
      if (from === "auto") vibrate([120, 60, 120]);
    },
    [stepIndex, steps.length, enterStep, paused, sound, recordResult],
  );

  // Ticker
  useEffect(() => {
    if (!session || summary) return;
    const t = setInterval(() => {
      const n = Date.now();
      const dt = n - lastTick.current;
      lastTick.current = n;
      setNow(n);
      if (!paused) setElapsed((e) => e + Math.min(dt, 5000));
    }, 200);
    return () => clearInterval(t);
  }, [session, paused, summary]);

  // Countdown cues and auto-advance for timed steps
  useEffect(() => {
    if (endsAt === null || paused || summary) return;
    const left = endsAt - now;
    const sec = Math.ceil(left / 1000);
    if (left <= 0) {
      goTo(stepIndex + 1, "auto");
      return;
    }
    if (sec <= 3 && sec !== lastCue.current) {
      lastCue.current = sec;
      if (sound) beep(880, 0.12);
    }
  }, [now, endsAt, paused, summary, stepIndex, sound, goTo]);

  // Persist progress on step change and periodically
  useEffect(() => {
    if (session && !summary) persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, paused]);
  useEffect(() => {
    if (!session || summary) return;
    const t = setInterval(() => persist(), 5000);
    const vis = () => document.visibilityState === "hidden" && persist();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [session, summary, persist]);

  // Keep the screen on during a workout where supported.
  useEffect(() => {
    if (!session || summary) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {});
    return () => {
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [session, summary]);

  function start(resume: boolean) {
    unlockAudio();
    if (resume && resumable?.progress) {
      const p = resumable.progress;
      setSession(resumable);
      setReps(p.reps ?? {});
      setSkipped(p.skipped ?? []);
      setVariants(p.variants ?? {});
      setElapsed(p.elapsedMs ?? 0);
      lastTick.current = Date.now();
      // Resume paused so the user is ready.
      setTimeout(() => enterStep(Math.min(p.stepIndex, steps.length - 1), { paused: true, remainingMs: p.remainingMs }), 0);
      return;
    }
    if (resumable) {
      const { updated_at: _u, ...old } = resumable;
      save("workout_sessions", { ...old, status: "abandoned", progress: null });
    }
    const s: WorkoutSession = {
      id: `${today}-${Math.random().toString(36).slice(2, 8)}`,
      local_date: today,
      cycle_id: pos.cycle?.id ?? null,
      program_week: pos.week,
      effective_week: week,
      day_type: dayTypeFor(today),
      status: "in_progress",
      started_at: new Date().toISOString(),
      completed_at: null,
      duration_seconds: null,
      fatigue: null,
      pain: null,
      recovery: null,
      notes: null,
      progress: null,
      updated_at: "",
    };
    const { updated_at: _u, ...row } = s;
    save("workout_sessions", row);
    setSession(s);
    lastTick.current = Date.now();
    enterStep(0);
    if (sound) beep(1320, 0.2);
  }

  function togglePause() {
    unlockAudio();
    if (paused) {
      if (remaining !== null) setEndsAt(Date.now() + remaining);
      setRemaining(null);
      setPaused(false);
      lastTick.current = Date.now();
    } else {
      if (endsAt !== null) setRemaining(Math.max(0, endsAt - Date.now()));
      setEndsAt(null);
      setPaused(true);
    }
  }

  // ------------------------------------------------------------------ intro
  if (!session) {
    return (
      <main className="safe-top mx-auto max-w-xl px-4 pb-10 fade-in">
        <button type="button" onClick={() => router.push("/workout/")} className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
          <ChevronLeft size={20} aria-hidden /> Workout
        </button>
        <h1 className="text-[28px] font-bold">{plan.title}</h1>
        <p className="text-muted">
          Week {week} · {DAY_TYPE_LABEL[dayType]} · about {plan.estimatedMinutes} min
        </p>
        <Card className="mt-4">
          <ul className="space-y-1 text-[15px]">
            <li>1. Warm-up (~4 min)</li>
            <li>2. Main set with timed rests</li>
            <li>3. Cooldown and stretching (~5 min)</li>
          </ul>
          <p className="mt-3 text-sm text-muted">
            Sound cues and vibration work only while FitFlow is open on screen (vibration is not available on iPhone). If iOS
            suspends the app, the timer catches up when you return; your progress is saved.
          </p>
        </Card>
        <div className="mt-4 space-y-2">
          {resumable && (
            <Button size="lg" className="w-full" onClick={() => start(true)}>
              <Play size={20} aria-hidden /> Resume where you stopped (step {(resumable.progress?.stepIndex ?? 0) + 1})
            </Button>
          )}
          <Button size="lg" variant={resumable ? "secondary" : "primary"} className="w-full" onClick={() => start(false)}>
            <Play size={20} aria-hidden /> {resumable ? "Start over" : "Start workout"}
          </Button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------- summary
  if (summary) return <Summary session={session} steps={steps} reps={reps} skipped={skipped} elapsed={elapsed} today={today} onDone={() => router.push("/workout/")} />;

  // ----------------------------------------------------------------- player
  const ex = step.kind === "exercise" ? step : null;
  const resolved = ex ? resolveExerciseKey(ex.key, state.data.exercise_preferences, variants) : null;
  const exInfo = resolved ? EXERCISES[resolved.key] : step.kind === "rest" && step.nextKey ? EXERCISES[resolveExerciseKey(step.nextKey, state.data.exercise_preferences, variants).key] : null;
  const pct = (stepIndex / steps.length) * 100;
  const phaseLabel = step.phase === "warmup" ? "Warm-up" : step.phase === "cooldown" ? "Cooldown" : ex?.block ?? "Main set";
  const repCount = ex?.reps ? reps[stepIndex] ?? ex.reps : null;

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            persist();
            router.push("/workout/");
          }}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent"
        >
          <ChevronLeft size={20} aria-hidden /> Save &amp; exit
        </button>
        <span className="tabular text-sm text-muted" aria-label="Elapsed time">{fmt(elapsed)}</span>
        <button type="button" onClick={() => setSound(!sound)} aria-label={sound ? "Mute sound cues" : "Turn on sound cues"} className="grid h-11 w-11 place-items-center rounded-full bg-card">
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>
      <div className="mt-1">
        <ProgressBar value={pct} label="Workout progress" />
        <p className="mt-1 text-sm text-muted">
          {phaseLabel}
          {ex && ex.rounds > 1 && ` · Round ${ex.round} of ${ex.rounds}`} · Step {stepIndex + 1} of {steps.length}
        </p>
      </div>

      <section className="flex flex-1 flex-col items-center justify-center py-4 text-center" aria-live="polite">
        {step.kind === "rest" ? (
          <>
            <p className="text-lg font-semibold text-muted">{step.label}</p>
            <p className="tabular text-[84px] font-bold leading-none" data-testid="timer">{fmt(timeLeft ?? 0)}</p>
            {exInfo && <p className="mt-3 text-[15px]">Next: <strong>{exInfo.name}</strong></p>}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => (endsAt !== null ? setEndsAt(endsAt + 15000) : setRemaining((r) => (r ?? 0) + 15000))}>
                +15 s
              </Button>
              <Button variant="secondary" onClick={() => goTo(stepIndex + 1, "next")}>Skip rest</Button>
            </div>
          </>
        ) : (
          <>
            {exInfo && <Figure pose={exInfo.pose} label={`${exInfo.name} illustration`} animate={!paused} />}
            <h1 className="mt-2 text-[26px] font-bold leading-tight" data-testid="exercise-name">{exInfo?.name}</h1>
            <p className="text-muted">
              {describeTarget(ex!)}
              {ex!.tempo && ` · ${ex!.tempo}`}
            </p>
            {secs !== null ? (
              <p className="tabular mt-2 text-[72px] font-bold leading-none" data-testid="timer">{fmt(timeLeft ?? 0)}</p>
            ) : (
              <div className="mt-3 flex items-center gap-4">
                <button type="button" aria-label="One less rep" onClick={() => setReps({ ...reps, [stepIndex]: Math.max(0, (repCount ?? 0) - 1) })} className="grid h-14 w-14 place-items-center rounded-full bg-card ring-1 ring-line">
                  <Minus />
                </button>
                <div>
                  <p className="tabular text-[64px] font-bold leading-none" data-testid="rep-count">{repCount}</p>
                  <p className="text-xs text-muted">reps done{ex!.perSide ? " per leg" : ""}</p>
                </div>
                <button type="button" aria-label="One more rep" onClick={() => setReps({ ...reps, [stepIndex]: (repCount ?? 0) + 1 })} className="grid h-14 w-14 place-items-center rounded-full bg-card ring-1 ring-line">
                  <Plus />
                </button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowInfo(true)}>
                <Info size={16} aria-hidden /> How to
              </Button>
              {resolved && exInfo && <WatchLink exerciseKey={resolved.key} name={exInfo.name} />}
              {EXERCISES[ex!.key]?.easier && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setVariants({ ...variants, [ex!.key]: resolved?.variant === "easier" ? "standard" : "easier" })}
                >
                  {resolved?.variant === "easier" ? "Use standard version" : "Use easier version"}
                </Button>
              )}
            </div>
            {secs === null && (
              <Button size="lg" className="mt-4 w-full max-w-xs" onClick={() => goTo(stepIndex + 1, "next")}>
                Done — next
              </Button>
            )}
          </>
        )}
        {paused && <Notice tone="warn">Paused</Notice>}
      </section>

      <div className="grid grid-cols-4 gap-2">
        <Button variant="secondary" aria-label="Previous exercise" onClick={() => goTo(Math.max(0, stepIndex - 1), "prev")} disabled={stepIndex === 0}>
          <SkipBack size={20} aria-hidden />
        </Button>
        <Button aria-label={paused ? "Resume" : "Pause"} onClick={togglePause} disabled={secs === null}>
          {paused ? <Play size={20} aria-hidden /> : <Pause size={20} aria-hidden />}
        </Button>
        <Button variant="secondary" aria-label="Skip exercise" onClick={() => goTo(stepIndex + 1, "skip")}>
          <SkipForward size={20} aria-hidden />
        </Button>
        <Button variant="danger" aria-label="Finish workout" onClick={() => { setEndsAt(null); setSummary(true); }}>
          <Square size={18} aria-hidden />
        </Button>
      </div>
      <p className="mt-1 grid grid-cols-4 text-center text-[11px] text-muted" aria-hidden>
        <span>Previous</span>
        <span>{paused ? "Resume" : "Pause"}</span>
        <span>Skip</span>
        <span>Finish</span>
      </p>

      <Sheet open={showInfo} onClose={() => setShowInfo(false)} title={exInfo?.name ?? ""}>
        {exInfo && <ExerciseDetails ex={exInfo} />}
      </Sheet>
    </main>
  );
}

function Summary({
  session,
  steps,
  reps,
  skipped,
  elapsed,
  today,
  onDone,
}: {
  session: WorkoutSession;
  steps: Step[];
  reps: Record<number, number>;
  skipped: number[];
  elapsed: number;
  today: string;
  onDone: () => void;
}) {
  const exerciseSteps = steps.map((s, i) => [s, i] as const).filter(([s]) => s.kind === "exercise" && s.phase === "main") as Array<readonly [ExerciseStep, number]>;
  const done = exerciseSteps.filter(([, i]) => !skipped.includes(i));
  const totalReps = done.reduce((n, [s, i]) => n + (s.reps ? (reps[i] ?? s.reps) * (s.perSide ? 2 : 1) : 0), 0);
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(false);
  const [recovery, setRecovery] = useState<"good" | "ok" | "poor">("good");
  const [notes, setNotes] = useState("");

  function finish() {
    const { updated_at: _u, ...rest } = session;
    save("workout_sessions", {
      ...rest,
      status: "completed",
      completed_at: new Date().toISOString(),
      duration_seconds: Math.round(elapsed / 1000),
      fatigue,
      pain,
      recovery,
      notes: notes.trim() || null,
      progress: null,
    });
    if (session.local_date === today) {
      setTaskStatus(today, "workout", "completed");
      setTaskStatus(today, "cooldown", "completed");
      if (!getState().data.task_completions[`${today}:prep`]) setTaskStatus(today, "prep", "completed");
    }
    onDone();
  }

  return (
    <main className="safe-top mx-auto max-w-xl px-4 pb-10 fade-in">
      <h1 className="text-[28px] font-bold">Session complete</h1>
      <p className="text-muted">Nice work. Record how it felt so the program can stay safe.</p>
      <Card className="mt-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Time" value={`${Math.round(elapsed / 60000)} min`} />
          <Stat label="Exercises" value={`${done.length}/${exerciseSteps.length}`} sub={`${skipped.length} skipped`} />
          <Stat label="Total reps" value={totalReps} />
        </div>
      </Card>
      <Card className="mt-4 space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">How tired are you? (1 = easy, 5 = exhausted)</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((f) => (
              <button key={f} type="button" aria-pressed={fatigue === f} onClick={() => setFatigue(f)} className={cx("min-h-12 rounded-xl text-lg font-bold ring-1 ring-line", fatigue === f ? "bg-accent text-accentfg" : "bg-card2")}>
                {f}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">Any pain (not normal muscle effort)?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[false, true].map((p) => (
              <button key={String(p)} type="button" aria-pressed={pain === p} onClick={() => setPain(p)} className={cx("min-h-12 rounded-xl font-semibold ring-1 ring-line", pain === p ? "bg-accent text-accentfg" : "bg-card2")}>
                {p ? "Yes, some pain" : "No pain"}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-muted">Recovery since the last session</legend>
          <div className="grid grid-cols-3 gap-2">
            {(["good", "ok", "poor"] as const).map((r) => (
              <button key={r} type="button" aria-pressed={recovery === r} onClick={() => setRecovery(r)} className={cx("min-h-12 rounded-xl font-semibold capitalize ring-1 ring-line", recovery === r ? "bg-accent text-accentfg" : "bg-card2")}>
                {r}
              </button>
            ))}
          </div>
        </fieldset>
        {(pain || fatigue === 5 || recovery === "poor") && (
          <Notice tone="warn">
            FitFlow will not raise the intensity for your next session. If pain is sharp or lasts, stop that exercise and consider
            seeing a health professional.
          </Notice>
        )}
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Button size="lg" className="w-full" onClick={finish}>
          Save workout
        </Button>
      </Card>
    </main>
  );
}
