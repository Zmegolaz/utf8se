import { defineConfig, devices } from "@playwright/test";

// Playwright spins up the static server itself (the same one used in dev) and
// waits for it before running the browser tests. Works locally and in CI.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8765",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "python3 -m http.server 8765 --directory public",
    url: "http://localhost:8765",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
