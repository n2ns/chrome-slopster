// Smoke tests: the settings view and side panel render against fake storage.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import SidepanelApp from '@/entrypoints/sidepanel/App';
import { SettingsView } from '@/entrypoints/sidepanel/settings/SettingsView';
import { registerHandlers, type BackgroundMessages } from '@/src/messaging/protocol';
import { AppError } from '@/src/providers/types';
import { getApiKeys } from '@/src/storage/items';
import { createPersona, defaultPersonaFields, getPersona, listPersonas, updatePersona } from '@/src/storage/personas';
import { saveApiKeys } from '@/src/storage/settings';
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

  it('settings view renders every section and the seeded persona', async () => {
    await render(<SettingsView />);
    const text = container.textContent ?? '';
    for (const key of ['personasHeading', 'apiKeysHeading', 'enginesHeading', 'adBlockHeading', 'defaultPersonaName']) {
      expect(text).toContain(key);
    }
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(4);
  });

  it('shows and hides each API key on request', async () => {
    await render(<SettingsView />);
    const input = container.querySelector<HTMLInputElement>('#key-gemini')!;
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-controls="key-gemini"]')!;
    expect(input.type).toBe('password');
    expect(toggle.textContent).toBe('showKey');
    await act(async () => toggle.click());
    expect(input.type).toBe('text');
    expect(toggle.textContent).toBe('hideKey');
    expect(container.querySelector<HTMLInputElement>('#key-openai')!.type).toBe('password');
    await act(async () => toggle.click());
    expect(input.type).toBe('password');
  });

  it('saving API keys does not overwrite a key another window changed meanwhile', async () => {
    await render(<SettingsView />);
    await act(async () => void (await saveApiKeys({ claude: 'claude-from-other-window' })));
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-openai')!, 'openai-here'));
    await act(async () => container.querySelector('#key-openai')!.closest('form')!.requestSubmit());
    await settle();
    expect(await getApiKeys()).toMatchObject({ openai: 'openai-here', claude: 'claude-from-other-window' });
  });

  it('saving a persona keeps fields another window changed meanwhile', async () => {
    await render(<SettingsView />);
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

  it('side panel opens the settings in place and goes back with drafts kept', async () => {
    await render(<SidepanelApp />);
    await act(async () => setValue(container.querySelector<HTMLTextAreaElement>('#translate-input')!, 'kept'));
    const headerButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('header button')].find((button) => button.textContent?.includes(label))!;
    await act(async () => headerButton('settingsButton').click());
    await settle();
    expect(container.querySelector('header h1')!.textContent).toBe('optionsTitle');
    expect(container.textContent).toContain('apiKeysHeading');
    expect(container.querySelector<HTMLElement>('#translate-input')!.closest('[hidden]')).not.toBeNull();

    await act(async () => headerButton('backButton').click());
    expect(container.querySelector('header h1')!.textContent).toBe('sidepanelTitle');
    expect(container.querySelector<HTMLTextAreaElement>('#translate-input')!.value).toBe('kept');
    expect(container.querySelector<HTMLElement>('#translate-input')!.closest('[hidden]')).toBeNull();
    expect(container.querySelector<HTMLElement>('#key-openai')!.closest('[hidden]')).not.toBeNull();
  });

  it('side panel keeps unsaved settings edits when going back and returning', async () => {
    await render(<SidepanelApp />);
    const headerButton = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('header button')].find((button) => button.textContent?.includes(label))!;
    await act(async () => headerButton('settingsButton').click());
    await settle();
    await act(async () => setValue(container.querySelector<HTMLInputElement>('#key-openai')!, 'unsaved-key'));
    await act(async () => headerButton('backButton').click());
    await act(async () => headerButton('settingsButton').click());
    expect(container.querySelector<HTMLInputElement>('#key-openai')!.value).toBe('unsaved-key');
  });

  it('side panel opens the settings when an API key is missing', async () => {
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
    expect(container.querySelector('header h1')!.textContent).toBe('optionsTitle');
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(4);
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
