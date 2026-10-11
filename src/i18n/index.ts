import type enMessages from '../../public/_locales/en/messages.json';

/** Message keys, derived from the default (English) locale so typos fail to compile. */
export type MessageKey = keyof typeof enMessages;

/**
 * Look up a UI string for the browser's language.
 * Falls back to the key itself so a missing message is visible rather than blank.
 */
export function t(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions) || key;
}
