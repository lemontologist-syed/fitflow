"use client";
import { Bell, CalendarClock, ChevronRight, Download, Moon, RotateCcw, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountCard } from "@/components/Account";
import { ProfileForm } from "@/components/ProfileForm";
import { Button, Card, Notice, Page, SectionTitle, cx, shareOrDownload } from "@/components/ui";
import { backendConfigured, callFunction, supabase } from "@/lib/backend";
import { exportJson } from "@/lib/exporters";
import { formatDateShort, useClock } from "@/lib/hooks";
import { newCycle, programPosition } from "@/lib/program";
import { liveList, migrateState, seedState } from "@/lib/state";
import { getState, resetLocalData, save, setState, useAppState } from "@/lib/store";
import { signOut, syncNow, useSyncStatus } from "@/lib/sync";
import { TABLES } from "@/lib/types";

function ThemePicker() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("fitflow-theme") ?? "system";
    } catch {
      return "system";
    }
  });
  const apply = (t: string) => {
    setTheme(t);
    try {
      localStorage.setItem("fitflow-theme", t);
    } catch {
      /* ignore */
    }
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
      {["system", "light", "dark"].map((t) => (
        <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => apply(t)} className={cx("min-h-11 rounded-xl font-semibold capitalize ring-1 ring-line", theme === t ? "bg-accent text-accentfg" : "bg-card2")}>
          {t}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const state = useAppState();
  const router = useRouter();
  const { today } = useClock();
  const sync = useSyncStatus();
  const cycles = liveList(state, "training_cycles").sort((a, b) => a.start_date.localeCompare(b.start_date));
  const pos = programPosition(today, cycles);
  const [msg, setMsg] = useState<string | null>(null);

  async function importBackup(file: File) {
    try {
      const json = JSON.parse(await file.text()) as Record<string, unknown>;
      if (json.app !== "FitFlow") throw new Error("This is not a FitFlow backup file.");
      let s = getState();
      const now = new Date().toISOString();
      for (const t of TABLES) {
        const rows = (json[t] as Array<{ id: string }> | undefined) ?? [];
        const table = { ...s.data[t] } as Record<string, unknown>;
        for (const r of rows) table[r.id] = { ...r, updated_at: now };
        s = { ...s, data: { ...s.data, [t]: table } };
        s = { ...s, sync: { ...s.sync, dirty: { ...s.sync.dirty, [t]: Array.from(new Set([...(s.sync.dirty[t] ?? []), ...rows.map((r) => r.id)])) } } };
      }
      setState(seedState(migrateState(s)), "local");
      setMsg("Backup imported.");
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  }

  async function deleteEverything() {
    if (!confirm("Delete ALL FitFlow data on this phone" + (sync.signedIn ? " AND your account and data on the server" : "") + "? This cannot be undone. Export a backup first if you want one.")) return;
    try {
      if (sync.signedIn && backendConfigured()) {
        await callFunction("delete-account");
        await signOut();
      }
      await resetLocalData();
      setMsg("All data deleted.");
      router.replace("/onboarding/");
    } catch (e) {
      setMsg(`Delete failed: ${(e as Error).message}`);
    }
  }

  return (
    <Page title="Settings">
      <Card className="p-2">
        <Link href="/settings/schedule/" className="flex min-h-12 items-center gap-3 rounded-2xl px-2">
          <CalendarClock className="text-accent" aria-hidden /> <span className="flex-1 font-medium">Daily schedule &amp; reminder times</span> <ChevronRight size={18} aria-hidden />
        </Link>
        <Link href="/settings/notifications/" className="flex min-h-12 items-center gap-3 rounded-2xl px-2">
          <Bell className="text-accent" aria-hidden /> <span className="flex-1 font-medium">Notifications, alarms &amp; calendar</span> <ChevronRight size={18} aria-hidden />
        </Link>
      </Card>

      <Card>
        <SectionTitle>Account &amp; sync</SectionTitle>
        <AccountCard />
      </Card>

      <Card>
        <SectionTitle>Profile and targets</SectionTitle>
        <ProfileForm />
      </Card>

      <Card>
        <SectionTitle>Training cycles</SectionTitle>
        <ul className="divide-y divide-line text-sm">
          {cycles.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted">
                {formatDateShort(c.start_date)} – {formatDateShort(c.end_date)} · {c.status}
              </span>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          onClick={() => {
            if (!confirm("Start a new 4-week cycle on the next Monday?")) return;
            if (pos.cycle && pos.cycle.status === "active") save("training_cycles", { ...pos.cycle, status: "completed" });
            save("training_cycles", newCycle(today, cycles.length + 1, new Date().toISOString()));
          }}
        >
          Start a new 4-week cycle
        </Button>
      </Card>

      <Card>
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Moon size={18} aria-hidden /> Appearance
          </span>
        </SectionTitle>
        <ThemePicker />
      </Card>

      <Card>
        <SectionTitle>Your data</SectionTitle>
        <div className="grid gap-2">
          <Button variant="secondary" onClick={() => void shareOrDownload(`fitflow-backup-${today}.json`, exportJson(getState()), "application/json")}>
            <Download size={18} aria-hidden /> Export everything (JSON)
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-card2 font-semibold ring-1 ring-line">
            <Upload size={18} aria-hidden /> Import a backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && void importBackup(e.target.files[0])} />
          </label>
          {sync.signedIn && (
            <Button
              variant="secondary"
              onClick={async () => {
                const sb = supabase();
                if (!sb || !confirm("Delete your notification history on the server?")) return;
                const { error } = await sb.from("notification_log").delete().neq("kind", "");
                setMsg(error ? error.message : "Notification history deleted.");
              }}
            >
              Clear notification history
            </Button>
          )}
          <Button variant="danger" onClick={() => void deleteEverything()}>
            <Trash2 size={18} aria-hidden /> Delete all my data{sync.signedIn ? " and account" : ""}
          </Button>
        </div>
        {msg && <Notice>{msg}</Notice>}
        <p className="mt-2 text-xs text-muted">
          FitFlow stores only what you enter here. No analytics, no ads, no third-party trackers.
        </p>
      </Card>

      <Card>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            save("profiles", { ...getState().data.profiles.me, onboarding_done: false });
            void syncNow();
            router.push("/onboarding/");
          }}
        >
          <RotateCcw size={18} aria-hidden /> Reopen the setup guide
        </Button>
      </Card>
    </Page>
  );
}
