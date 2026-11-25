import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    channel: process.env.CI ? undefined : 'chrome',
    baseURL: 'http://127.0.0.1:5175/StampStudio/',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [{
    command: 'node server/test-server.mjs',
    url: 'http://127.0.0.1:8788/contributions',
    reuseExistingServer: false,
  }, {
    command: 'npm run dev -- --port 5175 --strictPort',
    env: { VITE_BOARD_API_URL: 'http://127.0.0.1:8788', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' },
    url: 'http://127.0.0.1:5175/StampStudio/',
    reuseExistingServer: false,
  }],
})
