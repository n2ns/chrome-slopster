// Per-request length caps. Truncation only cuts the source; the notice is added
// by the UI from the `truncated` flag and is never put into the text sent to or
// returned from a provider (an engine would translate it, and paid APIs bill it).

export const GOOGLE_FREE_MAX_CHARS = 4500;
export const AI_TRANSLATION_MAX_CHARS = 8000;

export interface LimitedText {
  text: string;
  truncated: boolean;
}

export function limitProviderText(text: string, maxChars: number): LimitedText {
  const source = text.trim();
  if (source.length <= maxChars) return { text: source, truncated: false };
  // Do not cut a UTF-16 surrogate pair in half.
  const lastCode = source.charCodeAt(maxChars - 1);
  const end = lastCode >= 0xd800 && lastCode <= 0xdbff ? maxChars - 1 : maxChars;
  return { text: source.slice(0, end).trim(), truncated: true };
}
