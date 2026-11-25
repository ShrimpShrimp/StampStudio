import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), 'VITE_')
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Configure the hosted Supabase project in .env.local first.')
export default defineConfig({
  testDir: './tests-hosted',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], channel: 'chrome', baseURL: 'http://127.0.0.1:5176/StampStudio/', viewport: { width: 1440, height: 1000 }, trace: 'off', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 5176 --strictPort',
    env: { ...env, VITE_BOARD_API_URL: '' },
    url: 'http://127.0.0.1:5176/StampStudio/',
    reuseExistingServer: true,
  },
})
