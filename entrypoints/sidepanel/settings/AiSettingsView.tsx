import './settings.css';
import { AiEngineSection } from './AiEngineSection';
import { PersonasSection } from './PersonasSection';

/** AI settings: personas, and the global AI engine with its API key and model, and translation. */
export function AiSettingsView() {
  return (
    <div className="settings">
      <PersonasSection />
      <AiEngineSection />
    </div>
  );
}
