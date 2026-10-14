import { createContext, useContext } from 'react';

/** Opens the settings view inside the side panel; provided by the side panel's root. */
export const SettingsNavContext = createContext<() => void>(() => undefined);

export function useOpenSettings(): () => void {
  return useContext(SettingsNavContext);
}
