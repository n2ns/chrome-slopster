# chrome-slopster (Slopster) Implementation Plan

> Status: phases 0–6 implemented; replies and new posts checked end to end on the real sites on 2026-10-12. Open work is tracked in [TODO.md](../TODO.md). The project name is provisional.
> Reference project: `/home/deploy/_projects/chrome-smart-readit` (used only for design ideas; individual modules are ported by hand as needed, the codebase is not copied wholesale).

## 1. Goals and Boundaries

Assist the operator on Reddit, X, and Facebook:

- **Translation**: translate posts and comments on the page into the operator's language (manual button + optional lazy auto-translation).
- **Replying**: draft a reply from the post context and the selected persona profile, with a native-language side-by-side version, and fill it into the page's reply box.
- **New posts** (final phase): draft a new post and fill it into the post composer.
- **Ad blocking**: one independent toggle per platform, off by default.

Hard boundaries:

- **Only fill the input box; the operator clicks send manually.** The extension never clicks a send button, never simulates submission, and never performs bulk actions.
- No product promotion: no product info, promotional links, tracking links, or "promotion fit" style fields.
- Generated content must not impersonate anyone, fabricate first-hand experience, or hide the fact that it was drafted by AI; each platform's community rules take precedence.

## 2. Tech Stack

| Item | Choice |
|---|---|
| Extension framework | WXT (Vite-based, generates the MV3 manifest) |
| UI | React + TypeScript (`strict`) |
| Package manager | npm |
| Testing | Vitest + WXT's testing plugin (`fakeBrowser`) + jsdom page fixtures |
| Linting | ESLint (typescript-eslint) + `tsc --noEmit` |
| i18n | WXT i18n, with `en` and `zh_CN` message sets, following the browser language |

Exact dependency versions are determined from the official docs during Phase 0 setup and recorded in the lockfile.

## 3. Directory Structure

```
chrome-slopster/
├─ entrypoints/
│  ├─ background.ts                # Message routing, translation queue, provider calls, opening the side panel
│  ├─ sidepanel/                   # React: drafting, translation, filling
│  │  └─ settings/                 # React: personas, AI settings (engine, API key, model, translation) and general settings (language, font size, ad toggles), shown inside the side panel
│  ├─ reddit.content.ts            # Composition only: core + Reddit adapter
│  ├─ x.content.ts
│  └─ facebook.content.ts
├─ src/
│  ├─ adapters/
│  │  ├─ types.ts                  # PlatformAdapter interface
│  │  ├─ reddit.ts
│  │  ├─ x.ts
│  │  └─ facebook.ts
│  ├─ content-core/                # Platform-agnostic: scanning, translate buttons, lazy loading, entry buttons, ad toggle, filling
│  ├─ messaging/protocol.ts        # Type definitions for all cross-context messages
│  ├─ storage/                     # Storage item definitions, sync chunking, migrations
│  ├─ providers/                   # openai / deepseek / gemini / claude / google-free
│  ├─ translation/                 # Queue, cooldown, fallback, length truncation
│  ├─ prompt/                      # Prompt building, platform rules, tone rules, result parsing
│  ├─ models/registry.ts           # Single source of model IDs + aliases for old IDs
│  └─ ui/                          # React components and base styles shared by the side panel and its settings views
├─ public/_locales/{en,zh_CN}/messages.json
├─ tests/
│  ├─ fixtures/{reddit,x,facebook}/*.html   # Saved page fragments
│  └─ ...
├─ docs/
└─ wxt.config.ts
```

Each platform has its own content script entry point. WXT bundles the shared `content-core` into each one, so content scripts can use `import` normally.

## 4. Core Interfaces

### 4.1 Platform Adapter

