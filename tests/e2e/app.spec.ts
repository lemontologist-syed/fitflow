import { expect, test } from "@playwright/test";
import { completeOnboarding, noHorizontalScroll, openAt, seoul } from "./helpers";

test.describe("FitFlow app flows", () => {
  test("onboarding, dashboard and persistence of a completed task", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "09:10")); // Tuesday, week 1
    await completeOnboarding(page);
    await expect(page.getByRole("heading", { name: "Good Morning" })).toBeVisible();
    await expect(page.getByText("Tuesday, November 10")).toBeVisible();
    await expect(page.getByText("Bodyweight conditioning · Week 1")).toBeVisible();
    await expect(page.getByText(/Next: Breakfast/)).toBeVisible();
    await expect(page.getByText("Overnight oats are planned for lunch at 12:30 PM.")).toBeVisible();

    const wake = page.locator("#item-wake");
    await expect(wake.getByText("Missed")).toBeVisible();
    await page.getByRole("button", { name: "Mark Wake up done" }).click();
    await expect(wake.getByText("Done")).toBeVisible();
    await page.getByRole("button", { name: "Skip Prepare for exercise, drink water" }).click();
    await expect(page.locator("#item-prep").getByText("Skipped")).toBeVisible();
    await expect(page.getByText("10%")).toBeVisible();

    // Survives a reload (IndexedDB persistence)
    await page.reload();
    await expect(page.locator("#item-wake").getByText("Done")).toBeVisible();
    await expect(page.locator("#item-prep").getByText("Skipped")).toBeVisible();
    await noHorizontalScroll(page);
    // First install must not pretend an update is waiting
    await page.waitForTimeout(1500);
    await expect(page.getByText("New version available")).toHaveCount(0);
  });

  test("bottom navigation reaches all five tabs without horizontal scrolling", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "09:10"));
    await completeOnboarding(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    for (const [label, heading] of [
      ["Workout", "Workout"],
      ["Meals", "Meals"],
      ["Progress", "Progress"],
      ["Settings", "Settings"],
      ["Today", "Good Morning"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await noHorizontalScroll(page);
    }
  });

  test("workout intensity follows the program week and the timer runs", async ({ page }) => {
    await openAt(page, seoul("2026-11-23", "07:20")); // Monday, week 3
    await completeOnboarding(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Workout" }).click();
    await expect(page.getByText("Cycle 1 · Week 3 of 4")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Full-body strength" })).toBeVisible();
    await page.getByRole("link", { name: "Start workout" }).click();
    await page.getByRole("button", { name: "Start workout" }).click();

    // Warm-up step 1: 60-second timer that advances by itself
    await expect(page.getByTestId("exercise-name")).toHaveText("March in place");
    await expect(page.getByTestId("timer")).toHaveText("1:00");
    await page.clock.runFor(30_000);
    await expect(page.getByTestId("timer")).toHaveText("0:30");
    await page.getByRole("button", { name: "Pause" }).click();
    await page.clock.runFor(20_000);
    await expect(page.getByTestId("timer")).toHaveText("0:30");
    await page.getByRole("button", { name: "Resume" }).click();
    await page.clock.runFor(31_000);
    await expect(page.getByTestId("exercise-name")).toHaveText("Arm circles");

    // Skip the rest of the warm-up to the main set
    for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Skip exercise" }).click();
    await expect(page.getByText("Get ready")).toBeVisible();
    await page.getByRole("button", { name: "Skip rest" }).click();
    await expect(page.getByTestId("exercise-name")).toHaveText("Bodyweight squat");
    await expect(page.getByText("18 reps", { exact: true })).toBeVisible();
    await expect(page.getByText(/Round 1 of 4/)).toBeVisible();
    // "Watch how" opens YouTube in a new tab/app, not embedded
    const watch = page.getByTestId("watch-how");
    await expect(watch).toHaveAttribute("href", /^https:\/\/www\.youtube\.com\/(watch\?v=|results\?search_query=)/);
    await expect(watch).toHaveAttribute("target", "_blank");

    // Record actual reps, then rest countdown
    await page.getByRole("button", { name: "One less rep" }).click();
    await expect(page.getByTestId("rep-count")).toHaveText("17");
    await page.getByRole("button", { name: "Done — next" }).click();
    await expect(page.getByText("Next: Push-up")).toBeVisible();
    await page.clock.runFor(31_000);
    await expect(page.getByTestId("exercise-name")).toHaveText("Push-up");

    // Easier alternative and previous exercise
    await page.getByRole("button", { name: "Use easier version" }).click();
    await expect(page.getByTestId("exercise-name")).toHaveText("Incline or knee push-up (easier)");
    await page.getByRole("button", { name: "Previous exercise" }).click();
    await expect(page.getByText("Next: Incline or knee push-up (easier)")).toBeVisible();

    // Leave and resume later
    await page.getByRole("button", { name: /Save & exit/ }).click();
    await expect(page.getByRole("link", { name: "Resume workout" })).toBeVisible();
    await page.getByRole("link", { name: "Resume workout" }).click();
    await page.getByRole("button", { name: /Resume where you stopped/ }).click();
    await expect(page.getByText("Paused")).toBeVisible();
    await expect(page.getByText("Next: Incline or knee push-up (easier)")).toBeVisible();
  });

  test("finishing a workout records it; pain holds the next week's intensity", async ({ page }) => {
    await openAt(page, seoul("2026-11-14", "07:30")); // Saturday, week 1 (mixed)
    await completeOnboarding(page);
    await page.goto("workout/play/");
    await page.getByRole("button", { name: "Start workout" }).click();
    await page.getByRole("button", { name: "Finish workout" }).click();
    await expect(page.getByRole("heading", { name: "Session complete" })).toBeVisible();
    await page.getByRole("button", { name: "Yes, some pain" }).click();
    await expect(page.getByText("FitFlow will not raise the intensity")).toBeVisible();
    await page.getByRole("button", { name: "Save workout" }).click();
    await expect(page.getByText(/Mixed moderate-intensity · W1 · fatigue 3\/5 · pain reported/)).toBeVisible();

    // Two days later: calendar week 2, but intensity is held at week 1
    await page.clock.setSystemTime(seoul("2026-11-16", "07:30"));
    await page.reload();
    await expect(page.getByText(/Intensity held at Week 1 because your last session \(2026-11-14\) reported pain/)).toBeVisible();
    await expect(page.getByText(/Week 1: Establish baseline/)).toBeVisible();
    // and the Today card marks the workout task done for the 14th's history
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }).click();
    await expect(page.getByText("Full-body strength · Week 1")).toBeVisible();
  });

  test("meal planner: overnight oats recipe, portions, eaten totals", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "12:35"));
    await completeOnboarding(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Meals" }).click();
    const lunch = page.getByTestId("meal-lunch");
    await expect(lunch.getByRole("heading", { name: "High-protein overnight oats" })).toBeVisible();
    await expect(lunch.getByText("≈ 592 kcal · 38.7 g protein")).toBeVisible();
    await lunch.getByRole("button", { name: "Recipe & portions" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("40 g")).toBeVisible();
    await expect(dialog.getByText("170 g")).toBeVisible();
    await expect(dialog.getByText("Cover and refrigerate overnight.")).toBeVisible();
    await dialog.getByRole("button", { name: "More Rolled oats" }).click();
    await expect(dialog.getByText("50 g")).toBeVisible();
    await expect(dialog.getByTestId("sheet-total")).toHaveText("≈ 630 kcal · 40 g protein");
    await dialog.getByRole("checkbox", { name: "Have Rolled oats" }).check();
    await dialog.getByRole("button", { name: "Eaten" }).click();
    await expect(page.getByTestId("kcal-eaten")).toHaveText("630 / 1800–2000 kcal");
    await expect(lunch.getByText("✓ Eaten")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("kcal-eaten")).toHaveText("630 / 1800–2000 kcal");
    // Lunch task on Today is completed too
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Today" }).click();
    await expect(page.locator("#item-lunch").getByText("Done")).toBeVisible();
  });

  test("weight logging, chart and CSV export", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "07:05"));
    await completeOnboarding(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Progress" }).click();
    await page.getByLabel(/Today \(Nov 10\) in kg/).fill("79.6");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved 79.6 kg for today.")).toBeVisible();
    await expect(page.getByRole("img", { name: /Weight history\. 1 entries/ })).toBeVisible();
    await expect(page.getByText("-0.4 kg")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
    expect(download.suggestedFilename()).toBe("fitflow-history-2026-11-10.csv");
    const text = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(text).toString()).toContain("2026-11-10,79.6");
  });

  test("Test C: editing lunch to 1:00 PM updates the schedule and persists", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "10:00"));
    await completeOnboarding(page);
    await page.goto("settings/schedule/");
    await page.getByLabel("Time for Lunch: overnight oats").fill("13:00");
    await expect(page.getByText(/1:00 PM · every day · reminder on/).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Time for Lunch: overnight oats")).toHaveValue("13:00");
    await page.goto("./");
    await expect(page.locator("#item-lunch").getByText("1:00 PM")).toBeVisible();
    // 10:00 → breakfast is past, so lunch is next
    await expect(page.getByText("Next: Lunch: overnight oats 1:00 PM")).toBeVisible();
  });

  test("calendar fallback: static .ics and personal export", async ({ page, request }) => {
    const res = await request.get("fitflow-routine.ics");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("DTSTART;TZID=Asia/Seoul:20261109T070000");
    await openAt(page, seoul("2026-11-10", "10:00"));
    await completeOnboarding(page);
    await page.goto("settings/notifications/");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Export my routine/ }).click()]);
    expect(download.suggestedFilename()).toBe("fitflow-routine.ics");
  });

  test("notifications page is honest without a server", async ({ page }) => {
    await openAt(page, seoul("2026-11-10", "10:00"));
    await completeOnboarding(page);
    await page.goto("settings/notifications/");
    await expect(page.getByText("Server set up:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send test notification" })).toBeDisabled();
    await expect(page.getByText("Last successful test: none yet")).toBeVisible();
    await page.getByRole("button", { name: "Enable notifications" }).click();
    await expect(page.getByText(/The server is not set up yet/)).toBeVisible();
    await expect(page.getByText("A web app cannot do this.")).toBeVisible();
  });
});
