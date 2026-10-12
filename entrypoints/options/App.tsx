import { t } from '@/src/i18n';
import { AdBlockSection } from './AdBlockSection';
import { ApiKeysSection } from './ApiKeysSection';
import { EnginesSection } from './EnginesSection';
import { PersonasSection } from './PersonasSection';

export default function App() {
  return (
    <main className="options">
      <h1>{t('optionsTitle')}</h1>
      <PersonasSection />
      <ApiKeysSection />
      <EnginesSection />
      <AdBlockSection />
    </main>
  );
}
