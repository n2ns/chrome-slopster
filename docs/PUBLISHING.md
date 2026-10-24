# Publishing

How Slopster is released to the Chrome Web Store. The setup mirrors the sister project [chrome-widemark](https://github.com/n2ns/chrome-widemark): pushing a `v*` tag builds, packages, uploads, and submits the extension for review through GitHub Actions.

## Release flow

1. Update `version` in `package.json` (WXT writes it into the manifest) and add the release to [CHANGELOG.md](../CHANGELOG.md).
2. Run `npm run check` and `npm run zip`, then load `.output/chrome-mv3` unpacked and test it by hand (see the checklist below).
3. Commit, then tag and push: `git tag v<version> && git push origin v<version>`.
4. [`.github/workflows/publish.yml`](../.github/workflows/publish.yml) runs in the `chrome-web-store` environment: it checks that the tag matches `package.json`, runs `npm run check`, packages `.output/chrome-slopster-<version>-chrome.zip` from the build with the `zip` tool (not `wxt zip`, whose entry dates are invalid), checks the manifest version inside it, creates a draft GitHub Release for the tag with the zip attached (notes: this version's CHANGELOG section with relative links made absolute, plus manual install steps), uploads the zip with `publish-browser-extension` through Chrome Web Store API v2 (it is submitted for review straight away), and only then publishes the GitHub Release. Re-running the workflow refreshes the release zip and notes. If the store upload succeeded but publishing the release failed, a re-run cannot help (the store refuses the same version twice); publish the draft by hand with `gh release edit v<version> --draft=false`.

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs `npm run check` and a test package, and in a separate job the Playwright end-to-end tests (`npm run test:e2e`), on every push to `main` and on pull requests.

## Status

- 2026-10-15: 0.1.0 uploaded by hand and submitted for review under the Datafrog.io publisher (item ID `mmgmeicjkmabnhjedpinlnpddagpoend`). It was approved and is live at https://chromewebstore.google.com/detail/slopster/mmgmeicjkmabnhjedpinlnpddagpoend (checked 2026-10-24). The listing uses category Productivity > Tools, the five store screenshots, both promo tiles, homepage https://n2ns.com/projects/slopster, support https://github.com/n2ns/chrome-slopster/issues, and the privacy policy at https://github.com/n2ns/chrome-slopster/blob/main/PRIVACY.md. The detailed description is filled in English only: the Spanish and Chinese (Simplified) store pages show the English description under their localized summary. The Spanish and Chinese texts are ready in [STORE-LISTING.md](STORE-LISTING.md).
- 2026-10-25: 0.2.0 published by pushing the `v0.2.0` tag: the workflow uploaded it through API v2 and submitted it for review, and the GitHub Release https://github.com/n2ns/chrome-slopster/releases/tag/v0.2.0 is out. It carries the new store title and summary.
- The `chrome-web-store` environment exists with `EXTENSION_ID`. The upload uses Chrome Web Store API v2 with the shared n2ns organization secrets `CWS_SERVICE_ACCOUNT_CLIENT_EMAIL` and `CWS_SERVICE_ACCOUNT_PRIVATE_KEY` and `CWS_PUBLISHER_ID` (all set). The service account is added to the publisher and can read this item, so tag-triggered publishing works for versions after 0.1.0.
- 2026-10-25: the `v0.1.0` tag points at 7c0610a, the commit the uploaded 0.1.0 package was built from. Its publish run created the GitHub Release with the zip and then failed at the store upload as expected (that commit still has the old OAuth upload step, and the store already has 0.1.0); the release was published by hand without the Latest mark, which stays on v0.2.0. n2ns.com links to the store listing.

## One-time setup

1. **First upload by hand.** The Web Store API can only update an existing item. Build the zip with `npm run zip`, create a new item in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) under the N2NS account, upload the zip, fill in the listing from [STORE-LISTING.md](STORE-LISTING.md) and the privacy and distribution tabs from the notes below, and submit. The item ID shown in the dashboard is the `EXTENSION_ID`.
2. **Privacy policy URL.** The store needs a public URL. The repository is public, so the listing uses `https://github.com/n2ns/chrome-slopster/blob/main/PRIVACY.md` (as WideMark does).
3. **GitHub environment and secrets.** The `chrome-web-store` environment holds `EXTENSION_ID`. Store credentials are n2ns organization secrets shared with chrome-wtfaa and chrome-widemark: `CWS_PUBLISHER_ID`, `CWS_SERVICE_ACCOUNT_CLIENT_EMAIL`, and `CWS_SERVICE_ACCOUNT_PRIVATE_KEY` (service account `chrome-extension-publisher@datafrog-platform.iam.gserviceaccount.com` in GCP project `datafrog-platform`, which must be added to the publisher in the Developer Dashboard).
4. **Store assets.** Screenshots and promo tiles are in [`store-assets/`](../store-assets/) (`npm run assets:store` regenerates them).

## Store listing

The title, summary, category, and the detailed description in English, Spanish, and Chinese (Simplified) are in [STORE-LISTING.md](STORE-LISTING.md). The title and summary come from the package; the detailed description is pasted into the dashboard per language.

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

- Homepage: https://n2ns.com/projects/slopster
- Source and issues: https://github.com/n2ns/chrome-slopster

## Checklist before each release

- `npm run check` passes, and `npm run zip` produces `.output/chrome-slopster-<version>-chrome.zip`.
- `unzip -l` shows only the runtime files: `manifest.json`, `background.js`, `sidepanel.html`, `chunks/`, `assets/`, `content-scripts/`, `icon/`, `_locales/`.
- Load `.output/chrome-mv3` unpacked and check by hand: translate on Reddit, X, and Facebook; draft and fill a reply and a new post on each (fill only, never send); personas; AI settings (engine, key, model); settings (language, auto-translate, translation color, font size, ad blocking); English, Spanish, and Chinese UI.
- Store screenshots still match the UI; regenerate with `npm run assets:store` if not.
- The listing text in [STORE-LISTING.md](STORE-LISTING.md) still matches the features; after changing it, paste the detailed description into the dashboard for every language.
- `CHANGELOG.md` has the release, and the tag equals `v` + `package.json` version.
