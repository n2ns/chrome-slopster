// Persona profiles: an array stored in sync through chunked storage, plus the
// active persona ID. Several extension pages may edit at once, so every write
// runs under one Web Lock and re-reads the stored list inside it.

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

async function readStored(): Promise<Persona[]> {
  const stored = await readChunked<unknown>(PERSONAS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.map(normalizePersona).filter((persona): persona is Persona => persona !== null);
}

async function setActiveId(id: string): Promise<void> {
  try {
    await activePersonaIdItem.setValue(id);
  } catch (error) {
    throw toStorageError(error);
  }
}

/** Store the default persona and make it active. Call inside the lock. */
async function seed(): Promise<Persona[]> {
  const personas = [{ id: crypto.randomUUID(), ...defaultPersonaFields() }];
  await writeChunked(PERSONAS_KEY, personas);
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
    const personas = await readStored();
    const persona: Persona = { ...fields, id: crypto.randomUUID() };
    await writeChunked(PERSONAS_KEY, [...personas, persona]);
    if (personas.length === 0) await setActiveId(persona.id);
    return persona;
  });
}

/** Replace a stored persona. Rejects with not-found when another window deleted it. */
export async function updatePersona(persona: Persona): Promise<Persona> {
  return withLock(async () => {
    const personas = await readStored();
    const index = personas.findIndex((item) => item.id === persona.id);
    if (index < 0) throw notFound(persona.id);
    personas[index] = { ...persona };
    await writeChunked(PERSONAS_KEY, personas);
    return personas[index]!;
  });
}

/**
 * Delete a persona. When it was active, the first remaining one becomes active;
 * deleting the last one seeds a fresh default persona.
 */
export async function deletePersona(id: string): Promise<void> {
  await withLock(async () => {
    const personas = await readStored();
    if (!personas.some((persona) => persona.id === id)) throw notFound(id);
    const remaining = personas.filter((persona) => persona.id !== id);
    if (remaining.length === 0) {
      await seed();
      return;
    }
    await writeChunked(PERSONAS_KEY, remaining);
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

/** Call `callback` when personas or the active persona change in any window. Returns an unsubscribe function. */
export function watchPersonas(callback: () => void): () => void {
  const unwatchList = watchChunked(PERSONAS_KEY, callback);
  const unwatchActive = activePersonaIdItem.watch(() => callback());
  return () => {
    unwatchList();
    unwatchActive();
  };
}
