// Playwright config for Quizzettone.
//
// Tests run against a LOCAL Firebase Realtime Database emulator (project
// "demo-quizzettone" -- the "demo-" prefix means it's a fake, offline-only
// project id that requires no credentials and can never touch the real
// production Firebase project). The app only talks to this emulator when
// the page is loaded with `?emulator=1` in the URL (see quizzettone.html),
// so production is never at risk from running these tests.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npx firebase emulators:start --only database --project demo-quizzettone',
      port: 9000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx http-server . -p 8080 -c-1 --silent',
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 20_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional override for sandboxes with no direct internet access to
        // download a browser build; unset by default so `npx playwright
        // install` continues to work normally everywhere else.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
});
