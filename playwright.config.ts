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
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: baseURL,
  },
})
