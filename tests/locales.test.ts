import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = join(import.meta.dirname, '..', 'public', '_locales');

function loadMessages(locale: string): Record<string, { message: string }> {
  return JSON.parse(readFileSync(join(LOCALES_DIR, locale, 'messages.json'), 'utf8'));
}

describe('locales', () => {
  const locales = readdirSync(LOCALES_DIR);
  const englishKeys = Object.keys(loadMessages('en')).sort();

  it('ships English and Simplified Chinese', () => {
    expect(locales).toEqual(expect.arrayContaining(['en', 'zh_CN']));
  });

  it.each(locales)('%s defines exactly the same keys as en', (locale) => {
    expect(Object.keys(loadMessages(locale)).sort()).toEqual(englishKeys);
  });

  it.each(locales)('%s has no empty messages', (locale) => {
    for (const [key, { message }] of Object.entries(loadMessages(locale))) {
      expect(message.trim(), `${locale}.${key}`).not.toBe('');
    }
  });
});
