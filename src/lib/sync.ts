"use client";
import { useSyncExternalStore } from "react";
import { supabase } from "./backend";
import { resyncSubscription } from "./push";
import { getState, onLocalChange, setState } from "./store";
import { markAllDirty, markUploaded, mergeRemote, pendingUploads } from "./state";
import { TABLES, type BaseRow } from "./types";

export interface SyncStatus {
  signedIn: boolean;
  email: string | null;
  syncing: boolean;
  online: boolean;
}

let status: SyncStatus = { signedIn: false, email: null, syncing: false, online: true };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  for (const l of listeners) l();
};

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => status,
    () => status,
  );
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let again = false;

export function requestSync(delayMs = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
}

export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const sb = supabase();
  if (!sb) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setStatus({ online: false });
    return;
  }
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    setStatus({ signedIn: false, email: null });
    return;
  }
  setStatus({ signedIn: true, email: user.email ?? null, syncing: true, online: true });
  try {
    // First sync for this account on this device: upload everything once.
    if (getState().sync.userId !== user.id) {
      const all = markAllDirty(getState());
      setState({ ...all, sync: { ...all.sync, userId: user.id } });
    }
    // 1) push local changes
    const uploads = pendingUploads(getState(), user.id);
    for (const t of TABLES) {
      const rows = uploads[t];
      if (!rows) continue;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await sb.from(t).upsert(chunk, { onConflict: "user_id,id" });
        if (error) throw new Error(`${t}: ${error.message}`);
        setState(markUploaded(getState(), t, chunk as Array<{ id: string; updated_at: string }>));
      }
    }
    // 2) pull remote changes since the last cursor
    for (const t of TABLES) {
      for (let page = 0; page < 50; page++) {
        const cursor = getState().sync.cursors[t] ?? "1970-01-01T00:00:00Z";
        const { data: rows, error } = await sb
          .from(t)
          .select("*")
          .gt("server_updated_at", cursor)
          .order("server_updated_at", { ascending: true })
          .limit(500);
        if (error) throw new Error(`${t}: ${error.message}`);
        if (!rows || rows.length === 0) break;
        setState(mergeRemote(getState(), t, rows as BaseRow[]));
        if (rows.length < 500) break;
      }
    }
    const s = getState();
    setState({ ...s, sync: { ...s.sync, lastSyncAt: new Date().toISOString(), lastSyncError: null } });
    if (!subscriptionChecked) {
      subscriptionChecked = true;
      void resyncSubscription(user.id);
    }
  } catch (e) {
    const s = getState();
    setState({ ...s, sync: { ...s.sync, lastSyncError: String((e as Error).message ?? e) } });
  } finally {
    setStatus({ syncing: false });
  }
}

let started = false;
let subscriptionChecked = false;

export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  const sb = supabase();
  onLocalChange((reason) => {
    if (reason === "local") requestSync();
  });
  if (!sb) return;
  sb.auth.onAuthStateChange((_event, session) => {
    setStatus({ signedIn: !!session, email: session?.user.email ?? null });
    if (session) requestSync(200);
  });
  window.addEventListener("online", () => {
    setStatus({ online: true });
    requestSync(200);
  });
  window.addEventListener("offline", () => setStatus({ online: false }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestSync(300);
  });
  setInterval(() => requestSync(0), 5 * 60_000);
  requestSync(300);
}

export async function signIn(email: string, password: string) {
  const sb = supabase();
  if (!sb) throw new Error("Backend not configured");
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  await syncNow();
}

export async function signOut() {
  const sb = supabase();
  if (!sb) return;
  await sb.auth.signOut();
  setStatus({ signedIn: false, email: null });
}
