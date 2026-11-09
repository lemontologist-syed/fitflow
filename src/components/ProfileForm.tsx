"use client";
import { useState } from "react";
import { useProfile } from "@/lib/hooks";
import { save } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { Button, Field, Notice, inputClass } from "./ui";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));

export function ProfileForm({ onSaved, submitLabel = "Save profile" }: { onSaved?: () => void; submitLabel?: string }) {
  const profile = useProfile();
  const [p, setP] = useState<Profile>(profile);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof Profile, v: string | number) => setP({ ...p, [k]: v });

  const nums: Array<[keyof Profile, string, number, number]> = [
    ["age", "Age", 10, 120],
    ["height_cm", "Height (cm)", 50, 260],
    ["start_weight_kg", "Starting weight (kg)", 20, 400],
    ["goal_weight_kg", "Goal weight (kg)", 20, 400],
  ];
  const targets: Array<[keyof Profile, string]> = [
    ["kcal_target_min", "kcal min"],
    ["kcal_target_max", "kcal max"],
    ["protein_target_min", "protein g min"],
    ["protein_target_max", "protein g max"],
  ];

  function submit() {
    for (const [k, label, min, max] of nums) {
      const v = p[k] as number;
      if (!Number.isFinite(v) || v < min || v > max) return setMsg(`${label} must be between ${min} and ${max}.`);
    }
    if (p.kcal_target_min > p.kcal_target_max || p.protein_target_min > p.protein_target_max) return setMsg("Minimum targets must not exceed maximum targets.");
    const { updated_at: _u, ...rest } = p;
    save("profiles", rest);
    setMsg("Saved.");
    onSaved?.();
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {nums.map(([k, label]) => (
          <Field key={k} label={label}>
            <input className={inputClass} inputMode="decimal" type="number" step="any" value={Number.isFinite(p[k] as number) ? String(p[k]) : ""} onChange={(e) => set(k, num(e.target.value))} />
          </Field>
        ))}
      </div>
      <Field label="Sex">
        <select className={inputClass} value={p.sex} onChange={(e) => set("sex", e.target.value)}>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Prefer not to say</option>
        </select>
      </Field>
      <Field label="Activity">
        <input className={inputClass} value={p.activity_level} onChange={(e) => set("activity_level", e.target.value)} />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-muted">Daily targets (estimates — adjust freely)</legend>
        <div className="grid grid-cols-2 gap-2">
          {targets.map(([k, label]) => (
            <Field key={k} label={label}>
              <input className={inputClass} inputMode="numeric" type="number" value={Number.isFinite(p[k] as number) ? String(p[k]) : ""} onChange={(e) => set(k, num(e.target.value))} />
            </Field>
          ))}
        </div>
      </fieldset>
      <Notice>
        Your original aim was −5 kg in 26 days. That is faster than the roughly 0.5–1 kg per week usually considered sustainable,
        so FitFlow treats {p.goal_weight_kg} kg as a direction, not a deadline, and simply shows your real results. The calorie and
        protein targets are estimates, not medical advice.
      </Notice>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      <Button className="w-full" onClick={submit}>
        {submitLabel}
      </Button>
    </div>
  );
}
