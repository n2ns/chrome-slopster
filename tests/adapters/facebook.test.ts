import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertIntoRichEditor } from '@/src/adapters/dom';
import { facebookAdapter } from '@/src/adapters/facebook';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'facebook');
const POST_PATH = '/AnhTraiVuotNganChongGai/posts/pfbid0XufPi2jLxKJsB5uFQ7G87wJm24RgJSnGeZaMwqcBFtNHx9bMry4BKp12hNJo3poYl';

function load(path: string, file: string): void {
  window.history.replaceState(null, '', path);
  document.body.innerHTML = readFileSync(join(FIXTURES, file), 'utf8');
}

const commentBy = (name: string) =>
  facebookAdapter.findReplyTargets(document).find((target) => facebookAdapter.extractThread(target).author === name)!;

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('facebook adapter on a post dialog', () => {
  it('offers the post first, then its comments, as reply targets', () => {
    load(POST_PATH, 'post-dialog.html');
    const threads = facebookAdapter.findReplyTargets(document).map((target) => facebookAdapter.extractThread(target));
    expect(threads[0]!.kind).toBe('post');
    expect(threads.slice(1).every((thread) => thread.kind === 'comment')).toBe(true);
    expect(threads.length).toBeGreaterThan(5);
  });

  it('extracts the post with its author, text, and URL', () => {
    load(POST_PATH, 'post-dialog.html');
    const thread = facebookAdapter.extractThread(facebookAdapter.findReplyTargets(document)[0]!);
    expect(thread).toMatchObject({ platform: 'facebook', author: 'Anh Trai Vượt Ngàn Chông Gai', url: `https://www.facebook.com${POST_PATH}` });
    expect(thread.body).toMatch(/^Gai Con ơiiiii/);
    expect(thread.comments.length).toBeGreaterThan(0);
  });

  it('extracts a comment with a stable per-comment URL and the post as context', () => {
    load(POST_PATH, 'post-dialog.html');
    const thread = facebookAdapter.extractThread(commentBy('Vũ Mạnh'));
    expect(thread.kind).toBe('comment');
    expect(thread.url).toMatch(new RegExp(`^https://www.facebook.com${POST_PATH}\\?comment_id=`));
    expect(thread.body).toBeTruthy();
    expect(thread.parentChain.at(-1)).toMatch(/^Gai Con ơiiiii/);
    const other = facebookAdapter.extractThread(commentBy('Thảo Nguyên'));
    expect(other.url).not.toBe(thread.url);
  });

  it("uses the reply box addressed to a comment's author, and the general box for the post", () => {
    load(POST_PATH, 'post-dialog.html');
    expect(facebookAdapter.findComposer(commentBy('Vũ Mạnh'))?.getAttribute('aria-label')).toBe('回复 Vũ Mạnh…');
    expect(facebookAdapter.findComposer(commentBy('Thảo Nguyên'))).toBeNull();
    expect(facebookAdapter.findComposer(facebookAdapter.findReplyTargets(document)[0]!)?.getAttribute('aria-label')).toBe('写评论…');
  });

  it('recognizes a reply box by the mention Facebook prefills when its label has no name (group posts)', () => {
    load(POST_PATH, 'post-dialog.html');
    const box = document.querySelector('[aria-label="回复 Vũ Mạnh…"]')!;
    box.setAttribute('aria-label', '写公开回复…');
    box.setAttribute('aria-placeholder', '写公开回复…');
    expect(facebookAdapter.findComposer(commentBy('Vũ Mạnh'))?.getAttribute('aria-label')).toBe('写公开回复…');
    expect(facebookAdapter.findComposer(facebookAdapter.findReplyTargets(document)[0]!)?.getAttribute('aria-label')).toBe('写评论…');
  });

  it('has one translatable unit for the post and one per comment', () => {
    load(POST_PATH, 'post-dialog.html');
    expect(facebookAdapter.findTranslatableUnits(document)).toHaveLength(facebookAdapter.findReplyTargets(document).length);
  });

  it("keeps the page's key while a post dialog is open", () => {
    load('/AnhTraiVuotNganChongGai', 'page-feed.html');
    expect(facebookAdapter.pageKey(document)).toBe('AnhTraiVuotNganChongGai');
    load('/somewhere/else/that/opened/a/dialog', 'post-dialog.html');
    expect(facebookAdapter.pageKey(document)).toBe('AnhTraiVuotNganChongGai');
  });
});

describe('facebook adapter on a page feed', () => {
  it('finds the post, its text without "See more", and its inline comment box', () => {
    load('/AnhTraiVuotNganChongGai', 'page-feed.html');
    const [post] = facebookAdapter.findReplyTargets(document);
    const thread = facebookAdapter.extractThread(post!);
    expect(thread.kind).toBe('post');
    expect(thread.body).not.toMatch(/展开$/);
    expect(facebookAdapter.findComposer(post!)?.getAttribute('aria-label')).toBe('写评论…');
  });

  it('keys pages, groups, and the home feed', () => {
    load('/groups/12345/posts/678', 'page-feed.html');
    expect(facebookAdapter.pageKey(document)).toBe('groups/12345');
    load('/', 'page-feed.html');
    expect(facebookAdapter.pageKey(document)).toBe('home');
  });
});

describe('facebook text insertion', () => {
  it('pastes the draft as one line, since a line break can post a Facebook comment', async () => {
    vi.stubGlobal('DataTransfer', class {
      data = '';
      setData(_type: string, value: string) {
        this.data = value;
      }
    });
    vi.stubGlobal('ClipboardEvent', class extends Event {
      clipboardData: { data: string };
      constructor(type: string, init: EventInit & { clipboardData: { data: string } }) {
        super(type, init);
        this.clipboardData = init.clipboardData;
      }
    });
    const editor = document.createElement('div');
    document.body.append(editor);
    const pasted: string[] = [];
    editor.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = (event as unknown as { clipboardData: { data: string } }).clipboardData.data;
      pasted.push(text);
      editor.textContent += text;
    });
    await expect(facebookAdapter.insertText(editor, 'Line one\n\nLine two')).resolves.toEqual({ ok: true });
    expect(pasted).toEqual(['Line one Line two']);
    vi.unstubAllGlobals();
  });

  it('never issues insertParagraph, which posts a Facebook comment', async () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.append(editor);
    const execCommand = vi.fn((command: string, _ui?: boolean, value?: string) => {
      if (command === 'insertText') editor.textContent += value ?? '';
      return true;
    });
    document.execCommand = execCommand as unknown as Document['execCommand'];
    await expect(facebookAdapter.insertText(editor, 'Line one\n\nLine two')).resolves.toEqual({ ok: true });
    expect(execCommand.mock.calls.map(([command]) => command)).not.toContain('insertParagraph');
    expect(editor.textContent).toBe('Line one Line two');
  });

  it('keeps paragraphs in the fallback for other platforms', async () => {
    const editor = document.createElement('div');
    document.body.append(editor);
    const execCommand = vi.fn((command: string, _ui?: boolean, value?: string) => {
      if (command === 'insertText') editor.textContent += value ?? '';
      return true;
    });
    document.execCommand = execCommand as unknown as Document['execCommand'];
    await insertIntoRichEditor(editor, 'a\nb');
    expect(execCommand.mock.calls.map(([command]) => command)).toContain('insertParagraph');
  });
});
