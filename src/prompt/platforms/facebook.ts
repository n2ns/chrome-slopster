import { commonPlatformRules } from './common';

export const FACEBOOK_RULES: string[] = commonPlatformRules(
  'Facebook',
  "- Each group's own rules override everything else. Many groups ban self-promotion, links, or AI-written content. If the group name, the post, or the visible context suggests such a restriction, set should_reply to false and name the suspected rule in review_notes.",
);
