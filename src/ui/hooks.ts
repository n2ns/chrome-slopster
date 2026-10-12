import { useCallback, useEffect, useRef, useState } from 'react';
import { getSettings, settingsItem } from '@/src/storage/items';
import { getActivePersona, listPersonas, watchPersonas } from '@/src/storage/personas';
import type { Persona, Settings } from '@/src/storage/types';

interface LiveValue<T> {
  value: T | undefined;
  error: unknown;
  /** Replace the shown value right away, e.g. with the result of a save. */
  setValue: (value: T) => void;
  reload: () => void;
}

/**
 * Load a stored value and reload it whenever `subscribe` reports a change
 * (including changes made in other extension windows). `load` and `subscribe`
 * must be stable references.
 */
export function useLiveValue<T>(load: () => Promise<T>, subscribe: (onChange: () => void) => () => void): LiveValue<T> {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<unknown>();
  const latest = useRef(0);

  const reload = useCallback(() => {
    const request = ++latest.current;
    load().then(
      (next) => {
        if (request !== latest.current) return;
        setValue(next);
        setError(undefined);
      },
      (failure: unknown) => {
        if (request === latest.current) setError(failure);
      },
    );
  }, [load]);

  useEffect(() => {
    reload();
    return subscribe(reload);
  }, [reload, subscribe]);

  return { value, error, setValue, reload };
}

export interface PersonaState {
  personas: Persona[];
  activeId: string;
}

async function loadPersonaState(): Promise<PersonaState> {
  const personas = await listPersonas();
  const active = await getActivePersona();
  return { personas, activeId: active.id };
}

export function usePersonaState(): LiveValue<PersonaState> {
  return useLiveValue(loadPersonaState, watchPersonas);
}

function watchSettings(onChange: () => void): () => void {
  return settingsItem.watch(() => onChange());
}

export function useSettings(): LiveValue<Settings> {
  return useLiveValue(getSettings, watchSettings);
}
