import type { AiEngine } from '@/src/storage/types';
import { claudeProvider } from './claude';
import { geminiProvider } from './gemini';
import { deepSeekProvider, openAiProvider } from './openai-compatible';
import type { AiProvider } from './types';

export { translateGoogleFree } from './google-free';

export const AI_PROVIDERS: Record<AiEngine, AiProvider> = {
  openai: openAiProvider,
  deepseek: deepSeekProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
};
