# Slopster

Slopster is a Chrome extension that helps you read and join conversations on **Reddit**, **X**, and **Facebook**, even in languages you do not speak.

- **Translate** posts and comments right on the page, with one click or automatically as you scroll.
- **Draft replies** to a post or a comment in the voice of a persona you set up, using the AI engine you choose (OpenAI, DeepSeek, Gemini, or Claude). Each draft comes with a copy in your own language, so you know exactly what it says.
- **Draft new posts** for a subreddit, your X timeline, or a Facebook group or page.
- **Fill** a draft you have reviewed into the site's reply box or new-post form with one click.
- Optionally **hide ads** on each site.

**You stay in control.** Slopster never posts, replies, or sends anything for you. It only fills text into a box you opened; you read it and press send yourself.

## Getting started

1. Install Slopster from the [Chrome Web Store](https://chromewebstore.google.com/detail/slopster/mmgmeicjkmabnhjedpinlnpddagpoend), or download it from GitHub and install it by hand (see [Install manually](#install-manually-download-from-github) below; the first release is on its way).
2. Pin it: click the puzzle-piece icon in Chrome's toolbar, then the pin next to Slopster.
3. Click the Slopster icon to open the side panel.
4. To draft replies and posts, open **AI settings** in the side panel, choose an AI engine, and paste your API key for it. You get the key from that company's website.

Translation works right away without any key, using the free Google Translate.

## Install manually (download from GitHub)

Use this if you cannot use the Chrome Web Store, or want a specific version. A manually installed copy works the same, but it does not update itself.

**Install**

1. Open the [Releases page](https://github.com/n2ns/chrome-slopster/releases) and, under **Assets** of the latest release, download `chrome-slopster-<version>-chrome.zip`.
2. Unzip it into a folder you will keep, for example `Documents\Slopster` on Windows or `~/Slopster` on macOS and Linux. Chrome loads the extension from this folder every time it starts, so do not delete, move, or rename it.
3. In Chrome, open `chrome://extensions` (type it into the address bar).
4. Turn on **Developer mode** with the switch in the top-right corner.
5. Click **Load unpacked** and select the unzipped folder: the one that directly contains `manifest.json`.
6. Pin it: click the puzzle-piece icon in Chrome's toolbar, then the pin next to Slopster.

**Update**

1. Download the newer `chrome-slopster-<version>-chrome.zip` from the Releases page.
2. Replace the files in your existing folder with the new ones. Make sure they end up in that same folder, not in a new one next to it:
   - Windows: right-click the zip, choose **Extract All…**, and set the destination to your existing folder. Confirm replacing the files.
   - macOS: double-clicking the zip creates a new folder next to it. Open that folder, select all its files, and drag them into your existing folder, choosing **Replace**.
   - Linux: `unzip -o chrome-slopster-<version>-chrome.zip -d <your folder>`.
3. On `chrome://extensions`, click the reload arrow on the Slopster card.

Keep using the same folder: Chrome ties a manually installed extension, and the settings it saved (including your API keys), to the folder it was loaded from. Loading it from a different folder installs a separate copy that starts with empty settings.

**Remove**

On `chrome://extensions`, click **Remove** on the Slopster card. You can then delete the folder.

**Good to know**

- Install either the Chrome Web Store version or a manual copy, not both, or you will see two Slopster icons.
- Chrome may remind you that extensions are running in developer mode. That is expected for manually installed extensions.

## How to use

### Translate

Every post and comment on Reddit, X, and Facebook gets a small **Translate** button. Click it to show the translation below the original; click again to hide or show it. To have posts translated automatically as they scroll into view, turn on **Translate posts automatically** in **Settings**.

You can also paste any text into the translation box in the side panel.

### Draft a reply

1. Click **Draft reply** under the post or comment you want to answer. The side panel opens with it selected. (Or just open a post and use the side panel; it replies to the post itself.)
2. Pick a persona and, if you like, write the point you want to make.
3. Click **Generate**. You get a suggestion on whether replying is a good idea, the draft, a copy in your language, and notes to check before sending.
4. Edit the draft if needed.

### Draft a new post

1. Open the site's own new-post form first: on Reddit, the subreddit's **Create post** page; on X, the post composer; on Facebook, **Create post** or **Write something** in a group or page.
2. In the side panel, switch **Draft type** to **New post**, pick a persona, and optionally say what the post should be about.
3. Click **Generate**, then review and edit the draft. Reddit posts also get a title.

### Fill and send yourself

1. Open the site's reply box (or new-post form) for the right post.
2. Click **Fill reply box** (or **Fill post form**) in the side panel.
3. Read the text once more on the page, then send or publish it yourself.

On X, the side panel counts characters and warns you when a reply or post goes over X's 280-character limit.

## The side panel

The top bar of the side panel has three buttons:

- **Personas**: the voices you write in.
- **AI settings**: the AI engine, its API key and model, and the translation engine.
- **Settings**: language, translation, display, and ad blocking options.

The open view is highlighted. Click its button again, or the Slopster title, to go back to your draft.

## Settings

**Personas.** A persona describes who you are and how you write: name, identity and background, tone, reply language, banned words, custom rules, and an option to avoid an AI-sounding tone. Drafts never invent experiences beyond what the persona says. You can create several and set one as active. The built-in default persona can be edited but not deleted.

**AI settings.**

- **AI engine**: OpenAI, DeepSeek, Gemini, or Claude. It is used for all drafting, and for translation if you pick it there.
- **API key**: the key for the selected engine. It is stored on this device only.
- **Model**: each engine offers a stronger model and a cheaper, faster one.
- **Translation engine**: free Google Translate, or the AI engine you selected. With Google, you can also let the AI engine take over when Google translation fails.

**Settings.**

- **Your language**: pages are translated into this language, and every draft includes a copy in it. By default it follows your browser.
- **Translate posts automatically**.
- **Translation background** and **Translation text color**: how translations look on pages, from presets or a custom color. The text color follows the page unless you pick one.
- **Hide the original text while its translation is shown**: show only the translation of a post or comment; hiding the translation brings the original back.
- **Font size** of the side panel: small, medium, or large.
- **Ad blocking**: hide ads on Reddit, X, and Facebook, each turned on separately.

## Languages

Slopster's interface is available in English, Spanish, and Simplified Chinese. It follows your browser's language, and uses English for any other language. Your language and each persona's reply language can be chosen from many more, such as Japanese, Korean, French, German, or Arabic.

## Privacy

In short:

- Your API keys stay on this device. They are never synced and are sent only to the AI company they belong to.
- Text is sent only to the services you use, when you use them: Google Translate or your AI engine for translation, and your AI engine for drafts.
- Nothing is sent to us. Slopster has no server of its own and collects no analytics.
- Your personas and settings sync to your other computers through Chrome Sync, like other extension settings.

Read the full [privacy policy](PRIVACY.md) for details.

## Responsible use

Slopster is meant to help a real person write their own replies, not to post automatically.

- Do not use it for spam, bulk posting, or fake engagement.
- Do not pretend to be someone else, claim experiences you did not have, or hide an affiliation.
- Follow the rules of each site and each community you post in.

## FAQ

**Do I need an API key?**
Not for translation: free Google Translate works without one. To draft replies and posts, you need a key for the AI engine you choose.

**Which AI engine should I pick?**
Any of them works. If you already have an account with OpenAI, DeepSeek, Google (Gemini), or Anthropic (Claude), use that one. Each engine offers a stronger model and a cheaper one; the cheaper model is a good place to start. Usage is billed by the AI company, not by Slopster.

**Why doesn't the reply box get filled?**
Slopster fills only a box that is already open. Click the site's own reply button (or open its new-post form) for the post you are answering, then click **Fill** again. If the site does not accept the text, use **Copy** and paste it yourself.

**Why is my Facebook comment one line?**
On Facebook, a line break in a comment box can post the comment right away. To be safe, Slopster fills Facebook comments as a single line. New Facebook posts keep their paragraphs.

**Does it work on the mobile sites?**
No. Only the desktop sites are supported (not `m.facebook.com` or `mobile.x.com`).

**Something stopped working on a site.**
Sites change their pages from time to time, which can break the Translate and Draft reply buttons until Slopster is updated. Please let us know (see below).

## Support and feedback

Report problems or suggest ideas on [GitHub Issues](https://github.com/n2ns/chrome-slopster/issues). Please never include your API keys in a report.

Slopster is made by [N2NS Lab](https://n2ns.com).

Developers: see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
