import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const systemChromium = process.env.PLAYWRIGHT_EXECUTABLE_PATH || [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].find(path => existsSync(path));

export default defineConfig({
  testDir: './e2e/tests',
  use: {
    baseURL: 'http://localhost:5173',
    ...(systemChromium ? { executablePath: systemChromium } : {}),
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'npm run dev --prefix backend', url: 'http://localhost:3000/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev --prefix frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 },
  ],
});
