import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'npm.cmd run dev --prefix backend', url: 'http://localhost:3000/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm.cmd run dev --prefix frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 },
  ],
});
