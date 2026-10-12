import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockText, insertIntoRichEditor } from '@/src/adapters/dom';

class FakeDataTransfer {
  private data = new Map<string, string>();
  setData(type: string, value: string) {
    this.data.set(type, value);
  }
  getData(type: string) {
    return this.data.get(type) ?? '';
  }
}

class FakeClipboardEvent extends Event {
  clipboardData: FakeDataTransfer;
  constructor(type: string, init: EventInit & { clipboardData: FakeDataTransfer }) {
    super(type, init);
    this.clipboardData = init.clipboardData;
  }
}

/** An editor that, like Lexical, handles paste itself and updates its DOM asynchronously. */
function asyncPasteEditor(): HTMLElement {
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event as unknown as FakeClipboardEvent).clipboardData.getData('text/plain');
    setTimeout(() => {
      for (const line of text.split('\n')) editor.append(Object.assign(document.createElement('p'), { textContent: line }));
    }, 5);
  });
  document.body.append(editor);
  return editor;
}

describe('insertIntoRichEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('waits for an editor that applies a handled paste asynchronously, and inserts once', async () => {
    vi.stubGlobal('DataTransfer', FakeDataTransfer);
    vi.stubGlobal('ClipboardEvent', FakeClipboardEvent);
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    const editor = asyncPasteEditor();

    await expect(insertIntoRichEditor(editor, 'First line.\n\nSecond line.')).resolves.toEqual({ ok: true });
    expect(execCommand).not.toHaveBeenCalled();
    expect(blockText(editor)).toBe('First line.\n\nSecond line.');
  });

  it('rejects empty text', async () => {
    await expect(insertIntoRichEditor(document.createElement('div'), '  \n ')).resolves.toEqual({ ok: false, reason: 'rejected' });
  });
});
