# Chrome Web Store Listing

The store listing text for Slopster, in every listing language. Paste each language's detailed description into the Developer Dashboard (Store listing tab, language selector at the top). The store fields are plain text, so the copy below uses no Markdown inside the code blocks.

## Writing rules

- Write for the people who install the extension, not for developers: start from their problem, use their words (for example "your own AI key", not "BYOK"), and say plainly what they need to set up.
- Promise only what the extension does today. No claims of perfect translations, human-sounding text, or safety from bans; say that drafts must be read before sending.
- Name the buttons exactly as the interface does in each language.
- Each language is written for its readers, not translated word by word, but all three make the same claims.

## Fields that come from the package

These are read from the manifest and change only with a new version:

| Store field | Source | Limit |
|---|---|---|
| Title | `extName` in `public/_locales/<locale>/messages.json` | 75 characters |
| Summary | `extDescription` in the same files | 132 characters |

A test (`tests/locales.test.ts`) keeps both within their limits. The toolbar tooltip uses the short `actionTitle` ("Slopster"), so the long title appears only in the store and on `chrome://extensions`. The summary adds what the title does not say (free translation, your own voice, you post it) instead of repeating the sites.

| Locale | Title | Summary |
|---|---|---|
| en | Slopster: Translate Posts & Draft AI Replies on Reddit, X & Facebook | Translate for free, no sign-up. Draft replies in your own voice with your own AI key, then edit and post them yourself. |
| es | Slopster: traduce y redacta respuestas con IA en Reddit, X y Facebook | Traduce gratis y sin registro. Redacta respuestas con tu propio estilo y tu clave de IA, y publícalas tú después de editarlas. |
| zh_CN | Slopster：在 Reddit、X 和 Facebook 上翻译帖子、用 AI 起草回复 | 免费翻译，无需注册。用你自己的 AI 密钥，按你的口吻起草回复，改好后由你亲自发出。 |

## Category

Productivity > Tools (alternative: Social & Communication).

## Detailed description

### English

```text
Found a thread you want to join, but it's in a language you don't read? Or you know what you want to say, but writing it in another language takes forever, and AI tools make it sound like a chatbot?

Slopster sits next to Reddit, X, and Facebook and helps you read a thread, then reply in your own words.

READ ANY THREAD
• Click Translate under a post or comment and the translation appears right below it.
• Or turn on automatic translation, and posts translate as you scroll.
• Translation is free and works right away. No sign-up, no key.

REPLY WITHOUT THE STRUGGLE
• Click Draft reply, jot down the point you want to make, and get a draft in the language of the thread.
• Next to it you get the same draft in your language, so you know exactly what you are about to say, plus a few notes on what to double-check.
• Drafts follow your profile: who you are, how you talk, and words you never use. An optional style setting keeps them from sounding like an assistant.
• Writing a new post instead? Open the site's post form and Slopster drafts the post, with a title on Reddit.

YOU HAVE THE LAST WORD
• Slopster puts the draft into the reply box you opened. It never sends or posts anything: you read it, change what you like, and send it yourself.
• It tells you when a reply may not fit the thread, and on X it counts your 280 characters.
• Drafts are asked to stick to what your profile says about you, not to make up stories. AI can still get things wrong, so read every draft before you send it.

WHAT YOU NEED
• To translate: nothing.
• To draft: your own key from OpenAI, DeepSeek, Google Gemini, or Anthropic Claude. You pay that company directly for what you use. Slopster itself is free.

YOUR DATA
• Your key stays on your computer.
• Text is sent only to the translation or AI service you chose, and only when you ask for it or turn on automatic translation.
• Slopster has no server, no account, and no tracking.

Also: optional ad hiding on each site, your choice of translation color, and Slopster itself in English, Spanish, or Chinese. Works on the desktop versions of reddit.com, x.com, and facebook.com.

Please don't use it for spam or mass posting, and follow each community's rules.
```

### Spanish

