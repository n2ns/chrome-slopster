# Social Reply Assistant

A Chrome extension that helps you read and take part in conversations on **Reddit**, **X**, and **Facebook**:

- **Translate** posts and comments in place, on demand or automatically as they scroll into view.
- **Draft replies** to a post or a comment with an AI model, in the voice of a persona you define, with a copy in your own language for review.
- **Draft new posts** for a subreddit, your X timeline, or a Facebook group or page.
- **Fill** a reviewed draft into the right reply or post box with one click.
- Optionally **hide ads**, separately for each site.

The extension never sends or publishes anything. You review every draft and post it yourself.

## How it works

1. Open the side panel from the toolbar icon (or click **Draft reply** under any post or comment).
2. Pick a persona and, optionally, say what you want the reply to get across.
3. Click **Generate**. The panel shows whether replying seems appropriate, the draft, a translation in your language, and notes for review.
4. Edit the draft if needed. Open the site's own reply box (or new-post form), then click **Fill**.
5. Read it once more on the page and send it yourself.

Settings open inside the side panel from the three icons at its top right, and **Back** returns to your draft. **Personas**: persona profiles. **AI settings**: the AI engine (OpenAI, DeepSeek, Gemini, or Claude), used everywhere, with its API key and model shown below it; translation engine (free Google Translate or the selected AI engine, with optional AI fallback when Google is rate limited). **Settings**: your language; auto-translate; font size of the side panel; ad blocking per site. The interface is available in English and Simplified Chinese and follows the browser language.

See [PRIVACY.md](PRIVACY.md) for what is stored and what is sent where, and [SECURITY.md](SECURITY.md) for how keys and drafts are handled.

## Responsible use

Drafts are suggestions for a person to review, not automated posting. Generated text must not impersonate anyone, invent experiences you did not have, or hide an affiliation, and every community's own rules come first. The prompts sent to the model state these rules for every platform.

## Install

From a release zip: unzip it, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the unzipped folder.

From source (Node 22 or later):

```bash
npm ci
npm run build        # output in .output/chrome-mv3, load it as an unpacked extension
npm run zip          # .output/social-reply-assistant-<version>-chrome.zip
```

## Development

```bash
npm run dev          # WXT dev mode with hot reload
npm run check        # type check, lint, unit tests, build (run before every commit)
npm run test:e2e     # build, then Playwright tests of the built extension
```

Tests come in three layers:

1. **Unit and fixture tests** (Vitest, jsdom): platform adapters run against page fragments saved from the real sites in `tests/fixtures/`; storage, providers, prompts, and the side panel against fakes.
2. **Extension end-to-end tests** (Playwright, `e2e/`): the built extension in Chromium, with every request answered by a route, so no login and no network.
3. **Real-site checks** in a separate test Chrome profile, filling drafts and clearing them again without ever sending.

Project layout, conventions, and the design are described in [CLAUDE.md](CLAUDE.md) and [docs/implementation-plan.md](docs/implementation-plan.md).

## Known limitations

- Site markup changes over time; when a site redesigns, its adapter in `src/adapters/` and the saved fixtures need updating.
- Facebook comment drafts are filled as one line (a line break there can post the comment). New Facebook posts keep their paragraphs.
- Ad detection on X and Facebook has not yet been checked against real ads.
- Only the desktop sites are supported (not `m.facebook.com` or `mobile.x.com`).
