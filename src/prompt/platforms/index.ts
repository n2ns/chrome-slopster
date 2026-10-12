import type { PlatformId } from '@/src/storage/types';
import { FACEBOOK_RULES } from './facebook';
import { REDDIT_RULES } from './reddit';
import { X_RULES } from './x';

export const PLATFORM_RULES: Record<PlatformId, string[]> = {
  reddit: REDDIT_RULES,
  x: X_RULES,
  facebook: FACEBOOK_RULES,
};

export const PLATFORM_NAMES: Record<PlatformId, string> = {
  reddit: 'Reddit',
  x: 'X',
  facebook: 'Facebook',
};
