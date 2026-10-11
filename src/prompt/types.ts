import type { ThreadContext } from '@/src/adapters/types';
import type { Persona } from '@/src/storage/types';

export type GenerationMode = 'reply' | 'post';

export interface GenerationRequest {
  mode: GenerationMode;
  /** Required for 'reply'; for 'post' it carries the target community and URL. */
  thread: ThreadContext;
  persona: Persona;
  /** Free-text operator intent for this one reply or post. */
  intent: string;
  /** Resolved operator language (never 'auto'), used for the review copy. */
  operatorLanguage: string;
}

/** Parsed model output. Fields are normalized; see parseGenerationOutput(). */
export interface ParsedGeneration {
  shouldReply: boolean;
  reason: string;
  /** Reply or post body in the target language. */
  reply: string;
  /** New posts only (Reddit title). */
  title?: string;
  /** Review copy in the operator's language. */
  replyNative: string;
  reviewNotes: string;
}

export interface GenerationResult {
  raw: string;
  /** null when the output could not be parsed; the UI shows `raw` and disables filling. */
  parsed: ParsedGeneration | null;
}
