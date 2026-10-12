import { expect, fixturePage, test } from './fixtures';

// Code passed to background.evaluate() runs in the extension service worker, where Chrome exposes `chrome`.
declare const chrome: typeof browser;

const STATUS_URL = 'https://x.com/DNetwork_4/status/2109314061410120106';
const REPLY = 'article[data-testid="tweet"] >> nth=1';

test.beforeEach(async ({ context }) => {
  await context.route('https://x.com/**', (route) => route.fulfill({ contentType: 'text/html', body: fixturePage('x', 'status.html') }));
  await context.route('https://translate.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([[['我以为它很结实', 'src']]]) }),
  );
});

test('translates a reply tweet', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(STATUS_URL);
  const toolbar = page.locator(REPLY).locator('[data-sra-toolbar]');
  await toolbar.locator('[data-action="translate"]').click();
  await expect(toolbar.locator('.output')).toHaveText('我以为它很结实');
});

test('selecting a reply tweet stores it as a comment target', async ({ context, background }) => {
  const page = await context.newPage();
  await page.goto(STATUS_URL);
  await page.locator(REPLY).locator('[data-sra-toolbar] [data-action="reply"]').click();
  await expect
    .poll(() =>
      background.evaluate(async () => {
        const all = await chrome.storage.session.get(null);
        const key = Object.keys(all).find((name) => name.startsWith('replyTarget:'));
        const thread = key ? (all[key] as { kind: string; author?: string; platform: string }) : null;
        return thread && `${thread.platform}:${thread.kind}:${thread.author}`;
      }),
    )
    .toBe('x:comment:@Triumph_talez');
});

test("opening X's reply dialog (URL /compose/post) keeps the reply target", async ({ context, background }) => {
  const page = await context.newPage();
  await page.goto(STATUS_URL);
  await page.locator(REPLY).locator('[data-sra-toolbar] [data-action="reply"]').click();
  const stored = () =>
    background.evaluate(async () => Object.keys(await chrome.storage.session.get(null)).filter((name) => name.startsWith('replyTarget:')).length);
  await expect.poll(stored).toBe(1);
  await page.evaluate(() => history.pushState(null, '', '/compose/post'));
  await page.waitForTimeout(1000);
  expect(await stored()).toBe(1);
});
