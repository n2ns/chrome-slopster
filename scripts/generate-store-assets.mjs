// Generates the Chrome Web Store assets in store-assets/.
//
// Loads the built extension (.output/chrome-mv3; `npm run assets:store` builds
// it first) into headless Chromium, seeds generic demo data, captures real UI
// states, and composes them into marketing frames. Every request is routed:
// the forum pages are local mocks, and translation and AI calls get canned
// responses. Nothing reaches the network and no real API key is used.

/* global chrome -- functions passed to evaluate() and addInitScript() run in extension contexts. */

import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const EXTENSION = join(ROOT, '.output', 'chrome-mv3');
const OUT = join(ROOT, 'store-assets');

const PANEL = { width: 400, height: 860 };
const POST_URL = 'https://www.reddit.com/r/travel/comments/demo01/rail_pass_japan/';
const SUBMIT_URL = 'https://www.reddit.com/r/travel/submit';

// Brand colors from design/icon.svg.
const BRAND = '#EF3F43';
const BRAND_DARK = '#B8262B';

// ---------------------------------------------------------------------------
// Demo data (generic; no real people, accounts, or keys)

const PERSONAS = [
  {
    id: 'travel',
    name: 'Travel enthusiast',
    identity: 'Has backpacked on a budget for several years, mostly by train and bus.',
    tone: 'Friendly and practical. Short sentences, concrete details.',
    replyLanguage: 'auto',
    bannedWords: ['game-changer', 'hidden gem'],
    customRules: ['Share one concrete tip from experience.', 'Admit when you are not sure.'],
    antiAiVoice: true,
  },
  {
    id: 'cook',
    name: 'Home cook',
    identity: 'Cooks for a family of four on weeknights.',
    tone: 'Warm, relaxed, a little self-deprecating.',
    replyLanguage: 'auto',
    bannedWords: [],
    customRules: [],
    antiAiVoice: true,
  },
  {
    id: 'photo',
    name: 'Weekend photographer',
    identity: 'Shoots landscapes with an older mirrorless camera.',
    tone: 'Curious and encouraging.',
    replyLanguage: 'en',
    bannedWords: [],
    customRules: [],
    antiAiVoice: true,
  },
];

const POST = {
  title: '¿Vale la pena el pase de tren para recorrer Japón en dos semanas?',
  body: 'Estoy planeando mi primer viaje a Japón en primavera: Tokio, Kioto, Osaka e Hiroshima. He leído que el pase nacional ya no compensa después de la subida de precio. ¿Alguien lo ha calculado hace poco?',
};
const COMMENTS = [
  'Para esa ruta yo compraría billetes sueltos. El pase solo sale a cuenta si haces muchas excursiones de un día.',
  'Hay pases regionales mucho más baratos para la zona de Kansai. Échales un vistazo antes de decidir.',
];

/** Canned Google Translate results, keyed by source text. */
const TRANSLATIONS = {
  [POST.title]: 'Is the rail pass worth it for two weeks in Japan?',
  [POST.body]:
    "I'm planning my first trip to Japan in spring: Tokyo, Kyoto, Osaka and Hiroshima. I've read that the national pass no longer pays off after the price increase. Has anyone worked it out recently?",
  [COMMENTS[0]]: "For that route I'd buy single tickets. The pass only pays off if you take a lot of day trips.",
  [COMMENTS[1]]: 'There are much cheaper regional passes for the Kansai area. Take a look before you decide.',
};

const REPLY = {
  should_reply: true,
  reason: 'A practical question that matches your travel experience.',
  reply:
    'Lo calculé el año pasado para una ruta casi igual. Con ida y vuelta desde Tokio, el pase de 14 días apenas salía a cuenta. Si vas a hacer excursiones a Nara o Himeji, suma; si no, los billetes sueltos son más baratos. Compara los precios por tramo antes de decidir.',
  reply_native:
    'I worked it out last year for an almost identical route. With the round trip from Tokyo, the 14-day pass barely paid off. If you plan day trips to Nara or Himeji, it adds up; otherwise single tickets are cheaper. Compare the per-leg prices before you decide.',
  review_notes: 'Fares change often; check current prices before posting.',
};

