import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/src/i18n';

describe('t', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the message for the browser language', () => {
    vi.spyOn(browser.i18n, 'getMessage').mockReturnValue('设置');
    expect(t('settingsButton')).toBe('设置');
  });

  it('falls back to the key when a message is missing', () => {
    vi.spyOn(browser.i18n, 'getMessage').mockReturnValue('');
    expect(t('settingsButton')).toBe('settingsButton');
  });
});
