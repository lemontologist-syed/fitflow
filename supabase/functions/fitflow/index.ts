// FitFlow Edge Function (Supabase, Deno runtime).
// Routes (POST):
//   /fitflow/cron     called every minute by pg_cron; header x-cron-secret
//   /fitflow/test     signed-in user: send a test notification now
//   /fitflow/receipt  service worker: confirms a notification was shown
//   /fitflow/delete-account  signed-in user: delete account + all data
// Deploy with JWT verification OFF (this file authorizes every route itself):
//   npx supabase functions deploy fitflow --no-verify-jwt
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { runReminderTick, sendTestNotification, type SchedulerStore } from "../_shared/scheduler.ts";
import { sendWebPush, type VapidKeys } from "../_shared/webpush.ts";
import { isValidTimeZone } from "../_shared/zoned.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

function firstKey(jsonDict: string): string {
  try {
    const d = JSON.parse(jsonDict) as Record<string, string>;
    return d.default ?? Object.values(d)[0] ?? "";
  } catch {
    return "";
  }
}

const SUPABASE_URL = env("SUPABASE_URL");
const SECRET_KEY = firstKey(env("SUPABASE_SECRET_KEYS")) || env("SUPABASE_SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = firstKey(env("SUPABASE_PUBLISHABLE_KEYS")) || env("SUPABASE_ANON_KEY");
const CRON_SECRET = env("CRON_SECRET");
const ALLOWED_ORIGIN = env("ALLOWED_ORIGIN") || "*";
const vapid: VapidKeys = {
  publicKey: env("VAPID_PUBLIC_KEY"),
  privateKey: env("VAPID_PRIVATE_KEY"),
  subject: env("VAPID_SUBJECT") || "mailto:fitflow@example.com",
};

const admin: SupabaseClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function timingSafeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const randomToken = () => {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const store: SchedulerStore = {
  async activeUsers() {
    const subs = must(
      await admin.from("push_subscriptions").select("user_id").is("disabled_at", null),
    ) as Array<{ user_id: string }>;
    const ids = [...new Set(subs.map((s) => s.user_id))];
    if (ids.length === 0) return [];
    const prefs = must(
      await admin.from("reminder_preferences").select("user_id, push_enabled").in("user_id", ids).eq("deleted", false),
    ) as Array<{ user_id: string; push_enabled: boolean }>;
    const disabled = new Set(prefs.filter((p) => p.push_enabled === false).map((p) => p.user_id));
    const profiles = must(
      await admin.from("profiles").select("user_id, timezone").in("user_id", ids),
    ) as Array<{ user_id: string; timezone: string }>;
    const tz = new Map(profiles.map((p) => [p.user_id, p.timezone]));
    return ids
      .filter((id) => !disabled.has(id))
      .map((id) => {
        const t = tz.get(id) ?? "Asia/Seoul";
        return { userId: id, timeZone: isValidTimeZone(t) ? t : "Asia/Seoul" };
      });
  },
  async items(userId) {
    return must(
      await admin
        .from("schedule_items")
        .select("id, title, time_local, reminder_enabled, days, notify_body, deleted, updated_at")
        .eq("user_id", userId)
        .eq("deleted", false),
    );
  },
  async completions(userId, dates) {
    return must(
      await admin
        .from("task_completions")
        .select("local_date, item_id, status, deleted")
        .eq("user_id", userId)
        .in("local_date", dates)
        .eq("deleted", false),
    );
  },
  async subscriptions(userId) {
    return must(
      await admin
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .eq("user_id", userId)
        .is("disabled_at", null),
    );
  },
  async dueSnoozes(now) {
    const since = new Date(now.getTime() - 30 * 60000).toISOString();
    return must(
      await admin
        .from("snoozes")
        .select("id, user_id, item_id, local_date, title, fire_at")
        .is("sent_at", null)
        .lte("fire_at", now.toISOString())
        .gte("fire_at", since),
    );
  },
  async markSnoozeSent(id, at) {
    must(await admin.from("snoozes").update({ sent_at: at.toISOString() }).eq("id", id));
  },
  async claim(log) {
    const rows = must(
      await admin
        .from("notification_log")
        .upsert({ ...log, status: "sending" }, { onConflict: "dedupe_key", ignoreDuplicates: true })
        .select("id"),
    ) as Array<{ id: string }>;
    return rows.length > 0;
  },
  async finish(logId, result) {
    must(await admin.from("notification_log").update(result).eq("id", logId));
  },
  async subscriptionResult(subId, r, at) {
    if (r.ok) {
      must(
        await admin
          .from("push_subscriptions")
          .update({ last_success_at: at.toISOString(), failure_count: 0, last_error: null })
          .eq("id", subId),
      );
      return;
    }
    const current = must(
      await admin.from("push_subscriptions").select("failure_count").eq("id", subId).maybeSingle(),
    ) as { failure_count: number } | null;
    const failures = (current?.failure_count ?? 0) + 1;
    must(
      await admin
        .from("push_subscriptions")
        .update({
          last_failure_at: at.toISOString(),
          failure_count: failures,
          last_error: `HTTP ${r.status} ${r.body ?? ""}`.slice(0, 300),
          // Expired (404/410) or repeatedly failing subscriptions stop being used.
          ...(r.gone || failures >= 10 ? { disabled_at: at.toISOString(), disabled_reason: r.gone ? "expired" : "failing" } : {}),
        })
        .eq("id", subId),
    );
  },
};

const send = (sub: { endpoint: string; p256dh: string; auth: string }, payload: unknown, options: object) =>
  sendWebPush(sub, payload, vapid, options);

async function userFrom(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function receiptUrl(): string {
  const u = `${SUPABASE_URL}/functions/v1/fitflow/receipt`;
  return PUBLISHABLE_KEY ? `${u}?apikey=${encodeURIComponent(PUBLISHABLE_KEY)}` : u;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const route = new URL(req.url).pathname.split("/").filter(Boolean).pop();

  try {
    if (route === "cron") {
      if (!timingSafeEqual(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) {
        return json({ error: "Forbidden" }, 403);
      }
      if (!vapid.publicKey || !vapid.privateKey) return json({ error: "VAPID keys not configured" }, 500);
      const summary = await runReminderTick({
        store,
        send,
        now: new Date(),
        receiptUrl: receiptUrl(),
        newId: () => crypto.randomUUID(),
        newToken: randomToken,
      });
      // Housekeeping once an hour: keep 120 days of delivery history.
      if (new Date().getUTCMinutes() === 7) {
        const cutoff = new Date(Date.now() - 120 * 86400_000).toISOString();
        await admin.from("notification_log").delete().lt("created_at", cutoff);
        await admin.from("snoozes").delete().lt("fire_at", cutoff);
      }
      return json({ ok: true, ...summary });
    }

    if (route === "receipt") {
      const { token } = (await req.json().catch(() => ({}))) as { token?: string };
      if (!token || token.length < 32) return json({ error: "Bad token" }, 400);
      await admin
        .from("notification_log")
        .update({ delivered_at: new Date().toISOString() })
        .eq("receipt_token", token)
        .is("delivered_at", null);
      return json({ ok: true });
    }

    const userId = await userFrom(req);
    if (!userId) return json({ error: "Sign in required" }, 401);

    if (route === "test") {
      if (!vapid.publicKey || !vapid.privateKey) return json({ error: "VAPID keys not configured on the server" }, 500);
      const result = await sendTestNotification({
        store,
        send,
        now: new Date(),
        userId,
        receiptUrl: receiptUrl(),
        newId: () => crypto.randomUUID(),
        newToken: randomToken,
      });
      return json(result);
    }

    if (route === "delete-account") {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true }); // all tables cascade on auth.users deletion
    }

    return json({ error: "Unknown route" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
