import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 240_000,
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
})
