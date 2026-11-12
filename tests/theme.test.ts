import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from '@/src/ui/theme';

/** The blocking script the side panel runs in <head> before its first paint. */
const runThemeInit = () => new Function(readFileSync(join(import.meta.dirname, '..', 'public', 'theme-init.js'), 'utf8'))();

describe('side panel theme', () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it('applies the saved theme before the settings load on the next open, so a chosen theme does not flash', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    delete document.documentElement.dataset.theme;
    runThemeInit();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('leaves the theme to the browser when nothing was saved or the saved value is unknown', () => {
    runThemeInit();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    localStorage.setItem('theme', 'purple');
    runThemeInit();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
