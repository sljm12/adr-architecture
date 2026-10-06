import { defineConfig } from '@playwright/test';
import appConfig from './playwright.config';

// Share app setup, but use each project's own browser with normal launch settings.
// The app config's optional Chromium executable must never reach another engine.
const { launchOptions: _appLaunchOptions, ...sharedUse } = appConfig.use ?? {};

export default defineConfig({
  ...appConfig,
  testMatch: '**/html-package-*.spec.ts',
  use: { ...sharedUse, trace: 'retain-on-failure' },
  projects: [
    { name: 'offline-chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'offline-edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'offline-firefox', use: { browserName: 'firefox' } },
    { name: 'offline-webkit', use: { browserName: 'webkit' } },
  ],
});
