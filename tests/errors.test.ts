import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AppError, type ErrorCode } from '@/src/providers/types';
import { ERROR_MESSAGE_KEYS, errorMessage } from '@/src/ui/errors';
import { mockI18n } from './helpers/browser';

// Record<ErrorCode, true> fails to compile when a code is added or removed.
const ALL_CODES: Record<ErrorCode, true> = {
  'missing-api-key': true,
  'rate-limited': true,
  'http-error': true,
  'network-error': true,
  'bad-response': true,
  'unsupported-engine': true,
  'invalid-request': true,
  'not-found': true,
  'storage-error': true,
  'internal-error': true,
};
const CODES = Object.keys(ALL_CODES) as ErrorCode[];

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(import.meta.dirname, '..', 'public', '_locales', locale, 'messages.json'), 'utf8'));
}

describe('errorMessage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    mockI18n();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(CODES)('maps %s to a message defined in every locale', (code) => {
    const key = ERROR_MESSAGE_KEYS[code];
    expect(errorMessage(new AppError(code, 'detail'))).toBe(key);
    for (const locale of ['en', 'zh_CN']) expect(loadMessages(locale)).toHaveProperty(key);
  });

  it('covers exactly the known codes', () => {
    expect(Object.keys(ERROR_MESSAGE_KEYS).sort()).toEqual([...CODES].sort());
  });

  it.each([new Error('boom'), 'text', undefined, new AppError('bogus' as ErrorCode, 'x')])('uses a generic message for %s', (error) => {
    expect(errorMessage(error)).toBe('errorGeneric');
  });
});
