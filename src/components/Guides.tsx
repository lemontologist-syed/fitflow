"use client";
import { AlarmClock, CalendarPlus, Download, PlusSquare, Share } from "lucide-react";
import { useState } from "react";
import { BASE_PATH } from "@/lib/backend";
import { buildIcs } from "@/lib/ics";
import { useClock } from "@/lib/hooks";
import { pushEnvironment } from "@/lib/push";
import { liveList } from "@/lib/state";
import { useAppState } from "@/lib/store";
import { Button, Notice, Toggle, shareOrDownload } from "./ui";

export function InstallGuide() {
  const env = typeof window !== "undefined" ? pushEnvironment() : null;
  return (
    <div className="space-y-3 text-[15px]">
      {env?.standalone ? (
        <Notice tone="good">FitFlow is running as an installed Home Screen app. ✓</Notice>
      ) : (
        <Notice>You are viewing FitFlow in the browser. Install it to get notifications and a full-screen app.</Notice>
      )}
      <ol className="space-y-2">
        <li className="flex gap-2">
          <span className="font-bold">1.</span>
          <span>Open this page in <strong>Safari</strong> on your iPhone (the address must start with https://).</span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">2.</span>
          <span>
            Tap the <strong>Share</strong> button <Share size={16} className="inline align-text-bottom" aria-label="Share icon" /> (bottom bar,
            or the ••• menu first on newer iOS).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">3.</span>
          <span>
            Scroll and tap <strong>Add to Home Screen</strong> <PlusSquare size={16} className="inline align-text-bottom" aria-label="Add icon" />.
            Keep “Open as Web App” on, then tap <strong>Add</strong>.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="font-bold">4.</span>
          <span>Close Safari and open <strong>FitFlow from the Home Screen icon</strong>. Do notifications from there.</span>
        </li>
      </ol>
      <p className="text-sm text-muted">
        The Home Screen app keeps its own storage, separate from Safari. Anything you entered in Safari before installing stays in
        Safari unless you sign in to sync.
      </p>
    </div>
  );
}

export function ClockGuide() {
  const state = useAppState();
  const wake = state.data.schedule_items.wake?.time_local ?? "07:00";
  const [h, m] = wake.split(":").map(Number);
  const label = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return (
    <div className="space-y-3 text-[15px]">
      <div className="flex items-start gap-2">
        <AlarmClock className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>
          A web app can send a notification, but it cannot create an alarm that keeps ringing until you dismiss it. For waking up,
          use the iPhone Clock app as a reliable backup:
        </p>
      </div>
      <ol className="ml-5 list-decimal space-y-1">
        <li>Open the <strong>Clock</strong> app → <strong>Alarms</strong>.</li>
        <li>Tap <strong>+</strong> and set <strong>{label}</strong>.</li>
        <li>Tap <strong>Repeat</strong> and select every day.</li>
        <li>Set <strong>Label</strong> to “FitFlow — wake up, drink water”.</li>
        <li>Choose a <strong>Sound</strong> and keep <strong>Snooze</strong> on if you like, then <strong>Save</strong>.</li>
      </ol>
      <p className="text-sm text-muted">
        Clock alarms ring even in Silent mode and Focus. FitFlow cannot create or change Clock alarms automatically; if you change
        the wake-up time in FitFlow, change the alarm too.
      </p>
    </div>
  );
}

export function CalendarExport() {
  const state = useAppState();
  const { today, tz } = useClock();
  const [workouts, setWorkouts] = useState(true);
  const make = () =>
    buildIcs({
      items: liveList(state, "schedule_items"),
      timeZone: tz,
      startDate: today,
      cycles: liveList(state, "training_cycles"),
      includeWorkouts: workouts,
    });
  return (
    <div className="space-y-3 text-[15px]">
      <div className="flex items-start gap-2">
        <CalendarPlus className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>
          Fallback without Web Push: add your routine to Apple Calendar as repeating events with an alert at each start time
          ({tz} times).
        </p>
      </div>
      <Toggle label="Include the daily workout plan" checked={workouts} onChange={setWorkouts} />
      <Button className="w-full" onClick={() => void shareOrDownload("fitflow-routine.ics", make(), "text/calendar")}>
        <Download size={18} aria-hidden /> Export my routine (.ics)
      </Button>
      <a
        href={`${BASE_PATH}/fitflow-routine.ics`}
        className="flex min-h-11 items-center justify-center rounded-2xl text-sm font-semibold text-accent ring-1 ring-line"
      >
        Open the default routine calendar in Safari
      </a>
      <ul className="ml-5 list-disc space-y-1 text-sm text-muted">
        <li>Easiest on iPhone: open the link above in <strong>Safari</strong> (not the installed app), then tap “Add All”.</li>
        <li>Imported alerts usually stay with the events, but calendar apps differ; check one event in Calendar after importing.</li>
        <li>Imported events do not update when you change times in FitFlow. Delete the old events and import again.</li>
        <li>Subscribed calendars may have alerts turned off; this file is meant to be imported, not subscribed.</li>
      </ul>
    </div>
  );
}
