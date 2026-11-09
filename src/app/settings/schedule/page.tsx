"use client";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatTime12 } from "@shared/reminders.ts";
import { timeToMinutes } from "@shared/zoned.ts";
import { Button, Card, Field, Notice, Page, Toggle, cx, inputClass } from "@/components/ui";
import { backendConfigured } from "@/lib/backend";
import { defaultSchedule } from "@/lib/defaults";
import { countDirty, liveList } from "@/lib/state";
import { remove, save, useAppState } from "@/lib/store";
import { useSyncStatus } from "@/lib/sync";
import type { ScheduleItem } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SchedulePage() {
  const state = useAppState();
  const sync = useSyncStatus();
  const items = liveList(state, "schedule_items").sort(
    (a, b) => timeToMinutes(a.time_local) - timeToMinutes(b.time_local) || a.sort_order - b.sort_order,
  );
  const pending = (state.sync.dirty.schedule_items ?? []).length;
  const [open, setOpen] = useState<string | null>(null);

  const update = (item: ScheduleItem, patch: Partial<ScheduleItem>) => {
    const { updated_at: _u, ...rest } = item;
    save("schedule_items", { ...rest, ...patch });
  };

  return (
    <Page
      title="Daily schedule"
      action={
        <Link href="/settings/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
          <ChevronLeft size={18} aria-hidden /> Settings
        </Link>
      }
    >
      {backendConfigured() && sync.signedIn ? (
        pending > 0 || sync.syncing ? (
          <Notice tone="warn">Saving changes to the reminder server… ({pending} pending). Reminders use the old times until this finishes.</Notice>
        ) : (
          <Notice tone="good">Reminder server is up to date ✓ ({countDirty(state)} other changes pending)</Notice>
        )
      ) : (
        <Notice>Changes are saved on this phone. Server reminders need sign-in (Settings → Account &amp; sync).</Notice>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const expanded = open === item.id;
          return (
            <li key={item.id}>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    aria-label={`Time for ${item.title}`}
                    className={cx(inputClass.replace("w-full ", ""), "tabular w-[118px] shrink-0")}
                    value={item.time_local}
                    onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && update(item, { time_local: e.target.value })}
                  />
                  <button type="button" onClick={() => setOpen(expanded ? null : item.id)} aria-expanded={expanded} className="min-h-11 min-w-0 flex-1 truncate text-left font-medium">
                    {item.title}
                    <span className="block text-xs font-normal text-muted">
                      {formatTime12(item.time_local)} · {item.days?.length ? item.days.map((d) => DAYS[d]).join(" ") : "every day"} · reminder {item.reminder_enabled ? "on" : "off"}
                    </span>
                  </button>
                </div>
                <div className="mt-1">
                  <Toggle label="Reminder" checked={item.reminder_enabled} onChange={(v) => update(item, { reminder_enabled: v })} />
                </div>
                {expanded && (
                  <div className="mt-2 space-y-3">
                    <Field label="Title">
                      <input className={inputClass} maxLength={80} value={item.title} onChange={(e) => update(item, { title: e.target.value || item.title })} />
                    </Field>
                    <Field label="Notification text">
                      <textarea className={inputClass} rows={2} maxLength={200} value={item.notify_body ?? ""} onChange={(e) => update(item, { notify_body: e.target.value || null })} />
                    </Field>
                    <fieldset>
                      <legend className="mb-1 text-sm font-medium text-muted">Days</legend>
                      <div className="flex flex-wrap gap-1">
                        {DAYS.map((d, i) => {
                          const on = !item.days?.length || item.days.includes(i);
                          return (
                            <button
                              key={d}
                              type="button"
                              aria-pressed={on}
                              onClick={() => {
                                const cur = item.days?.length ? item.days : [0, 1, 2, 3, 4, 5, 6];
                                const next = on ? cur.filter((x) => x !== i) : [...cur, i].sort();
                                if (next.length === 0) return;
                                update(item, { days: next.length === 7 ? null : next });
                              }}
                              className={cx("min-h-10 min-w-11 rounded-xl px-2 text-sm font-semibold ring-1 ring-line", on ? "bg-accent text-accentfg" : "bg-card2 text-muted")}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    {item.is_custom && (
                      <Button variant="danger" size="sm" onClick={() => remove("schedule_items", item.id)}>
                        <Trash2 size={16} aria-hidden /> Delete this item
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            const id = `custom-${Date.now().toString(36)}`;
            save("schedule_items", { id, title: "New activity", time_local: "18:00", kind: "custom", days: null, reminder_enabled: true, notify_body: null, sort_order: 999, is_custom: true, deleted: false });
            setOpen(id);
          }}
        >
          <Plus size={18} aria-hidden /> Add activity
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            if (!confirm("Reset all default items to the original times? Custom items stay.")) return;
            for (const d of defaultSchedule()) {
              const { updated_at: _u, ...rest } = d;
              save("schedule_items", { ...rest, deleted: false });
            }
          }}
        >
          Reset defaults
        </Button>
      </div>
    </Page>
  );
}
