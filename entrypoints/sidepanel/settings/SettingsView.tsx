import './settings.css';
import { AdBlockSection } from './AdBlockSection';
import { ApiKeysSection } from './ApiKeysSection';
import { EnginesSection } from './EnginesSection';
import { PersonasSection } from './PersonasSection';

/** The settings, shown inside the side panel in place of the main view. */
export function SettingsView() {
  return (
    <div className="settings">
      <PersonasSection />
      <ApiKeysSection />
      <EnginesSection />
      <AdBlockSection />
    </div>
  );
}
