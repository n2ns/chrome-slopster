import './settings.css';
import { PersonasSection } from './PersonasSection';

/** Persona profiles, in a view of their own. */
export function PersonasSettingsView() {
  return (
    <div className="settings">
      <PersonasSection />
    </div>
  );
}
