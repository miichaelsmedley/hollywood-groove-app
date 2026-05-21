import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright render smoke tests for the Hollywood Groove PWA.
 *
 * Scope: load every key route against a local production build (`vite
 * preview`) and assert the app renders without crashing — no uncaught
 * errors and the app-wide ErrorBoundary never trips. It deliberately does
 * NOT drive real sign-in or payment; Firebase Auth, App Check and Stripe
 * make those impractical to automate. See e2e/smoke.spec.ts.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
