import { expect, type Page } from "@playwright/test";

/** Seoul wall-clock time → Date. */
export const seoul = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`);

export async function openAt(page: Page, when: Date, path = "") {
  await page.clock.install({ time: when });
  // Native share sheets cannot be automated; force the download path.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  });
  await page.goto(path);
}

/** Walks through the 9-step setup guide with default answers. */
export async function completeOnboarding(page: Page) {
  await expect(page.getByRole("heading", { name: "Welcome to FitFlow" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your profile and goal" })).toBeVisible();
  await page.getByRole("button", { name: "Save and continue" }).click();
  for (const title of [
    "Your daily schedule",
    "Your workout program",
    "Add FitFlow to your Home Screen",
    "Reminders when the app is closed",
    "Send a real test notification",
    "Wake-up alarm backup",
  ]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/ }).click();
  }
  await expect(page.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await page.getByRole("button", { name: "Open my dashboard" }).click();
  await expect(page.getByText("Timeline")).toBeVisible();
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
