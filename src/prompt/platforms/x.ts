import { commonPlatformRules } from './common';

export const X_MAX_CHARS = 280;

export const X_RULES: string[] = [
  ...commonPlatformRules(
    'X',
    '- Any community rules or reply restrictions visible in the thread override everything else. If the context suggests this kind of reply is unwelcome, set should_reply to false and say why in review_notes.',
  ),
  `- The text in "reply" must be at most ${X_MAX_CHARS} characters, counting spaces, emojis, and line breaks. Shorter is better.`,
];
