# Publishing

How Slopster is released to the Chrome Web Store. The setup mirrors the sister project [chrome-widemark](https://github.com/n2ns/chrome-widemark): pushing a `v*` tag builds, packages, uploads, and submits the extension for review through GitHub Actions.

## Release flow

1. Update `version` in `package.json` (WXT writes it into the manifest) and add the release to [CHANGELOG.md](../CHANGELOG.md).
2. Run `npm run check` and `npm run zip`, then load `.output/chrome-mv3` unpacked and test it by hand (see the checklist below).
3. Commit, then tag and push: `git tag v<version> && git push origin v<version>`.
4. [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) runs in the `chrome-web-store` environment: it checks that the tag matches `package.json`, runs `npm run check`, packages `.output/chrome-slopster-<version>-chrome.zip`, checks the manifest version inside it, creates a GitHub Release for the tag with the zip attached (release notes are this version's CHANGELOG section plus manual install steps; users install it by hand as described in the README), and uploads it with `mnao305/chrome-extension-upload` (`publish: true`, so it is submitted for review straight away).

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs `npm run check` and a test package on every push to `main` and on pull requests.

## One-time setup

1. **First upload by hand.** The Web Store API can only update an existing item. Build the zip with `npm run zip`, create a new item in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) under the N2NS account, upload the zip, fill in the listing, privacy, and distribution tabs from the drafts below, and submit. The item ID shown in the dashboard is the `EXTENSION_ID`.
2. **Privacy policy URL.** The store needs a public URL. This repository is private, so `PRIVACY.md` on GitHub is not reachable by reviewers. Either make the repository public and use `https://github.com/n2ns/chrome-slopster/blob/main/PRIVACY.md` (as WideMark does), or publish the policy on n2ns.com.
3. **GitHub environment and secrets.** Create the `chrome-web-store` environment in this repository and add the secrets `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN`. The OAuth client and refresh token can be the same ones chrome-widemark uses (same publisher account); only `EXTENSION_ID` differs. GitHub never shows secret values again, so copy them from wherever they were recorded when WideMark was set up, or create a new OAuth client and refresh token for the Chrome Web Store API.
4. **Store assets.** Screenshots and promo tiles are in [`store-assets/`](../store-assets/) (`npm run assets:store` regenerates them).

## Store listing draft

### Name

Slopster

### Short description (max 132 characters)

Translate posts on Reddit, X, and Facebook, and draft replies and new posts with your own AI key. You review and send everything.

### Category and language

- Category: Productivity (alternative: Social & Communication)
- Languages: English, Spanish, Chinese (Simplified)

### Detailed description

Slopster helps you read and take part in conversations on Reddit, X, and Facebook, in any language.

- Translate posts and comments in place, on demand or automatically as they scroll into view. Free Google Translate works without any setup; an AI engine can be used instead.
- Draft a reply to a post or a comment, or a new post for a subreddit, your X timeline, or a Facebook group or page. Drafts follow a persona you define: who you are, your tone, the language you reply in, words to avoid, and your own rules.
- Every draft comes with a copy in your own language and short review notes, so you know exactly what you are about to say.
- Fill a reviewed draft into the site's reply or post box with one click. Slopster never sends or publishes anything: you read the text on the page and send it yourself.
- Bring your own AI: OpenAI, DeepSeek, Google Gemini, or Anthropic Claude, with your own API key and the model you pick.
- Optional ad hiding on each site, a translation color you choose, and a side panel in English, Spanish, or Chinese.

Your API keys stay on your device. Text is sent only to the translation or AI service you use, and only when you ask for it (or turn on auto-translate). Slopster has no server and collects no analytics.

Please use it responsibly: no spam, no bulk posting, and follow each site's rules.

## Privacy practices tab

### Single purpose

Help the user read and write posts and comments on Reddit, X, and Facebook: translate page content and draft replies or new posts that the user reviews and sends.

### Permission justifications

- `sidePanel`: the whole interface (drafting, translation, settings) lives in Chrome's side panel.
- `storage`: saves personas and settings (Chrome Sync), API keys (local only), and the post selected for a reply in the current tab (session only).
- Host access to `www.reddit.com`, `reddit.com`, `x.com`, `twitter.com`, `www.facebook.com`: content scripts add the Translate and Draft reply buttons next to posts and comments, read the post the user selects, fill the user's draft into the reply or post box the user opened, and hide ads when the user turned that on.
- Host access to `translate.googleapis.com`: free Google translation of the text the user asks to translate.
- Host access to `api.openai.com`, `api.deepseek.com`, `generativelanguage.googleapis.com`, `api.anthropic.com`: calls the AI provider the user selected, with the user's own API key, to translate or draft text.

### Remote code

No. All code ships in the package; the extension only exchanges data (JSON) with the services above.

### Data usage

Declare honestly, matching [PRIVACY.md](../PRIVACY.md):

- **Website content**: yes. The text of posts and comments the user translates or replies to is sent to the translation or AI service the user selected, at the user's request.
- **Authentication information**: the user's own API keys are stored locally and sent only to the provider they belong to; they are never sent to the developer.
- Nothing is sent to the developer, nothing is sold, and no data is used for advertising, credit, or unrelated purposes.

Certify the three Limited Use statements in the form.

## Support links

- Homepage and support: N2NS Lab, https://n2ns.com
- Source and issues: https://github.com/n2ns/chrome-slopster (once public)

## Checklist before each release

- `npm run check` passes, and `npm run zip` produces `.output/chrome-slopster-<version>-chrome.zip`.
- `unzip -l` shows only the runtime files: `manifest.json`, `background.js`, `sidepanel.html`, `chunks/`, `assets/`, `content-scripts/`, `icon/`, `_locales/`.
- Load `.output/chrome-mv3` unpacked and check by hand: translate on Reddit, X, and Facebook; draft and fill a reply and a new post on each (fill only, never send); personas; AI settings (engine, key, model); settings (language, auto-translate, translation color, font size, ad blocking); English, Spanish, and Chinese UI.
- Store screenshots still match the UI; regenerate with `npm run assets:store` if not.
- `CHANGELOG.md` has the release, and the tag equals `v` + `package.json` version.
