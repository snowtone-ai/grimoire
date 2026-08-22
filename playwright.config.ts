import { defineConfig, devices } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['html', { open: 'never' }], ['line']] : 'list',
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start --hostname 127.0.0.1',
    // Never reuse whatever happens to hold the port. `reuseExistingServer` took
    // a running `pnpm dev` and ran the whole suite against it: a cold Turbopack
    // compile put first paint past the 5s expect budget and all 11 tests failed
    // for a reason that had nothing to do with the code. The reverse is worse —
    // a dev server can make the suite pass on behaviour the production build
    // does not have. Occupying the port now fails loudly instead ("port 3000 is
    // used"), which is the correct answer to "stop your dev server first".
    reuseExistingServer: false,
    timeout: 180_000,
    url: baseURL,
  },
})
