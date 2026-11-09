import { defineConfig, devices } from "@playwright/test";

// Runs against the production build in ./out served like GitHub Pages
// (run `npm run build` first). iPhone-sized WebKit (Safari's engine) for
// the app flows; Chromium for service-worker/offline checks.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4321/fitflow/",
    timezoneId: "Asia/Seoul",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs out",
    url: "http://localhost:4321/fitflow/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "iphone-webkit", use: { ...devices["iPhone 15"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