const NEW_POST = {
  should_reply: true,
  reason: 'A clear question that fits the community and invites practical answers.',
  title: 'Packing for two weeks with a carry-on?',
  reply:
    "Heading out for two weeks in October with mixed weather, and I'd like to skip checked luggage this time. So far: three tops, one pair of trousers, a light rain jacket, and shoes I can walk in all day.\n\nWhat always earns its space in your bag, and what did you stop packing after the first trip?",
  reply_native: '',
  review_notes: '',
};

// ---------------------------------------------------------------------------
// Mock forum pages (served at reddit.com URLs so the content script runs)

const FORUM_STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef1f5; font: 15px/1.55 'Ubuntu Sans', system-ui, sans-serif; color: #1c2430; }
  .top { height: 52px; background: #fff; border-bottom: 1px solid #dfe3ea; display: flex; align-items: center; gap: 10px; padding: 0 24px; font-weight: 700; color: #3a4553; }
  .top .dot { width: 26px; height: 26px; border-radius: 50%; background: #9aa6b6; }
  .top .search { margin-left: auto; width: 200px; height: 30px; border-radius: 15px; background: #eef1f5; }
  .wrap { max-width: 700px; margin: 22px auto; padding: 0 20px; }
  shreddit-post, shreddit-comment, [slot] { display: block; }
  shreddit-post { background: #fff; border: 1px solid #dfe3ea; border-radius: 12px; padding: 18px 22px; }
  .meta { display: flex; align-items: center; gap: 8px; color: #6a7686; font-size: 13px; margin-bottom: 8px; }
  .meta b { color: #1c2430; }
  .avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-block; }
  [slot="title"] { font-size: 21px; font-weight: 700; line-height: 1.3; margin: 2px 0 6px; }
  [slot="text-body"] { margin: 12px 0 4px; }
  .stats { display: flex; gap: 18px; color: #6a7686; font-size: 13px; margin-top: 10px; }
  .comments { margin-top: 16px; background: #fff; border: 1px solid #dfe3ea; border-radius: 12px; padding: 6px 22px; }
  shreddit-comment { padding: 14px 0; border-bottom: 1px solid #edf0f4; }
  shreddit-comment:last-child { border-bottom: 0; }
  label.f { display: block; font-size: 13px; color: #6a7686; margin: 14px 0 6px; }
  .field { border: 1px solid #cdd4de; border-radius: 10px; padding: 12px 14px; min-height: 46px; background: #fff; }
  .field.big { min-height: 220px; }
`;

function forumShell(content) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>r/travel</title><style>${FORUM_STYLE}</style></head>
<body><div class="top"><span class="dot"></span>r/travel<span class="search"></span></div><div class="wrap">${content}</div></body></html>`;
}

function postPage() {
  const comment = (text, index, color) => `
    <shreddit-comment depth="0" author="commenter${index}" permalink="/r/travel/comments/demo01/rail_pass_japan/c${index}/">
      <div class="meta"><span class="avatar" style="background:${color}"></span><b>traveler_${index}</b> · ${index + 2} h</div>
      <div slot="comment"><p style="margin:0">${text}</p></div>
    </shreddit-comment>`;
  return forumShell(`
    <shreddit-post permalink="/r/travel/comments/demo01/rail_pass_japan/" subreddit-prefixed-name="r/travel" author="poster" post-title="${POST.title}">
      <div class="meta"><span class="avatar" style="background:#f2a65a"></span><b>r/travel</b> · posted 5 h ago</div>
      <h1 slot="title">${POST.title}</h1>
      <div slot="text-body"><p style="margin:0">${POST.body}</p></div>
    </shreddit-post>
    <div class="comments">${COMMENTS.map((text, index) => comment(text, index + 1, ['#6aa9e9', '#7cc496'][index])).join('')}</div>`);
}

function submitPage() {
  return forumShell(`
    <shreddit-post style="padding:22px">
      <div class="meta"><b>Create post</b> · r/travel</div>
      <r-post-composer-form>
        <label class="f">Title</label><div class="field"></div>
        <label class="f">Body</label>
        <shreddit-composer name="body"><div class="field big" contenteditable="true" role="textbox"></div></shreddit-composer>
      </r-post-composer-form>
    </shreddit-post>`);
}

// ---------------------------------------------------------------------------
// Capture

async function seed(worker) {
  await worker.evaluate(
    async ({ personas }) => {
      const serialized = JSON.stringify(personas);
      await chrome.storage.sync.set({
        personas__chunks: 1,
        personas__c0: serialized,
        activePersonaId: 'travel',
        settings: {
          translationEngine: 'google-free',
          aiEngine: 'gemini',
          models: { openai: '', deepseek: '', gemini: 'gemini-3.8-flash', claude: '' },
          operatorLanguage: 'en',
          autoTranslate: false,
          aiFallback: true,
          fontSize: 'medium',
          translationColor: '#5b8def',
        },
      });
      // A placeholder, not a real key: the AI endpoint is routed to canned output.
      await chrome.storage.local.set({ apiKeys: { openai: '', deepseek: '', gemini: 'demo-key-for-screenshots', claude: '' } });
    },
    { personas: PERSONAS },
  );
}

/** Make the panel, opened as a tab, act on the forum tab as if it were the active tab. */
function panelInitScript() {
  const original = chrome.tabs.query.bind(chrome.tabs);
  chrome.tabs.query = (query, ...rest) =>
    query && query.active ? original({ url: 'https://www.reddit.com/*' }, ...rest) : original(query, ...rest);
}

/**
 * Screenshot the panel with every textarea grown to fit its text (as if resized
 * by hand), scrolled so `scrollTo` sits right below the fixed header. With
 * `fitTo`, the shot ends just below that element instead of at the viewport.
 */
async function panelShot(panel, scrollTo, fitTo) {
  await panel.evaluate(() => {
    for (const area of document.querySelectorAll('textarea')) area.style.height = `${area.scrollHeight + 2}px`;
  });
  if (scrollTo) {
    await panel.evaluate((selector) => {
      const header = document.querySelector('.sidepanel-header').getBoundingClientRect().height;
      window.scrollBy(0, document.querySelector(selector).getBoundingClientRect().top - header - 12);
    }, scrollTo);
  }
  if (!fitTo) return panel.screenshot();
  const bottom = await panel.evaluate((selector) => document.querySelector(selector).getBoundingClientRect().bottom, fitTo);
  return panel.screenshot({ clip: { x: 0, y: 0, width: PANEL.width, height: Math.min(PANEL.height, Math.ceil(bottom) + 14) } });
}

async function capture() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, '--lang=en-US'],
  });
  const shots = {};
  try {
    await context.route(/^https?:\/\//, (route) => route.abort());
    await context.route('https://www.reddit.com/**', (route) => {
      const html = new URL(route.request().url()).pathname.includes('/submit') ? submitPage() : postPage();
      return route.fulfill({ contentType: 'text/html', body: html });
    });
    await context.route('https://translate.googleapis.com/**', (route) => {
      const source = new URLSearchParams(route.request().postData() ?? '').get('q')?.trim() ?? '';
      const text = TRANSLATIONS[source] ?? source;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([[[text, source]]]) });
    });
    let generation = REPLY;
    await context.route('https://generativelanguage.googleapis.com/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(generation) }] } }] }),
      }),
    );

    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const extensionId = new URL(worker.url()).host;
    await seed(worker);

    // 1. Translations on the page.
    const forum = await context.newPage();
    await forum.setViewportSize({ width: 760, height: 600 });
    await forum.goto(POST_URL);
    const translate = async (selector) => {
      const toolbar = forum.locator(`${selector} + [data-sra-toolbar]`).first();
      await toolbar.locator('[data-action="translate"]').click();
      await toolbar.locator('.output').waitFor();
    };
    await translate('shreddit-post [slot="title"]');
    await translate('shreddit-post [slot="text-body"]');
    await translate('shreddit-comment [slot="comment"]');
    shots.page = await forum.screenshot({ fullPage: true });

    // 2. Reply draft for the post, selected with the page's Draft reply button.
    await forum.locator('shreddit-post > [data-sra-toolbar] [data-action="reply"]').first().click();
    await forum.waitForTimeout(300);
    await forum.bringToFront();
    const panel = await context.newPage();
    await panel.addInitScript(panelInitScript);
    await panel.setViewportSize(PANEL);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.locator('.target').waitFor();
    await panel.locator('#intent').fill('Share what I found when I compared the pass with single tickets.');
    await panel.locator('#reply-flow .generate').click();
    await panel.locator('#reply-draft').waitFor();
    shots.reply = await panelShot(panel, '#reply-flow .target');

    // 3. New post for the open submit form.
    await forum.goto(SUBMIT_URL);
    await forum.waitForTimeout(500);
    generation = NEW_POST;
    await panel.reload();
    await panel.locator('.mode-switch button').nth(1).click();
    await panel.locator('#intent').fill('Ask for tips on packing light for two weeks with only a carry-on.');
    await panel.locator('#post-flow .generate').click();
    await panel.locator('#post-draft').waitFor();
    shots.post = await panelShot(panel, '#post-flow .target');

    // 4. Personas.
    await panel.reload();
    await panel.getByRole('button', { name: 'Personas' }).click();
    await panel.locator('.persona-list').waitFor();
    await panel.waitForTimeout(300);
    shots.personas = await panelShot(panel);

    // 5. AI settings.
    await panel.reload();
    await panel.locator('.header-actions button').nth(1).click();
    await panel.locator('#ai-engine').waitFor();
    await panel.waitForTimeout(300);
    shots.ai = await panelShot(panel, undefined, 'section:has(#ai-engine)');
  } finally {
    await context.close();
  }
  return shots;
}

// ---------------------------------------------------------------------------
// Composition

const dataUrl = (png) => `data:image/png;base64,${png.toString('base64')}`;
// The icon cropped to its rounded tile, so the tile can get a ring and a shadow on the brand background.
const ICON = `data:image/svg+xml;base64,${Buffer.from(
  readFileSync(join(ROOT, 'design', 'icon.svg'), 'utf8').replace('viewBox="0 0 128 128"', 'viewBox="8 8 112 112"'),
).toString('base64')}`;

const FRAME_STYLE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Ubuntu Sans', 'Ubuntu', sans-serif; color: #fff; overflow: hidden;
    background: radial-gradient(circle at 18% 12%, #F4585C 0%, ${BRAND} 38%, ${BRAND_DARK} 100%); }
  .mark { display: block; box-shadow: 0 0 0 2px rgba(255, 255, 255, .6), 0 8px 20px rgba(70, 8, 10, .3); }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 24px; font-weight: 700; }
  h1 { font-size: 52px; line-height: 1.1; font-weight: 800; letter-spacing: -0.5px; }
  p.caption { font-size: 22px; line-height: 1.45; color: rgba(255, 255, 255, .92); max-width: 500px; }
  .card { background: #fff; border-radius: 16px; overflow: hidden; flex: none;
    box-shadow: 0 30px 60px rgba(70, 8, 10, .35), 0 6px 16px rgba(70, 8, 10, .25); }
  .card img { display: block; width: 100%; }
  .bar { height: 30px; background: #e9ecf1; display: flex; align-items: center; gap: 7px; padding: 0 14px; }
  .bar i { width: 11px; height: 11px; border-radius: 50%; }
`;

function brandMark(size) {
  return `<img class="mark" src="${ICON}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size / 4)}px">`;
}

function page(width, height, style, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FRAME_STYLE}</style></head>
<body style="width:${width}px;height:${height}px;${style}">${body}</body></html>`;
}

/** A 1280x800 screenshot: brand, headline, and caption on the left, the capture in a card on the right. */
function screenshotFrame({ image, imageWidth, headline, caption, browserBar = false }) {
  const bar = browserBar ? '<div class="bar"><i style="background:#f26b5e"></i><i style="background:#f5bd4f"></i><i style="background:#5ec26a"></i></div>' : '';
  return page(
    1280,
    800,
    `display:flex;align-items:center;justify-content:space-between;padding:0 ${browserBar ? 80 : 130}px 0 100px`,
    `<div style="display:flex;flex-direction:column;gap:28px;max-width:${browserBar ? 460 : 560}px">
       <div class="brand">${brandMark(46)}Slopster</div>
       <h1>${headline}</h1>
       <p class="caption">${caption}</p>
     </div>
     <div class="card" style="width:${imageWidth}px">${bar}<img src="${image}"></div>`,
  );
}

function smallPromo() {
  return page(
    440,
    280,
    'display:flex;flex-direction:column;justify-content:center;gap:20px;padding:0 40px',
    `<div class="brand" style="font-size:40px;font-weight:800;gap:16px">${brandMark(60)}Slopster</div>
     <p style="font-size:21px;line-height:1.4;font-weight:600">Translate, reply and post.<br>You stay in control.</p>`,
  );
}

function marqueePromo(panelImage) {
  return page(
    1400,
    560,
    'position:relative',
    `<div style="position:absolute;left:100px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:26px">
       <div class="brand" style="font-size:50px;font-weight:800;gap:20px">${brandMark(72)}Slopster</div>
       <h1 style="font-size:50px">Translate, reply and post.<br>You stay in control.</h1>
       <p class="caption" style="max-width:640px">Read threads in your language and draft replies in your own voice on Reddit, X and Facebook.</p>
     </div>
     <div class="card" style="position:absolute;right:120px;top:64px;width:380px"><img src="${panelImage}"></div>`,
  );
}

async function render(browser, name, html, width, height) {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await tab.setContent(html, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.screenshot({ path: join(OUT, `${name}.png`) });
  await tab.close();
  console.log(`Created store-assets/${name}.png (${width}x${height})`);
}

const shots = await capture();
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const panel = 340;
  const frames = [
    ['screenshot-01-translate', { image: shots.page, imageWidth: 600, browserBar: true, headline: 'Read every thread<br>in your language', caption: 'Translate posts and comments in place on Reddit, X and Facebook.' }],
    ['screenshot-02-reply', { image: shots.reply, imageWidth: panel, headline: 'Draft replies<br>in your own voice', caption: 'Pick a post, say what you want to say, and review the draft with a copy in your language.' }],
    ['screenshot-03-new-post', { image: shots.post, imageWidth: panel, headline: 'Start new posts<br>from a rough idea', caption: 'Get a title and body that fit the community, then edit before you publish.' }],
    ['screenshot-04-personas', { image: shots.personas, imageWidth: panel, headline: 'Personas keep<br>your voice consistent', caption: 'Describe who you are, how you write, and what to avoid. Switch personas in one click.' }],
    ['screenshot-05-ai-settings', { image: shots.ai, imageWidth: panel, headline: 'Your engine,<br>your key, your model', caption: 'OpenAI, DeepSeek, Gemini or Claude. Keys stay on this device and never sync.' }],
  ];
  for (const [name, options] of frames) await render(browser, name, screenshotFrame({ ...options, image: dataUrl(options.image) }), 1280, 800);
  await render(browser, 'promo-small-440x280', smallPromo(), 440, 280);
  await render(browser, 'promo-marquee-1400x560', marqueePromo(dataUrl(shots.reply)), 1400, 560);
} finally {
  await browser.close();
}
