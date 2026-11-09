"use client";
import { Bell, BellOff, CheckCircle2, Circle, Send, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { backendConfigured } from "@/lib/backend";
import { formatDateTime, useTimeZone } from "@/lib/hooks";
import {
  currentSubscription,
  disablePush,
  enablePush,
  notificationHistory,
  pushEnvironment,
  sendTestNotification,
  serverSubscriptions,
  waitForDisplay,
  type LogRow,
  type PushEnvironment,
  type ServerSubscription,
} from "@/lib/push";
import { save, useAppState } from "@/lib/store";
import { syncNow, useSyncStatus } from "@/lib/sync";
import { Button, Notice } from "./ui";

function Row({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  const Icon = ok === null ? Circle : ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2 py-1.5">
      <Icon size={18} className={ok ? "mt-0.5 shrink-0 text-good" : ok === false ? "mt-0.5 shrink-0 text-bad" : "mt-0.5 shrink-0 text-muted"} aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{label}: </span>
        <span>{ok === null ? "unknown" : ok ? "yes" : "no"}</span>
        {detail && <span className="block text-sm text-muted">{detail}</span>}
      </span>
    </li>
  );
}

export function useNotificationStatus() {
  const [env, setEnv] = useState<PushEnvironment | null>(null);
  const [browserSub, setBrowserSub] = useState<PushSubscription | null>(null);
  const [serverSubs, setServerSubs] = useState<ServerSubscription[] | null>(null);
  const [history, setHistory] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sync = useSyncStatus();

  const refresh = useCallback(async () => {
    setEnv(pushEnvironment());
    try {
      setBrowserSub(await currentSubscription());
    } catch {
      setBrowserSub(null);
    }
    if (backendConfigured() && sync.signedIn) {
      try {
        setServerSubs(await serverSubscriptions());
        setHistory(await notificationHistory(30));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [sync.signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { env, browserSub, serverSubs, history, error, refresh, signedIn: sync.signedIn };
}

export function NotificationSetup({ compact = false }: { compact?: boolean }) {
  const state = useAppState();
  const tz = useTimeZone();
  const { env, browserSub, serverSubs, history, error, refresh, signedIn } = useNotificationStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "info" | "warn"; text: string } | null>(null);
  const prefs = state.data.reminder_preferences.me;
  const configured = backendConfigured();
  const thisDeviceOnServer = !!browserSub && !!serverSubs?.some((s) => s.endpoint === browserSub.endpoint && !s.disabled_at);
  const lastTest = history?.find((h) => h.kind === "test" && (h.delivered_at || h.status === "sent"));

  async function onEnable() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await enablePush(signedIn);
      if (r.ok) {
        save("reminder_preferences", { ...prefs, push_enabled: true });
        await syncNow();
        setMsg({ tone: "good", text: `${r.message} Reminders will now be sent by the server at your scheduled times.` });
      } else setMsg({ tone: "bad", text: r.message });
    } catch (e) {
      setMsg({ tone: "bad", text: `Could not enable notifications: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function onDisable() {
    setBusy(true);
    try {
      await disablePush();
      save("reminder_preferences", { ...prefs, push_enabled: false });
      await syncNow();
      setMsg({ tone: "info", text: "Notifications turned off for this device. The server will stop sending reminders." });
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function onTest() {
    setBusy(true);
    setMsg({ tone: "info", text: "Asking the server to send a test notification…" });
    try {
      const r = await sendTestNotification();
      const accepted = r.results.filter((x) => x.ok);
      if (r.status === "no_subscription") {
        setMsg({ tone: "bad", text: "The server has no active subscription for you. Tap “Enable notifications” first." });
        return;
      }
      if (accepted.length === 0) {
        setMsg({
          tone: "bad",
          text: `The push service rejected the message: ${r.results.map((x) => `${x.host} HTTP ${x.status}${x.gone ? " (subscription expired — enable again)" : ""}`).join("; ")}`,
        });
        return;
      }
      setMsg({
        tone: "warn",
        text: `The push service accepted the message (${accepted.map((x) => x.host).join(", ")}). Waiting for this device to confirm it was shown…`,
      });
      const shown = await waitForDisplay(r.log_id, 30000);
      setMsg(
        shown
          ? { tone: "good", text: "Test notification was shown on this device. ✓" }
          : {
              tone: "warn",
              text: "Accepted by the push service, but this device has not confirmed showing it within 30 seconds. Check Notification Centre, Focus/Do Not Disturb, and Settings → Notifications → FitFlow. (Delivery to another device would not confirm here.)",
            },
      );
    } catch (e) {
      setMsg({ tone: "bad", text: `Test failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  return (
    <div className="space-y-3 text-[15px]">
      <ul>
        <Row ok={configured} label="Server set up" detail={configured ? undefined : "Add the Supabase details to config.js (README)."} />
        <Row ok={configured ? signedIn : null} label="Signed in" />
        <Row ok={env ? env.standalone : null} label="Opened from Home Screen" detail={env && !env.standalone && env.ios ? "Required for notifications on iPhone." : undefined} />
        <Row
          ok={env ? env.permission === "granted" : null}
          label="Notification permission"
          detail={env ? `Status: ${env.permission}` : undefined}
        />
        <Row ok={env ? !!browserSub : null} label="Push subscription on this device" />
        <Row ok={signedIn && configured ? thisDeviceOnServer : null} label="Subscription stored on the server" />
        <Row ok={prefs?.push_enabled ?? false} label="Server reminders turned on" />
      </ul>
      {error && <Notice tone="bad">Could not read status from the server: {error}</Notice>}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid gap-2">
        {!(thisDeviceOnServer && prefs?.push_enabled) ? (
          <Button size="lg" onClick={() => void onEnable()} disabled={busy}>
            <Bell size={18} aria-hidden /> Enable notifications
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void onDisable()} disabled={busy}>
            <BellOff size={18} aria-hidden /> Turn off notifications
          </Button>
        )}
        <Button variant="secondary" onClick={() => void onTest()} disabled={busy || !configured || !signedIn}>
          <Send size={18} aria-hidden /> Send test notification
        </Button>
      </div>
      <p className="text-sm text-muted">
        Last successful test:{" "}
        {lastTest
          ? lastTest.delivered_at
            ? `shown on a device ${formatDateTime(lastTest.delivered_at, tz)}`
            : `accepted by the push service ${formatDateTime(lastTest.sent_at, tz)} (display not confirmed)`
          : "none yet"}
      </p>
      {!compact && history && (
        <div>
          <h3 className="mb-1 font-semibold">Notification history</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {history.map((h) => (
                <li key={h.id} className="py-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{h.title ?? h.kind}</span>
                    <span className="shrink-0 text-muted">{formatDateTime(h.scheduled_for, tz)}</span>
                  </div>
                  <div className="text-muted">
                    {h.kind} ·{" "}
                    {h.delivered_at
                      ? "shown on device ✓"
                      : h.status === "sent"
                        ? "accepted by push service"
                        : h.status === "failed"
                          ? `failed${h.error ? `: ${h.error}` : ""}`
                          : h.status === "no_subscription"
                            ? "no device subscribed"
                            : "sending"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
