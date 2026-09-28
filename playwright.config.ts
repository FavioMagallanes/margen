import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4173",
    // 'on-first-retry' only keeps a trace for tests that fail and get retried.
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // Builds and serves the production bundle so e2e tests exercise the same
  // artifact that ships, instead of the dev server.
  webServer: {
    command: "pnpm build && pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
