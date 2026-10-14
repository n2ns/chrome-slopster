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
import { getApiKeys } from '@/src/storage/items';
import { createPersona, defaultPersonaFields, getPersona, listPersonas, updatePersona } from '@/src/storage/personas';
import { saveApiKeys, saveSettings } from '@/src/storage/settings';
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
