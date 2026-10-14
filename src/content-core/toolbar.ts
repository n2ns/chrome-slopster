// The small toolbar injected after each content unit: Translate and, for reply
// targets, Draft reply. It lives in a shadow root so page CSS cannot restyle it.

const STYLE = `
:host { display: block; margin: 4px 0; font: 12px/1.4 system-ui, sans-serif; color: inherit; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
button { font: inherit; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 999px; padding: 1px 10px; cursor: pointer; opacity: .75; }
button:hover { opacity: 1; }
button:disabled { cursor: default; opacity: .45; }
button[aria-pressed="true"] { opacity: 1; font-weight: 600; }
.note { opacity: .7; }
/* The accent comes from --slopster-accent on the host (see setAccent); the fallback is the default preset. */
.output { white-space: pre-wrap; margin-top: 4px; padding: 6px 8px; border-left: 3px solid; border-left-color: var(--slopster-accent, #5b8def); border-radius: 4px; background: color-mix(in srgb, var(--slopster-accent, #5b8def) 10%, transparent); font-size: 14px; line-height: 1.5; }
.output.error { border-left-color: #d9534f; background: rgba(217, 83, 79, .08); }
`;

export interface Toolbar {
  host: HTMLElement;
  translateButton: HTMLButtonElement;
  addReplyButton(label: string, onClick: () => void): HTMLButtonElement;
  setNote(text: string): void;
  /** Show text below the buttons, or hide the output when text is null. */
  setOutput(text: string | null, isError?: boolean): void;
  isOutputVisible(): boolean;
  /** Set the accent color (#rrggbb) of the translation output. */
  setAccent(color: string): void;
}

export const TOOLBAR_ATTRIBUTE = 'data-sra-toolbar';

/** Insert a toolbar right after `unit` and return its controls. */
export function createToolbar(unit: HTMLElement, translateLabel: string): Toolbar {
  const host = unit.ownerDocument.createElement('div');
  host.setAttribute(TOOLBAR_ATTRIBUTE, '');
  // A slotted unit sits in its parent's shadow tree; an unslotted sibling would not render.
  if (unit.slot && unit.parentElement?.shadowRoot) host.slot = unit.slot;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${STYLE}</style><div class="row"><button type="button" data-action="translate"></button><span class="note"></span></div><div class="output" hidden></div>`;
  const row = root.querySelector('.row')!;
  const note = root.querySelector<HTMLElement>('.note')!;
  const output = root.querySelector<HTMLElement>('.output')!;
  const translateButton = root.querySelector<HTMLButtonElement>('[data-action="translate"]')!;
  translateButton.textContent = translateLabel;
  unit.insertAdjacentElement('afterend', host);

  return {
    host,
    translateButton,
    addReplyButton(label, onClick) {
      const button = unit.ownerDocument.createElement('button');
      button.type = 'button';
      button.dataset.action = 'reply';
      button.textContent = label;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      row.insertBefore(button, note);
      return button;
    },
    setNote(text) {
      note.textContent = text;
    },
    setOutput(text, isError = false) {
      output.hidden = text === null;
      output.textContent = text ?? '';
      output.classList.toggle('error', isError);
    },
    isOutputVisible() {
      return !output.hidden;
    },
    setAccent(color) {
      host.style.setProperty('--slopster-accent', color);
    },
  };
}
