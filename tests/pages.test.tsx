// Smoke tests: the settings view and side panel render against fake storage.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import SidepanelApp from '@/entrypoints/sidepanel/App';
import { AiSettingsView } from '@/entrypoints/sidepanel/settings/AiSettingsView';
import { GeneralSettingsView } from '@/entrypoints/sidepanel/settings/GeneralSettingsView';
import { PersonasSettingsView } from '@/entrypoints/sidepanel/settings/PersonasSettingsView';
import { registerHandlers, type BackgroundMessages } from '@/src/messaging/protocol';
import { AppError } from '@/src/providers/types';
import { getApiKeys, getSettings } from '@/src/storage/items';
import { DEFAULT_PERSONA_ID, createPersona, defaultPersonaFields, getPersona, listPersonas, updatePersona } from '@/src/storage/personas';
import { saveApiKeys, saveSettings } from '@/src/storage/settings';
import { TRANSLATION_COLOR_PRESETS } from '@/src/storage/types';
import { installLocksPolyfill, mockI18n } from './helpers/browser';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

async function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(node));
  await settle();
}

async function settle() {
  for (let i = 0; i < 5; i += 1) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

function setValue(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('pages', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    installLocksPolyfill();
    mockI18n();
    vi.spyOn(fakeBrowser.i18n, 'getUILanguage').mockReturnValue('en');
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('AI settings view renders the engine, its API key, and its model, without personas', async () => {
    await render(<AiSettingsView />);
    const text = container.textContent ?? '';
    for (const key of ['apiKeysHeading', 'enginesHeading', 'aiFallback']) {
      expect(text).toContain(key);
    }
    expect(text).not.toContain('personasHeading');
    expect(text).not.toContain('adBlockHeading');
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1);
  });

  it('AI settings show the selected engine API key between the engine and the model', async () => {
    await render(<AiSettingsView />);
    const keyIds = () => [...container.querySelectorAll('input[id^="key-"]')].map((input) => input.id);
    expect(keyIds()).toEqual(['key-gemini']);
    const engine = container.querySelector<HTMLSelectElement>('#ai-engine')!;
    const key = container.querySelector('#key-gemini')!;
    const model = container.querySelector('#model-gemini')!;
    expect(engine.compareDocumentPosition(key) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(key.compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-gemini')!, 'unsaved-gemini'));
    await act(async () => {
      engine.value = 'openai';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(keyIds()).toEqual(['key-openai']);
    await act(async () => {
      engine.value = 'gemini';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(container.querySelector<HTMLInputElement>('#key-gemini')!.value).toBe('unsaved-gemini');
  });

  it('the saved notice belongs to the engine whose key was saved', async () => {
    await render(<AiSettingsView />);
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-gemini')!, 'gemini-key'));
    await act(async () => container.querySelector('#key-gemini')!.closest('form')!.requestSubmit());
    await settle();
    expect(container.querySelector('.key-field .status')).not.toBeNull();
    const engine = container.querySelector<HTMLSelectElement>('#ai-engine')!;
    await act(async () => {
      engine.value = 'openai';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(container.querySelector('.key-field .status')).toBeNull();
  });

  it('the translation engine is Google or the selected AI engine', async () => {
    await render(<AiSettingsView />);
    const options = [...container.querySelector<HTMLSelectElement>('#translation-engine')!.options].map((option) => option.value);
    expect(options).toEqual(['google-free', 'ai']);
  });

  it('AI settings show only the model select of the selected AI engine', async () => {
    await render(<AiSettingsView />);
    const modelSelects = () => [...container.querySelectorAll<HTMLSelectElement>('select[id^="model-"]')].map((select) => select.id);
    expect(modelSelects()).toEqual(['model-gemini']);
    const engine = container.querySelector<HTMLSelectElement>('#ai-engine')!;
    await act(async () => {
      engine.value = 'claude';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(modelSelects()).toEqual(['model-claude']);
  });

  it('general settings view renders language, font size, and ad blocking', async () => {
    await render(<GeneralSettingsView />);
    const text = container.textContent ?? '';
    for (const key of ['generalHeading', 'operatorLanguage', 'autoTranslate', 'fontSize', 'adBlockHeading']) {
      expect(text).toContain(key);
    }
    expect(text).not.toContain('apiKeysHeading');
  });

  it('general settings place the translation color between auto-translate and font size, with named presets', async () => {
    await render(<GeneralSettingsView />);
    const text = container.textContent ?? '';
    expect(text.indexOf('autoTranslate')).toBeLessThan(text.indexOf('translationColor'));
    expect(text.indexOf('translationColor')).toBeLessThan(text.indexOf('fontSize'));
    const swatches = [...container.querySelectorAll<HTMLButtonElement>('.color-swatches button')];
    expect(swatches.map((button) => button.getAttribute('aria-label'))).toEqual(TRANSLATION_COLOR_PRESETS.map((preset) => preset.label));
    expect(swatches.map((button) => button.title)).toEqual(TRANSLATION_COLOR_PRESETS.map((preset) => preset.label));
    expect(container.querySelector('input[type="color"]')!.getAttribute('aria-label')).toBe('translationColorCustom');
  });

  it('clicking a translation color preset saves it and marks it selected', async () => {
    await render(<GeneralSettingsView />);
    const swatch = (label: string) => container.querySelector<HTMLButtonElement>(`.color-swatches button[aria-label="${label}"]`)!;
    expect(swatch('colorBlue').getAttribute('aria-pressed')).toBe('true');
    expect(swatch('colorGreen').getAttribute('aria-pressed')).toBe('false');
    await act(async () => swatch('colorGreen').click());
    await settle();
    expect((await getSettings()).translationColor).toBe('#2e9d5b');
    expect(swatch('colorGreen').getAttribute('aria-pressed')).toBe('true');
    expect(swatch('colorBlue').getAttribute('aria-pressed')).toBe('false');
  });

  it('the custom translation color saves on change', async () => {
    await render(<GeneralSettingsView />);
    const input = container.querySelector<HTMLInputElement>('input[type="color"]')!;
    await act(async () => setValue(input, '#123456'));
    await settle();
    // Dragging in the picker fires input events only; nothing is written until change.
    expect((await getSettings()).translationColor).toBe('#5b8def');
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await settle();
    expect((await getSettings()).translationColor).toBe('#123456');
  });

  it('the selected translation color follows the stored value, preset or custom', async () => {
    await saveSettings({ translationColor: '#123456' });
    await render(<GeneralSettingsView />);
    const custom = () => container.querySelector<HTMLInputElement>('input[type="color"]')!;
    const pressed = () => [...container.querySelectorAll('.color-swatches button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'));
    expect(pressed()).toEqual([]);
    expect(custom().value).toBe('#123456');
    expect(custom().closest('.swatch')!.classList.contains('selected')).toBe(true);
    expect(container.querySelector<HTMLElement>('.color-preview')!.style.getPropertyValue('--preview-color')).toBe('#123456');

    await act(async () => void (await saveSettings({ translationColor: '#e5484d' })));
    await settle();
    expect(pressed()).toEqual(['colorRed']);
    expect(custom().closest('.swatch')!.classList.contains('selected')).toBe(false);
    expect(container.querySelector<HTMLElement>('.color-preview')!.style.getPropertyValue('--preview-color')).toBe('#e5484d');
  });

  it('shows and hides each API key on request', async () => {
    await render(<AiSettingsView />);
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="key-gemini"]')!;
    expect(input.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('showKey');
    await act(async () => toggle.click());
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('hideKey');
    expect(container.querySelector('#key-openai')).toBeNull();
    await act(async () => toggle.click());
    expect(input.type).toBe('password');
  });

  it('saving API keys does not overwrite a key another window changed meanwhile', async () => {
    await render(<AiSettingsView />);
    await act(async () => void (await saveApiKeys({ claude: 'claude-from-other-window' })));
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-gemini')!, 'gemini-here'));
    await act(async () => container.querySelector('#key-gemini')!.closest('form')!.requestSubmit());
    await settle();
    expect(await getApiKeys()).toMatchObject({ gemini: 'gemini-here', claude: 'claude-from-other-window' });
  });

  it('personas view renders the seeded persona and nothing else', async () => {
    await render(<PersonasSettingsView />);
    const text = container.textContent ?? '';
    expect(text).toContain('personasHeading');
    expect(text).toContain('defaultPersonaName');
    expect(text).not.toContain('apiKeysHeading');
  });

  it('the delete button is disabled for the built-in default persona only', async () => {
    await render(<PersonasSettingsView />);
    const deleteButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="personaDelete"]')!;
    expect(deleteButton().disabled).toBe(true);
    await act(async () => void (await createPersona({ ...defaultPersonaFields(), name: 'Second' })));
    await settle();
    const chip = [...container.querySelectorAll<HTMLButtonElement>('.persona-list button')].find((button) => button.textContent?.includes('Second'))!;
    await act(async () => chip.click());
    expect(deleteButton().disabled).toBe(false);
  });

  it('save buttons show only an icon with an accessible name', async () => {
    await render(<AiSettingsView />);
    const keySave = container.querySelector<HTMLButtonElement>('.key-field button[type="submit"]')!;
    expect(keySave.getAttribute('aria-label')).toBe('save');
    expect(keySave.textContent).toBe('');
    act(() => root.unmount());
    await render(<PersonasSettingsView />);
    const personaSave = container.querySelector<HTMLButtonElement>('.persona-editor button[type="submit"]')!;
    expect(personaSave.getAttribute('aria-label')).toBe('save');
    expect(personaSave.textContent).toBe('');
  });

  it('a persona field saves when it loses focus', async () => {
    await render(<PersonasSettingsView />);
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    await act(async () => setValue(tone, 'tone saved on blur'));
    await act(async () => tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect((await getPersona(DEFAULT_PERSONA_ID))!.tone).toBe('tone saved on blur');
  });

  it('a persona field that is blurred without changes writes nothing', async () => {
    await render(<PersonasSettingsView />);
    const write = vi.spyOn(fakeBrowser.storage.sync, 'set');
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    await act(async () => tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(write).not.toHaveBeenCalled();
  });

  it('the API key saves when its input loses focus', async () => {
    await render(<AiSettingsView />);
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    await act(async () => setValue(input, 'gemini-on-blur'));
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect((await getApiKeys()).gemini).toBe('gemini-on-blur');
  });

  it('blur followed by an immediate Save click writes the persona once', async () => {
    await render(<PersonasSettingsView />);
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    const write = vi.spyOn(fakeBrowser.storage.sync, 'set');
    await act(async () => setValue(tone, 'first'));
    await act(async () => tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    const oneSave = write.mock.calls.length;
    expect(oneSave).toBeGreaterThan(0);

    write.mockClear();
    await act(async () => setValue(tone, 'second'));
    await act(async () => {
      tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      tone.closest('form')!.requestSubmit();
    });
    await settle();
    expect(write.mock.calls.length).toBe(oneSave);
    expect((await getPersona(DEFAULT_PERSONA_ID))!.tone).toBe('second');
  });

  it('a persona field changed back while its blur save is running ends up stored as shown', async () => {
    await render(<PersonasSettingsView />);
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    const original = tone.value;
    // Hold the first storage write so the blur save is still running during the next edit.
    const realSet = fakeBrowser.storage.sync.set.bind(fakeBrowser.storage.sync);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async (items) => {
      await held;
      return realSet(items);
    });
    await act(async () => setValue(tone, 'temporary'));
    await act(async () => void tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    await act(async () => setValue(tone, original));
    await act(async () => void tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    release();
    await settle();
    await settle();
    expect((await getPersona(DEFAULT_PERSONA_ID))!.tone).toBe(original);
    expect(tone.value).toBe(original);
  });

  it('typing into the API key while its blur save runs is not overwritten', async () => {
    await render(<AiSettingsView />);
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    const realSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const set = vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
      await held;
      return realSet(items);
    });
    await act(async () => setValue(input, 'k1'));
    await act(async () => void input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    await act(async () => setValue(input, 'k12'));
    release();
    await settle();
    expect(input.value).toBe('k12');
    expect((await getApiKeys()).gemini).toBe('k1');
  });

  it('an API key save error stays visible after switching the AI engine', async () => {
    await render(<AiSettingsView />);
    vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota'));
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    await act(async () => setValue(input, 'will-fail'));
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(container.querySelector('.key-field .error')).not.toBeNull();
    const engine = container.querySelector<HTMLSelectElement>('#ai-engine')!;
    vi.spyOn(fakeBrowser.storage.sync, 'set');
    await act(async () => {
      engine.value = 'openai';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(container.querySelector('#key-openai')).not.toBeNull();
    expect(container.querySelector('.key-field .error')!.textContent).toContain('engineGemini');
  });

  it('an explicit key save with nothing changed clears an old error from another engine', async () => {
    await render(<AiSettingsView />);
    const failing = vi.spyOn(fakeBrowser.storage.local, 'set').mockRejectedValue(new Error('quota'));
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    const original = input.value;
    await act(async () => setValue(input, 'will-fail'));
    await act(async () => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    failing.mockRestore();
    await act(async () => setValue(input, original));
    const engine = container.querySelector<HTMLSelectElement>('#ai-engine')!;
    await act(async () => {
      engine.value = 'openai';
      engine.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await act(async () => container.querySelector('#key-openai')!.closest('form')!.requestSubmit());
    await settle();
    expect(container.querySelector('.key-field .error')).toBeNull();
  });

  it('no saved notice while the API key has text typed after the save started', async () => {
    await render(<AiSettingsView />);
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    const realSet = fakeBrowser.storage.local.set.bind(fakeBrowser.storage.local);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const set = vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementationOnce(async (items) => {
      await held;
      return realSet(items);
    });
    await act(async () => setValue(input, 'k1'));
    await act(async () => void input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    await act(async () => setValue(input, 'k12'));
    release();
    await settle();
    expect(container.querySelector('.key-field .status')).toBeNull();
  });

  it('no saved notice while a persona field has text typed after the save started', async () => {
    await render(<PersonasSettingsView />);
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    const realSet = fakeBrowser.storage.sync.set.bind(fakeBrowser.storage.sync);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async (items) => {
      await held;
      return realSet(items);
    });
    await act(async () => setValue(tone, 'saved part'));
    await act(async () => void tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    await act(async () => setValue(tone, 'saved part, still typing'));
    release();
    await settle();
    expect(container.querySelector('.persona-editor .status')).toBeNull();
  });

  it('deleting a persona right after editing it shows no not-found error', async () => {
    await act(async () => void (await createPersona({ ...defaultPersonaFields(), name: 'Doomed' })));
    await render(<PersonasSettingsView />);
    const chip = [...container.querySelectorAll<HTMLButtonElement>('.persona-list button')].find((button) => button.textContent?.includes('Doomed'))!;
    await act(async () => chip.click());
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    const realSet = fakeBrowser.storage.sync.set.bind(fakeBrowser.storage.sync);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async (items) => {
      await held;
      return realSet(items);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => setValue(tone, 'first edit'));
    await act(async () => void tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    await act(async () => setValue(tone, 'second edit'));
    const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="personaDelete"]')!;
    await act(async () => {
      tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      deleteButton.click();
    });
    release();
    await settle();
    await settle();
    expect((await listPersonas()).some((persona) => persona.name === 'Doomed')).toBe(false);
    expect(container.querySelector('.error')).toBeNull();
  });

  it('a persona name of only spaces is not saved', async () => {
    await render(<PersonasSettingsView />);
    const name = container.querySelector<HTMLInputElement>('#persona-name')!;
    await act(async () => setValue(name, '   '));
    await act(async () => name.closest('form')!.requestSubmit());
    await settle();
    expect((await getPersona(DEFAULT_PERSONA_ID))!.name).toBe('defaultPersonaName');
  });

  it('after a failed delete, edits to the persona still save', async () => {
    await act(async () => void (await createPersona({ ...defaultPersonaFields(), name: 'Kept' })));
    await render(<PersonasSettingsView />);
    const chip = [...container.querySelectorAll<HTMLButtonElement>('.persona-list button')].find((button) => button.textContent?.includes('Kept'))!;
    await act(async () => chip.click());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const failing = vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValue(new Error('quota'));
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="personaDelete"]')!.click());
    await settle();
    expect(container.querySelector('.error')).not.toBeNull();
    failing.mockRestore();
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    await act(async () => setValue(tone, 'edited after failed delete'));
    await act(async () => tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    const kept = (await listPersonas()).find((persona) => persona.name === 'Kept')!;
    expect(kept.tone).toBe('edited after failed delete');
  });

  it('a blur save skipped for an empty name tells the operator', async () => {
    await render(<PersonasSettingsView />);
    const name = container.querySelector<HTMLInputElement>('#persona-name')!;
    await act(async () => setValue(name, '  '));
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(container.querySelector('.persona-editor .error')!.textContent).toContain('personaNameRequired');
    await act(async () => setValue(name, 'Named again'));
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(container.querySelector('.persona-editor .error')).toBeNull();
    expect((await getPersona(DEFAULT_PERSONA_ID))!.name).toBe('Named again');
  });

  it('the empty-name notice clears when the original name is typed back', async () => {
    await render(<PersonasSettingsView />);
    const name = container.querySelector<HTMLInputElement>('#persona-name')!;
    const original = name.value;
    await act(async () => setValue(name, ''));
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(container.querySelector('.persona-editor .error')).not.toBeNull();
    await act(async () => setValue(name, original));
    await act(async () => name.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(container.querySelector('.persona-editor .error')).toBeNull();
  });

  it('edits dropped while a delete was pending are saved when the delete fails', async () => {
    await act(async () => void (await createPersona({ ...defaultPersonaFields(), name: 'Survivor' })));
    await render(<PersonasSettingsView />);
    const chip = [...container.querySelectorAll<HTMLButtonElement>('.persona-list button')].find((button) => button.textContent?.includes('Survivor'))!;
    await act(async () => chip.click());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const tone = container.querySelector<HTMLTextAreaElement>('#persona-tone')!;
    await act(async () => setValue(tone, 'typed before delete'));
    // The delete fails; the blur save queued behind it is dropped while it is pending.
    const failing = vi.spyOn(fakeBrowser.storage.sync, 'set').mockRejectedValueOnce(new Error('quota'));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="personaDelete"]')!.click();
      tone.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await settle();
    await settle();
    failing.mockRestore();
    await settle();
    const survivor = (await listPersonas()).find((persona) => persona.name === 'Survivor')!;
    expect(survivor.tone).toBe('typed before delete');
    // The delete error stays visible after the dropped edits are saved.
    expect(container.querySelector('.error')).not.toBeNull();
  });

  it('saving a persona keeps fields another window changed meanwhile', async () => {
    await render(<PersonasSettingsView />);
    const [persona] = await listPersonas();
    await act(async () => void (await updatePersona(persona!.id, { tone: 'tone from other window' })));
    await settle();
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#persona-name')!, 'Renamed here'));
    await act(async () => container.querySelector('#persona-name')!.closest('form')!.requestSubmit());
    await settle();
    expect(await getPersona(persona!.id)).toMatchObject({ name: 'Renamed here', tone: 'tone from other window' });
  });

  it('side panel lists personas and refreshes on change', async () => {
    await render(<SidepanelApp />);
    const select = container.querySelector<HTMLSelectElement>('#persona')!;
    expect(select.options).toHaveLength(1);

    await act(async () => void (await createPersona({ ...defaultPersonaFields(), name: 'Second' })));
    await settle();
    expect([...select.options].map((option) => option.text)).toContain('Second');
    expect(select.value).toBe((await listPersonas())[0]!.id);
  });

  it('side panel translates text and appends the truncation notice', async () => {
    registerHandlers<BackgroundMessages>({ translate: async ({ text }) => ({ text: `T:${text}`, truncated: true }) });
    await render(<SidepanelApp />);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#translate-input')!, 'hello'));
    await act(async () => container.querySelector('form')!.requestSubmit());
    await settle();
    expect(container.querySelector('.output')!.textContent).toBe('T:hello\n\ntranslationTruncated');
  });

  it('side panel navigation: fixed header, highlighted button, same button or title returns home, drafts kept', async () => {
    await render(<SidepanelApp />);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#translate-input')!, 'kept'));
    const nav = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('header button')].find((button) => button.getAttribute('aria-label') === label)!;
    const title = () => container.querySelector<HTMLButtonElement>('header button.home')!;
    const pressed = () => [...container.querySelectorAll<HTMLButtonElement>('header button[aria-pressed="true"]')].map((button) => button.getAttribute('aria-label'));
    const visible = (selector: string) => container.querySelector<HTMLElement>(selector)!.closest('[hidden]') === null;
    const headerText = () => container.querySelector('header')!.textContent;

    expect(pressed()).toEqual([]);
    await act(async () => nav('aiSettingsButton').click());
    await settle();
    expect(pressed()).toEqual(['aiSettingsButton']);
    expect(headerText()).toBe('sidepanelTitle');
    expect(container.querySelector('[aria-label="backButton"], button.back')).toBeNull();
    expect(visible('#key-gemini')).toBe(true);
    expect(visible('#translate-input')).toBe(false);

    // Another nav button switches directly; the same button again goes home.
    await act(async () => nav('settingsButton').click());
    await settle();
    expect(pressed()).toEqual(['settingsButton']);
    expect(visible('#font-size')).toBe(true);
    expect(visible('#key-gemini')).toBe(false);
    await act(async () => nav('settingsButton').click());
    expect(pressed()).toEqual([]);
    expect(visible('#translate-input')).toBe(true);

    // The title goes home too.
    await act(async () => nav('personasHeading').click());
    await settle();
    expect(pressed()).toEqual(['personasHeading']);
    expect(visible('#persona-name')).toBe(true);
    await act(async () => title().click());
    expect(pressed()).toEqual([]);
    expect(container.querySelector<HTMLTextAreaElement>('#translate-input')!.value).toBe('kept');
    expect(visible('#translate-input')).toBe(true);
    expect(visible('#persona-name')).toBe(false);
  });

  it('side panel header shows the extension icon before the title', async () => {
    await render(<SidepanelApp />);
    const icon = container.querySelector<HTMLImageElement>('header button.home img')!;
    expect(icon.getAttribute('src')).toBe('/icon/48.png');
    expect(icon.getAttribute('alt')).toBe('');
  });

  it('side panel applies the font size setting to the whole panel', async () => {
    await render(<SidepanelApp />);
    expect(document.documentElement.dataset.fontSize).toBe('medium');
    await act(async () => void (await saveSettings({ fontSize: 'large' })));
    await settle();
    expect(document.documentElement.dataset.fontSize).toBe('large');
  });

  it('side panel keeps unsaved settings edits when going back and returning', async () => {
    await render(<SidepanelApp />);
    const headerButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('header button')].find((button) => (button.getAttribute('aria-label') ?? button.textContent)?.includes(label))!;
    await act(async () => headerButton('aiSettingsButton').click());
    await settle();
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-gemini')!, 'unsaved-key'));
    await act(async () => headerButton('aiSettingsButton').click());
    await act(async () => headerButton('aiSettingsButton').click());
    expect(container.querySelector<HTMLInputElement>('#key-gemini')!.value).toBe('unsaved-key');
  });

  it('side panel opens the AI settings when an API key is missing', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async () => {
        throw new AppError('missing-api-key', 'no key');
      },
    });
    await render(<SidepanelApp />);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#translate-input')!, 'hello'));
    await act(async () => container.querySelector('form')!.requestSubmit());
    await settle();
    const link = [...container.querySelectorAll('button')].find((button) => button.textContent === 'openSettingsLink')!;
    await act(async () => link.click());
    await settle();
    expect(container.querySelector('header button[aria-pressed="true"]')!.getAttribute('aria-label')).toBe('aiSettingsButton');
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(1);
  });

  it('side panel shows a localized error when translation fails', async () => {
    registerHandlers<BackgroundMessages>({
      translate: async () => {
        throw new AppError('missing-api-key', 'no key');
      },
    });
    await render(<SidepanelApp />);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#translate-input')!, 'hello'));
    await act(async () => container.querySelector('form')!.requestSubmit());
    await settle();
    expect(container.querySelector('.error')!.textContent).toBe('errorMissingApiKey');
  });
});
