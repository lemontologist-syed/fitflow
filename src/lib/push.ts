"use client";
// Web Push subscription management (browser side).
import { b64urlDecode } from "@shared/webpush.ts";
import { BASE_PATH, backendConfigured, callFunction, currentUserId, getConfig, supabase } from "./backend";

export interface PushEnvironment {
  serviceWorker: boolean;
  pushManager: boolean;
  notifications: boolean;
  standalone: boolean;
  ios: boolean;
  permission: NotificationPermission | "unsupported";
}

export function pushEnvironment(): PushEnvironment {
  if (typeof window === "undefined") {
    return { serviceWorker: false, pushManager: false, notifications: false, standalone: false, ios: false, permission: "unsupported" };
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  return {
    serviceWorker: "serviceWorker" in nav,
    pushManager: "PushManager" in window,
    notifications: "Notification" in window,
    standalone: window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true,
    ios,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration(`${BASE_PATH}/`);
  return (await reg?.pushManager?.getSubscription()) ?? null;
}

/**
 * Must be called directly from a tap handler: iOS only shows the permission
 * prompt in response to a user gesture.
 */
export async function enablePush(signedIn: boolean): Promise<{ ok: boolean; message: string }> {
  const env = pushEnvironment();
  if (!backendConfigured()) return { ok: false, message: "The server is not set up yet (see README → Supabase setup)." };
  if (!env.notifications || !env.pushManager || !env.serviceWorker) {
    return {
      ok: false,
      message: env.ios && !env.standalone
        ? "On iPhone, notifications only work after you add FitFlow to the Home Screen and open it from there."
        : "This browser does not support Web Push.",
    };
  }
  if (!signedIn) return { ok: false, message: "Sign in first (Settings → Account & sync) so the server can store your subscription." };
  const vapid = getConfig().vapidPublicKey;
  if (!vapid) return { ok: false, message: "vapidPublicKey is missing in config.js." };

  // The permission request must be the first await inside the tap handler:
  // iOS only shows the prompt while the user gesture is still active.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      message:
        permission === "denied"
          ? "Notifications are blocked. iPhone: Settings → Notifications → FitFlow → Allow Notifications."
          : "Permission was not granted.",
    };
  }
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64urlDecode(vapid).slice().buffer as ArrayBuffer,
    });
  }
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.keys?.p256dh || !json.keys.auth) return { ok: false, message: "The browser returned an incomplete subscription." };
  const sb = supabase()!;
  const userId = await currentUserId();
  if (!userId) return { ok: false, message: "Your sign-in expired. Sign in again and retry." };
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
      disabled_at: null,
      disabled_reason: null,
      failure_count: 0,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, message: `Subscribed in the browser, but saving on the server failed: ${error.message}` };
  return { ok: true, message: "Subscription saved on the server." };
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  const sb = supabase();
  if (sub) {
    if (sb) await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

export interface ServerSubscription {
  id: string;
  endpoint: string;
  created_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_error: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
}

export async function serverSubscriptions(): Promise<ServerSubscription[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, created_at, last_success_at, last_failure_at, last_error, disabled_at, disabled_reason")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ServerSubscription[];
}

export interface LogRow {
  id: string;
  kind: string;
  item_id: string | null;
  local_date: string | null;
  title: string | null;
  status: string;
  scheduled_for: string;
  sent_at: string | null;
  delivered_at: string | null;
  error: string | null;
  success_count: number;
  failure_count: number;
}

export async function notificationHistory(limit = 30): Promise<LogRow[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("notification_log")
    .select("id, kind, item_id, local_date, title, status, scheduled_for, sent_at, delivered_at, error, success_count, failure_count")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as LogRow[];
}

export interface TestResult {
  log_id: string;
  status: string;
  results: Array<{ host: string; ok: boolean; status: number; gone: boolean; body?: string }>;
}

export function sendTestNotification(): Promise<TestResult> {
  return callFunction<TestResult>("test");
}

/** Resolves when this device's service worker reports showing that notification. */
export function waitForDisplay(logId: string, timeoutMs = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!("serviceWorker" in navigator)) return resolve(false);
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "push-shown" && e.data.log_id === logId) {
        cleanup();
        resolve(true);
      }
    };
    const t = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener("message", onMsg);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
  });
}

export async function snooze(itemId: string, title: string, localDate: string, minutes: number): Promise<void> {
  const sb = supabase();
  const userId = await currentUserId();
  if (!sb || !userId) throw new Error("Snooze needs the server and sign-in.");
  const { error } = await sb.from("snoozes").insert({
    user_id: userId,
    item_id: itemId,
    local_date: localDate,
    title,
    fire_at: new Date(Date.now() + minutes * 60000).toISOString(),
  });
  if (error) throw new Error(error.message);
}

/**
 * Re-saves this device's existing subscription on the server (idempotent).
 * Browsers may rotate subscriptions; this keeps the server copy current
 * every time the app syncs, without asking for permission again.
 */
export async function resyncSubscription(userId: string): Promise<void> {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    const sb = supabase();
    if (!sub || !sb) return;
    const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.keys?.p256dh || !json.keys.auth) return;
    await sb.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200), disabled_at: null, disabled_reason: null },
      { onConflict: "endpoint" },
    );
  } catch {
    /* best effort */
  }
}