```ts
type PlatformId = 'reddit' | 'x' | 'facebook';

interface ThreadContext {
  kind: 'post' | 'comment';
  platform: PlatformId;
  url: string;
  community?: string;        // r/xxx or Facebook group name; empty for X
  author?: string;
  title?: string;            // Reddit only
  body: string;
  parentChain: string[];     // Ancestor content when replying to a comment, nearest first
  comments: string[];        // Sample of existing replies, at most 5
}

interface PlatformAdapter {
  id: PlatformId;
  matches: string[];
  /** Translatable content units on the page (posts, comments) */
  findTranslatableUnits(root: ParentNode): HTMLElement[];
  /** Extract plain text from a content unit */
  extractText(unit: HTMLElement): string;
  /** Content units that get a reply button */
  findReplyTargets(root: ParentNode): HTMLElement[];
  /** Extract the reply target and its context */
  extractThread(target: HTMLElement): ThreadContext;
  /** Find the current reply box: prefer the focused one, then a visible one */
  findComposer(target?: HTMLElement): HTMLElement | null;
  /** Write text without sending */
  insertText(composer: HTMLElement, text: string): InsertResult;
  /** Ad nodes (called only when the corresponding toggle is on) */
  findAds(root: ParentNode): HTMLElement[];
  constraints: { maxReplyLength?: number };  // 280 for X
}

type InsertResult = { ok: true } | { ok: false; reason: 'not-found' | 'rejected' };
```

Unified text insertion strategy: `focus` first, then `execCommand('insertText')`; on failure fall back to a simulated paste event (required by the Lexical / Draft.js editors used by Facebook and X); only as a last resort assign the value directly and dispatch an `input` event. Each platform may override this order.

### 4.2 Message Protocol

All messages are defined in `src/messaging/protocol.ts` as typed request/response maps and sent through typed wrappers (`sendToBackground`, `sendToTab`, `registerHandlers`). Failures cross contexts as an `AppError` with a machine-readable `ErrorCode`; only UI code maps codes to i18n text, so the background never produces localized strings. Once the extension context is invalidated, the content script stops sending messages, detecting this via WXT's `ctx.isInvalid` / `ctx.onInvalidated`, and stops its observers.

| Direction | Message | Purpose |
|---|---|---|
| content → bg | `translate {text, targetLang}` | Translate a piece of text |
| content → bg | `selectReplyTarget {thread}` | A reply button on the page was clicked: write the reply target to `session` and open the side panel |
| content → bg | `clearReplyTarget {}` | The selected target left the page, or the content script started on a new document: forget the tab's reply target. URL changes alone do not clear it, because X opens its reply dialog at `/compose/post` |
| sidepanel → bg | `generate {mode, thread, persona, intent, operatorLanguage}` | Generate a reply or post; the side panel sends the full persona so the background does not read persona storage |
| sidepanel → bg | `translate` | Translate the draft |
| sidepanel → content | `getThreadContext` | When no reply target is selected, read the main post on the current page |
| sidepanel → content | `insertText {text, thread}` | Fill the reply box of the target the draft was generated for (matched by `thread.url`); not-found when it is not on the page |

Risk: `chrome.sidePanel.open()` must be called within a user gesture. Whether the gesture still counts after a click in the content script is relayed to the background via a message must be tested in Phase 2. If it does not, fall back to: write only the reply target, show a hint on the extension icon, and let the operator click the icon to open the side panel.

### 4.3 Storage Schema

| Area | Key | Content |
|---|---|---|
| `sync` | `personas` (chunked) | Array of persona profiles |
| `sync` | `activePersonaId` | Current persona |
| `sync` | `settings` | Translation engine, AI engine, models, target language, auto-translate, AI fallback, font size, etc.; no secrets |
| `sync` | `adBlock` | `{ reddit: false, x: false, facebook: false }` |
| `local` | `apiKeys` | `{ openai, deepseek, gemini, claude }`, **stored on this device only** |
| `session` | `googleFreeCooldownAt` | Start of the Google free translation cooldown |
| `session` | `replyTarget:<tabId>` | Reply target selected on the page |

Persona profile:

