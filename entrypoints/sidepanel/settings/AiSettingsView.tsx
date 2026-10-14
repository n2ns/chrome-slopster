import './settings.css';
import { AiEngineSection } from './AiEngineSection';
import { ApiKeysSection } from './ApiKeysSection';
import { PersonasSection } from './PersonasSection';

/** AI settings: personas, API keys, engines and models. */
export function AiSettingsView() {
  return (
    <div className="settings">
      <PersonasSection />
      <ApiKeysSection />
      <AiEngineSection />
    </div>
  );
}
