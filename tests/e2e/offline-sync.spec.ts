import { expect, test } from "@playwright/test";
import { completeOnboarding, openAt, seoul } from "./helpers";

test.describe("service worker and offline use (Test D)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Service-worker offline emulation is checked in Chromium");

  test("app opens offline and completion controls keep working", async ({ page, context }) => {
    await page.goto("./");
    await completeOnboarding(page);
    // Wait until the service worker controls the page and has precached the app.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
      }
    });
    await page.reload();
    await expect(page.getByText("Timeline")).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText("Timeline")).toBeVisible();
    await expect(page.getByText(/Offline — changes are saved on this phone/)).toBeVisible();
    await page.getByRole("button", { name: /^Skip / }).first().click();
    await expect(page.getByText("Skipped").first()).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Workout" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Workout" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Meals" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Meals" })).toBeVisible();
    await context.setOffline(false);
  });
});

// Signed-in sync against a mocked Supabase API (no real server needed).
test.describe("sign-in and server sync (mocked Supabase)", () => {
  // Requests answered by the service worker bypass page.route(), so block it here.
  test.use({ serviceWorkers: "block" });
  test("uploads local changes with the user's id and pulls server rows", async ({ page }) => {
    const SB = "https://mockproject.supabase.co";
    const uploads: Array<{ table: string; rows: Array<Record<string, unknown>> }> = [];
    const userId = "11111111-1111-4111-8111-111111111111";
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, exp: 4102444800, role: "authenticated", email: "me@example.com" })}.sig`;

    await page.route("**/fitflow/config.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: `window.FITFLOW_CONFIG = { supabaseUrl: "${SB}", supabaseAnonKey: "sb_publishable_mock_key_000000000000", vapidPublicKey: "" };`,
      }),
    );
    await page.route(`${SB}/auth/v1/**`, (route) =>
      route.fulfill({
        json: {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "r",
          user: { id: userId, aud: "authenticated", role: "authenticated", email: "me@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" },
        },
      }),
    );
    await page.route(`${SB}/rest/v1/**`, async (route) => {
      const req = route.request();
      const table = new URL(req.url()).pathname.split("/").pop()!;
      if (req.method() === "POST") {
        uploads.push({ table, rows: JSON.parse(req.postData() ?? "[]") });
        return route.fulfill({ status: 201, body: "" });
      }
      if (req.method() === "GET" && table === "weight_logs" && !new URL(req.url()).searchParams.get("server_updated_at")?.includes("2026-11-09T01")) {
        return route.fulfill({
          json: [{ user_id: userId, id: "2026-11-09", local_date: "2026-11-09", weight_kg: 80.2, updated_at: "2026-11-09T00:00:00Z", server_updated_at: "2026-11-09T01:00:00Z", deleted: false }],
        });
      }
      return route.fulfill({ json: [] });
    });

    await openAt(page, seoul("2026-11-10", "10:00"));
    await completeOnboarding(page);
    await page.goto("settings/");
    await page.getByLabel("Email").fill("me@example.com");
    await page.getByLabel("Password").fill("test-password-only");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Signed in as")).toBeVisible();
    await expect(page.getByText(/everything uploaded/)).toBeVisible();

    // Initial full upload carried our user id; nothing from other users.
    const sched = uploads.filter((u) => u.table === "schedule_items").flatMap((u) => u.rows);
    expect(sched.length).toBeGreaterThanOrEqual(10);
    expect(sched.every((r) => r.user_id === userId)).toBe(true);

    // Server row was pulled in
    await page.goto("progress/");
    await expect(page.getByRole("img", { name: /Weight history\. 1 entries from 80.2/ })).toBeVisible();

    // A schedule edit is pushed to the server (this is what re-times reminders)
    uploads.length = 0;
    await page.goto("settings/schedule/");
    await page.getByLabel("Time for Lunch: overnight oats").fill("13:00");
    await expect.poll(() => uploads.flatMap((u) => (u.table === "schedule_items" ? u.rows : [])).find((r) => r.id === "lunch")?.time_local).toBe("13:00");
    await expect(page.getByText(/Reminder server is up to date/)).toBeVisible();
  });
});

test.describe("safe updates", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "Service-worker script interception is Chromium-only");

  test("a new version waits for the user, then reloads into it", async ({ page, context }) => {
    const { readFileSync } = await import("node:fs");
    let version = "A";
    await context.route("**/fitflow/sw.js", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: readFileSync("out/sw.js", "utf8") + `\n// build ${version}\n`,
      }),
    );
    await page.goto("./");
    await completeOnboarding(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect(page.getByText("New version available")).toHaveCount(0);
    version = "B"; // deploy a new build
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const banner = page.getByRole("button", { name: /New version available/ });
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await Promise.all([page.waitForEvent("load"), banner.click()]);
    await expect(page.getByText("Timeline")).toBeVisible();
    // Data survived the update
    await expect(page.getByRole("heading", { name: "Good Morning" }).or(page.getByRole("heading", { name: /Good/ }))).toBeVisible();
  });
});
