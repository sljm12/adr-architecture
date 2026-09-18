import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const systemChromium = process.env.PLAYWRIGHT_EXECUTABLE_PATH || [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => existsSync(path));
const usesWindowsBrowser = Boolean(systemChromium?.match(/^[A-Z]:\//i));

export default defineConfig({
  testDir: './e2e/tests',
  use: {
    baseURL: 'http://localhost:5173',
    ...(systemChromium ? { launchOptions: { executablePath: systemChromium, ...(usesWindowsBrowser ? { headless: false } : {}) } } : {}),
    trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'npm run dev --prefix backend', url: 'http://localhost:3000/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev --prefix frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 },
  ],
});
