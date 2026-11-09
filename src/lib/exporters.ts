import type { AppState, TableName } from "./types";
import { TABLES } from "./types";

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

const strip = (r: Record<string, unknown>) => {
  const { user_id: _u, server_updated_at: _s, ...rest } = r;
  return rest;
};

export function liveRows(state: AppState, table: TableName): Record<string, unknown>[] {
  return Object.values(state.data[table] as Record<string, { deleted?: boolean }>)
    .filter((r) => !r.deleted)
    .map((r) => strip(r as Record<string, unknown>));
}

/** Full JSON backup (all tables, live rows only). */
export function exportJson(state: AppState, now = new Date()): string {
  const out: Record<string, unknown> = { app: "FitFlow", exported_at: now.toISOString(), format: 1 };
  for (const t of TABLES) out[t] = liveRows(state, t);
  return JSON.stringify(out, null, 2);
}

/** History CSV files: weight, meals, workouts, routine. */
export function exportCsvFiles(state: AppState): Record<string, string> {
  const byDate = (a: Record<string, unknown>, b: Record<string, unknown>) =>
    String(a.local_date ?? "").localeCompare(String(b.local_date ?? ""));
  return {
    "fitflow-weight.csv": toCsv(liveRows(state, "weight_logs").sort(byDate), ["local_date", "weight_kg"]),
    "fitflow-meals.csv": toCsv(liveRows(state, "meal_logs").sort(byDate), [
      "local_date",
      "slot",
      "status",
      "kcal",
      "protein_g",
      "template_id",
      "items",
    ]),
    "fitflow-workouts.csv": toCsv(liveRows(state, "workout_sessions").sort(byDate), [
      "local_date",
      "day_type",
      "program_week",
      "effective_week",
      "status",
      "duration_seconds",
      "fatigue",
      "pain",
      "recovery",
      "notes",
    ]),
    "fitflow-routine.csv": toCsv(liveRows(state, "task_completions").sort(byDate), ["local_date", "item_id", "status"]),
  };
}

/** Combined CSV (one file) for a simple download on iPhone. */
export function exportCombinedCsv(state: AppState): string {
  const files = exportCsvFiles(state);
  return Object.entries(files)
    .map(([name, csv]) => `# ${name}\r\n${csv}`)
    .join("\r\n");
}
