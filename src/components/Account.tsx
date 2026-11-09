"use client";
import { Cloud, CloudOff, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { backendConfigured } from "@/lib/backend";
import { formatDateTime, useTimeZone } from "@/lib/hooks";
import { countDirty } from "@/lib/state";
import { useAppState } from "@/lib/store";
import { signIn, signOut, syncNow, useSyncStatus } from "@/lib/sync";
import { Button, Field, Notice, inputClass } from "./ui";

export function AccountCard() {
  const configured = backendConfigured();
  const status = useSyncStatus();
  const state = useAppState();
  const tz = useTimeZone();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pending = countDirty(state);

  if (!configured) {
    return (
      <div className="space-y-2 text-[15px]">
        <div className="flex items-center gap-2 font-semibold">
          <CloudOff size={18} aria-hidden /> Local-only mode
        </div>
        <p className="text-sm text-muted">
          Everything works and is saved on this device. To back up your data and receive reminders when FitFlow is closed, the
          Supabase server must be set up and its address added to <code>config.js</code> (see README, “Server setup”).
        </p>
      </div>
    );
  }

  if (!status.signedIn) {
    return (
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            await signIn(email.trim(), password);
            setPassword("");
          } catch (x) {
            setErr((x as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-sm text-muted">Sign in with the account you created in Supabase (Authentication → Users).</p>
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {err && <Notice tone="bad">{err}</Notice>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-3 text-[15px]">
      <div className="flex items-center gap-2">
        <Cloud size={18} className="text-good" aria-hidden />
        <span>
          Signed in as <strong>{status.email}</strong>
        </span>
      </div>
      <p className="text-sm text-muted">
        Last sync: {formatDateTime(state.sync.lastSyncAt, tz)}
        {pending > 0 ? ` · ${pending} change${pending === 1 ? "" : "s"} waiting to upload` : " · everything uploaded"}
        {!status.online && " · offline"}
      </p>
      {state.sync.lastSyncError && <Notice tone="bad">Last sync failed: {state.sync.lastSyncError}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => void syncNow()} disabled={status.syncing}>
          <RefreshCw size={16} aria-hidden className={status.syncing ? "animate-spin" : ""} /> Sync now
        </Button>
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut size={16} aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  );
}
