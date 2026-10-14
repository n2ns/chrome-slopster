// Persona profiles: an array stored in sync through chunked storage, plus the
// active persona ID. Several extension pages may edit at once, so every write
// runs under one Web Lock and re-reads the stored list inside it.
//
// Sync resolves conflicts per item, so edits from two offline devices can leave
// a mix of chunk generations that no longer parses. The last good list is kept
// in storage.local as a backup and served when the synced copy is unreadable;
// the next write repairs sync. Without a backup, resetPersonas() starts over.

import { t } from '@/src/i18n';
import { AppError } from '@/src/providers/types';
import { readChunked, toStorageError, watchChunked, writeChunked } from './chunked-sync';
import { activePersonaIdItem } from './items';
import type { Persona } from './types';

export const PERSONAS_KEY = 'personas';
const LOCK_NAME = 'personas';

/** Persona fields without the ID, as edited in a form. */
export type PersonaFields = Omit<Persona, 'id'>;

function withLock<T>(work: () => Promise<T>): Promise<T> {
  return navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, work);
}

/** A neutral starting point; carries no product or promotion content. */
export function defaultPersonaFields(): PersonaFields {
  return {
    name: t('defaultPersonaName'),
    identity: '',
    tone: t('defaultPersonaTone'),
    replyLanguage: 'auto',
    bannedWords: [],
    customRules: [],
    antiAiVoice: true,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Fill in defaults for fields missing from data written by another version. */
function normalizePersona(value: unknown): Persona | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Record<keyof Persona, unknown>>;
  if (typeof raw.id !== 'string' || !raw.id) return null;
  const text = (field: unknown, fallback = '') => (typeof field === 'string' ? field : fallback);
  return {
    id: raw.id,
    name: text(raw.name),
    identity: text(raw.identity),
    tone: text(raw.tone),
    replyLanguage: text(raw.replyLanguage, 'auto') || 'auto',
    bannedWords: stringList(raw.bannedWords),
    customRules: stringList(raw.customRules),
    antiAiVoice: typeof raw.antiAiVoice === 'boolean' ? raw.antiAiVoice : true,
  };
}

/** Last list read from or written to sync; never synced itself. */
const backupItem = storage.defineItem<Persona[] | null>('local:personasBackup', { fallback: null });

function normalizeList(stored: unknown): Persona[] {
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizePersona).filter((persona): persona is Persona => persona !== null);
}

async function saveBackup(personas: Persona[]): Promise<void> {
  try {
    await backupItem.setValue(personas);
  } catch (error) {
    console.warn('Failed to update the local persona backup.', error);
  }
}

async function readStored(): Promise<Persona[]> {
  let stored: unknown;
  try {
    stored = await readChunked<unknown>(PERSONAS_KEY);
  } catch (error) {
    const backup = await backupItem.getValue();
    if (error instanceof AppError && error.code === 'storage-error' && backup) return normalizeList(backup);
    throw error;
  }
  const personas = normalizeList(stored);
  if (personas.length > 0 && JSON.stringify(personas) !== JSON.stringify(await backupItem.getValue())) await saveBackup(personas);
  return personas;
}

async function writeStored(personas: Persona[]): Promise<void> {
  await writeChunked(PERSONAS_KEY, personas);
  await saveBackup(personas);
}

async function setActiveId(id: string): Promise<void> {
  try {
    await activePersonaIdItem.setValue(id);
  } catch (error) {
    throw toStorageError(error);
  }
}

/** ID of the built-in default persona; it can be edited but never deleted. */
export const DEFAULT_PERSONA_ID = 'default';

/** Store the default persona and make it active. Call inside the lock. */
async function seed(): Promise<Persona[]> {
  const personas = [{ id: DEFAULT_PERSONA_ID, ...defaultPersonaFields() }];
  await writeStored(personas);
  await setActiveId(personas[0]!.id);
  return personas;
}

function notFound(id: string): AppError {
  return new AppError('not-found', `Persona ${id} no longer exists.`);
}

/** All personas, seeding the default one when none are stored. */
export async function listPersonas(): Promise<Persona[]> {
  const personas = await readStored();
  if (personas.length > 0) return personas;
  return withLock(async () => {
    const current = await readStored();
    return current.length > 0 ? current : seed();
  });
}

export async function getPersona(id: string): Promise<Persona | undefined> {
  return (await listPersonas()).find((persona) => persona.id === id);
}

export async function createPersona(fields: PersonaFields): Promise<Persona> {
  return withLock(async () => {
    // On empty storage the default persona is seeded first, so it always exists.
    const stored = await readStored();
    const personas = stored.length > 0 ? stored : await seed();
    const persona: Persona = { ...fields, id: crypto.randomUUID() };
    await writeStored([...personas, persona]);
    return persona;
  });
}

/**
 * Apply `patch` to the latest stored copy of a persona, so fields another window
 * changed meanwhile are kept. Rejects with not-found when the persona was deleted.
 */
export async function updatePersona(id: string, patch: Partial<PersonaFields>): Promise<Persona> {
  return withLock(async () => {
    const personas = await readStored();
    const index = personas.findIndex((item) => item.id === id);
    if (index < 0) throw notFound(id);
    personas[index] = { ...personas[index]!, ...patch, id };
    await writeStored(personas);
    return personas[index]!;
  });
}

/**
 * Delete a persona. The built-in default persona is never deleted. When the
 * deleted one was active, the first remaining one becomes active; deleting the
 * last one seeds a fresh default persona.
 */
export async function deletePersona(id: string): Promise<void> {
  if (id === DEFAULT_PERSONA_ID) throw new AppError('invalid-request', 'The default persona cannot be deleted.');
  await withLock(async () => {
    const personas = await readStored();
    if (!personas.some((persona) => persona.id === id)) throw notFound(id);
    const remaining = personas.filter((persona) => persona.id !== id);
    if (remaining.length === 0) {
      await seed();
      return;
    }
    await writeStored(remaining);
    const activeId = await activePersonaIdItem.getValue();
    if (!remaining.some((persona) => persona.id === activeId)) await setActiveId(remaining[0]!.id);
  });
}

/** The active persona; falls back to the first one when the stored ID is stale. */
export async function getActivePersona(): Promise<Persona> {
  const personas = await listPersonas();
  const activeId = await activePersonaIdItem.getValue();
  return personas.find((persona) => persona.id === activeId) ?? personas[0]!;
}

export async function setActivePersona(id: string): Promise<void> {
  await withLock(async () => {
    const personas = await readStored();
    if (!personas.some((persona) => persona.id === id)) throw notFound(id);
    await setActiveId(id);
  });
}

/** Replace all personas, readable or not, with a fresh default persona. */
export async function resetPersonas(): Promise<void> {
  await withLock(async () => {
    await seed();
  });
}

/** Call `callback` when personas or the active persona change in any window. Returns an unsubscribe function. */
export function watchPersonas(callback: () => void): () => void {
  const unwatchList = watchChunked(PERSONAS_KEY, callback);
  const unwatchActive = activePersonaIdItem.watch(() => callback());
  return () => {
    unwatchList();
    unwatchActive();
  };
}
