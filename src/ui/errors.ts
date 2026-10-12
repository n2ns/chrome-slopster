import { t, type MessageKey } from '@/src/i18n';
import { AppError, type ErrorCode } from '@/src/providers/types';

/** i18n message for every error code; the Record type keeps it exhaustive. */
export const ERROR_MESSAGE_KEYS: Record<ErrorCode, MessageKey> = {
  'missing-api-key': 'errorMissingApiKey',
  'rate-limited': 'errorRateLimited',
  'http-error': 'errorHttp',
  'network-error': 'errorNetwork',
  'bad-response': 'errorBadResponse',
  'unsupported-engine': 'errorUnsupportedEngine',
  'invalid-request': 'errorInvalidRequest',
  'not-found': 'errorNotFound',
  'storage-error': 'errorStorage',
  'internal-error': 'errorGeneric',
};

/** A localized, operator-facing message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof AppError && Object.hasOwn(ERROR_MESSAGE_KEYS, error.code)) {
    return t(ERROR_MESSAGE_KEYS[error.code]);
  }
  return t('errorGeneric');
}
