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

  it('ships English, Spanish, and Simplified Chinese', () => {
    expect(locales).toEqual(expect.arrayContaining(['en', 'es', 'zh_CN']));
  });

  it.each(locales)('%s defines exactly the same keys as en', (locale) => {
    expect(Object.keys(loadMessages(locale)).sort()).toEqual(englishKeys);
  });

  // Chrome Web Store limits: the name is the store title, the description is the store summary.
  it.each(locales)('%s keeps the extension name within 75 and the description within 132 characters', (locale) => {
    const messages = loadMessages(locale);
    expect(messages.extName!.message.length).toBeLessThanOrEqual(75);
    expect(messages.extDescription!.message.length).toBeLessThanOrEqual(132);
  });

  it.each(locales)('%s has no empty messages', (locale) => {
    for (const [key, { message }] of Object.entries(loadMessages(locale))) {
      expect(message.trim(), `${locale}.${key}`).not.toBe('');
    }
  });
});
