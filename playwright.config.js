import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 7000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    channel: 'chromium',
    launchOptions: { args: ['--disable-gpu'] },
  },
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000,
  },
  reporter: 'list',
});
