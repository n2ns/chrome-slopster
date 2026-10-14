import { CircleAlert, ShieldBan } from 'lucide-react';
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
      <h2>
        <ShieldBan className="icon" size={18} aria-hidden />
        {t('adBlockHeading')}
      </h2>
      {value ? (
        <div className="toggle-list">
          {PLATFORMS.map((platform) => (
            <label key={platform} className="check">
              <input type="checkbox" checked={value[platform]} onChange={(event) => toggle(platform, event.target.checked)} />
              <span>{t(LABELS[platform])}</span>
            </label>
          ))}
        </div>
      ) : (
        !shownError && <p className="hint">{t('loading')}</p>
      )}
      {shownError !== undefined && (
        <p className="error">
          <CircleAlert className="icon" size={16} aria-hidden />
          {errorMessage(shownError)}
        </p>
      )}
    </section>
  );
}
