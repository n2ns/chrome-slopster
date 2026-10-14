# Privacy

Social Reply Assistant runs entirely in your browser. It has no server of its own, collects no analytics, and sends nothing anywhere until you use a feature that needs a third-party service (listed below).

## What is stored, and where

| Data | Storage | Leaves this device? |
|---|---|---|
| Persona profiles (name, identity, tone, reply language, banned words, custom rules) | `chrome.storage.sync` | Yes, through Chrome Sync, to your other devices signed in to the same Chrome profile |
| Active persona, settings (engines, models, language, auto-translate, AI fallback, font size), ad-blocking toggles | `chrome.storage.sync` | Yes, through Chrome Sync |
| API keys for OpenAI, DeepSeek, Gemini, and Claude | `chrome.storage.local` | **No.** Keys stay on this device and are never synced |
| A local backup of your persona profiles (used if synced data becomes unreadable) | `chrome.storage.local` | No |
| The post or comment you selected for a reply, per tab | `chrome.storage.session` | No. Cleared when the browser closes, the tab closes, or the page moves to another conversation |
| Google free translation cooldown time | `chrome.storage.session` | No |

If you do not want persona profiles or settings to go through Chrome Sync, turn off sync for extensions in Chrome's settings.

## What is sent to third parties, and when

Page content is sent only when you ask for it, or when you turned on auto-translate:

- **Translation.** When you click **Translate**, or when auto-translate is on and a post or comment scrolls into view, its text is sent to the translation engine you chose: Google Translate (`translate.googleapis.com`, no account or key), or one of the AI providers below with your API key. Text you paste into the side panel's translation box is sent the same way.
- **Drafting.** When you click **Generate**, the extension sends the selected post or comment, its surrounding context (parent comments, a few existing replies, the subreddit or group name, the page address), your active persona, and the intent you typed to the AI provider you chose, with your API key:
  - OpenAI (`api.openai.com`)
  - DeepSeek (`api.deepseek.com`)
  - Google Gemini (`generativelanguage.googleapis.com`)
  - Anthropic Claude (`api.anthropic.com`)

Each provider handles this data under its own terms and privacy policy. Your API key authenticates you to that provider; the extension sends it only to the provider it belongs to.

Nothing else is sent. Filling a draft into a page's reply or post box happens locally in the page, and the extension never publishes anything: you review and send every reply and post yourself.

## Site access

The extension reads pages only on `www.reddit.com`, `reddit.com`, `x.com`, `twitter.com`, and `www.facebook.com`, to add the Translate and Draft reply controls, read the post you select, fill your draft into the box you choose, and hide ads when you turned that on. It does not read other sites.

## Removing your data

Uninstalling the extension removes what it stored on this device. To remove synced personas and settings from your other devices as well, delete them in the settings (the **Settings** link in the side panel) before uninstalling. You can delete personas and clear API keys there at any time.
