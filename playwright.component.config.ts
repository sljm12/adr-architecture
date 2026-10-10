import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** Reproducible phase-6 harness: real HTTP/PostgreSQL test server plus the existing frontend. */
export default defineConfig({
  ...base,
  workers: 1,
  use: { ...base.use, launchOptions: { ...base.use?.launchOptions, headless: true } },
  webServer: [{ command: 'npm run dev --prefix frontend', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 120_000 }],
});
