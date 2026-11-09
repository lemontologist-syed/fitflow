"use client";
// User actions that touch several tables.
import { DEFAULT_TEMPLATE } from "./defaults";
import { mealTotals } from "./nutrition";
import { getState, remove, save } from "./store";
import type { MealItem, MealLog, MealSlot, TaskCompletion } from "./types";

export function setTaskStatus(date: string, itemId: string, status: TaskCompletion["status"] | null) {
  const id = `${date}:${itemId}`;
  if (status === null) {
    if (getState().data.task_completions[id]) remove("task_completions", id);
    return;
  }
  save("task_completions", { id, local_date: date, item_id: itemId, status, deleted: false });
}

export function defaultTemplateFor(slot: MealSlot) {
  const s = getState();
  const t = s.data.meal_templates[DEFAULT_TEMPLATE[slot]];
  if (t && !t.deleted) return t;
  return Object.values(s.data.meal_templates).find((x) => !x.deleted && x.slot === slot);
}

/** The meal log for a date/slot, or a fresh one from the default template (not saved). */
export function mealDraft(date: string, slot: MealSlot): MealLog {
  const s = getState();
  const existing = s.data.meal_logs[`${date}:${slot}`];
  if (existing && !existing.deleted) return existing;
  const t = defaultTemplateFor(slot);
  return {
    id: `${date}:${slot}`,
    local_date: date,
    slot,
    template_id: t?.id ?? null,
    items: t ? t.items.map((i) => ({ ...i })) : [],
    checked: [],
    kcal: null,
    protein_g: null,
    status: "planned",
    updated_at: "",
  };
}

export function saveMeal(log: MealLog, patch: Partial<MealLog>) {
  const next = { ...log, ...patch };
  const totals = mealTotals(next.items, getState().data.foods);
  const { updated_at: _u, ...rest } = next;
  save("meal_logs", { ...rest, kcal: totals.kcal, protein_g: totals.protein, deleted: false });
  // Keep the routine timeline in step with the meal status.
  if (patch.status === "eaten") setTaskStatus(log.local_date, log.slot, "completed");
  else if (patch.status === "skipped") setTaskStatus(log.local_date, log.slot, "skipped");
  else if (patch.status === "planned") setTaskStatus(log.local_date, log.slot, null);
}

export function applyTemplate(log: MealLog, templateId: string): MealLog {
  const t = getState().data.meal_templates[templateId];
  return { ...log, template_id: templateId, items: t ? t.items.map((i: MealItem) => ({ ...i })) : [], checked: [] };
}

export function saveWeight(date: string, kg: number) {
  save("weight_logs", { id: date, local_date: date, weight_kg: Math.round(kg * 10) / 10, deleted: false });
}
