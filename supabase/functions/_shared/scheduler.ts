// The production reminder scheduler, written against a small storage
// interface so it can be unit-tested with an in-memory store and run in the
// Edge Function with Supabase.
import { dueReminders, snoozeKey, type Completion, type ReminderItem } from "./reminders.ts";
import { addDays, localDate } from "./zoned.ts";
import { topicFor, type PushSubscriptionKeys, type SendOptions, type SendResult, type VapidKeys } from "./webpush.ts";

export interface StoredSubscription extends PushSubscriptionKeys {
  id: string;
  user_id: string;
}

export interface UserContext {
  userId: string;
  timeZone: string;
}

export interface Snooze {
  id: string;
  user_id: string;
  item_id: string;
  local_date: string;
  title: string;
  fire_at: string;
}

export interface NewLog {
  id: string;
  user_id: string;
  dedupe_key: string;
  kind: "reminder" | "snooze" | "test";
  item_id: string | null;
  local_date: string | null;
  scheduled_for: string;
  receipt_token: string;
  title: string;
  body: string;
}

export interface LogResult {
  status: "sent" | "failed" | "no_subscription";
  sent_at: string | null;
  success_count: number;
  failure_count: number;
  error: string | null;
}

export interface SchedulerStore {
  /** Users that have push enabled and at least one active subscription. */
  activeUsers(): Promise<UserContext[]>;
  items(userId: string): Promise<ReminderItem[]>;
  completions(userId: string, dates: string[]): Promise<Completion[]>;
  subscriptions(userId: string): Promise<StoredSubscription[]>;
  dueSnoozes(now: Date): Promise<Snooze[]>;
  markSnoozeSent(id: string, at: Date): Promise<void>;
  /** Inserts the log row unless dedupe_key exists. true = this caller owns it. */
  claim(log: NewLog): Promise<boolean>;
  finish(logId: string, result: LogResult): Promise<void>;
  subscriptionResult(subId: string, result: SendResult, at: Date): Promise<void>;
}

export type Sender = (sub: PushSubscriptionKeys, payload: unknown, options: SendOptions) => Promise<SendResult>;

export interface TickDeps {
  store: SchedulerStore;
  send: Sender;
  now: Date;
  /** Public URL of the receipt endpoint, called by the service worker. */
  receiptUrl: string;
  newId: () => string;
  newToken: () => string;
  appPath?: string;
}

export interface TickSummary {
  users: number;
  due: number;
  claimed: number;
  sent: number;
  failed: number;
}

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
  kind: NewLog["kind"];
  item_id: string | null;
  local_date: string | null;
  log_id: string;
  receipt_url: string;
  receipt_token: string;
}

async function deliver(
  deps: Pick<TickDeps, "store" | "send" | "now">,
  log: NewLog,
  payload: PushPayload,
  subs: StoredSubscription[],
): Promise<{ result: LogResult; perSubscription: Array<{ subscription_id: string; host: string } & SendResult> }> {
  const perSubscription: Array<{ subscription_id: string; host: string } & SendResult> = [];
  const topic = await topicFor(log.dedupe_key);
  for (const sub of subs) {
    let r: SendResult;
    try {
      r = await deps.send(sub, payload, {
        topic,
        urgency: "high",
        // A reminder that arrives hours late is useless; tests may wait longer.
        ttlSeconds: log.kind === "test" ? 600 : 1800,
      });
    } catch (e) {
      r = { ok: false, status: 0, gone: false, body: String(e).slice(0, 300) };
    }
    await deps.store.subscriptionResult(sub.id, r, deps.now);
    let host = "";
    try {
      host = new URL(sub.endpoint).host;
    } catch {
      host = "invalid";
    }
    perSubscription.push({ subscription_id: sub.id, host, ...r });
  }
  const ok = perSubscription.filter((p) => p.ok).length;
  const failed = perSubscription.length - ok;
  const result: LogResult = {
    status: subs.length === 0 ? "no_subscription" : ok > 0 ? "sent" : "failed",
    sent_at: ok > 0 ? deps.now.toISOString() : null,
    success_count: ok,
    failure_count: failed,
    error:
      failed > 0
        ? perSubscription
            .filter((p) => !p.ok)
            .map((p) => `${p.host}: HTTP ${p.status}${p.body ? ` ${p.body}` : ""}`)
            .join("; ")
            .slice(0, 500)
        : null,
  };
  await deps.store.finish(log.id, result);
  return { result, perSubscription };
}

