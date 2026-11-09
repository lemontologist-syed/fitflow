"use client";
import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { addDays, daysBetween, mondayOf } from "@shared/zoned.ts";
import { BarChart, LineChart } from "@/components/Charts";
import { Button, Card, Field, Notice, Page, SectionTitle, Stat, inputClass, shareOrDownload } from "@/components/ui";
import { saveWeight } from "@/lib/actions";
import { exportCombinedCsv, exportJson } from "@/lib/exporters";
import { formatDateShort, useClock } from "@/lib/hooks";
import { dayTotals } from "@/lib/nutrition";
import { dayTypeFor, programPosition } from "@/lib/program";
import { liveList } from "@/lib/state";
import { getState, remove, useAppState } from "@/lib/store";

export default function ProgressPage() {
  const state = useAppState();
  const { today } = useClock();
  const profile = state.data.profiles.me;
  const weights = liveList(state, "weight_logs").sort((a, b) => a.local_date.localeCompare(b.local_date));
  const todays = state.data.weight_logs[today];
  const [input, setInput] = useState(todays && !todays.deleted ? String(todays.weight_kg) : "");
  const [msg, setMsg] = useState<string | null>(null);
  const current = weights.length ? weights[weights.length - 1].weight_kg : null;
  const change = current != null ? Math.round((current - profile.start_weight_kg) * 10) / 10 : null;

  // Weekly averages (Monday-based weeks)
  const weekly = new Map<string, number[]>();
  for (const w of weights) {
    const k = mondayOf(w.local_date);
    weekly.set(k, [...(weekly.get(k) ?? []), w.weight_kg]);
  }
  const weeklyRows = [...weekly.entries()].map(([wk, v]) => ({ wk, avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10, n: v.length }));

  // Adherence since the cycle start (up to today)
  const cycles = liveList(state, "training_cycles");
  const pos = programPosition(today, cycles);
  const start = pos.cycle && pos.cycle.start_date <= today ? pos.cycle.start_date : today;
  const days: string[] = [];
  for (let d = start; d <= today && days.length < 400; d = addDays(d, 1)) days.push(d);
  const sessions = liveList(state, "workout_sessions").filter((s) => s.status === "completed");
  const workoutDays = days.filter((d) => dayTypeFor(d) !== "rest");
  const doneDays = new Set(sessions.map((s) => s.local_date));
  const workoutAdh = workoutDays.length ? Math.round((workoutDays.filter((d) => doneDays.has(d)).length / workoutDays.length) * 100) : 0;
  const mealLogs = liveList(state, "meal_logs");
  const eatenMeals = mealLogs.filter((m) => m.status === "eaten" && m.local_date >= start && m.local_date <= today).length;
  const mealAdh = days.length ? Math.round((eatenMeals / (days.length * 3)) * 100) : 0;

  const last14: string[] = [];
  for (let i = 13; i >= 0; i--) last14.push(addDays(today, -i));
  const totals = last14.map((d) => ({ d, t: dayTotals(mealLogs, d, state.data.foods) }));

  function logWeight() {
    const v = Number(input.replace(",", "."));
    if (!Number.isFinite(v) || v < 20 || v > 400) {
      setMsg("Enter a weight between 20 and 400 kg.");
      return;
    }
    saveWeight(today, v);
    setMsg(`Saved ${Math.round(v * 10) / 10} kg for today.`);
  }

  return (
    <Page title="Progress">
      <Card>
        <SectionTitle>Morning weight</SectionTitle>
        <div className="flex items-end gap-2">
          <Field label={`Today (${formatDateShort(today)}) in kg`}>
            <input
              className={inputClass}
              inputMode="decimal"
              type="number"
              step="0.1"
              min={20}
              max={400}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
              placeholder="e.g. 79.6"
            />
          </Field>
          <Button onClick={logWeight}>Save</Button>
        </div>
        {msg && <p className="mt-2 text-sm" role="status">{msg}</p>}
        <p className="mt-2 text-xs text-muted">Weigh yourself at the same time each morning, after the bathroom, before eating.</p>
      </Card>

      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Start" value={`${profile.start_weight_kg} kg`} />
          <Stat label="Current" value={current != null ? `${current} kg` : "—"} sub={change != null ? `${change > 0 ? "+" : ""}${change} kg` : undefined} />
          <Stat label="Goal" value={`${profile.goal_weight_kg} kg`} />
        </div>
        <div className="mt-3">
          <LineChart points={weights.map((w) => ({ date: w.local_date, value: w.weight_kg }))} goal={profile.goal_weight_kg} unit="kg" label="Weight history" />
        </div>
        <p className="mt-2 text-xs text-muted">
          This shows what you actually logged. Day-to-day weight moves with water and food; weekly averages are more meaningful.
          A safe pace for most adults is roughly 0.5–1 kg per week; FitFlow does not predict or guarantee results.
        </p>
      </Card>

      {weeklyRows.length > 0 && (
        <Card>
          <SectionTitle>Weekly average weight</SectionTitle>
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Week of</th>
                <th className="py-1 font-medium">Average</th>
                <th className="py-1 font-medium">Entries</th>
              </tr>
            </thead>
            <tbody>
              {weeklyRows.map((r) => (
                <tr key={r.wk} className="border-t border-line">
                  <td className="py-1">{formatDateShort(r.wk)}</td>
                  <td className="tabular py-1 font-semibold">{r.avg} kg</td>
                  <td className="tabular py-1">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <SectionTitle>Adherence since {formatDateShort(start)}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Workouts" value={`${workoutAdh}%`} sub={`${workoutDays.filter((d) => doneDays.has(d)).length}/${workoutDays.length} days`} />
          <Stat label="Sessions" value={sessions.length} sub="completed" />
          <Stat label="Meals eaten" value={`${mealAdh}%`} sub={`${eatenMeals}/${days.length * 3}`} />
        </div>
        <p className="mt-2 text-xs text-muted">Day {Math.max(1, daysBetween(start, today) + 1)} of the current period.</p>
      </Card>

      <Card>
        <SectionTitle>Calories — last 14 days</SectionTitle>
        <BarChart points={totals.map(({ d, t }) => ({ date: d, value: t.kcal }))} band={[profile.kcal_target_min, profile.kcal_target_max]} unit="kcal" label="Daily calories from meals marked eaten" />
      </Card>
      <Card>
        <SectionTitle>Protein — last 14 days</SectionTitle>
        <BarChart points={totals.map(({ d, t }) => ({ date: d, value: Math.round(t.protein) }))} band={[profile.protein_target_min, profile.protein_target_max]} unit="g" label="Daily protein from meals marked eaten" />
      </Card>

      <Card>
        <SectionTitle>Weight log</SectionTitle>
        {weights.length === 0 ? (
          <p className="text-sm text-muted">No entries yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {[...weights].reverse().slice(0, 30).map((w) => (
              <li key={w.id} className="flex items-center justify-between py-1">
                <span>{formatDateShort(w.local_date)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular font-semibold">{w.weight_kg} kg</span>
                  <button type="button" aria-label={`Delete ${w.local_date} entry`} onClick={() => remove("weight_logs", w.id)} className="grid h-10 w-10 place-items-center text-muted">
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Export your history</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => void shareOrDownload(`fitflow-history-${today}.csv`, exportCombinedCsv(getState()), "text/csv")}>
            <Download size={18} aria-hidden /> CSV
          </Button>
          <Button variant="secondary" onClick={() => void shareOrDownload(`fitflow-backup-${today}.json`, exportJson(getState()), "application/json")}>
            <Download size={18} aria-hidden /> JSON
          </Button>
        </div>
        <Notice>On iPhone the share sheet opens: choose “Save to Files”.</Notice>
      </Card>
    </Page>
  );
}
