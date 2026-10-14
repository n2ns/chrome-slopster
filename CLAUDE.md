# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Chrome MV3 extension (WXT + React + TypeScript) that translates posts and drafts operator-reviewed replies and new posts on Reddit, X, and Facebook. The design lives in [docs/implementation-plan.md](docs/implementation-plan.md) and open work in [TODO.md](TODO.md); read both before starting new work.

## Hard rules

- **Never send.** The extension only fills text into a composer. No code path may click a send / post / submit button, simulate submission, or act in bulk. The same applies to Claude during real-site testing: fill, read back, clear.
- **No promotion.** No product info, promotional or tracking links, or promotion-fit fields.
- **English only** for all project documentation and code comments. UI text goes through i18n (`en` and `zh_CN`), never hard-coded in components.
- API keys live in `chrome.storage.local` only, never in `sync`.

## Commands

```bash
npm run compile   # tsc for extension code (tsconfig.json) and for tests/configs (tsconfig.node.json)
npm run lint      # eslint .
npm test          # vitest run
npm run build     # wxt build -> .output/chrome-mv3
npm run check     # all of the above; must pass before every commit
npm run dev       # wxt dev mode with hot reload
npm run test:e2e  # build, then Playwright tests of the built extension (e2e/, all network routed)
npm run zip       # packaged zip in .output/
```

Run a single test file: `npx vitest run tests/locales.test.ts`

## Layout

- `entrypoints/`: WXT entry points (`background.ts`, `sidepanel/` with the personas, AI, and general settings views in `sidepanel/settings/`, `reddit|x|facebook.content.ts`). Keep them thin; logic lives in `src/`.
- `src/adapters/`: one `PlatformAdapter` per site (`types.ts` is the contract) plus shared DOM helpers (`dom.ts`: rich-editor insertion via synthetic paste). All site-specific selectors live here, never class names.
- `src/content-core/`: platform-agnostic content script: toolbars (Translate / Draft reply) in shadow roots, ad hiding, and the content-side message handlers. Fills are always resolved from the thread or post target the draft was generated for.
- `src/messaging/protocol.ts`: every cross-context message, typed. Errors cross as `AppError` codes; only UI code localizes them.
- `src/storage/`: storage items, chunked sync storage, personas (Web Locks, local backup).
- `src/providers/`, `src/translation/`, `src/prompt/`, `src/models/registry.ts`: AI and translation calls, queue/cooldown/fallback, prompt building and parsing, the only list of model IDs.
- `src/i18n/`: `t()` wraps `browser.i18n.getMessage`. Message keys are typed from `public/_locales/en/messages.json`, so adding a string means adding it to **every** locale (a test enforces identical key sets).
- `src/ui/`: React helpers and base styles (`styles.css`) shared by the side panel and its settings views. Icons come from `lucide-react`; no emoji in the UI.
- `tests/`: Vitest with jsdom and WXT's `fakeBrowser` (via `WxtVitest`); `tests/fixtures/<platform>/` holds sanitized page fragments saved from the real sites (no account names or tracking parameters).
- `e2e/`: Playwright tests of the built extension against the fixtures, with every request routed.

## Testing in a real browser

A shared Windows test Chrome (separate data directory, debugging port 9222) is used for all real-browser checks:

- `chrome-test` starts it if it is not running; the chrome-devtools MCP server connects to it automatically.
- Load the build straight from WSL: `\\wsl.localhost\Ubuntu_26\home\deploy\_projects\social-reply-assistant\.output\chrome-mv3` (CDP `Extensions.loadUnpacked`, or the MCP `install_extension` tool). No sync to Windows is needed.
- Real-site testing uses test accounts only, at low frequency; pause on login pages, CAPTCHAs, or risk-control prompts and hand over to the operator.
