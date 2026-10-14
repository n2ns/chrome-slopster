import './settings.css';
import { AdBlockSection } from './AdBlockSection';
import { GeneralSection } from './GeneralSection';

/** Everything that is not about AI: language, auto-translate, font size, ad blocking. */
export function GeneralSettingsView() {
  return (
    <div className="settings">
      <GeneralSection />
      <AdBlockSection />
    </div>
  );
}
