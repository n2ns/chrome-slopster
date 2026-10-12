import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, test as base, type BrowserContext, type Worker } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');

/** A saved fixture fragment wrapped in a minimal page. */
export function fixturePage(platform: string, name: string): string {
  const fragment = readFileSync(join(ROOT, 'tests', 'fixtures', platform, name), 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><title>fixture</title></head><body>${fragment}</body></html>`;
}

export const test = base.extend<{ context: BrowserContext; background: Worker }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    // Nothing may reach the network.
    await context.route(/^https?:\/\//, (route) => route.abort());
    await use(context);
    await context.close();
  },
  background: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
});

export const expect = test.expect;
