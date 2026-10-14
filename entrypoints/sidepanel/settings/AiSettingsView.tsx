import './settings.css';
import { AiEngineSection } from './AiEngineSection';

/** AI settings: the global AI engine with its API key and model, and translation. */
export function AiSettingsView() {
  return (
    <div className="settings">
      <AiEngineSection />
    </div>
  );
}
