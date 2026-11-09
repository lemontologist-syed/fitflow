"use client";
import { CloudOff, RefreshCw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BASE_PATH, ensureConfig } from "@/lib/backend";
import { registerServiceWorker } from "@/lib/push";
import { flush, initStore, useAppState, useReady } from "@/lib/store";
import { startSync } from "@/lib/sync";
import BottomNav from "./BottomNav";

const norm = (p: string | null) => (p ?? "/").replace(/\/+$/, "") || "/";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const ready = useReady();
  const state = useAppState();
  const path = norm(usePathname());
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const updateAccepted = useRef(false);

  useEffect(() => {
    void ensureConfig()
      .then(() => initStore())
      .then(() => startSync());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // Service worker: offline cache, push notifications, safe updates.
    void registerServiceWorker().then((reg) => {
      if (!reg) return;
      if (reg.waiting && reg.active) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        // Only a worker that replaces an existing active one is an "update";
        // the very first install just takes over silently.
        const isUpdate = !!reg.active;
        const sw = reg.installing;
        sw?.addEventListener("statechange", () => {
          if (isUpdate && sw.state === "installed") setWaiting(sw);
        });
      });
      // Check for a new version whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update().catch(() => {});
      });
    });
    // Reload only after the user accepted an update (not on the first install,
    // where the new worker simply takes control of the already-open page).
    let reloading = false;
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (reloading || !updateAccepted.current) return;
      reloading = true;
      void flush().then(() => window.location.reload());
    });
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const profile = state.data.profiles.me;
  const needsOnboarding = ready && profile && !profile.onboarding_done && path !== "/onboarding";

  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding/");
  }, [needsOnboarding, router]);

  // Opened from a notification tap: "?focus=<item>" → highlight on Today.
  const hideNav = path === "/onboarding" || path === "/workout/play";

  if (!ready || needsOnboarding) {
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy="true">
        <p className="text-muted">Loading FitFlow…</p>
      </div>
    );
  }

  return (
    <>
      {!online && (
        <div className="safe-top fixed inset-x-0 top-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="mt-1 flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium shadow ring-1 ring-line">
            <CloudOff size={14} aria-hidden /> Offline — changes are saved on this phone and sync later
          </div>
        </div>
      )}
      {waiting && (
        <div className="fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <button
            type="button"
            onClick={() => {
              updateAccepted.current = true;
              waiting.postMessage({ type: "SKIP_WAITING" });
            }}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accentfg shadow-lg"
          >
            <RefreshCw size={16} aria-hidden /> New version available — tap to update
          </button>
        </div>
      )}
      {children}
      {!hideNav && <BottomNav path={path} />}
      <noscript>FitFlow needs JavaScript. Base path: {BASE_PATH}</noscript>
    </>
  );
}
