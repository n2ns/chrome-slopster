# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-25

### Added
- Translation text color: translations on pages can use a color you pick (presets or custom); by default they keep the page's text color.
- Hide the original text while its translation is shown, so a translated post or comment shows only the translation.

### Changed
- The translation color setting is now labelled "Translation background", which is what it sets; saved colors are kept.

### Fixed
- The color preview in the settings showed the side panel's translate box hint; it now shows its own sample text in the chosen colors.

## [0.2.0] - 2026-10-25

### Added
- Draft reply on posts on Reddit user profiles (`/user/<name>/comments/...`), not only on subreddit posts.

### Changed
- The Chrome Web Store title now says what Slopster does ("Slopster: Translate Posts & Draft AI Replies on Reddit, X & Facebook", in English, Spanish, and Chinese), with a new store summary. The toolbar tooltip still reads "Slopster".

### Fixed
- Clearing the reply target in the side panel now also clears the selection on the page (the pressed Draft reply button and its note).

## [0.1.0] - 2026-10-15

First release.

### Added
- Translate posts and comments in place on Reddit, X, and Facebook, on demand or automatically as they scroll into view, with free Google Translate or the selected AI engine (optional AI fallback when Google is rate limited).
- Draft replies to posts and comments, and new posts for a subreddit, the X timeline, or a Facebook group or page, in the voice of a persona, with a review copy in the operator's language and review notes.
- Fill a reviewed draft into the site's reply or post box with one click; the extension never sends or publishes.
- Personas with identity, tone, reply language, banned words, custom rules, and an option to avoid an AI-sounding tone; a built-in default persona that can be edited but not deleted.
- One global AI engine (OpenAI, DeepSeek, Gemini, or Claude) with its own API key and model; keys stay on the device.
- Side panel with a fixed top bar for Personas, AI settings, and Settings; settings save as fields lose focus.
- Settings for your language, auto-translate, translation color (presets or custom), side panel font size, and per-site ad hiding.
- English, Spanish, and Simplified Chinese interface.
