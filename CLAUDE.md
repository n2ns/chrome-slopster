# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Chrome MV3 extension (WXT + React + TypeScript) that translates posts and drafts operator-reviewed replies on Reddit, X, and Facebook. The full design, phases, and completion criteria live in [docs/implementation-plan.md](docs/implementation-plan.md); read it before starting a phase.

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
```

Run a single test file: `npx vitest run tests/locales.test.ts`

## Layout

- `entrypoints/`: WXT entry points (`background.ts`, `sidepanel/`, `options/`, later `<platform>.content.ts`). Keep them thin; logic lives in `src/`.
- `src/i18n/`: `t()` wraps `browser.i18n.getMessage`. Message keys are typed from `public/_locales/en/messages.json`, so adding a string means adding it to **every** locale (a test enforces identical key sets).
- `src/ui/`: React helpers shared by the side panel and options page.
- `tests/`: Vitest with jsdom and WXT's `fakeBrowser` (via `WxtVitest`).

## Testing in a real browser

A shared Windows test Chrome (separate data directory, debugging port 9222) is used for all real-browser checks:

- `chrome-test` starts it if it is not running; the chrome-devtools MCP server connects to it automatically.
- Load the build straight from WSL: `\\wsl.localhost\<distro>\<repo path>\.output\chrome-mv3` (CDP `Extensions.loadUnpacked`, or the MCP `install_extension` tool). No sync to Windows is needed.
- Real-site testing uses test accounts only, at low frequency; pause on login pages, CAPTCHAs, or risk-control prompts and hand over to the operator.
