// DOM helpers shared by platform adapters.

import type { InsertResult } from './types';

const BLOCK_SELECTOR = 'p, li, pre, blockquote, h1, h2, h3, h4, h5, h6';

function collapse(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Plain text of a rich-text container, one paragraph per block element.
 * Works without layout (innerText is unavailable in jsdom and skips hidden text).
 */
export function blockText(element: Element): string {
  const leaves = [...element.querySelectorAll(BLOCK_SELECTOR)].filter((block) => !block.querySelector(BLOCK_SELECTOR));
  if (leaves.length === 0) return collapse(element.textContent);
  return leaves
    .map((block) => (block.tagName === 'PRE' ? (block.textContent ?? '').trim() : collapse(block.textContent)))
    .filter(Boolean)
    .join('\n\n');
}

/** Whether an element is rendered. Treated as visible where checkVisibility is unsupported (jsdom). */
export function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;
  return typeof element.checkVisibility === 'function' ? element.checkVisibility() : true;
}

function placeCaretAtEnd(editor: HTMLElement): void {
  const selection = editor.ownerDocument.getSelection();
  if (!selection) return;
  const range = editor.ownerDocument.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function firstLine(text: string): string {
  return text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
}

function contains(editor: HTMLElement, line: string): boolean {
  return collapse(editor.textContent).includes(collapse(line));
}

const SETTLE_TIMEOUT_MS = 1000;

/** Wait until the editor's DOM contains `line`; rich editors re-render after the event returns. */
async function waitForText(editor: HTMLElement, line: string): Promise<boolean> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  while (!contains(editor, line)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return true;
}

/**
 * Insert text at the end of a rich-text editor without sending anything.
 *
 * Rich editors (Lexical, Draft.js) keep their own model and ignore direct DOM
 * edits, so the text goes through the paths they listen to: first a synthetic
 * paste carrying text/plain (keeps paragraphs), then execCommand line by line.
 * Success is judged by the editor's DOM containing the text once it settles.
 * A paste the editor handled is never followed by the fallback, which would
 * insert the text twice.
 *
 * `singleLine: true` joins all lines with spaces before inserting anything, for
 * editors where a line break can act like Enter and submit (Facebook comments).
 */
export async function insertIntoRichEditor(editor: HTMLElement, rawText: string, { singleLine = false } = {}): Promise<InsertResult> {
  const text = singleLine ? rawText.split('\n').map((line) => line.trim()).filter(Boolean).join(' ') : rawText;
  const expected = firstLine(text);
  if (!expected) return { ok: false, reason: 'rejected' };
  editor.focus();
  placeCaretAtEnd(editor);

  if (typeof DataTransfer === 'function' && typeof ClipboardEvent === 'function') {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true });
    editor.dispatchEvent(event);
    if (event.defaultPrevented) return (await waitForText(editor, expected)) ? { ok: true } : { ok: false, reason: 'rejected' };
  }

  if (typeof editor.ownerDocument.execCommand === 'function') {
    text.split('\n').forEach((line, index) => {
      if (index > 0) editor.ownerDocument.execCommand('insertParagraph');
      if (line) editor.ownerDocument.execCommand('insertText', false, line);
    });
    if (await waitForText(editor, expected)) return { ok: true };
  }
  return { ok: false, reason: 'rejected' };
}
