// Side panel theme. The theme setting lives in synced storage, which loads
// asynchronously; a copy in localStorage, applied by public/theme-init.js before the
// first paint, lets the panel open in the chosen theme instead of flashing the
// browser's scheme first.

import type { Settings } from '@/src/storage/types';

const KEY = 'theme';

/** Apply the theme setting to the page (see styles.css) and remember it for the next open. */
export function applyTheme(theme: Settings['theme']): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Only the next open's first frames depend on it.
  }
}

