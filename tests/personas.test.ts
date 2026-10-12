import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { AppError } from '@/src/providers/types';
import { chunkCountKey, readChunked } from '@/src/storage/chunked-sync';
import { activePersonaIdItem } from '@/src/storage/items';
import {
  createPersona,
  defaultPersonaFields,
  deletePersona,
  getActivePersona,
  getPersona,
  listPersonas,
  PERSONAS_KEY,
  setActivePersona,
  updatePersona,
  watchPersonas,
  type PersonaFields,
} from '@/src/storage/personas';
import { enforceSyncItemQuota, installLocksPolyfill, mockI18n } from './helpers/browser';

function fields(name: string, extra: Partial<PersonaFields> = {}): PersonaFields {
  return { ...defaultPersonaFields(), name, ...extra };
}

describe('personas', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    installLocksPolyfill();
    enforceSyncItemQuota();
    mockI18n();
  });
  afterEach(() => vi.restoreAllMocks());

  it('seeds one neutral default persona and makes it active', async () => {
    const personas = await listPersonas();
    expect(personas).toHaveLength(1);
    expect(personas[0]).toMatchObject({ name: 'defaultPersonaName', identity: '', replyLanguage: 'auto', bannedWords: [], customRules: [] });
    expect(Object.keys(personas[0]!).sort()).toEqual(
      ['antiAiVoice', 'bannedWords', 'customRules', 'id', 'identity', 'name', 'replyLanguage', 'tone'].sort(),
    );
    expect(await activePersonaIdItem.getValue()).toBe(personas[0]!.id);
    await expect(readChunked(PERSONAS_KEY)).resolves.toEqual(personas);
  });

  it('seeds only once when several windows load at the same time', async () => {
    await Promise.all([listPersonas(), listPersonas(), listPersonas()]);
    expect(await listPersonas()).toHaveLength(1);
  });

  it('creates, reads, updates, and deletes', async () => {
    await listPersonas();
    const created = await createPersona(fields('Dev', { bannedWords: ['synergy'], customRules: ['Be brief'], antiAiVoice: false }));
    expect(created.id).toBeTruthy();
    expect(await getPersona(created.id)).toEqual(created);

    const updated = await updatePersona({ ...created, tone: 'Dry humor', replyLanguage: 'ja' });
    expect(await getPersona(created.id)).toEqual(updated);
    expect(updated.tone).toBe('Dry humor');

    await deletePersona(created.id);
    expect(await getPersona(created.id)).toBeUndefined();
    expect(await listPersonas()).toHaveLength(1);
  });

  it('sets the active persona and falls back to the first one when the stored ID is stale', async () => {
    const [seeded] = await listPersonas();
    const other = await createPersona(fields('Other'));
    await setActivePersona(other.id);
    expect((await getActivePersona()).id).toBe(other.id);

    await activePersonaIdItem.setValue('gone');
    expect((await getActivePersona()).id).toBe(seeded!.id);
  });

  it('rejects setting a missing persona active', async () => {
    await listPersonas();
    await expect(setActivePersona('missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('picks another persona when the active one is deleted', async () => {
    const [seeded] = await listPersonas();
    const other = await createPersona(fields('Other'));
    await setActivePersona(other.id);
    await deletePersona(other.id);
    expect(await activePersonaIdItem.getValue()).toBe(seeded!.id);
  });

  it('keeps the active persona when another one is deleted', async () => {
    const [seeded] = await listPersonas();
    const other = await createPersona(fields('Other'));
    await deletePersona(other.id);
    expect(await activePersonaIdItem.getValue()).toBe(seeded!.id);
  });

  it('seeds a fresh default after the last persona is deleted', async () => {
    const [seeded] = await listPersonas();
    await deletePersona(seeded!.id);
    const personas = await listPersonas();
    expect(personas).toHaveLength(1);
    expect(personas[0]!.id).not.toBe(seeded!.id);
    expect(await activePersonaIdItem.getValue()).toBe(personas[0]!.id);
  });

  it('does not lose updates from concurrent writes', async () => {
    await listPersonas();
    const [a, b] = await Promise.all([createPersona(fields('A')), createPersona(fields('B'))]);
    await Promise.all([
      updatePersona({ ...a!, tone: 'tone A' }),
      updatePersona({ ...b!, tone: 'tone B' }),
      createPersona(fields('C')),
      createPersona(fields('D')),
    ]);
    const personas = await listPersonas();
    expect(personas.map((persona) => persona.name).sort()).toEqual(['A', 'B', 'C', 'D', 'defaultPersonaName']);
    expect(personas.find((persona) => persona.id === a!.id)!.tone).toBe('tone A');
    expect(personas.find((persona) => persona.id === b!.id)!.tone).toBe('tone B');
  });

  it('rejects an update with not-found when another window deleted the persona first', async () => {
    await listPersonas();
    const target = await createPersona(fields('Target'));
    const [deleted, updated] = await Promise.allSettled([deletePersona(target.id), updatePersona({ ...target, tone: 'late edit' })]);
    expect(deleted.status).toBe('fulfilled');
    expect(updated.status).toBe('rejected');
    const reason = (updated as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(AppError);
    expect(reason).toMatchObject({ code: 'not-found' });
    expect(await getPersona(target.id)).toBeUndefined();
  });

  it('rejects deleting a persona that is already gone', async () => {
    await listPersonas();
    await expect(deletePersona('missing')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('stores personas larger than one sync item across chunks', async () => {
    await listPersonas();
    const long = '经验'.repeat(2000);
    await createPersona(fields('Big', { identity: long, customRules: ['😀'.repeat(1500)] }));
    const snapshot = await fakeBrowser.storage.sync.get(null);
    expect(snapshot[chunkCountKey(PERSONAS_KEY)]).toBeGreaterThan(1);
    expect((await listPersonas()).find((persona) => persona.name === 'Big')!.identity).toBe(long);
  });

  it('fills defaults for fields missing from stored data', async () => {
    await fakeBrowser.storage.sync.set({ personas__chunks: 1, personas__c0: JSON.stringify([{ id: 'old', name: 'Old' }, 'junk']) });
    expect(await listPersonas()).toEqual([
      { id: 'old', name: 'Old', identity: '', tone: '', replyLanguage: 'auto', bannedWords: [], customRules: [], antiAiVoice: true },
    ]);
  });

  it('surfaces a quota failure on save as storage-error', async () => {
    await listPersonas();
    vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('QUOTA_BYTES quota exceeded'));
    await expect(createPersona(fields('X'))).rejects.toMatchObject({ code: 'storage-error' });
  });

  it('notifies watchers about persona and active persona changes', async () => {
    await listPersonas();
    const callback = vi.fn();
    const unwatch = watchPersonas(callback);
    const created = await createPersona(fields('New'));
    expect(callback).toHaveBeenCalled();
    callback.mockClear();
    await setActivePersona(created.id);
    expect(callback).toHaveBeenCalled();
    unwatch();
  });
});
