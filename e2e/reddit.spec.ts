import { expect, fixturePage, test } from './fixtures';

// Code passed to background.evaluate() runs in the extension service worker, where Chrome exposes `chrome`.
declare const chrome: typeof browser;

const POST_URL = 'https://www.reddit.com/r/selfhosted/comments/1x3m5xo/why_selfhost/';
const COMMENT = 'shreddit-comment[thingid="t1_pfccwzm"]';

test.beforeEach(async ({ context }) => {
  await context.route('https://www.reddit.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixturePage('reddit', 'post-page.html') }),
  );
  await context.route('https://translate.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([[['已翻译的评论', 'src']]]) }),
  );
});

test('injects toolbars and translates a comment through the background', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(POST_URL);
  const toolbar = page.locator(`${COMMENT} [data-sra-toolbar]`).first();
  await expect(toolbar.locator('[data-action="translate"]')).toBeVisible();
  await toolbar.locator('[data-action="translate"]').click();
  await expect(toolbar.locator('.output')).toHaveText('已翻译的评论');
});

test('selecting a comment stores it as the reply target for the tab', async ({ context, background }) => {
  const page = await context.newPage();
  await page.goto(POST_URL);
  await page.locator(`${COMMENT} [data-sra-toolbar] [data-action="reply"]`).first().click();
  await expect
    .poll(() =>
      background.evaluate(async () => {
        const all = await chrome.storage.session.get(null);
        const key = Object.keys(all).find((name) => name.startsWith('replyTarget:'));
        return key ? (all[key] as { author?: string }).author : null;
      }),
    )
    .toBe('Beautiful_Ad_4813');
});

test('hides ads while the Reddit toggle is on', async ({ context, background }) => {
  await background.evaluate(() => chrome.storage.sync.set({ adBlock: { reddit: true, x: false, facebook: false } }));
  const page = await context.newPage();
  await page.goto(POST_URL);
  await expect(page.locator('shreddit-comments-page-ad')).toBeHidden();
  await background.evaluate(() => chrome.storage.sync.set({ adBlock: { reddit: false, x: false, facebook: false } }));
  await expect(page.locator('shreddit-comments-page-ad')).not.toHaveAttribute('data-sra-hidden-ad');
});
