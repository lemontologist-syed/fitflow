"use client";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { CalendarExport, ClockGuide, InstallGuide } from "@/components/Guides";
import { NotificationSetup } from "@/components/NotificationSetup";
import { Card, Field, Page, SectionTitle, inputClass } from "@/components/ui";
import { useProfile } from "@/lib/hooks";
import { save, useAppState } from "@/lib/store";

const COMMON_TZ = ["Asia/Seoul", "Asia/Tokyo", "Asia/Shanghai", "Asia/Singapore", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC"];

export default function NotificationsPage() {
  const profile = useProfile();
  const state = useAppState();
  const prefs = state.data.reminder_preferences.me;
  let zones: string[] = COMMON_TZ;
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (all?.length) zones = Array.from(new Set([...COMMON_TZ, ...all]));
  } catch {
    /* keep the short list */
  }
  if (!zones.includes(profile.timezone)) zones = [profile.timezone, ...zones];

  return (
    <Page
      title="Notifications"
      action={
        <Link href="/settings/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent">
          <ChevronLeft size={18} aria-hidden /> Settings
        </Link>
      }
    >
      <Card>
        <SectionTitle>Status and controls</SectionTitle>
        <NotificationSetup />
      </Card>

      <Card>
        <SectionTitle>Timezone</SectionTitle>
        <Field label="Reminders follow wall-clock time in" hint="Daylight-saving changes are handled automatically. Changing this re-times all future reminders.">
          <select className={inputClass} value={profile.timezone} onChange={(e) => save("profiles", { ...profile, timezone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Snooze length">
          <select className={`${inputClass} mt-1`} value={prefs?.snooze_minutes ?? 10} onChange={(e) => save("reminder_preferences", { ...prefs, snooze_minutes: Number(e.target.value) })}>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card>
        <SectionTitle>How reminders work (and their limits)</SectionTitle>
        <div className="space-y-2 text-[15px]">
          <p>
            <strong>Push notification</strong> — sent by the FitFlow server at each scheduled time, through Apple’s push service. It
            arrives even when FitFlow is closed and the phone is locked, as long as the phone has internet.
          </p>
          <p>
            <strong>Audible notification</strong> — plays the normal iPhone notification sound once, unless Silent mode or a Focus
            silences it. Web apps cannot choose a custom or louder sound.
          </p>
          <p>
            <strong>Persistent alarm</strong> — a sound that keeps ringing until you stop it. A web app cannot do this.
          </p>
          <p>
            <strong>Native Clock alarm</strong> — the iPhone Clock app. Use it for waking up (guide below). FitFlow cannot create it for you.
          </p>
          <p className="text-sm text-muted">
            Delivery usually takes seconds but is not guaranteed at the exact second, and not at all during internet or server
            outages. Reminders already marked Done or Skipped are not sent. A reminder that could not be sent within 10 minutes of
            its time is dropped rather than arriving late.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Focus and Do Not Disturb</SectionTitle>
        <ul className="ml-5 list-disc space-y-1 text-[15px]">
          <li>FitFlow notifications behave like any other app’s: a Focus or Do Not Disturb hides or silences them.</li>
          <li>To let them through: Settings → Focus → (your Focus, e.g. Sleep) → Apps → Add “FitFlow”.</li>
          <li>Settings → Notifications → FitFlow lets you choose banners, sounds and lock-screen display.</li>
          <li>Scheduled Summary can delay them — keep FitFlow out of the summary for on-time reminders.</li>
        </ul>
      </Card>

      <Card>
        <SectionTitle>Install on iPhone</SectionTitle>
        <InstallGuide />
      </Card>

      <Card>
        <SectionTitle>Wake-up alarm (Clock app)</SectionTitle>
        <ClockGuide />
      </Card>

      <Card>
        <SectionTitle>Apple Calendar fallback</SectionTitle>
        <CalendarExport />
      </Card>
    </Page>
  );
}
