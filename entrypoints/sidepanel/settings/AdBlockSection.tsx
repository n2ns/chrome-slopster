import { useState } from 'react';
import { t, type MessageKey } from '@/src/i18n';
import { adBlockItem } from '@/src/storage/items';
import { getAdBlock, saveAdBlock } from '@/src/storage/settings';
import { PLATFORMS, type PlatformId } from '@/src/storage/types';
import { errorMessage } from '@/src/ui/errors';
import { useLiveValue } from '@/src/ui/hooks';

const LABELS: Record<PlatformId, MessageKey> = {
  reddit: 'adBlockReddit',
  x: 'adBlockX',
  facebook: 'adBlockFacebook',
};

function watchAdBlock(onChange: () => void): () => void {
  return adBlockItem.watch(() => onChange());
}

export function AdBlockSection() {
  const { value, error: loadError, setValue } = useLiveValue(getAdBlock, watchAdBlock);
  const [error, setError] = useState<unknown>();

  async function toggle(platform: PlatformId, enabled: boolean) {
    setError(undefined);
    try {
      setValue(await saveAdBlock({ [platform]: enabled }));
    } catch (failure) {
      setError(failure);
    }
  }

  const shownError = error ?? loadError;
  return (
    <section>
      <h2>{t('adBlockHeading')}</h2>
      {value
        ? PLATFORMS.map((platform) => (
            <label key={platform} className="check">
              <input type="checkbox" checked={value[platform]} onChange={(event) => toggle(platform, event.target.checked)} />
              {t(LABELS[platform])}
            </label>
          ))
        : !shownError && <p className="hint">{t('loading')}</p>}
      {shownError !== undefined && <p className="error">{errorMessage(shownError)}</p>}
    </section>
  );
}
