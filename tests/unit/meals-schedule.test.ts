import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, defaultFoods, defaultSchedule, defaultTemplates } from "@/lib/defaults";
import { dayTotals, formatQty, mealTotals, plannedDayTotals } from "@/lib/nutrition";
import { completionPercent, greeting, nextUpcoming, timeline } from "@/lib/schedule";
import type { Food, MealLog } from "@/lib/types";

const foods: Record<string, Food> = Object.fromEntries(defaultFoods().map((f) => [f.id, f]));
const templates = Object.fromEntries(defaultTemplates().map((t) => [t.id, t]));

describe("calorie calculations (estimates)", () => {
  it("overnight oats with water ≈ 585–600 kcal", () => {
    const t = mealTotals(templates["lunch-overnight-oats"].items, foods);
    expect(t.kcal).toBeGreaterThanOrEqual(570);
    expect(t.kcal).toBeLessThanOrEqual(600);
    expect(t.protein).toBeGreaterThan(35);
  });

  it("matches the recipe quantities", () => {
    const items = Object.fromEntries(templates["lunch-overnight-oats"].items.map((i) => [i.food_id, i.qty]));
    expect(formatQty(items.oats, foods.oats)).toBe("40 g");
    expect(formatQty(items["greek-yogurt"], foods["greek-yogurt"])).toBe("170 g");
    expect(formatQty(items.chia, foods.chia)).toBe("10 g");
    expect(formatQty(items.sesame, foods.sesame)).toBe("5 g");
    expect(items.banana).toBe(0.5);
    expect(items.orange).toBe(0.5);
    expect(items.egg).toBe(2);
    expect(formatQty(items.water, foods.water)).toBe("90 ml");
  });

  it("the default day lands in the 1,800–2,000 kcal and 110–130 g protein targets", () => {
    const d = plannedDayTotals(
      [],
      "2026-11-10",
      {
        breakfast: templates[DEFAULT_TEMPLATE.breakfast],
        lunch: templates[DEFAULT_TEMPLATE.lunch],
        dinner: templates[DEFAULT_TEMPLATE.dinner],
      },
      foods,
    );
    expect(d.kcal).toBeGreaterThanOrEqual(1800);
    expect(d.kcal).toBeLessThanOrEqual(2000);
    expect(d.protein).toBeGreaterThanOrEqual(110);
    expect(d.protein).toBeLessThanOrEqual(130);
  });

  it("portion edits change totals, and only eaten meals count in the day log", () => {
    const base = mealTotals([{ food_id: "chicken", qty: 1 }], foods);
    const double = mealTotals([{ food_id: "chicken", qty: 2 }], foods);
    expect(double.kcal).toBe(base.kcal * 2);
    const logs: MealLog[] = [
      { id: "2026-11-10:breakfast", local_date: "2026-11-10", slot: "breakfast", template_id: null, items: [{ food_id: "egg", qty: 2 }], checked: [], kcal: 156, protein_g: 12.6, status: "eaten", updated_at: "" },
      { id: "2026-11-10:lunch", local_date: "2026-11-10", slot: "lunch", template_id: null, items: [{ food_id: "egg", qty: 2 }], checked: [], kcal: 156, protein_g: 12.6, status: "skipped", updated_at: "" },
    ];
    expect(dayTotals(logs, "2026-11-10", foods)).toEqual({ kcal: 156, protein: 12.6, eaten: 1, skipped: 1 });
  });

  it("ignores unknown or deleted foods", () => {
    expect(mealTotals([{ food_id: "nope", qty: 3 }], foods)).toEqual({ kcal: 0, protein: 0 });
  });
});

describe("daily timeline", () => {
  const items = defaultSchedule();

  it("marks completed, skipped, missed, in-progress and upcoming states", () => {
    const t = timeline(
      items,
      [
        { id: "a", local_date: "2026-11-10", item_id: "wake", status: "completed", updated_at: "" },
        { id: "b", local_date: "2026-11-10", item_id: "prep", status: "skipped", updated_at: "" },
      ],
      "2026-11-10",
      9 * 60 + 10, // 09:10
    );
    const s = Object.fromEntries(t.map((e) => [e.item.id, e.state]));
    expect(s).toMatchObject({
      wake: "completed",
      prep: "skipped",
      workout: "missed",
      cooldown: "missed",
      breakfast: "in_progress",
      lunch: "upcoming",
      sleep: "upcoming",
    });
    expect(nextUpcoming(t)?.item.id).toBe("breakfast");
    expect(completionPercent(t)).toBe(10);
  });

  it("drops workout items on Sunday", () => {
    const t = timeline(items, [], "2026-11-15", null);
    expect(t.map((e) => e.item.id)).not.toContain("workout");
    expect(t).toHaveLength(7);
  });

  it("greets by time of day", () => {
    expect(greeting(7)).toBe("Good Morning");
    expect(greeting(13)).toBe("Good Afternoon");
    expect(greeting(20)).toBe("Good Evening");
  });
});
