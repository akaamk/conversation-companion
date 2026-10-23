---
doc: spec
status: approved
---

# Conversation Companion — Technical Spec

Implements `prd.md` (approved). Kernel: `scope.md > The Unique Kernel`.

## How This Works, In Plain Language
The app is three web pages plus one small helper that lives on Vercel.

- **The pages** are plain HTML (which you know), styled with CSS (the language that sets colors, fonts and layout), with JavaScript (the language that makes a page *do* things) for the interactive parts. No framework — just files.
- **The questionnaire page** keeps the family's answers in the browser's short-term memory for that visit (a "sticky note" the browser holds for this one site until the tab is closed). Nothing is saved anywhere else.
- **The conversation page** uses two features already built into Chrome and Edge:
  - **Speech recognition** turns what the elder says into text. (Behind the scenes Chrome sends the audio to Google, and Edge to Microsoft, to do this.)
  - **Speech synthesis** reads text aloud in one of the browser's voices.
- **The helper** (Vercel calls it a *serverless function*: a tiny program that wakes up when asked, runs, and goes back to sleep) is the only part that talks to Claude. It exists so your secret Anthropic key is never visible in the web page, where anyone could copy it.
  - Each time the elder finishes speaking, the page sends the helper: the questionnaire answers + the conversation so far.
  - The helper turns the answers into companion instructions (your GPT instructions, with the blanks filled in), asks **Claude Haiku 5.5** for a reply, and sends the reply back.
  - The page speaks the reply aloud and listens again.

Why this shape: it's the smallest setup that keeps the key secret, works in a browser at a link, and builds on HTML you already know. One outside service (Anthropic), one host (Vercel), no database, no logins.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. Family member opens the Vercel link → **Home page** (`index.html`) loads. They press **Get started** → `questionnaire.html`.
2. They answer the 8 questions and press submit → `questionnaire.js` saves the answers to the browser's session storage → the browser goes to `conversation.html`.
3. The elder presses **Start** → the browser asks permission to use the microphone (first time only) → `conversation.js` starts listening; the light shows **listening**.
4. The elder says "Hi!" → speech recognition turns it into text → after a short pause, the page decides they've finished → the light shows **thinking** (a slow, dim glow) → the page sends `{answers, history}` to `/api/chat`.
5. `api/chat.js` builds the instructions from `api/companion-instructions.js` + the answers → calls Claude → returns the reply text.
6. The page speaks the reply; the light shows **speaking** → when it finishes speaking, the light returns to **listening** and the loop repeats from step 4.
7. Ending: if Claude's reply signals a goodbye (see `Ending Rules`), the page speaks it and stops. If nobody speaks for a while, the page asks "Are you still there?"; with no answer, it says goodbye and stops. The screen returns to the big Start button.

```
Elder speaks ─► Browser speech recognition ─► text
                                              │
                    conversation.js ──POST /api/chat {answers, history}──► api/chat.js
                                                                             │ builds instructions
                                                                             ▼
                                                                    Anthropic API (Claude Haiku 5.5)
                                                                             │ reply text
                    conversation.js ◄────────────────────────────────────────┘
                          │
             Browser speech synthesis ─► Elder hears reply
```

