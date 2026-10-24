# Development

Slopster is a Chrome MV3 extension built with [WXT](https://wxt.dev), React, and TypeScript. The user-facing description is in [README.md](../README.md); the design is in [implementation-plan.md](implementation-plan.md) and open work in [TODO.md](../TODO.md).

## Setup

Uses Node 24, the version CI runs.

```bash
npm ci               # also runs `wxt prepare`
```

## Commands

```bash
npm run dev          # WXT dev mode with hot reload
npm run compile      # type check extension code (tsconfig.json) and tests/configs (tsconfig.node.json)
npm run lint         # eslint .
npm test             # Vitest unit and fixture tests
npm run build        # production build in .output/chrome-mv3
npm run check        # compile, lint, test, and build; run before every commit
npm run test:e2e     # build, then Playwright tests of the built extension
npm run zip          # packaged zip: .output/chrome-slopster-<version>-chrome.zip
```

`npm run zip` (`wxt zip`) is for local checks. Release zips are packaged by CI with the `zip` tool instead, because `wxt zip` writes invalid entry dates (see [PUBLISHING.md](PUBLISHING.md)).

Run a single test file: `npx vitest run tests/locales.test.ts`

## Loading a build in Chrome

Build with `npm run build` (or unzip a release zip), open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `.output/chrome-mv3` (or the unzipped folder).

## Project layout

- `entrypoints/`: WXT entry points: `background.ts`, the side panel (`sidepanel/`, with the personas, AI, and general settings views in `sidepanel/settings/`), and one content script per site (`reddit|x|facebook.content.ts`). Kept thin; logic lives in `src/`.
- `src/adapters/`: one `PlatformAdapter` per site (`types.ts` is the contract) plus shared DOM helpers. All site-specific selectors live here.
- `src/content-core/`: the platform-agnostic content script: page toolbars (Translate / Draft reply), ad hiding, and content-side message handlers.
- `src/messaging/protocol.ts`: every cross-context message, typed.
- `src/storage/`: storage items, chunked sync storage, personas.
- `src/providers/`, `src/translation/`, `src/prompt/`, `src/models/registry.ts`: AI and translation calls, prompt building and parsing, and the only list of model IDs.
- `src/i18n/` and `public/_locales/`: UI strings in `en`, `es`, and `zh_CN`. Every locale must have the same keys (a test enforces it).
- `src/ui/`: React helpers and base styles shared by the side panel views.
- `tests/`: Vitest tests; `tests/fixtures/<platform>/` holds sanitized page fragments saved from the real sites.
- `e2e/`: Playwright tests of the built extension.

Conventions and hard rules (never send, no promotion, keys in `chrome.storage.local` only, English-only docs) are in [CLAUDE.md](../CLAUDE.md).

## Testing

Tests come in three layers:

1. **Unit and fixture tests** (Vitest, jsdom): platform adapters run against page fragments saved from the real sites in `tests/fixtures/`; storage, providers, prompts, and the side panel against fakes.
2. **Extension end-to-end tests** (Playwright, `e2e/`): the built extension in Chromium, with every request answered by a route, so no login and no network. CI runs them on every push to `main` and on pull requests. Locally, install the browser once with `npx playwright install chromium`.
3. **Real-site checks** in a separate test Chrome profile, filling drafts and clearing them again without ever sending. See "Testing in a real browser" in [CLAUDE.md](../CLAUDE.md) for the shared test Chrome and how to load the build into it. Use test accounts only, at low frequency.

## Known limitations

- Site markup changes over time; when a site redesigns, refresh its fixtures in `tests/fixtures/` and update its adapter in `src/adapters/`.
- Facebook comment drafts are filled as one line (a line break there can post the comment). New Facebook posts keep their paragraphs.
- Ad detection on X and Facebook has not yet been checked against real ads.
- Only the desktop sites are supported (not `m.facebook.com` or `mobile.x.com`).

## Releases

Versioning, packaging, and Chrome Web Store publishing are described in [PUBLISHING.md](PUBLISHING.md). The store listing text is in [STORE-LISTING.md](STORE-LISTING.md).
