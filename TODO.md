# TODO

Open work after the first full pass (all phases done and checked on the real sites on 2026-10-12). Highest value first.

## Next

- [ ] **Show the provider's reason on errors.** The side panel shows only "The service returned an error" for HTTP failures. Add the provider's own message below it (e.g. "API key not valid", "IP address restriction … 123.20.121.39") so operators can fix keys themselves. The message is already in `AppError.message` (`src/providers/http.ts`); keep keys out of it.
- [ ] **Replies should address the commenter directly.** A real Facebook draft read "probably better for them to look into bookings…", talking about the commenter in the third person. Tell the model in `src/prompt/` to write to the person being replied to.
- [ ] **Version.** Still 0.0.1. The product name is Slopster (English and Chinese UI); the project directory and npm package are `chrome-slopster`. The icons in `public/icon/` (two white offset language panels on a bright red tile) are rendered from `design/icon.svg`.

## Decisions pending

- [ ] **First Chrome Web Store release.** Listing, permission justifications, CI and tag-triggered publish workflows, and store assets are ready ([docs/PUBLISHING.md](docs/PUBLISHING.md)). Still to do by hand: pick the first version, make the privacy policy reachable (public repository or n2ns.com), create the store item and upload the first zip, then add the `chrome-web-store` environment secrets.
- [ ] License. The repository has none yet.

## Known gaps

- [ ] Ad detection on X (an ad label outside the tweet text and author name: "Ad"/"Promoted", "广告"/"推广", "Anuncio"/"Promocionado") and on Facebook (a link to `/ads/about`, language independent) has not been checked against real ads; no ads appeared on the test accounts. The Spanish and Chinese X labels are assumed, not observed. Reddit ads are matched by element, so any UI language works.
- [ ] Facebook comment drafts are filled as one line, because a line break in a comment box can post the comment. Revisit only with a safe way to insert line breaks.
- [ ] Personas view: when resetting unreadable personas fails (quota or rate limit), the failure is not shown (`entrypoints/sidepanel/settings/PersonasSection.tsx`, load-error branch).
- [ ] Site markup changes over time. When a site redesigns, refresh its fixtures in `tests/fixtures/` from the test Chrome and update its adapter in `src/adapters/`.
