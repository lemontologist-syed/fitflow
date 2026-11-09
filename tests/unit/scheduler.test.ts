// Production scheduler logic against an in-memory store (dedupe, failures,
// completed tasks, snoozes, test notifications).
import { describe, expect, it } from "vitest";
import {
  runReminderTick,
  sendTestNotification,
  type LogResult,
  type NewLog,
  type SchedulerStore,
  type Snooze,
  type StoredSubscription,
} from "@shared/scheduler.ts";
import type { Completion, ReminderItem } from "@shared/reminders.ts";
import type { SendResult } from "@shared/webpush.ts";
import { defaultSchedule } from "@/lib/defaults";

function memoryStore(opts: { items?: ReminderItem[]; subs?: StoredSubscription[]; completions?: Completion[]; snoozes?: Snooze[] }) {
  const logs = new Map<string, NewLog & Partial<LogResult>>();
  const subs = opts.subs ?? [{ id: "s1", user_id: "u1", endpoint: "https://web.push.apple.com/abc", p256dh: "p", auth: "a" }];
  const subState = new Map<string, { failures: number; disabled: boolean }>();
  const snoozes = [...(opts.snoozes ?? [])].map((s) => ({ ...s, sent: false }));
  const store: SchedulerStore = {
    activeUsers: async () => [{ userId: "u1", timeZone: "Asia/Seoul" }],
    items: async () => opts.items ?? defaultSchedule(),
    completions: async (_u, dates) => (opts.completions ?? []).filter((c) => dates.includes(c.local_date)),
    subscriptions: async () => subs.filter((s) => !subState.get(s.id)?.disabled),
    dueSnoozes: async (now) => snoozes.filter((s) => !s.sent && Date.parse(s.fire_at) <= now.getTime()),
    markSnoozeSent: async (id) => {
      const s = snoozes.find((x) => x.id === id);
      if (s) s.sent = true;
    },
    claim: async (log) => {
      if ([...logs.values()].some((l) => l.dedupe_key === log.dedupe_key)) return false;
      logs.set(log.id, { ...log });
      return true;
    },
    finish: async (id, r) => {
      Object.assign(logs.get(id)!, r);
    },
    subscriptionResult: async (id, r) => {
      const s = subState.get(id) ?? { failures: 0, disabled: false };
      if (r.ok) s.failures = 0;
      else s.failures++;
      if (r.gone) s.disabled = true;
      subState.set(id, s);
    },
  };
  return { store, logs, subState };
}

let n = 0;
const ids = { newId: () => `id-${++n}`, newToken: () => `tok-${n}-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` };
const okSend = async (): Promise<SendResult> => ({ ok: true, status: 201, gone: false });

describe("reminder scheduler", () => {
  it("sends lunch once even if two ticks overlap (deduplication)", async () => {
    const { store, logs } = memoryStore({});
    const sent: unknown[] = [];
    const send = async (_s: unknown, payload: unknown) => {
      sent.push(payload);
      return { ok: true, status: 201, gone: false };
    };
    const now = new Date("2026-11-10T03:30:10Z"); // 12:30 Seoul
    const deps = { store, send, now, receiptUrl: "https://x/receipt", ...ids };
    const [a, b] = await Promise.all([runReminderTick(deps), runReminderTick(deps)]);
    expect(a.sent + b.sent).toBe(1);
    await runReminderTick({ ...deps, now: new Date("2026-11-10T03:31:10Z") });
    expect(sent).toHaveLength(1);
    expect([...logs.values()][0]).toMatchObject({ kind: "reminder", item_id: "lunch", status: "sent", local_date: "2026-11-10" });
    expect(sent[0]).toMatchObject({ title: "Lunch: overnight oats", tag: "lunch:2026-11-10", url: "./?focus=lunch" });
  });

  it("does not remind about completed tasks", async () => {
    const { store, logs } = memoryStore({ completions: [{ local_date: "2026-11-10", item_id: "lunch", status: "completed" }] });
    await runReminderTick({ store, send: okSend, now: new Date("2026-11-10T03:30:10Z"), receiptUrl: "", ...ids });
    expect(logs.size).toBe(0);
  });

  it("records failures and disables expired subscriptions without crashing", async () => {
    const { store, logs, subState } = memoryStore({});
    const gone = async (): Promise<SendResult> => ({ ok: false, status: 410, gone: true, body: "Unregistered" });
    const r = await runReminderTick({ store, send: gone, now: new Date("2026-11-10T03:30:10Z"), receiptUrl: "", ...ids });
    expect(r).toMatchObject({ sent: 0, failed: 1 });
    expect([...logs.values()][0]).toMatchObject({ status: "failed", failure_count: 1 });
    expect([...logs.values()][0].error).toContain("410");
    expect(subState.get("s1")?.disabled).toBe(true);
    const thrower = async (): Promise<SendResult> => {
      throw new Error("network down");
    };
    const { store: s2, logs: l2 } = memoryStore({});
    await runReminderTick({ store: s2, send: thrower, now: new Date("2026-11-10T03:30:10Z"), receiptUrl: "", ...ids });
    expect([...l2.values()][0].status).toBe("failed");
  });

  it("sends a snoozed reminder once at its time", async () => {
    const { store, logs } = memoryStore({
      items: [],
      snoozes: [{ id: "z1", user_id: "u1", item_id: "breakfast", local_date: "2026-11-10", title: "Breakfast", fire_at: "2026-11-10T00:10:00Z" }],
    });
    const deps = { store, send: okSend, receiptUrl: "", ...ids };
    await runReminderTick({ ...deps, now: new Date("2026-11-10T00:09:00Z") });
    expect(logs.size).toBe(0);
    await runReminderTick({ ...deps, now: new Date("2026-11-10T00:10:30Z") });
    await runReminderTick({ ...deps, now: new Date("2026-11-10T00:11:30Z") });
    expect(logs.size).toBe(1);
    expect([...logs.values()][0]).toMatchObject({ kind: "snooze", status: "sent" });
  });

  it("test notification reports the real per-device result", async () => {
    const { store } = memoryStore({});
    const r = await sendTestNotification({ store, send: okSend, now: new Date(), userId: "u1", receiptUrl: "", ...ids });
    expect(r.status).toBe("sent");
    expect(r.results[0]).toMatchObject({ host: "web.push.apple.com", ok: true, status: 201 });
    const { store: empty } = memoryStore({ subs: [] });
    const r2 = await sendTestNotification({ store: empty, send: okSend, now: new Date(), userId: "u1", receiptUrl: "", ...ids });
    expect(r2.status).toBe("no_subscription");
  });
});