```text
¿Encontraste un hilo en el que quieres participar, pero está en un idioma que no lees? ¿O sabes lo que quieres decir, pero escribirlo en otro idioma te cuesta un mundo, y las herramientas de IA lo hacen sonar a chatbot?

Slopster te acompaña en Reddit, X y Facebook para que entiendas el hilo y respondas con tus propias palabras.

ENTIENDE CUALQUIER HILO
• Pulsa Traducir debajo de una publicación o comentario y la traducción aparece justo debajo.
• O activa la traducción automática y las publicaciones se traducen mientras te desplazas.
• La traducción es gratis y funciona desde el primer momento. Sin registro y sin clave.

RESPONDE SIN COMPLICARTE
• Pulsa Redactar respuesta, anota la idea que quieres transmitir y recibe un borrador en el idioma del hilo.
• Al lado tienes el mismo borrador en tu idioma, para saber exactamente qué vas a decir, y unas notas sobre lo que conviene revisar.
• Los borradores siguen tu perfil: quién eres, cómo hablas y las palabras que nunca usas. Una opción de estilo evita que suenen a asistente.
• ¿Prefieres crear una publicación nueva? Abre el formulario del sitio y Slopster redacta la publicación, con título en Reddit.

TÚ TIENES LA ÚLTIMA PALABRA
• Slopster coloca el borrador en el cuadro de respuesta que abriste. Nunca envía ni publica nada: lo lees, cambias lo que quieras y lo envías tú.
• Te avisa cuando una respuesta quizá no encaje en el hilo, y en X cuenta tus 280 caracteres.
• A los borradores se les pide ceñirse a lo que dice tu perfil, sin inventar historias. Aun así, la IA puede equivocarse: lee cada borrador antes de enviarlo.

QUÉ NECESITAS
• Para traducir: nada.
• Para redactar: tu propia clave de OpenAI, DeepSeek, Google Gemini o Anthropic Claude. Pagas directamente a esa empresa por lo que uses. Slopster es gratis.

TUS DATOS
• Tu clave se queda en tu ordenador.
• El texto solo se envía al servicio de traducción o de IA que elegiste, y solo cuando lo pides o activas la traducción automática.
• Slopster no tiene servidor, ni cuentas, ni rastreo.

Además: ocultación opcional de anuncios en cada sitio, el color de traducción que prefieras y Slopster en español, inglés o chino. Funciona en las versiones de escritorio de reddit.com, x.com y facebook.com.

No lo uses para spam ni para publicar en masa, y respeta las reglas de cada comunidad.
```

### Chinese (Simplified)

```text
看到一个想参与的讨论，却看不懂那门语言？或者心里知道想说什么，用外语写出来却要花半天，交给 AI 写又一股机器味？

Slopster 陪你在 Reddit、X 和 Facebook 上先看懂讨论，再用你自己的话回复。

看懂任何讨论
• 点帖子或评论下方的“翻译”，译文直接出现在原文下面。
• 也可以开启自动翻译，帖子边滚动边翻译。
• 翻译免费，装好就能用，不用注册，也不用密钥。

回复不再费劲
• 点“起草回复”，随手写下你想表达的意思，就能拿到一份用讨论原语言写的草稿。
• 旁边附上用你的语言写的对照译文，让你清楚自己要说什么，还有几条需要再核实的提示。
• 草稿会按你的人设来写：你是谁、怎么说话、哪些词绝不用。可选的风格设置让它读起来不像 AI 助手。
• 想发新帖？先打开网站的发帖表单，Slopster 帮你起草帖子，Reddit 帖子还会附上标题。

最后一句由你说
• Slopster 只把草稿填进你打开的回复框，从不替你发送或发布：你读过、改好，再自己发出去。
• 回复可能不适合这个讨论时，它会提醒你；在 X 上还会帮你数着 280 字符的上限。
• 草稿会被要求只用你人设里写明的经历，不编故事。但 AI 仍可能出错，发送前请逐句读一遍。

你需要准备什么
• 翻译：什么都不用。
• 起草：你自己在 OpenAI、DeepSeek、Google Gemini 或 Anthropic Claude 申请的密钥。用多少由你直接付给这些公司，Slopster 本身免费。

你的数据
• 密钥只保存在你的电脑上。
• 文字只发给你选择的翻译或 AI 服务，而且只在你点击或开启自动翻译时才发送。
• Slopster 没有服务器、没有账号体系，也不追踪你。

另外：可按网站隐藏广告，可自选译文颜色，界面支持中文、英文和西班牙文。适用于 reddit.com、x.com 和 facebook.com 的电脑版网页。

请不要用它发垃圾信息或批量发帖，并遵守各社区的规则。
```