```ts
interface Persona {
  id: string;
  name: string;
  identity: string;          // Who I am and my background (guides how to speak; must not fabricate experience)
  tone: string;              // Tone description
  replyLanguage: 'auto' | string;  // auto = follow the post's language
  bannedWords: string[];
  customRules: string[];
  antiAiVoice: boolean;      // Whether the anti-AI-voice rules are enabled
}
```

A single `sync` item is capped at 8KB, so `personas` is written with chunked storage. The chunking follows the reference project's `chunked-sync-storage.js`: never split inside a UTF-16 surrogate pair, and report an error on a missing chunk rather than parsing it as truncated JSON. All storage items are defined with WXT's `storage.defineItem` and versioned; future schema changes go through migration functions.

### 4.4 Generation Result

The model must return JSON:

```json
{
  "should_reply": true,
  "reason": "…",
  "reply": "Reply in the target language",
  "reply_native": "Side-by-side translation in the operator's native language",
  "review_notes": "Points needing human attention"
}
```

Parsing must be lenient about field types ("boolean" fields may be strings, text fields may be objects). On parse failure, show the raw output and disable the "Fill" button. This follows the approach of the reference project's `reply-result.js`.

## 5. Module Notes

- **providers**: OpenAI and DeepSeek share an OpenAI-compatible implementation; Gemini is implemented separately, with the API key in the `x-goog-api-key` request header rather than the URL; Claude uses the Messages API and, when called directly from the browser, needs the `anthropic-dangerous-direct-browser-access: true` request header. All four share the same system prompt.
- **models/registry.ts**: two tiers per vendor (flagship + budget). Model IDs are verified against each vendor's official docs at implementation time, never written from memory; retired IDs go into the alias table.
- **translation**: concurrency cap of 3, with random staggering between tasks; Google free translation cools down for 5 minutes after a 429; optional fallback to AI; the truncation notice is appended after the translation and never concatenated into the source text.
- **prompt**: platform rules live in one file per platform (Reddit / X / Facebook) and are always placed near the top of the prompt, outside the reach of length-budget truncation; anti-AI-voice rules govern tone only and are controlled by the persona's `antiAiVoice`; length-budget truncation preserves the trailing JSON format description; for X, the 280-character limit is written into the prompt and the length is checked again after generation.
- **content-core**: throttled page scanning with MutationObserver; translate and reply buttons use Shadow DOM to isolate styles (WXT `createShadowRootUi`).
- **i18n**: all UI text goes through i18n, with no hard-coded Chinese or English in components; the same applies to error messages.

## 6. Permissions

```
permissions: storage, sidePanel
host_permissions:
  https://www.reddit.com/*, https://reddit.com/*
  https://x.com/*, https://twitter.com/*
  https://www.facebook.com/*
  https://translate.googleapis.com/*
  https://api.openai.com/*, https://api.deepseek.com/*,
  https://generativelanguage.googleapis.com/*, https://api.anthropic.com/*
```

`m.facebook.com` and `mobile.x.com` have different DOMs and are out of scope.

## 7. Automated Testing

During development, Claude runs the tests automatically, instead of relying on manual testing after syncing to Windows.

| Layer | Content | Environment | When |
|---|---|---|---|
| 1 Unit + page fixtures | Adapters tested against saved Reddit / X / Facebook page fragments: finding content, extracting context, finding the reply box, writing text; plus providers, storage, prompt | Vitest + jsdom, offline | Every commit |
| 2 Extension end-to-end | Playwright loads the build output; request interception serves local page fragments for URLs such as `https://www.reddit.com/...`, and content scripts inject as usual; tests cover translate buttons, side panel generation, and filling the reply box; AI and translation APIs are stubbed | Headless browser, no login, no network | At the end of each phase |
| 3 Real-site smoke | Via chrome-devtools MCP: load or reload the extension, open real pages, inspect DOM snapshots, check translations, generate replies or new posts with real APIs, fill them in, read the input box back to verify, then clear it; when selectors break, use it to capture fresh page fragments | Windows test Chrome (see below) | After each platform is integrated, and when selectors break |

