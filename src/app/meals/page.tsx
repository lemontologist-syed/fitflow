"use client";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { addDays } from "@shared/zoned.ts";
import { formatTime12 } from "@shared/reminders.ts";
import { Button, Card, Field, Notice, Page, ProgressBar, SectionTitle, Sheet, cx, inputClass } from "@/components/ui";
import { applyTemplate, defaultTemplateFor, mealDraft, saveMeal } from "@/lib/actions";
import { formatDateLong, useClock } from "@/lib/hooks";
import { SLOTS, SLOT_LABEL, dayTotals, formatQty, mealTotals, plannedDayTotals, qtyStep } from "@/lib/nutrition";
import { liveList } from "@/lib/state";
import { remove, save, useAppState } from "@/lib/store";
import type { Food, FoodCategory, MealLog, MealSlot } from "@/lib/types";

const CATEGORIES: FoodCategory[] = ["protein", "dairy", "grain", "fruit", "vegetable", "fat", "seeds", "liquid", "other"];

export default function MealsPage() {
  const state = useAppState();
  const { today } = useClock();
  const [date, setDate] = useState(today);
  const [openSlot, setOpenSlot] = useState<MealSlot | null>(null);
  const [foodEdit, setFoodEdit] = useState<Food | null>(null);
  const profile = state.data.profiles.me;
  const foods = state.data.foods;
  const logs = liveList(state, "meal_logs");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("slot");
    if (s === "breakfast" || s === "lunch" || s === "dinner") setOpenSlot(s);
  }, []);

  const eaten = dayTotals(logs, date, foods);
  const planned = plannedDayTotals(
    logs,
    date,
    { breakfast: defaultTemplateFor("breakfast"), lunch: defaultTemplateFor("lunch"), dinner: defaultTemplateFor("dinner") },
    foods,
  );
  const timeOf = (slot: MealSlot) => state.data.schedule_items[slot]?.time_local;

  return (
    <Page title="Meals" subtitle={formatDateLong(date)}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={18} aria-hidden />
        </Button>
        <Button variant={date === today ? "primary" : "secondary"} size="sm" onClick={() => setDate(today)}>
          Today
        </Button>
        <Button variant="secondary" size="sm" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={18} aria-hidden />
        </Button>
      </div>

      <Card>
        <SectionTitle>Daily totals</SectionTitle>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm">
              <span>Calories eaten</span>
              <span className="tabular font-semibold" data-testid="kcal-eaten">
                {eaten.kcal} / {profile.kcal_target_min}–{profile.kcal_target_max} kcal
              </span>
            </div>
            <ProgressBar value={(eaten.kcal / profile.kcal_target_max) * 100} label="Calories eaten versus target" />
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span>Protein eaten</span>
              <span className="tabular font-semibold" data-testid="protein-eaten">
                {eaten.protein} / {profile.protein_target_min}–{profile.protein_target_max} g
              </span>
            </div>
            <ProgressBar value={(eaten.protein / profile.protein_target_max) * 100} label="Protein eaten versus target" />
          </div>
          <p className="text-xs text-muted">
            Planned for the day: about {planned.kcal} kcal and {planned.protein} g protein. All nutrition numbers are estimates;
            brands and portions vary. Targets are editable in Settings → Profile.
          </p>
        </div>
      </Card>

      {SLOTS.map((slot) => {
        const log = mealDraft(date, slot);
        const t = mealTotals(log.items, foods);
        const tmpl = log.template_id ? state.data.meal_templates[log.template_id] : null;
        const time = timeOf(slot);
        return (
          <Card key={slot} data-testid={`meal-${slot}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted">
                  {SLOT_LABEL[slot]}
                  {time && ` · ${formatTime12(time)}`}
                </p>
                <h2 className="text-lg font-semibold">{tmpl?.name ?? "Custom meal"}</h2>
                <p className="tabular text-sm text-muted">
                  ≈ {t.kcal} kcal · {t.protein} g protein
                </p>
              </div>
              <span
                className={cx(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                  log.status === "eaten" && "bg-accentsoft text-good",
                  log.status === "skipped" && "text-muted line-through ring-1 ring-line",
                  log.status === "planned" && "text-muted ring-1 ring-line",
                )}
              >
                {log.status === "eaten" ? "✓ Eaten" : log.status === "skipped" ? "Skipped" : "Planned"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpenSlot(slot)}>
                Recipe &amp; portions
              </Button>
              {log.status !== "eaten" && (
                <Button size="sm" onClick={() => saveMeal(log, { status: "eaten" })} aria-label={`Mark ${SLOT_LABEL[slot]} as eaten`}>
                  <Check size={16} aria-hidden /> Eaten
                </Button>
              )}
              {log.status === "planned" && (
                <Button size="sm" variant="secondary" onClick={() => saveMeal(log, { status: "skipped" })} aria-label={`Skip ${SLOT_LABEL[slot]}`}>
                  Skip
                </Button>
              )}
              {log.status !== "planned" && (
                <Button size="sm" variant="ghost" onClick={() => saveMeal(log, { status: "planned" })}>
                  Undo
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      <Card>
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => setFoodEdit({ id: `custom-${Date.now().toString(36)}`, name: "", unit: "100 g", kcal: 0, protein_g: 0, category: "other", is_custom: true, updated_at: "" })}>+ Add food</Button>}>
          Food database
        </SectionTitle>
        <p className="mb-2 text-sm text-muted">Edit any value to match your own products. Values are per the unit shown.</p>
        <ul className="divide-y divide-line text-sm">
          {liveList(state, "foods")
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setFoodEdit(f)} className="flex min-h-11 w-full items-center justify-between gap-2 text-left">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="tabular shrink-0 text-muted">
                    {f.unit}: {f.kcal} kcal · {f.protein_g} g
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </Card>

      {openSlot && <MealSheet key={`${date}-${openSlot}`} date={date} slot={openSlot} onClose={() => setOpenSlot(null)} />}
      {foodEdit && <FoodSheet food={foodEdit} onClose={() => setFoodEdit(null)} />}
    </Page>
  );
}

function MealSheet({ date, slot, onClose }: { date: string; slot: MealSlot; onClose: () => void }) {
  const state = useAppState();
  const foods = state.data.foods;
  const [log, setLog] = useState<MealLog>(() => mealDraft(date, slot));
  const [saved, setSaved] = useState<string | null>(null);
  const templates = liveList(state, "meal_templates").filter((t) => t.slot === slot);
  const tmpl = log.template_id ? state.data.meal_templates[log.template_id] : null;
  const totals = mealTotals(log.items, foods);
  const liveFoods = liveList(state, "foods").sort((a, b) => a.name.localeCompare(b.name));

  const update = (patch: Partial<MealLog>) => {
    const next = { ...log, ...patch };
    setLog(next);
    saveMeal(next, {});
  };
  const setQty = (i: number, qty: number) =>
    update({ items: log.items.map((it, j) => (j === i ? { ...it, qty: Math.max(0, Math.round(qty * 100) / 100) } : it)) });

  return (
    <Sheet open onClose={onClose} title={`${SLOT_LABEL[slot]} · ${formatDateLong(date).split(",")[0]}`}>
      <div className="space-y-4">
        <Field label="Meal">
          <select className={inputClass} value={log.template_id ?? ""} onChange={(e) => update(applyTemplate(log, e.target.value))}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <Card>
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold">Ingredients</h3>
            <span className="tabular text-sm font-semibold" data-testid="sheet-total">
              ≈ {totals.kcal} kcal · {totals.protein} g protein
            </span>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {log.items.map((it, i) => {
              const f = foods[it.food_id];
              const checked = log.checked.includes(`${i}:${it.food_id}`);
              const same = liveFoods.filter((x) => x.category === f?.category);
              return (
                <li key={`${i}-${it.food_id}`} className="py-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Have ${f?.name ?? it.food_id}`}
                      className="h-6 w-6 shrink-0 accent-[var(--accent)]"
                      checked={checked}
                      onChange={() =>
                        update({
                          checked: checked ? log.checked.filter((c) => c !== `${i}:${it.food_id}`) : [...log.checked, `${i}:${it.food_id}`],
                        })
                      }
                    />
                    <select
                      aria-label="Swap ingredient"
                      className="min-h-10 min-w-0 flex-1 truncate rounded-lg bg-transparent font-medium"
                      value={it.food_id}
                      onChange={(e) => update({ items: log.items.map((x, j) => (j === i ? { ...x, food_id: e.target.value } : x)) })}
                    >
                      {(same.length ? same : liveFoods).map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" aria-label={`Remove ${f?.name}`} onClick={() => update({ items: log.items.filter((_, j) => j !== i) })} className="grid h-10 w-10 place-items-center text-muted">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="ml-8 mt-1 flex items-center gap-2">
                    <button type="button" aria-label={`Less ${f?.name}`} onClick={() => setQty(i, it.qty - qtyStep(f))} className="grid h-10 w-10 place-items-center rounded-full bg-card2 ring-1 ring-line">
                      <Minus size={16} />
                    </button>
                    <span className="tabular min-w-24 text-center text-sm font-semibold">{formatQty(it.qty, f)}</span>
                    <button type="button" aria-label={`More ${f?.name}`} onClick={() => setQty(i, it.qty + qtyStep(f))} className="grid h-10 w-10 place-items-center rounded-full bg-card2 ring-1 ring-line">
                      <Plus size={16} />
                    </button>
                    <span className="tabular ml-auto text-xs text-muted">{f ? Math.round(f.kcal * it.qty) : 0} kcal</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <Field label="Add ingredient">
            <select
              className={inputClass}
              value=""
              onChange={(e) => e.target.value && update({ items: [...log.items, { food_id: e.target.value, qty: 1 }] })}
            >
              <option value="">Choose a food…</option>
              {liveFoods.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.unit})
                </option>
              ))}
            </select>
          </Field>
        </Card>

        {tmpl && tmpl.steps.length > 0 && (
          <Card>
            <h3 className="font-semibold">Recipe</h3>
            <ol className="ml-5 mt-2 list-decimal space-y-1 text-[15px]">
              {tmpl.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {tmpl.notes && <p className="mt-2 text-sm text-muted">{tmpl.notes}</p>}
          </Card>
        )}

        {saved && <Notice tone="good">{saved}</Notice>}

        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => { saveMeal(log, { status: "eaten" }); onClose(); }}>
            <Check size={18} aria-hidden /> Eaten
          </Button>
          <Button size="lg" variant="secondary" onClick={() => { saveMeal(log, { status: "skipped" }); onClose(); }}>
            Skip meal
          </Button>
        </div>
        {tmpl && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              const { updated_at: _u, ...rest } = tmpl;
              save("meal_templates", { ...rest, items: log.items.map((i) => ({ ...i })) });
              setSaved(`Saved these portions as the default for “${tmpl.name}”.`);
            }}
          >
            Save portions as my default for this meal
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function FoodSheet({ food, onClose }: { food: Food; onClose: () => void }) {
  const [f, setF] = useState(food);
  const valid = f.name.trim().length > 0 && f.unit.trim().length > 0 && f.kcal >= 0 && f.protein_g >= 0;
  return (
    <Sheet open onClose={onClose} title={food.name ? "Edit food" : "Add food"}>
      <div className="space-y-3">
        <Field label="Name">
          <input className={inputClass} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Unit" hint='Use "100 g" or "100 ml" for weight-based portions, or e.g. "1 egg".'>
          <input className={inputClass} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="kcal per unit">
            <input className={inputClass} inputMode="decimal" type="number" min={0} step="any" value={f.kcal} onChange={(e) => setF({ ...f, kcal: Number(e.target.value) })} />
          </Field>
          <Field label="Protein g per unit">
            <input className={inputClass} inputMode="decimal" type="number" min={0} step="any" value={f.protein_g} onChange={(e) => setF({ ...f, protein_g: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Category (used for swaps)">
          <select className={inputClass} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FoodCategory })}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Button
          size="lg"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            const { updated_at: _u, ...rest } = f;
            save("foods", { ...rest, name: f.name.trim(), unit: f.unit.trim(), deleted: false });
            onClose();
          }}
        >
          Save
        </Button>
        {food.is_custom && food.name && (
          <Button variant="danger" className="w-full" onClick={() => { remove("foods", food.id); onClose(); }}>
            Delete this food
          </Button>
        )}
      </div>
    </Sheet>
  );
}