function payloadFor(log: NewLog, deps: Pick<TickDeps, "receiptUrl" | "appPath">): PushPayload {
  const base = deps.appPath ?? "./";
  const url = log.item_id ? `${base}?focus=${encodeURIComponent(log.item_id)}` : base;
  return {
    title: log.title,
    body: log.body,
    tag: log.item_id ? `${log.item_id}:${log.local_date}` : log.dedupe_key,
    url,
    kind: log.kind,
    item_id: log.item_id,
    local_date: log.local_date,
    log_id: log.id,
    receipt_url: deps.receiptUrl,
    receipt_token: log.receipt_token,
  };
}

/** One scheduler tick (called every minute by pg_cron). */
export async function runReminderTick(deps: TickDeps): Promise<TickSummary> {
  const { store, now } = deps;
  const summary: TickSummary = { users: 0, due: 0, claimed: 0, sent: 0, failed: 0 };
  const users = await store.activeUsers();
  summary.users = users.length;

  for (const user of users) {
    const today = localDate(now, user.timeZone);
    const [items, completions] = await Promise.all([
      store.items(user.userId),
      store.completions(user.userId, [addDays(today, -1), today]),
    ]);
    const due = dueReminders({ userId: user.userId, now, timeZone: user.timeZone, items, completions });
    summary.due += due.length;
    if (due.length === 0) continue;
    const subs = await store.subscriptions(user.userId);
    for (const r of due) {
      const log: NewLog = {
        id: deps.newId(),
        user_id: user.userId,
        dedupe_key: r.dedupeKey,
        kind: "reminder",
        item_id: r.itemId,
        local_date: r.localDate,
        scheduled_for: r.fireAt.toISOString(),
        receipt_token: deps.newToken(),
        title: r.title,
        body: r.body,
      };
      if (!(await store.claim(log))) continue; // already sent by an earlier tick
      summary.claimed++;
      const { result } = await deliver(deps, log, payloadFor(log, deps), subs);
      if (result.status === "sent") summary.sent++;
      else summary.failed++;
    }
  }

  // Snoozed reminders ("remind me again in 10 minutes").
  const snoozes = await store.dueSnoozes(now);
  for (const s of snoozes) {
    await store.markSnoozeSent(s.id, now);
    const completions = await store.completions(s.user_id, [s.local_date]);
    if (completions.some((c) => !c.deleted && c.item_id === s.item_id && c.local_date === s.local_date)) continue;
    summary.due++;
    const log: NewLog = {
      id: deps.newId(),
      user_id: s.user_id,
      dedupe_key: snoozeKey(s.user_id, s.id),
      kind: "snooze",
      item_id: s.item_id,
      local_date: s.local_date,
      scheduled_for: s.fire_at,
      receipt_token: deps.newToken(),
      title: s.title,
      body: `Snoozed reminder: ${s.title}`,
    };
    if (!(await store.claim(log))) continue;
    summary.claimed++;
    const subs = await store.subscriptions(s.user_id);
    const { result } = await deliver(deps, log, payloadFor(log, deps), subs);
    if (result.status === "sent") summary.sent++;
    else summary.failed++;
  }
  return summary;
}

/** Sends a test notification right away and reports what really happened. */
export async function sendTestNotification(
  deps: Omit<TickDeps, "now"> & { now: Date; userId: string },
): Promise<{
  log_id: string;
  status: LogResult["status"];
  results: Array<{ subscription_id: string; host: string; ok: boolean; status: number; gone: boolean; body?: string }>;
}> {
  const log: NewLog = {
    id: deps.newId(),
    user_id: deps.userId,
    dedupe_key: `t:${deps.userId}:${deps.newId()}`,
    kind: "test",
    item_id: null,
    local_date: null,
    scheduled_for: deps.now.toISOString(),
    receipt_token: deps.newToken(),
    title: "FitFlow test notification",
    body: "If you can read this, reminders can reach this device.",
  };
  await deps.store.claim(log);
  const subs = await deps.store.subscriptions(deps.userId);
  const { result, perSubscription } = await deliver(deps, log, payloadFor(log, deps), subs);
  return { log_id: log.id, status: result.status, results: perSubscription };
}
