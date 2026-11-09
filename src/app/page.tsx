"use client";
import { BellRing, Check, ChevronRight, Dumbbell, RotateCcw, SkipForward, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatTime12 } from "@shared/reminders.ts";
import { Button, Card, Notice, Page, ProgressBar, SectionTitle, Stat, cx } from "@/components/ui";
import StateBadge from "@/components/StateIcon";
import { setTaskStatus } from "@/lib/actions";
import { formatDateLong, useClock, useLatestWeight } from "@/lib/hooks";
import { DAY_TYPE_LABEL, dayTypeFor, effectiveWeek, newCycle, programPosition } from "@/lib/program";
import { snooze } from "@/lib/push";
import { completionPercent, greeting, nextUpcoming, timeline } from "@/lib/schedule";
import { liveList } from "@/lib/state";
import { save, useAppState } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";

export default function TodayPage() {
  const state = useAppState();
  const { today, minutes, hour } = useClock();
  const weight = useLatestWeight();
  const sync = useSyncStatus();
  const profile = state.data.profiles.me;
  const [focus, setFocus] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("focus");
    if (f) {
      setFocus(f);
      setTimeout(() => document.getElementById(`item-${f}`)?.scrollIntoView({ block: "center" }), 100);
    }
  }, []);

  const items = liveList(state, "schedule_items");
  const completions = liveList(state, "task_completions");
  const cycles = liveList(state, "training_cycles");
  const sessions = liveList(state, "workout_sessions");
  const entries = useMemo(() => timeline(items, completions, today, minutes), [items, completions, today, minutes]);
  const next = nextUpcoming(entries);
  const pct = completionPercent(entries);
  const pos = programPosition(today, cycles);
  const eff = effectiveWeek(pos.week, sessions, today);
  const dayType = dayTypeFor(today);
  const todaySession = sessions.find((s) => s.local_date === today);
  const lunch = entries.find((e) => e.item.kind === "lunch");
  const pushOn = state.data.reminder_preferences.me?.push_enabled && sync.signedIn;

  const endChoice = pos.status === "after" && pos.cycle?.status === "active";

  return (
    <Page title={greeting(hour)} subtitle={formatDateLong(today)}>
      {endChoice && pos.cycle && (
        <Card className="ring-1 ring-accent/40">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{pos.cycle.label} is complete</h2>
              <p className="mt-1 text-sm text-muted">
                Keep your routine with Week 4 workouts, or start a fresh four-week cycle next Monday.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => save("training_cycles", { ...pos.cycle!, status: "maintenance" })}>
                  Continue routine
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    save("training_cycles", { ...pos.cycle!, status: "completed" });
                    const c = newCycle(today, cycles.length + 1, new Date().toISOString());
                    save("training_cycles", c);
                  }}
                >
                  Start new cycle
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Current" value={weight != null ? `${weight} kg` : "—"} sub={weight == null ? "Log on Progress" : "latest"} />
          <Stat label="Goal" value={`${profile.goal_weight_kg} kg`} sub={`from ${profile.start_weight_kg} kg`} />
          <Stat
            label="Program"
            value={pos.status === "before" ? "Starts" : pos.status === "after" ? "Done" : `Week ${pos.week}`}
            sub={pos.status === "before" ? pos.cycle?.start_date : pos.status === "after" ? "maintenance" : `${pos.daysLeft} days left`}
          />
        </div>
        <div className="mt-3 rounded-2xl bg-card2 p-3">
          <p className="text-sm text-muted">Today&apos;s workout</p>
          <p className="font-semibold">
            {DAY_TYPE_LABEL[dayType]}
            {dayType !== "rest" && ` · Week ${eff.week}`}
            {todaySession?.status === "completed" && " · done ✓"}
          </p>
          {eff.held && <p className="mt-1 text-sm text-warn">{eff.reason}</p>}
        </div>
        {next ? (
          <div className="mt-3" aria-live="polite">
            <p className="text-xl font-bold">
              Next: {next.item.title} <span className="tabular text-accent">{formatTime12(next.item.time_local)}</span>
            </p>
            {lunch && next.item.kind !== "lunch" && lunch.state === "upcoming" && (
              <p className="text-sm text-muted">Overnight oats are planned for lunch at {formatTime12(lunch.item.time_local)}.</p>
            )}
          </div>
        ) : (
          <p className="mt-3 font-semibold">All of today&apos;s activities are behind you. Rest well.</p>
        )}
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted">Today completed</span>
          <span className="tabular text-sm font-bold">{pct}%</span>
        </div>
        <ProgressBar value={pct} label="Today's completion" />
        {dayType !== "rest" && todaySession?.status !== "completed" && (
          <Link
            href="/workout/play/"
            className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-accent font-semibold text-accentfg"
          >
            <Dumbbell size={20} aria-hidden />
            {todaySession?.status === "in_progress" ? "Resume workout" : "Start today's workout"}
          </Link>
        )}
      </Card>

      {msg && <Notice>{msg}</Notice>}

      <section aria-labelledby="timeline-h">
        <SectionTitle>
          <span id="timeline-h">Timeline</span>
        </SectionTitle>
        <ol className="relative space-y-2">
          {entries.map(({ item, state: st }) => {
            const isMeal = item.kind === "breakfast" || item.kind === "lunch" || item.kind === "dinner";
            const isWorkout = item.kind === "workout";
            return (
              <li
                key={item.id}
                id={`item-${item.id}`}
                className={cx(
                  "rounded-2xl bg-card p-3",
                  st === "in_progress" && "ring-2 ring-accent",
                  focus === item.id && "ring-2 ring-warn",
                  st === "skipped" && "opacity-70",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="tabular w-[68px] shrink-0 pt-0.5 text-sm font-semibold">{formatTime12(item.time_local)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx("font-medium", st === "skipped" && "line-through")}>{item.title}</span>
                      <StateBadge state={st} />
                    </div>
                    {!item.reminder_enabled && <p className="text-xs text-muted">Reminder off</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(st === "upcoming" || st === "in_progress" || st === "missed") && (
                        <>
                          {isWorkout ? (
                            <Link href="/workout/play/" className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-accent px-3 text-sm font-semibold text-accentfg">
                              <Dumbbell size={16} aria-hidden /> Start
                            </Link>
                          ) : isMeal ? (
                            <Link href={`/meals/?slot=${item.kind}`} className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-accent px-3 text-sm font-semibold text-accentfg">
                              Log meal <ChevronRight size={16} aria-hidden />
                            </Link>
                          ) : (
                            <Button size="sm" onClick={() => setTaskStatus(today, item.id, "completed")} aria-label={`Mark ${item.title} done`}>
                              <Check size={16} aria-hidden /> Done
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setTaskStatus(today, item.id, "skipped")} aria-label={`Skip ${item.title}`}>
                            <SkipForward size={16} aria-hidden /> Skip
                          </Button>
                          {pushOn && st !== "upcoming" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={`Snooze ${item.title}`}
                              onClick={async () => {
                                const mins = state.data.reminder_preferences.me?.snooze_minutes ?? 10;
                                try {
                                  await snooze(item.id, item.title, today, mins);
                                  setMsg(`You'll get another reminder for “${item.title}” in about ${mins} minutes.`);
                                } catch (e) {
                                  setMsg(`Snooze failed: ${(e as Error).message}`);
                                }
                              }}
                            >
                              <BellRing size={16} aria-hidden /> Snooze
                            </Button>
                          )}
                        </>
                      )}
                      {(st === "completed" || st === "skipped") && (
                        <Button size="sm" variant="ghost" onClick={() => setTaskStatus(today, item.id, null)} aria-label={`Undo ${item.title}`}>
                          <RotateCcw size={16} aria-hidden /> Undo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <Link href="/settings/schedule/" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent">
          Edit schedule and reminder times <ChevronRight size={16} aria-hidden />
        </Link>
      </section>
    </Page>
  );
}
