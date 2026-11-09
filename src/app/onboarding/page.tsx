"use client";
import { ChevronLeft, ChevronRight, Dumbbell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatTime12 } from "@shared/reminders.ts";
import { AccountCard } from "@/components/Account";
import { CalendarExport, ClockGuide, InstallGuide } from "@/components/Guides";
import { NotificationSetup } from "@/components/NotificationSetup";
import { ProfileForm } from "@/components/ProfileForm";
import { Button, Card, Notice, ProgressBar } from "@/components/ui";
import { backendConfigured } from "@/lib/backend";
import { DAY_TYPE_LABEL, WEEK_OBJECTIVES, weekSummary } from "@/lib/program";
import { itemsForDate } from "@/lib/schedule";
import { liveList } from "@/lib/state";
import { getState, save, useAppState } from "@/lib/store";
import { syncNow } from "@/lib/sync";

const TITLES = [
  "Welcome to FitFlow",
  "Your profile and goal",
  "Your daily schedule",
  "Your workout program",
  "Add FitFlow to your Home Screen",
  "Reminders when the app is closed",
  "Send a real test notification",
  "Wake-up alarm backup",
  "You're all set",
];

export default function OnboardingPage() {
  const router = useRouter();
  const state = useAppState();
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const s = Number(sessionStorage.getItem("fitflow-onboarding-step"));
      if (s > 0 && s < TITLES.length) setStep(s);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("fitflow-onboarding-step", String(step));
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
  }, [step]);

  const next = () => setStep((s) => Math.min(TITLES.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const finish = () => {
    save("profiles", { ...getState().data.profiles.me, onboarding_done: true });
    try {
      sessionStorage.removeItem("fitflow-onboarding-step");
    } catch {
      /* ignore */
    }
    void syncNow();
    router.replace("/");
  };
  const items = itemsForDate(liveList(state, "schedule_items"), "2026-11-09");
  const w1 = weekSummary(1);

  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[calc(20px+env(safe-area-inset-bottom))] fade-in">
      <div className="mb-3 mt-2">
        <p className="text-sm text-muted">
          Step {step + 1} of {TITLES.length}
        </p>
        <ProgressBar value={((step + 1) / TITLES.length) * 100} label="Setup progress" />
      </div>
      <h1 className="mb-4 text-[28px] font-bold leading-tight">{TITLES[step]}</h1>

      <div className="flex-1 space-y-4">
        {step === 0 && (
          <Card className="space-y-3 text-[15px]">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-accentfg">
              <Dumbbell size={34} aria-hidden />
            </div>
            <p>
              FitFlow guides your day: wake-up, a 4-week no-equipment home program, three planned meals, weight tracking and reminders.
            </p>
            <p>It takes about two minutes to set up. Everything can be changed later in Settings.</p>
            <p className="text-sm text-muted">
              Your data stays on this phone, and optionally on your own private server for backup and reminders.
            </p>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <ProfileForm submitLabel="Save and continue" onSaved={next} />
          </Card>
        )}

        {step === 2 && (
          <Card>
            <ul className="divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 py-2 text-[15px]">
                  <span className="tabular w-20 shrink-0 font-semibold">{formatTime12(i.time_local)}</span>
                  <span className="flex-1">{i.title}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">
              Workout steps are Monday–Saturday; Sunday is rest. Edit times or turn reminders off any time in Settings → Daily schedule.
            </p>
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-2 text-[15px]">
            <p>
              <strong>Mon / Wed / Fri:</strong> {DAY_TYPE_LABEL.strength} · <strong>Tue / Thu:</strong> {DAY_TYPE_LABEL.conditioning} ·{" "}
              <strong>Sat:</strong> {DAY_TYPE_LABEL.mixed} · <strong>Sun:</strong> {DAY_TYPE_LABEL.rest}
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              {WEEK_OBJECTIVES.map((o, i) => (
                <li key={o}>
                  <strong>Week {i + 1}:</strong> {o}
                </li>
              ))}
            </ol>
            <p className="text-sm text-muted">Week 1 strength: {w1.strength}</p>
            <Notice>
              Every session has a warm-up, rest periods and a cooldown. Each exercise has an easier option, and FitFlow will not raise
              the intensity if you report pain, excessive fatigue or poor recovery.
            </Notice>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <InstallGuide />
          </Card>
        )}

        {step === 5 && (
          <>
            <Card className="space-y-2 text-[15px]">
              <p>
                Reminders are sent by the FitFlow server at your scheduled times, so they arrive even when FitFlow is closed and the
                phone is locked (iOS 16.4 or later, app opened from the Home Screen, internet connection).
              </p>
              <p className="text-sm text-muted">
                Notification permission is requested only when you tap “Enable notifications”. You can skip this and use the Clock and
                Calendar fallbacks instead.
              </p>
            </Card>
            {backendConfigured() && (
              <Card>
                <AccountCard />
              </Card>
            )}
            <Card>
              <NotificationSetup compact />
            </Card>
          </>
        )}

        {step === 6 && (
          <Card>
            <p className="mb-3 text-[15px]">
              Tap “Send test notification”. You can lock the phone right after tapping — the message comes from the server, not from
              this screen. FitFlow only reports success when this device confirms it showed the notification.
            </p>
            <NotificationSetup compact />
          </Card>
        )}

        {step === 7 && (
          <>
            <Card>
              <ClockGuide />
            </Card>
            <Card>
              <CalendarExport />
            </Card>
          </>
        )}

        {step === 8 && (
          <Card className="space-y-2 text-[15px]">
            <p>Your Today screen shows the next activity, the day’s timeline and quick access to your workout.</p>
            <p className="text-sm text-muted">You can reopen this guide any time from Settings.</p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" size="lg" onClick={back} aria-label="Back">
            <ChevronLeft size={20} aria-hidden />
          </Button>
        )}
        {step === TITLES.length - 1 ? (
          <Button size="lg" className="flex-1" onClick={finish}>
            Open my dashboard
          </Button>
        ) : step === 1 ? null : (
          <Button size="lg" className="flex-1" onClick={next}>
            {step >= 4 && step <= 7 ? "Continue (or skip)" : "Continue"} <ChevronRight size={20} aria-hidden />
          </Button>
        )}
      </div>
    </main>
  );
}