## Stack
| Piece | Choice | Why |
|---|---|---|
| Pages | Plain HTML, CSS, JavaScript (no framework) | Builds on the learner's HTML; nothing to install; easiest to read and debug. |
| Listening | Web Speech API — `SpeechRecognition` (Chrome/Edge expose it as `webkitSpeechRecognition`) | Learner chose **Option A**: free, built in, simple. Accepted tradeoffs: robotic-ish voices, pause tuning for long stories, audio processed by Google/Microsoft. [MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) |
| Speaking | Web Speech API — `speechSynthesis` | Same reason. Edge offers more natural "Online (Natural)" voices. [MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) |
| Helper | Vercel serverless function in Node.js (JavaScript) | Keeps the API key secret; deploys automatically from GitHub. [Vercel Functions docs](https://vercel.com/docs/functions) |
| AI model | Claude Haiku 5.5 (`claude-haiku-5-5`) via the official Anthropic SDK `@anthropic-ai/sdk` | Learner chose **Claude** and **Haiku** for fast spoken turnaround and low cost; accepted tradeoff: a bit less nuance than Opus 5.5 (one-line switch to `claude-opus-5-5` if needed). [Anthropic API docs](https://docs.anthropic.com/en/api/messages), [TypeScript/JS SDK](https://github.com/anthropics/anthropic-sdk-typescript) |
| Hosting | Vercel (free Hobby plan), connected to the public GitHub repo | Learner chose hosting over running locally: the agent works in a cloud computer, the microphone needs `https://`, and families can try a link. [Vercel docs](https://vercel.com/docs) |

**Verify early in the build** (not looked up live during planning): Edge's support for continuous speech recognition (historically less reliable than Chrome's); current Vercel Hobby limits; current Anthropic SDK install/usage.

## Where It Runs and How Someone Tries It
- **Runtime:** browser pages + one Vercel function. Works in **Chrome or Edge on Windows** (the learner's setup). Firefox does not support speech recognition.
- **Needs:** a GitHub account (public repo), a Vercel account (free, sign in with GitHub), an Anthropic Console account with prepaid credit and a **spending limit**, and one secret: `ANTHROPIC_API_KEY`, pasted into Vercel's *Environment Variables* setting — never into chat, code, or GitHub.
- **To try it:** open the Vercel link (e.g. `https://<project>.vercel.app`) in Chrome or Edge → Get started → fill out the questionnaire → Start → allow the microphone → talk.
- **Updating:** every push to the GitHub repo's main branch redeploys automatically.
- **Demo recording:** record the screen and audio on the learner's Windows computer (e.g. the built-in Xbox Game Bar or Clipchamp — decided in `6-ship`) while using the live link. Submission still requires the demo video and the public GitHub repo; the link is a bonus.
- **Local fallback (not planned):** `npx vercel dev` would run it on a computer, but isn't needed.

## Look and Feel
From `prd.md > Look and Feel` (warm, soft colors; large, easy-to-read text; calm and friendly).
- **Palette:** warm cream background (`#FBF6EE`-ish), deep warm brown text (`#3B2F2A`-ish) for high contrast, a soft terracotta/peach accent for buttons and the light, gentle sage as a secondary. Avoid pure white glare and cold blues.
- **Type:** large — body ~20px, questionnaire labels ~22px, headlines ~40px+; a friendly rounded or humanist sans-serif (e.g. system UI fonts, or a Google Font such as "Nunito" or "Atkinson Hyperlegible" for readability). Generous line spacing.
- **Layout:** spacious, one column, lots of breathing room; big buttons (Start ≈ 200px circle) with clear focus outlines.
- **The light (orb):** a soft radial-gradient circle, center of the Conversation screen.
  - *Listening:* slow, gentle "breathing" glow.
  - *Thinking:* dimmer, slower pulse.
  - *Speaking:* brighter, livelier pulse.
  - *Stopped:* hidden; big Start button shown.
- **Copy tone:** warm, plain, no tech jargon on screen.

## Components

### Home Page
`index.html`. Static content with the learner's copy and a **Get started** link to `questionnaire.html`.
PRD ref: `prd.md > Home Page`.

### Questionnaire Page
`questionnaire.html` + `js/questionnaire.js`. One page, eight labeled `<textarea>` fields (exact wording in `prd.md > Family Questionnaire`). Preferred name is required; the rest optional. On submit: save answers to `sessionStorage` under the key `companionAnswers`, then go to `conversation.html`.
PRD ref: `prd.md > Family Questionnaire`.

### Conversation Page
`conversation.html` + `js/conversation.js`. Title "Conversation Companion", the big Start button, and the orb. If no answers are in session storage, show a message for the family member with a link back to the questionnaire.
PRD ref: `prd.md > Voice Conversation`, `prd.md > Screens and Layout`.

#### Listening
Uses `webkitSpeechRecognition` with `continuous = true`, `interimResults = true`, `lang = "en-US"`. The page itself decides when the elder has *finished* a turn: after **1.5 seconds** with no new words (learner's choice after live testing: 2.5s, then 2s, then 1.5s) (tunable constant `END_OF_TURN_MS`), so a pause mid-story doesn't cut them off. Recognition is paused while the companion speaks so it doesn't hear itself.
PRD ref: `prd.md > Voice Conversation` ("can talk at length without being cut off").

#### Speaking
`speechSynthesis` with a preferred English voice (prefer en-US names containing "Natural" on Edge), `rate ≈ 0.9` for a measured pace. The reply arrives in pieces as Claude writes it (see `Chat Helper`); each sentence is spoken as soon as it's complete, and when the last one ends, listening resumes.
**Testing line:** adding `?debug` to the page address shows what the browser heard and how long each part took (pause, first words, full reply). Hidden otherwise.
**Tap to interrupt:** a tap or click anywhere on the page while speaking calls `speechSynthesis.cancel()` and starts listening immediately (the microphone stays off while speaking, so the companion can't hear itself).
PRD ref: `prd.md > Voice Conversation`.

#### Orb States
A CSS class on the orb (`listening` / `thinking` / `speaking`) switches the animation. Respects reduced-motion settings.
PRD ref: `prd.md > Voice Conversation` ("light visibly differs").

#### Ending Rules
- **Goodbye:** the companion instructions tell Claude that when the elder is clearly ending the conversation, it says a warm goodbye and ends its reply with the marker `[END]`. The page removes the marker before speaking, then stops.
- **Silence:** if listening for **~45 seconds** (`IDLE_CHECK_MS`) with no speech, the page sends a hidden note to the helper so Claude produces a gentle "Are you still there?" in its own words; if another **~20 seconds** (`IDLE_END_MS`) pass with nothing, the page speaks a short fixed goodbye and stops.
- Stopping returns to the Start button; the conversation history is cleared.
PRD ref: `prd.md > Ending a Conversation`.

### Chat Helper
`api/chat.js` — Vercel serverless function at `POST /api/chat`.
- Receives `{ answers, history }`.
- Checks basic limits (answers and history not absurdly long; history trimmed to the most recent ~40 turns).
- Builds the system prompt with `buildInstructions(answers)` from `api/companion-instructions.js`.
- Calls Claude via `@anthropic-ai/sdk` (see `External Services and Dependencies`).
- **Streams** the reply back as plain text as Claude writes it (`client.messages.stream`), so the page can start speaking the first sentence early. Returns `{ error }` JSON with a status code if something fails before streaming starts.
PRD ref: `prd.md > Tailored Companion`.

### Companion Instructions
`api/companion-instructions.js`. The heart of the kernel.
- A fixed **core rules** section adapted from the learner's "The Conversation Companion" GPT instructions, made general (no references to the learner's father): role and purpose, personality and style, hearing and communication, sensitive subjects, well-being, memory and privacy, starting a conversation, overall goal — plus short replies suited to being spoken aloud (no lists or symbols), and the `[END]` rule.
- A **"About the person you're talking with"** section filled from the 8 answers.
- A clearly marked **"Know but do not mention first"** section from Q6, with the rule: never raise these unless the person brings them up first; then respond naturally and ask relevant questions.
- Blank answers are simply left out.
PRD ref: `prd.md > Tailored Companion`; source: `scope.md > Inspiration & Identity`.

## Data Model
| Data | Where it lives | How it's updated | When they leave and come back |
|---|---|---|---|
| Questionnaire answers `{name, ageAndOrigin, personality, interests, experiences, holdBack, communication, upsetting}` | Browser `sessionStorage` (`companionAnswers`) | Written once on submit | Survives a page refresh in the same tab; gone when the tab closes. A new visit starts from Home. |
| Conversation history `[{role: "user"|"assistant", content}]` | JavaScript memory on the conversation page | A message added per turn | Cleared when the conversation ends or the page reloads |
| Companion instructions | Built fresh on each request inside `api/chat.js` | Never stored | — |
| `ANTHROPIC_API_KEY` | Vercel environment variable only | Set once by the learner | — |

Nothing is stored on a server. Answers and conversation text are sent to Anthropic to generate replies; spoken audio is processed by Google (Chrome) or Microsoft (Edge). The demo uses a fictionalized profile.

## File Structure
```
conversation-companion/            # the GitHub repo (this folder)
├── index.html                     # Home page — learner's welcome copy, Get started
├── questionnaire.html             # 8 questions on one page
├── conversation.html              # Start button + orb
├── css/
│   └── styles.css                 # warm palette, large type, orb animations
├── js/
│   ├── questionnaire.js           # saves answers to sessionStorage, goes to conversation
│   └── conversation.js            # listening, end-of-turn timing, speaking, orb states, ending rules
├── api/
│   ├── chat.js                    # Vercel function: POST /api/chat → Claude → reply
│   └── companion-instructions.js  # core rules + buildInstructions(answers)
├── package.json                   # declares @anthropic-ai/sdk
├── .gitignore                     # node_modules, .env*, devpost/learner-profile.md
├── README.md                      # what it is, how to try it, how to deploy
└── devpost/                       # Devpost learning workspace (planning docs)
```

## External Services and Dependencies

### Anthropic API (Claude)
- **Call:** `client.messages.stream({ model: "claude-haiku-5-5", max_tokens: 1024, system: <instructions>, messages: <history>, output_config: { effort: "low" } })` using the official SDK (`new Anthropic()` reads `ANTHROPIC_API_KEY` automatically).
  - `effort: "low"` keeps replies quick — recommended for chat.
  - Replies are short by instruction (a few spoken sentences).
- **Response:** forward each `text_delta` to the page as it arrives. At the end, check the final message's `stop_reason`: if it's `"refusal"` and nothing was sent, send a gentle fallback line instead.
- **Auth:** `ANTHROPIC_API_KEY` (Vercel environment variable).
- **Cost:** Claude Haiku 5.5 is $0.10 per million input tokens and $0.50 per million output tokens (prompts under 100K tokens) — a typical conversation should cost about a cent or two. Prepaid credit; **set a monthly spend limit in the Console** because the link is public.
- **Docs:** [Messages API](https://docs.anthropic.com/en/api/messages), [SDK](https://github.com/anthropics/anthropic-sdk-typescript), [Console](https://console.anthropic.com).

### Vercel
- Free Hobby plan; imports the GitHub repo; files in `api/` become functions automatically; static HTML served as-is.
- Setting: Environment Variable `ANTHROPIC_API_KEY`.
- **Docs:** [Functions](https://vercel.com/docs/functions), [Environment Variables](https://vercel.com/docs/environment-variables).

### Web Speech API (built into the browser)
- No account or key. Chrome/Edge only for recognition. **Docs:** [Using the Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API).

## Important Failure Modes
- **Speech recognition mishears or hears nothing** (soft or older voice, background noise) → if a turn comes back empty, the companion says gently, "I didn't quite catch that. Could you say it again?" without mentioning hearing. (`prd.md > States and Boundaries` → Didn't catch that.)
- **Microphone blocked or unsupported browser** → a clear on-screen message for the family member: how to allow the microphone, or "please open this in Chrome or Edge." (→ Microphone not allowed.)
- **Helper or Claude fails** (no credit, network, key missing) → orb stops, an on-screen message for the family member ("The companion couldn't respond. Please check the connection and press Start again."), and a short spoken "I'm sorry, I need to stop for now." (→ Companion unavailable.)
- **Slow reply** → replies are streamed and spoken sentence by sentence; the orb's *thinking* state shows it's working.

## What Was Simplified and Why
- **Browser speech + text model** instead of a real-time voice model — simpler and cheaper; the fuller version would need a voice-model API, a live audio connection, and short-lived tokens.
- **Session storage** instead of saved profiles — the demo works in one visit; the fuller version would need a database and family accounts.
- **Fixed timing constants** (2.5s end-of-turn, 45s check-in, 20s goodbye) instead of adaptive timing — easy to tune during testing.
- **No usage limits beyond the Console spend cap and basic size checks** — fine for a demo link; a public launch would need rate limiting.

## Decisions and Open Issues

### Decisions
- **Hosting on Vercel** — learner chose, after the recommendation (agent works in the cloud; microphone needs https; families can use a link). Tradeoff: account setup and pasting a secret key; public link costs small amounts per use.
- **Voice Option A (browser speech + text model)** — learner chose, following the recommendation. Tradeoffs accepted: less natural voices, pause tuning, audio processed by Google/Microsoft.
- **Claude as the AI** — learner chose. **Claude Haiku 5.5** — learner chose for quick turnaround ("haiku would have quicker conversational turnaround"); switch to Opus 5.5 if the hold-back or sensitive-topic behavior falls short in testing.
- **Implementation details derived by the agent:** plain HTML/CSS/JS (from the learner's HTML background); Node.js for the Vercel function; `[END]` marker for goodbyes; timing constants; `effort: "low"`; session storage.

### Learner's useful unknown
The learner believed "voice companions are not yet doable in any of the prevailing frontier models" (from their custom GPT experience). Clarified: voice is doable either by layering browser speech around a text model or with real-time voice models; they chose the first. **To check during the build:** an early step proves the spoken round trip — the learner says a sentence and hears Claude's reply aloud — before anything else is built on it.

### Open issues
- **Hold-back behavior on Haiku** — test early with the demo profile: the companion must not mention a Q6 story first. If it slips, strengthen the instructions or switch models.
- **Long-story pauses** — tune `END_OF_TURN_MS` with real speech; Edge's continuous mode may need a restart-on-end workaround.
- **Silence timing** — 45s/20s are starting assumptions (`prd.md > Open Questions`).
- **Demo profile answers** — the fictionalized answers for the demo elder will be written with the learner during the build (no real identifying details).
- **Repository and accounts** — create the public GitHub repo and connect Vercel early in the build so testing happens on the real link.