**Layer 3 environment**:
- Uses this machine's shared test Chrome (shared by all projects, not part of this project): `~/.local/bin/chrome-test` launches Chrome on Windows with the separate data directory `C:\Users\James\AppData\Local\ChromeTest\UserData`, with `--remote-debugging-port=9222 --enable-unsafe-extension-debugging`.
- The chrome-devtools MCP launch command is `~/.local/bin/chrome-devtools-mcp-test`: it first ensures the test Chrome is running, then connects via `--browserUrl http://127.0.0.1:9222` (relies on WSL mirrored networking).
- The extension is loaded directly from `\\wsl.localhost\Ubuntu_26\home\deploy\_projects\chrome-slopster\.output\chrome-mv3`. Verified on 2026-10-12: CDP `Extensions.loadUnpacked` can load an extension from a `\\wsl.localhost` path, so no sync to Windows is needed.
- The operator logs in to the test accounts once in this profile by hand; the login state persists in the profile directory.

**Layer 3 hard rules**:
- Never click a send / post / submit button under any circumstances; only fill, verify, then clear the input box.
- Use test accounts only, and keep access frequency low.
- Pause on login pages, CAPTCHAs, or risk-control prompts and hand over to the operator.

## 8. Phases, Completion Criteria, and Verification

At the end of each phase: `tsc` and ESLint pass, `npm test` passes in full, `npm run build` succeeds, then commit.

| Phase | Content | Completion criteria | Verification |
|---|---|---|---|
| 0 Setup | Initialize WXT (React + TS), ESLint, Vitest, bilingual i18n, `git init`, project CLAUDE.md | The empty extension loads unpacked; side panel and options page open; Chinese/English text switches with the browser language | Build + manual load in Chrome |
| 1 Core | Storage (with chunking and versioning), message protocol, four providers, model registry, translation pipeline, prompt building and result parsing; options page (persona CRUD, API keys, models, ad toggles); side panel skeleton | Personas can be created, edited, and deleted on the options page and stay consistent across windows; API keys appear only in `local`; unit tests for all four providers pass | Unit tests (`fakeBrowser`, fetch stub) + manual use of the options page |
| 2 Reddit | Reddit adapter: translate buttons, auto-translation, reply buttons, context extraction, filling, ad toggle | On a Reddit post page, "translate → select post or comment → generate → fill" works end to end, with no automatic sending; the `sidePanel.open` gesture question is verified | Fixture-based adapter tests + a manual run-through on real pages |
| 3 X | X adapter | Same as above, plus a warning when exceeding 280 characters | Same as above |
| 4 Facebook | Facebook adapter | Same as above; selectors rely only on attributes such as `role`, `aria-*`, `dir` | Same as above |
| 5 New posts | Post composer adaptation for all three platforms; "post" mode in the side panel (Reddit with title and subreddit) | New posts can be drafted and filled on all three platforms, with no automatic sending | Tests + manual use |
| 6 Release prep | PRIVACY, SECURITY, README, packaged zip | Docs clearly state where data goes (`sync` / `local`, third-party APIs) | Check docs and links |

**Commit points**: commit once after all completion criteria of a phase are met. The repository has no remote yet; push once a remote is configured.

**Review intensity** (per global rules):
- Phase 1 storage, message protocol, and API key storage are high risk: review → fix → re-review.
- Phase 2–5 adapters and UI are normal risk: one review round.
- Phase 6 docs are low risk: self-check.

**Parallelism**: once the interfaces (Section 4) are committed, Phase 1 can be split into "providers + translation" and "storage + options page", worked on in parallel in two worktrees; Phases 2–4 depend on each other and are done sequentially.

## 9. Open Items

Tracked in [TODO.md](../TODO.md).
