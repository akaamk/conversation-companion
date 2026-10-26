---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn

## Slices

- [x] **1. You speak and hear Claude answer aloud, on your own link**
  Becomes usable: A live Vercel link with a Conversation page. Press Start, say something, and hear a reply from Claude Haiku 5.5 spoken back, using a simple placeholder companion. The loop repeats until you reload.
  Why now: Biggest risk first, and it settles your useful unknown ("voice companions aren't doable"). It also sets up everything later slices need: the project files, GitHub repo, Vercel deploy, and secret key. If voice in the browser doesn't work for you, we find out before building anything on top of it.
  PRD ref: `prd.md > Voice Conversation`, `prd.md > The Core Journey` (steps 4–5)
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Chat Helper`, `spec.md > Listening`, `spec.md > Speaking`, `spec.md > File Structure`, `spec.md > External Services and Dependencies`
  Build: Create the project files (package.json with @anthropic-ai/sdk, .gitignore, base css/styles.css in the warm palette), `api/chat.js` calling Claude Haiku 5.5 with a short placeholder instruction, and a minimal `conversation.html` + `js/conversation.js` with a Start button, speech recognition (end of turn after ~2.5s of quiet), and speech synthesis. Learner creates the GitHub repo, the Anthropic key and the Vercel project; the agent pushes; Vercel deploys.
  Verify (mechanical): `node --check` on all JS files; run `api/chat.js` locally against a stand-in Claude client to confirm it builds the right request and returns `{ reply }`; after deploy, `curl` POST to the live `/api/chat` returns a non-empty reply.
  Learner check: Open your Vercel link in Chrome or Edge, press Start, allow the microphone, say "Hi, how are you today?", and hear a spoken answer. Then say one more thing and hear it answer again.
  Commit: `Add spoken round trip with Claude on Vercel`

- [x] **2. The voice sounds natural, answers sooner, and can be interrupted**
  Becomes usable: The companion speaks with the most natural voice the browser offers (Edge's "Natural" voices), starts speaking its first sentence while the rest is still being written, waits 1.5 seconds of quiet before answering, and stops talking and listens when you tap the screen. A hidden testing line (add `?debug` to the address) shows what the browser heard and how long each part took.
  Why now: The learner's first live test found the voice robotic, the delay noticeable, and no way to interrupt. All three affect whether the companion's personality can be judged in the next slice, so the voice gets fixed first. Pulled forward from slice 5 (natural voice, tap-to-interrupt) and from the spec's planned streaming upgrade.
  PRD ref: `prd.md > Voice Conversation`
  Spec ref: `spec.md > Listening`, `spec.md > Speaking`, `spec.md > Chat Helper`, `spec.md > External Services and Dependencies`
  Build: Voice selection (prefer en-US voices with "Natural" in the name, rate ≈ 0.9). `END_OF_TURN_MS` = 1500. `api/chat.js` streams Claude's reply text as it's written, and the page speaks each sentence as soon as it's complete. Tap anywhere while speaking cancels speech and the in-flight reply and resumes listening. A `?debug` line shows the heard text and timings.
  Verify (mechanical): `node --check`. Run `api/chat.js` locally with a stand-in streaming client and confirm the chunks are written in order and a refusal gives the fallback line. Headless-browser tests with the fake speech engine and a slow streamed reply confirm the first sentence is spoken before the reply finishes, one sentence gets one reply, a tap while speaking cancels speech and resumes listening without extra replies, and `?debug` shows the heard text.
  Learner check: In Edge, reload the conversation page with `?debug` at the end of the address. Have a short conversation: does the voice sound better, and does the reply start sooner? Tap the screen while it's talking and check it stops and listens. Read the testing line to see what it heard.
  Commit: `Natural voice, streamed replies and tap to interrupt`

- [x] **3. The companion is tailored and holds back the stories it was told to wait for**
  Becomes usable: Conversations use your full companion rules plus a fictionalized demo elder's answers. It uses their name, talks about their interests, speaks in short clear sentences, and does not bring up the "wait for them" stories until the elder does.
  Why now: This is the unique kernel, so it comes as early as possible. It also tests the biggest open issue in the spec, whether Haiku reliably holds back. The early checkpoint follows, so your reactions can shape the remaining slices.
  PRD ref: `prd.md > Tailored Companion`
  Spec ref: `spec.md > Companion Instructions`, `spec.md > Chat Helper`, `spec.md > Decisions and Open Issues`
  Build: Write `api/companion-instructions.js` with the core rules adapted from your GPT instructions (generalized, no references to your parent) and `buildInstructions(answers)`, including the "Know but do not mention first" section. Write the fictionalized demo elder answers with you. Have `api/chat.js` accept `answers`, and temporarily have the Conversation page send the demo answers.
  Verify (mechanical): Run `buildInstructions` on the demo answers and on mostly blank answers, and confirm the right sections appear or are left out. Send scripted test conversations to the live `/api/chat`: an opener, a topic next to a held-back story (it must not mention the story), the elder raising the story (it should respond naturally), and an upsetting headline (calm, balanced). Read and judge each reply.
  Learner check: Talk with the demo companion for a few minutes. Does it sound like the companion you wrote? Try steering near a held-back story without mentioning it, then bring the story up yourself.
  Commit: `Add tailored companion instructions with hold-back rule`

- [x] **4. A family member can set it up from the Home page and questionnaire**
  Becomes usable: The full journey. Home page with your welcome text, Get started, the 8-question page, submit, then the Conversation page using those answers instead of the built-in demo ones.
  Why now: With the kernel proven, this adds the family half of the core journey, which is the setup the demo video shows first.
  PRD ref: `prd.md > Home Page`, `prd.md > Family Questionnaire`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > Home Page`, `spec.md > Questionnaire Page`, `spec.md > Conversation Page`, `spec.md > Data Model`, `spec.md > Look and Feel`
  Build: `index.html`, `questionnaire.html` and `js/questionnaire.js` saving to `sessionStorage` (`companionAnswers`, name required). The Conversation page reads the saved answers and shows a message linking back to the questionnaire if none exist. Remove the built-in demo answers from the page; they're kept as a test file.
  Verify (mechanical): A headless-browser script (Playwright, already installed) loads Home, clicks Get started, fills the form, submits without a name (blocked), then with a name, and confirms it lands on the Conversation page with the answers in session storage. Opening the Conversation page directly with no answers shows the message.
  Learner check: On your link, go from Home through the questionnaire using the demo elder's answers, then talk. Does the companion know who it's talking with?
  Commit: `Add home page and family questionnaire`

