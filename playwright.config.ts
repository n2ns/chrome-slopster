import { defineConfig } from '@playwright/test';

// Layer 2 tests: the built extension in Chromium against saved page fixtures.
// No login and no real network: every request is answered by a route.
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
