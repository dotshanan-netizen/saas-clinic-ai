import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright-tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker to ensure DB state transitions run sequentially
  reporter: "list",
  globalSetup: require.resolve("./playwright-tests/global-setup"),
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
    storageState: "playwright-tests/state.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
