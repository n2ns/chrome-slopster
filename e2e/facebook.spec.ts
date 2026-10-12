import { expect, fixturePage, test } from './fixtures';

// Code passed to background.evaluate() runs in the extension service worker, where Chrome exposes `chrome`.
declare const chrome: typeof browser;

const POST_URL = 'https://www.facebook.com/AnhTraiVuotNganChongGai/posts/pfbid0XufPi2jLxKJsB5uFQ7G87wJm24RgJSnGeZaMwqcBFtNHx9bMry4BKp12hNJo3poYl';
const COMMENT = '[role="article"][aria-label*="Vũ Mạnh"]';

test.beforeEach(async ({ context }) => {
  await context.route('https://www.facebook.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixturePage('facebook', 'post-dialog.html') }),
  );
  await context.route('https://translate.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([[['译文', 'src']]]) }),
  );
});

test('translates a comment', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(POST_URL);
  const toolbar = page.locator(`${COMMENT} [data-sra-toolbar]`).first();
  await toolbar.locator('[data-action="translate"]').click();
  await expect(toolbar.locator('.output')).toHaveText('译文');
});

test('selecting a comment stores it as the reply target', async ({ context, background }) => {
  const page = await context.newPage();
  await page.goto(POST_URL);
  await page.locator(`${COMMENT} [data-sra-toolbar] [data-action="reply"]`).first().click();
  await expect
    .poll(() =>
      background.evaluate(async () => {
        const all = await chrome.storage.session.get(null);
        const key = Object.keys(all).find((name) => name.startsWith('replyTarget:'));
        const thread = key ? (all[key] as { platform: string; kind: string; author?: string }) : null;
        return thread && `${thread.platform}:${thread.kind}:${thread.author}`;
      }),
    )
    .toBe('facebook:comment:Vũ Mạnh');
});
