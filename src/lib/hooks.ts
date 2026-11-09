"use client";
import { useEffect, useMemo, useState } from "react";
import { localDate, zonedParts } from "@shared/zoned.ts";
import { DEFAULT_TZ } from "./defaults";
import { liveList } from "./state";
import { useAppState } from "./store";
import type { Profile } from "./types";

/** Current time, refreshed every `ms` (and when the app returns to the foreground). */
export function useNow(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, ms);
    const vis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ms]);
  return now;
}

export function useProfile(): Profile {
  const s = useAppState();
  return s.data.profiles.me;
}

export function useTimeZone(): string {
  const p = useProfile();
  return p?.timezone || DEFAULT_TZ;
}

/** Today's local date and clock in the profile timezone. */
export function useClock() {
  const tz = useTimeZone();
  const now = useNow();
  return useMemo(() => {
    const p = zonedParts(now, tz);
    return { now, tz, today: localDate(now, tz), minutes: p.hour * 60 + p.minute, hour: p.hour };
  }, [now, tz]);
}

export function useLatestWeight(): number | null {
  const s = useAppState();
  const logs = liveList(s, "weight_logs").sort((a, b) => a.local_date.localeCompare(b.local_date));
  return logs.length ? logs[logs.length - 1].weight_kg : null;
}

export function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateShort(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
