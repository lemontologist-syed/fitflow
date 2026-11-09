import type { Food, MealItem, MealLog, MealSlot, MealTemplate } from "./types";

export interface Totals {
  kcal: number;
  protein: number;
}

export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function itemTotals(item: MealItem, foods: Record<string, Food>): Totals {
  const f = foods[item.food_id];
  if (!f || f.deleted || !Number.isFinite(item.qty)) return { kcal: 0, protein: 0 };
  return { kcal: f.kcal * item.qty, protein: f.protein_g * item.qty };
}

export function mealTotals(items: MealItem[], foods: Record<string, Food>): Totals {
  const t = items.reduce(
    (acc, it) => {
      const x = itemTotals(it, foods);
      return { kcal: acc.kcal + x.kcal, protein: acc.protein + x.protein };
    },
    { kcal: 0, protein: 0 },
  );
  return { kcal: Math.round(t.kcal), protein: Math.round(t.protein * 10) / 10 };
}

/** Totals of meals marked as eaten on a date. */
export function dayTotals(logs: MealLog[], date: string, foods: Record<string, Food>): Totals & { eaten: number; skipped: number } {
  const day = logs.filter((l) => !l.deleted && l.local_date === date);
  const eaten = day.filter((l) => l.status === "eaten");
  const t = eaten.reduce(
    (acc, l) => {
      const x = l.kcal != null && l.protein_g != null ? { kcal: l.kcal, protein: l.protein_g } : mealTotals(l.items, foods);
      return { kcal: acc.kcal + x.kcal, protein: acc.protein + x.protein };
    },
    { kcal: 0, protein: 0 },
  );
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein * 10) / 10,
    eaten: eaten.length,
    skipped: day.filter((l) => l.status === "skipped").length,
  };
}

/** Planned totals for a day: logged meals as edited, other slots from defaults. */
export function plannedDayTotals(
  logs: MealLog[],
  date: string,
  defaults: Record<MealSlot, MealTemplate | undefined>,
  foods: Record<string, Food>,
): Totals {
  let kcal = 0;
  let protein = 0;
  for (const slot of SLOTS) {
    const log = logs.find((l) => !l.deleted && l.local_date === date && l.slot === slot);
    if (log?.status === "skipped") continue;
    const items = log ? log.items : (defaults[slot]?.items ?? []);
    const t = mealTotals(items, foods);
    kcal += t.kcal;
    protein += t.protein;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein * 10) / 10 };
}

/** Step size for the portion editor, based on the food unit. */
export function qtyStep(food: Food | undefined): number {
  if (!food) return 0.5;
  return /100\s*(g|ml)/i.test(food.unit) ? 0.1 : 0.5;
}

export function formatQty(qty: number, food: Food | undefined): string {
  if (!food) return String(qty);
  const m = /^100\s*(g|ml)$/i.exec(food.unit.trim());
  if (m) return `${Math.round(qty * 100)} ${m[1]}`;
  const n = Math.round(qty * 100) / 100;
  return `${n} × ${food.unit}`;
}
