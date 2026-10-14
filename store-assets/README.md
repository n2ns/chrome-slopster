# Slopster Store Assets

Generated Chrome Web Store assets for Slopster.

## Files

- `screenshot-01-translate.png` - 1280x800: posts and comments translated in place on a forum page
- `screenshot-02-reply.png` - 1280x800: a reply draft in the persona's voice, with the review copy
- `screenshot-03-new-post.png` - 1280x800: a new-post draft (title and body) for the open post form
- `screenshot-04-personas.png` - 1280x800: the personas view
- `screenshot-05-ai-settings.png` - 1280x800: AI engine, API key, and model settings
- `promo-small-440x280.png` - 440x280: small promo tile
- `promo-marquee-1400x560.png` - 1400x560: marquee promo tile

The side panel images are real captures of the built extension in headless Chromium. The forum pages are local mocks, translation and AI responses are canned, demo data is generic, and no request reaches the network.

## Regenerate

```bash
npm run assets:store
```

This builds the extension and runs `scripts/generate-store-assets.mjs`, which overwrites the PNGs here.
