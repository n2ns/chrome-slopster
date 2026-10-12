import { commonPlatformRules } from './common';

export const REDDIT_RULES: string[] = commonPlatformRules(
  'Reddit',
  "- Each subreddit's own rules override everything else. Many subreddits ban self-promotion, links, or AI-written content outright. If the subreddit name, the post, or the visible context suggests such a restriction, set should_reply to false and name the suspected rule in review_notes.",
);
