---
doc: prd
status: approved
---

# Conversation Companion — Product Requirements

A web app where a family member answers eight questions about their elderly loved one, and the answers become a voice conversation companion tailored to that person — someone to talk with who lets them tell their own stories.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`.

## The Core Journey
1. **Family member opens the home page** and reads a short, warm welcome ("Every story deserves a listener."). They press **Get started**.
2. **They fill out the one-page questionnaire** — eight questions about their loved one — and submit it.
3. **The screen changes to the Conversation Companion page**, now tailored to that person from the answers. The family member hands the device to the elder.
4. **The elder presses the big Start button** and says something like "Hi!" or "Let's chat."
5. **They talk out loud.** The companion listens, replies aloud in short, clear sentences, contributes something interesting, and lets the elder lead with their own stories. A glowing light shows whether it is listening or speaking.
6. **The conversation ends** when the elder says goodbye, or after a quiet stretch the companion asks if they're still there and, hearing nothing, says goodbye and stops.

Success: the elder has an enjoyable spoken conversation with a companion that clearly knows their interests and needs, without ever typing or reading. (`scope.md > What "Working" Looks Like`)

## Screens and Layout
Three screens, moving in one direction:

1. **Home** — brand name "conversationcompanion" at top; headline "A more personal kind of connection"; subhead "Every story deserves a listener."; short paragraph: "Imagine a thoughtful conversation partner who knows what makes your loved one light up—ready to talk about their favorite subjects, listen to their stories, and keep curiosity alive."; one **Get started** button → Questionnaire.
2. **Questionnaire** — all eight questions on a single scrolling page (learner's preference; also fine for most users at this length), each with a free-text answer box, and a submit button at the bottom → Conversation.
3. **Conversation** — titled "Conversation Companion." One big **Start** button. Once started, the screen is dominated by a soft glowing light/orb that animates differently while listening vs. speaking. No text the elder needs to read.

## Look and Feel
- Warm, soft colors.
- Large, easy-to-read, high-contrast text (older eyes).
- Calm and friendly overall — nothing busy, flashy, or clinical.
- On the Conversation screen, the moving light is the main visual; avoid anything the elder must read.

## Features and Behavior

### Home Page
- As a family member, I want to quickly understand what this is and start setting it up.
  - [ ] Home shows the brand name, headline, subhead, paragraph, and a Get started button.
  - [ ] Pressing Get started opens the Questionnaire.

### Family Questionnaire
Source: `scope.md > The POC Boundary` (short questionnaire). Eight questions, drawn from the learner's 50-question draft:

1. What name do they prefer to be called?
2. About how old are they, and where did they grow up?
3. How would you describe their personality?
4. What subjects do they most enjoy talking about?
5. What work and life experiences are they proud of, and what stories do they love to tell?
6. Which of those experiences should the companion know about but wait for them to bring up first?
7. Do they have difficulty hearing or following conversation, and what helps?
8. Are there subjects that upset them, and how should the companion respond if those come up?

- As a family member, I want to describe my loved one in my own words so the companion feels personal to them.
  - [ ] All eight questions appear on one page, each with a free-text box.
  - [ ] Answers can be left blank except the preferred name (assumption — see Open Questions).
  - [ ] Submitting moves to the Conversation screen.

### Tailored Companion
Source: `scope.md > The Unique Kernel`. The answers are turned into companion behavior modeled on the learner's original GPT instructions ("The Conversation Companion — revised for age 98").

- [ ] The companion addresses the elder by their preferred name.
- [ ] It brings up general topics from their interests (Q4) when conversation slows.
- [ ] **It does not mention the experiences listed in Q6 unless the elder raises them first**; once raised, it responds naturally and asks relevant questions.
- [ ] It follows the hearing/communication guidance (Q7): short, clear sentences; one question at a time at most; rephrases in simpler words rather than repeating.
- [ ] It avoids introducing upsetting subjects (Q8) and responds calmly as the family described if the elder raises them.
- [ ] It always behaves per the learner's core rules: warm, curious, treats the elder as an intelligent adult; never quizzes memory or says "you already told me that"; never pretends to be human; not a caregiver or therapist.

### Voice Conversation
Source: `scope.md > The POC Boundary` (voice in and out).

- As an elder, I want to just talk and listen, without typing or reading.
  - [ ] Pressing Start begins the conversation; the elder speaks first (e.g., "Hi!" or "Let's chat").
  - [ ] The companion replies aloud, at a measured pace.
  - [ ] The glowing light visibly differs between **listening** and **speaking**.
  - [ ] The elder can talk at length without being cut off mid-story.
  - [ ] **Tap to interrupt:** tapping anywhere on the screen while the companion is speaking stops it right away and it starts listening. (Added after the first live test; learner chose this over interrupting by voice.)

### Ending a Conversation
- [ ] If the elder says goodbye (e.g., "bye"), the companion says a warm goodbye and stops.
- [ ] If the elder is silent for a while, the companion gently asks if they're still there or want to keep talking.
- [ ] If there's still no answer, the companion says goodbye and stops; the screen returns to the big Start button.

## States and Boundaries
- **First use** — The Conversation screen only exists after the questionnaire is submitted.
- **Didn't catch that** — If the companion can't make out what the elder said, it asks them calmly in simple words to say it again, without calling attention to hearing or memory.
- **Microphone not allowed** — If the device blocks the microphone, the screen shows a clear message for the family member (not the elder) explaining how to allow it.
- **Companion unavailable** — If the companion can't respond (e.g., connection problem), it shows a calm message for the family member, and the light stops animating, rather than leaving the elder waiting in silence.
- **Distress** — If the elder seems unusually upset or disoriented, the companion speaks calmly and suggests reaching out to a nearby caregiver or family member (from the learner's original instructions).
- **What persists** — Nothing needs to be kept between visits for the demo; a new visit starts from Home.

## Product Decisions
- **Eight questions, one page** — enough to show tailoring and the "know but hold back" kernel; quick to show in a demo; learner prefers one page and it suits short forms.
- **Start with a big button, not voice alone** — avoids an always-listening microphone (privacy) and browser restrictions; voice-only start deferred. (Proposed by the agent; learner did not object — confirm in review.)
- **Elder speaks first** — "Hi!" or "Let's chat."
- **Glowing light instead of text** — the elder shouldn't need to read; the light shows listening vs. speaking.
- **Two ways to end** — goodbye, or silence → check-in → goodbye.
- **Demo elder based on the learner's dad, with identifying details changed** — the demo is public. (`scope.md > Explicitly Cut`)
- **Warm, soft, calm, large text** — accessible for older users.

## What We're Building
- Home page with the learner's welcome copy and Get started.
- One-page, eight-question family questionnaire.
- Companion behavior built from the answers plus the learner's core conversation rules.
- Conversation screen with a big Start button and an animated listening/speaking light.
- Spoken back-and-forth conversation (elder speaks, companion speaks).
- Ending on goodbye or after silence with a check-in.
- The states listed above.

## Deferred From the POC
- **Starting by voice alone** — needs always-on listening; privacy and browser limits.
- **Saving profiles / coming back later** — implies storage or accounts; the demo works in one visit.
- **A family summary of the companion** (showing what was created) — nice for trust, but not needed to prove the conversation.
- **The full 50-question questionnaire** — too long for the proof of concept.

## Possible Later Enhancements
- Voice-activated start ("Hey, let's chat").
- Interrupting by speaking (needs a real-time voice model so the companion doesn't hear itself).
- Saved profiles for multiple families; the elder adding or correcting their own information.
- Family feedback and "is it making a difference?" questions.
- Choice of voice (gender, accent, pace) from the questionnaire.
- Smart speaker or dedicated device; additional languages.
- An avatar instead of a light.

## Non-Goals
- **Not a caregiver, therapist, or medical tool** — never claims to treat or prevent dementia.
- **No memory between conversations** — privacy; background comes from the questionnaire.
- **No accounts or public launch** — out of proof-of-concept size.
- **No real identifying details** about the learner's father.
- **No memory quizzes or brain-training exercises** — against the learner's core rules.

## Open Questions
- **How long a silence before the check-in?** Can be tuned during the build (assumption: around 30–60 seconds). Doesn't block `4-spec`.
- **Which questions are required?** Assumption: only the preferred name. Doesn't block `4-spec`.
- **Speech recognition for older or soft voices** — a technical risk for `4-spec` to address (and whether the demo needs a fallback).
