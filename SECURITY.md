# Security

## Reporting a vulnerability

Please report security issues privately to the maintainer instead of opening a public issue. Do not include API keys, private posts or messages, screenshots that show keys, or exports of browser storage in any report.

## How sensitive data is handled

- **API keys** are stored in `chrome.storage.local` only. They are never written to `chrome.storage.sync`, never put in a URL (Gemini's key goes in the `x-goog-api-key` header), and never included in error messages or logs.
- **No remote code.** All code ships in the extension package. The extension contacts only the services listed in [PRIVACY.md](PRIVACY.md).
- **Page isolation.** Controls added to pages live in shadow roots, and page or model text is always inserted as text, never as HTML.
- **No automatic publishing.** No code path clicks a send, post, or submit button or simulates one. Drafts are filled only into the box that belongs to the post or comment they were written for, or into the new-post form of the page they were written for; on Facebook, never into a post editor that already holds text. Facebook comment drafts are filled as a single line, because a line break there can act like Enter and post the comment.

## Before sharing a build or a bug report

Do not commit or share `.env` files, browser profile directories, storage exports, or packaged builds with private modifications.
