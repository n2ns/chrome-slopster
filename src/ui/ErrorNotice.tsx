import { t } from '@/src/i18n';
import { AppError } from '@/src/providers/types';
import { errorMessage } from './errors';

export function openSettings(): void {
  void browser.runtime.openOptionsPage();
}

/** A localized error, with a way to the settings when the fix is to add an API key. */
export function ErrorNotice({ error }: { error: unknown }) {
  const needsKey = error instanceof AppError && error.code === 'missing-api-key';
  return (
    <>
      <p className="error">{errorMessage(error)}</p>
      {needsKey && (
        <p>
          <button type="button" className="link" onClick={openSettings}>
            {t('openSettingsLink')}
          </button>
        </p>
      )}
    </>
  );
}
