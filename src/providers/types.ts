// Contract shared by every AI provider and the free Google translator.

import type { AiEngine } from '@/src/storage/types';

/** Machine-readable failure reasons. UI code maps them to i18n messages. */
export type ErrorCode =
  | 'missing-api-key'
  | 'rate-limited'
  | 'http-error'
  | 'network-error'
  | 'bad-response'
  | 'unsupported-engine'
  | 'invalid-request'
  | 'not-found'
  | 'storage-error'
  | 'internal-error';

export class AppError extends Error {
  readonly code: ErrorCode;
  /** HTTP status, when the failure came from an HTTP response. */
  readonly status?: number;

  constructor(code: ErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export interface ProviderCallOptions {
  apiKey: string;
  /** Already resolved with resolveModel(). */
  model: string;
  signal?: AbortSignal;
}

export interface GenerateInput {
  system: string;
  prompt: string;
  /** Ask the model for a JSON object response where the API supports it. */
  json: boolean;
}

export interface AiProvider {
  id: AiEngine;
  /** Returns only the translated text. */
  translate(text: string, targetLanguage: string, options: ProviderCallOptions): Promise<string>;
  /** Returns the model's raw text output. */
  generate(input: GenerateInput, options: ProviderCallOptions): Promise<string>;
}
