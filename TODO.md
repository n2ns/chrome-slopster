# TODO

Open work after the first full pass (all phases done and checked on the real sites on 2026-10-12). Highest value first.

## Next

- [ ] **Show the provider's reason on errors.** The side panel shows only "The service returned an error" for HTTP failures. Add the provider's own message below it (e.g. "API key not valid", "IP address restriction … 123.20.121.39") so operators can fix keys themselves. The message is already in `AppError.message` (`src/providers/http.ts`); keep keys out of it.
- [ ] **Replies should address the commenter directly.** A real Facebook draft read "probably better for them to look into bookings…", talking about the commenter in the third person. Tell the model in `src/prompt/` to write to the person being replied to.
- [ ] **Version.** Still 0.0.1. The product name is Slopster (English and Chinese UI); the project directory and npm package are `chrome-slopster`. The icons in `public/icon/` (two black offset language panels on a red tile) are rendered from `design/icon.svg`.

## Decisions pending

- [ ] Publish on the Chrome Web Store or not. If yes: store listing, permission justifications, and a hosted privacy policy based on `PRIVACY.md`.
- [ ] License. The repository has none yet.

## Known gaps

- [ ] Ad detection on X (an "Ad" label outside the tweet text and author name) and on Facebook (a link to `/ads/about`) has not been checked against real ads; no ads appeared on the test accounts.
- [ ] Facebook comment drafts are filled as one line, because a line break in a comment box can post the comment. Revisit only with a safe way to insert line breaks.
- [ ] Personas view: when resetting unreadable personas fails (quota or rate limit), the failure is not shown (`entrypoints/sidepanel/settings/PersonasSection.tsx`, load-error branch).
- [ ] Site markup changes over time. When a site redesigns, refresh its fixtures in `tests/fixtures/` from the test Chrome and update its adapter in `src/adapters/`.