- [x] **5. It feels like a calm, natural conversation for an elder**
  Becomes usable: The glowing orb breathes while listening, dims while thinking, and pulses while speaking. Long stories with pauses aren't cut off. "Bye" ends warmly, and a long silence gets "Are you still there?" then a goodbye. All pages have the warm, large-text look.
  Why now: The core journey works, so now we make it feel right for the person using it. Doing this after the early checkpoint lets your feedback set the timing and feel.
  PRD ref: `prd.md > Voice Conversation`, `prd.md > Ending a Conversation`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Orb States`, `spec.md > Speaking`, `spec.md > Listening`, `spec.md > Ending Rules`, `spec.md > Look and Feel`
  Build: Orb states and animations (respecting reduced motion), the `[END]` goodbye marker in the instructions and page, idle check-in and goodbye timers, and a polished stylesheet across all pages.
  Verify (mechanical): `node --check`. A headless-browser script with a fake speech engine confirms the orb class changes listening → thinking → speaking → listening, that a reply ending in `[END]` is spoken without the marker and stops the conversation, and that the idle timers fire the check-in and then stop. Live `/api/chat` (or a scripted check if the live link is unreachable) returns `[END]` after "Well, I'd better go. Bye!" and after the learner's real example "I was talking about the weather. I have an appointment, so I have to go. Goodbye."; the page then turns the microphone off and shows the Start button Screenshots of each page are reviewed against Look and Feel.
  Learner check: Have a real conversation. Tell a longer story with pauses, watch the orb, then say goodbye. In a second conversation, go quiet and wait for the check-in.
  Commit: `Add orb states, natural pacing and conversation endings`

- [x] **6. It handles the what-ifs gracefully**
  Becomes usable: If it doesn't catch what was said, it asks gently to repeat. A blocked microphone or unsupported browser shows a clear note for the family member. If Claude or the helper fails, the orb stops, a message appears, and it says it needs to stop. Distress handling and refusals give a calm fallback. The README explains how to try it.
  Why now: The demo path works and feels right, so now we protect it from the realistic failures that could happen while recording or when a family tries it.
  PRD ref: `prd.md > States and Boundaries`
  Spec ref: `spec.md > Important Failure Modes`, `spec.md > Chat Helper`, `spec.md > External Services and Dependencies`
  Build: Empty-turn handling, microphone-permission and browser-support messages, helper error responses (missing key, API error, refusal, oversized input) and their on-page handling, basic size limits in `api/chat.js`, and the README.
  Verify (mechanical): Run `api/chat.js` locally with a failing stand-in client, a refusal, a missing key and oversized input, and confirm each returns the planned status and message. Headless-browser checks with the fake speech engine: a denied microphone shows the note, an empty turn triggers the gentle repeat, and a 500 from the helper shows the message and stops the orb.
  Learner check: Block the microphone in the browser's site settings and press Start, then allow it again. During a conversation, mumble or stay quiet briefly and hear how it asks you to repeat.
  Commit: `Handle microphone, recognition and helper failures`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (talking with the tailored demo companion on the live link); feedback shapes slices 4–6
- [x] Final kick-the-tires exploration and feedback completed

## Final Review

- [x] Mumbling sometimes got a reply instead of "say it again": treat short, low-confidence speech as not caught (learner's final-review finding). Done: a turn of up to 4 words the browser is less than 0.5 sure of gets "say it again" (at most once in 30s); `?debug` shows how sure it was. Verified with 6 new checks. Learner retry: Edge reports confidence 1.0 even for gibberish, so the check only helps in browsers that report real confidence; Claude's instructions now say to ask again when what it received doesn't make sense, and to carry on when only a word or two is unclear. Learner retried: gibberish now gets "say it again"; the learner had nothing else to change
- [x] Add a small Stop button in a bottom corner that ends the conversation immediately (learner's request while reviewing the code route). Built and verified with 11 checks; learner confirmed it works.
- [x] The first lines of a conversation sounded robotic ("Hello, George!"): join a short opening (under 8 words) with the next sentence, and warm up the online voice silently on Start (learner chose both). Verified with 3 new checks. Learner retry: later lines sound better, but the first line still sounds robotic, especially the name ; the learner chose to stop saying the name aloud: the instructions say not to use it and the page removes it from every reply. Learner retried: the first line still sounds somewhat robotic; the learner accepted the browser voice for now (premium voice stays under PRD > Possible Later Enhancements) and kept the name unspoken.
- [x] With short answers, the companion kept falling back to baseball-on-the-radio questions (radio never mentioned; baseball is seasonal): instructions now forbid adding details that weren't given, keep the season in mind (today's date is passed in), and say to vary topics or let them lead after short answers. Learner retried: no more ball-game loop, and the seasonal touch was welcome
- [x] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [x] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [x] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [x] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: Guided route (static walkthrough on GitHub) following the kernel: question 6 → saved → sent each turn → built into the hold-back rules. Practice connected: "measure before you fix" (the learner's `?debug` timing numbers drove the pause decision; Edge's 1.0 confidence ruled out one mumbling fix).
Route and stops: `js/questionnaire.js#L51` (`sessionStorage.setItem`), `js/conversation.js#L471` (`JSON.stringify({ answers, history })`), `api/companion-instructions.js#L44` and `#L83` (`HOLD_BACK_RULE`, "Know but do not mention first"). The learner reviewed the route on GitHub (asked how to find the stops, then reviewed them), and while reviewing it asked for a manual Stop button.
Edit outcome: offered (`FINAL_GOODBYE` wording); declined ("we can keep the goodbye for now").
Reflection: offered; answered (kept in the learner profile).
Activity mode: explicit static fallback (code viewed on GitHub; the app runs only on Vercel).

