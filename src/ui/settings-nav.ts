import { createContext, useContext } from 'react';

/** The two settings views shown inside the side panel. */
export type SettingsView = 'ai' | 'general';

/** Opens a settings view inside the side panel; provided by the side panel's root. */
export const SettingsNavContext = createContext<(view: SettingsView) => void>(() => undefined);

export function useOpenSettings(): (view: SettingsView) => void {
  return useContext(SettingsNavContext);
}
