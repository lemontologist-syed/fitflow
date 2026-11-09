"use client";
// Client-side store: one in-memory state persisted to IndexedDB (works
// offline), synchronised with Supabase when signed in.
import { useSyncExternalStore } from "react";
import { kvGet, kvSet } from "./idb";
import { deleteRow, emptyState, migrateState, seedState, upsertRow } from "./state";
import type { AppState, TableName, Tables } from "./types";

let state: AppState = emptyState();
let ready = false;
const listeners = new Set<() => void>();
let changeHook: ((reason: "local" | "remote") => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

export function getState(): AppState {
  return state;
}

export function isReady(): boolean {
  return ready;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function onLocalChange(fn: (reason: "local" | "remote") => void) {
  changeHook = fn;
}

// Every change is written to IndexedDB right away (no debounce), so closing
// the app immediately after a tap cannot lose it. Writes are serialised and
// coalesced: at most one write in flight plus one pending with the latest state.
let writing: Promise<void> | null = null;
let pendingWrite = false;

function schedulePersist() {
  if (writing) {
    pendingWrite = true;
    return;
  }
  writing = (async () => {
    do {
      pendingWrite = false;
      await kvSet("state", { ...state, savedAt: Date.now() });
    } while (pendingWrite);
    writing = null;
  })();
}

async function persistNow() {
  schedulePersist();
  await writing;
}

export async function flush() {
  if (writing) await writing;
}

// An IndexedDB write still in flight when the page unloads is aborted by the
// browser. On pagehide / app switch we therefore also keep a synchronous
// copy in localStorage; on start the newer of the two copies wins.
const BACKUP_KEY = "fitflow:state-backup";

function backupSync() {
  if (!ready) return;
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    /* quota or private mode: IndexedDB copy still exists */
  }
}

function readBackup(): (AppState & { savedAt?: number }) | undefined {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

let initPromise: Promise<void> | null = null;

export function initStore(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const fromDb = await kvGet<AppState & { savedAt?: number }>("state");
      const fromBackup = readBackup();
      const raw = (fromBackup?.savedAt ?? 0) > (fromDb?.savedAt ?? 0) ? fromBackup : fromDb;
      state = seedState(migrateState(raw));
      ready = true;
      await persistNow();
      emit();
      try {
        // Ask the browser to keep our data even under storage pressure.
        await navigator.storage?.persist?.();
      } catch {
        /* optional */
      }
      if (typeof window !== "undefined") {
        window.addEventListener("pagehide", backupSync);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") backupSync();
        });
      }
    })();
  }
  return initPromise;
}

/** Replace the whole state (sync merge, import, reset). */
export function setState(next: AppState, reason: "local" | "remote" = "remote") {
  state = next;
  schedulePersist();
  emit();
  changeHook?.(reason);
}

export function save<T extends TableName>(
  table: T,
  row: Omit<Tables[T], "updated_at"> & { updated_at?: string },
) {
  setState(upsertRow(state, table, row, new Date()), "local");
}

export function remove(table: TableName, id: string) {
  setState(deleteRow(state, table, id, new Date()), "local");
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useReady(): boolean {
  return useSyncExternalStore(subscribe, isReady, () => false);
}

export async function resetLocalData() {
  try {
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
  state = seedState(emptyState());
  await persistNow();
  emit();
}