## Revisions
- Slice 1 live check done by the learner instead of `curl` — this cloud environment's network policy blocks the agent from reaching `conversation-companion-sand.vercel.app`; the learner confirmed spoken replies on the live link.
- Ignore speech results that arrive after listening stops — the first live test showed one sentence producing several replies (reproduced headlessly: 3 requests for 1 sentence; fixed: 1).
- Added tap-to-interrupt to slice 4 (now slice 2) (`prd.md > Voice Conversation`, `spec.md > Speaking`) — the learner found they couldn't interrupt during the first live test and chose tap over voice interruption, which would need a real-time voice model.
- Inserted new slice 2 (natural voice, streamed replies, tap to interrupt, `?debug` line; 2-second pause) and renumbered the rest — after the live test the learner found the voice robotic and the delay noticeable, and asked to fix the voice before judging the companion. Moved voice selection and tap-to-interrupt out of the orb/pacing slice; the spec's "streaming later if slow" became now.
- Voice set to Edge's "Guy" (Natural) first, with a `voices.html` sampler and `?voice=` override for testing — the learner wanted a male, more mature voice and chose Guy as "a bit folksy and sounds older."
- End-of-turn now uses the browser's quick first-guess text as well as its final text, and `?debug` shows a timing breakdown — the learner found the pause longer after slice 2's changes; the page had been waiting for Edge's slower final text and sometimes discarded a turn when it hadn't arrived.
- Voice failures handled: an online voice that errors or never starts switches to a voice on the computer, and the page no longer hangs on "Speaking…"; text selection no longer counts as a tap; a "Tap anywhere to interrupt" hint shows while speaking; pause shortened to 1.5s — from the learner's live test: silent "Speaking…" hang, copying the testing line interrupted it, no sign that tapping interrupts, and the learner wanted a shorter pause.
- Words are kept across Edge's automatic listening restarts and the restart gap no longer counts as the pause; a failed online voice is retried once before falling back, and the fallback applies to one reply only — the learner was cut off during a pause shorter than 1.5s, and after a tap the robotic voice took over for the rest of the conversation.
- Wait an extra 2s when the words so far sound unfinished ("yeah", "so", "I mean", "let me"…) — the learner was cut off while saying "yeah, um, let me restart"; the browser doesn't transcribe "um", so hesitations looked like silence.
- Companion instructions now avoid first-meeting greetings ("nice to meet you") and claims of remembering past chats — from the learner's live test; the companion has no memory between conversations.
- Slice 5 ending check now includes the learner's real example ("I have an appointment, so I have to go. Goodbye.") — the learner left the window open, the page kept listening and replied to a stray remark, and they asked for goodbyes to close the microphone and return to Start.
- Demo elder is "George", 96, from Queens, a retired NYC patrolman who started in the northern part of the city (learner's choices; identifying details left out). Slice 3's scripted conversation checks are done by the learner on the live link, because this cloud environment still can't reach the Vercel site.
- Added a sound meter (microphone loudness; room level = quietest moment in the last 5s; sound keeps the turn open for up to 6s without new words), spoke the first sentence alone and the rest in one stretch, and told the companion to use the elder's name rarely and inside a sentence — the learner's slice 3 test found it jumping in mid-speech, "George" sounding tacked on, and Guy sounding more robotic.
- The name is now used only in the first greeting, the page drops a tacked-on name (", George." / "George.") before speaking, the sound meter's microphone turns off call-style processing, and `&rate=1` / `&meter=off` testing switches were added; the testing line shows what Claude wrote — the learner still heard "George" as a separate sentence and Guy sounding like separate word blocks after the sound meter was added.
- Normal speaking speed by default, the name allowed in the first reply's greeting, symbols like `*` stripped before speaking ("M*A*S*H*" was read as "M asterisk A…"), a 2.5s pause once a turn passes 12 words, and a 10s window for the sound meter's background level — from the learner's comparison test (normal speed best; cut off during longer talking; the name never used at all). Premium voice noted under PRD > Possible Later Enhancements.
- Added a "talk to them, not about them" rule — in the learner's slice 3 test the companion once slipped into the third person ("sounds like he had a good time"), echoing the family's third-person background. Early checkpoint: headline handled calmly and steered back; police and movie stories handled well; the learner accepted the browser voice for now.
- Kept `js/demo-answers.js` as a testing aid instead of removing it: `questionnaire.html?demo` fills in George's answers (handy for testing and the demo video) and `conversation.html?demo` uses them directly; without `?demo` the Conversation page only uses the family's saved answers.
- Added question 9, a man's or woman's voice with "Hear it" samples (`js/voices.js`, shared by the questionnaire and conversation) — the learner made a profile for a woman ("Sarah") and it still spoke with Guy. Learner check for slice 4 passed: the pages look good and the companion knew who it was talking with.

- Ending a conversation also turns off the sound meter's microphone (added in slice 2), and the silence check-in is sent as a note in place of the elder's words rather than a hidden system message; `&idle=` testing switch added. Found and fixed while testing: pressing Start after a goodbye would never start listening.
- Silence is now measured from the elder's last real words with a half-second check, and empty speech results are ignored — in the learner's live test the check-in never came after 2 minutes; reproduced: Edge's empty results in a quiet room kept resetting the timer. Orb states now have distinct colors (listening sage green, thinking pale gold, speaking terracotta) at the learner's request.
- Slice 5 learner check passed: goodbye ends the conversation and brings back Start (the learner kept how it ended when they said their grandson was calling), the silence check-in works, the orb colors are clear, and the woman's voice is used when chosen.
- Slice 6 learner check passed: the blocked-microphone note showed, and mumbling "more or less worked" (followed up in the final review). Final automated run before the final review: 131 checks across 17 test scripts, all passing.

- Ship day: the woman's voice (Jenny) is now the default and listed first in question 9, including for the demo profile — the learner found Guy still sounded robotic in conversation.
- Ship day: sound with no new words now holds a turn open for at most 3.5s (was 6s), and very faint sound is ignored — in the learner's live test, low outside noise made the pause before answering too long, while turning the sound meter off brought back cut-offs.
- Ship day: the companion is told never to mention or explain its instructions (in the learner's test, the silence check-in said "I'm not supposed to say names").
