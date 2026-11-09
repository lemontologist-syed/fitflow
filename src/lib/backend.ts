// Connection to the optional Supabase backend. Values come from config.js,
// which is a plain file next to index.html so it can be edited on GitHub
// without rebuilding. All three values are public by design.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface FitflowConfig {
  supabaseUrl: string;
  supabaseAnonKey: string; // publishable (sb_publishable_...) or legacy anon key
  vapidPublicKey: string;
}

declare global {
  interface Window {
    FITFLOW_CONFIG?: Partial<FitflowConfig>;
  }
}

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function getConfig(): FitflowConfig {
  const c = (typeof window !== "undefined" && window.FITFLOW_CONFIG) || {};
  return {
    supabaseUrl: (c.supabaseUrl ?? "").trim().replace(/\/+$/, ""),
    supabaseAnonKey: (c.supabaseAnonKey ?? "").trim(),
    vapidPublicKey: (c.vapidPublicKey ?? "").trim(),
  };
}

export function backendConfigured(): boolean {
  const c = getConfig();
  return /^https:\/\//.test(c.supabaseUrl) && c.supabaseAnonKey.length > 20;
}

let configPromise: Promise<void> | null = null;

/**
 * Loads config.js (once) before anything reads the configuration. Resolves
 * even if the file is missing or offline-uncached: the app then runs in
 * local-only mode.
 */
export function ensureConfig(): Promise<void> {
  if (typeof window === "undefined" || window.FITFLOW_CONFIG) return Promise.resolve();
  configPromise ??= new Promise<void>((resolve) => {
    const s = document.createElement("script");
    s.src = `${BASE_PATH}/config.js`;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
    setTimeout(resolve, 6000);
  });
  return configPromise;
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!backendConfigured()) return null;
  if (!client) {
    const c = getConfig();
    client = createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "fitflow-auth" },
    });
  }
  return client;
}

export async function currentUserId(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/** POST to the FitFlow Edge Function as the signed-in user. */
export async function callFunction<T>(route: string, body: unknown = {}): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("Sign in first (Settings → Account & sync).");
  const c = getConfig();
  const res = await fetch(`${c.supabaseUrl}/functions/v1/fitflow/${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: c.supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Server returned HTTP ${res.status}`);
  return json;
}
