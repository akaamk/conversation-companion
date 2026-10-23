---
doc: scope
status: approved
---

# The Conversation Companion

A family answers a short questionnaire about their elderly loved one, and it becomes a voice companion tailored to that person: someone to talk with who treats them as an intelligent adult with a lifetime of stories.

## The Unique Kernel
**Family questionnaire → tailored companion → voice conversation.** The family's answers shape *how* the companion talks (pace, short sentences, rephrasing for hearing loss), *what* it talks about, what it avoids, and — distinctively — what it **knows but holds back**: it can know the person's life stories yet "let him introduce his own stories," so the elder stays the one who leads the discovery of their life. It is a conversation partner, never a caregiver, therapist, or memory test.

## Who It's For
- **The elder:** someone like the learner's very elderly father — a 98-year-old retired NYC police officer at home with health aides, hard of hearing, increasingly isolated, with "no one to talk to," and showing more signs of dementia. Loves WWII and NYC history, police work, classic movies. Shouldn't have to type or read.
- **The family member:** an adult child who wants their parent to have engaging company and fills out the questionnaire. Today the alternatives are aides who may not talk much, relatives who rarely check in, or nothing.

## The Core Loop
- **Family (once):** answers the short questionnaire → sees a companion created for their loved one.
- **Elder (over and over):** starts a conversation and talks out loud; the companion listens, responds warmly and substantively in short clear sentences, contributes something interesting, and lets them tell their stories. They come back because it's enjoyable company that knows what they care about.

## Inspiration & Identity
- The learner's own drafted GPT instructions ("The Conversation Companion — revised for age 98") and family questionnaire ("Getting to Know Your Loved One"), both written before this hackathon. These are the source material for the companion's behavior and the setup questions.
- Tone: "two adults having an enjoyable, thoughtful chat." Warm, curious, well-informed, patient, occasionally humorous. "Leave him feeling heard rather than managed."
- Previous attempt: a custom GPT, abandoned because GPTs are being phased out and the replacement wouldn't allow voice.

## Why This Matters to the Learner
Their father "has no one to talk to which is isolating for him and has clearly increased signs of dementia." It may be too late for him, so they're "picturing providing it to others in similar situations."

## What "Working" Looks Like
A short demo video that shows:
1. **Setup overview:** a family member fills out a short version of the questionnaire for a demo elder (based on the learner's dad, with identifying details like the NYPD movie/TV unit and famous encounters removed or changed).
2. **Conversation:** that companion has a simple spoken conversation with the elder — no typing, no reading required.

The "oh, that works" beat: the family "should see that the elderly parent is being engaged and has a conversation partner and the elderly person should be enjoying a conversation" — e.g., the companion responds to a story naturally, in short clear spoken sentences, without revealing background it was told to hold back.

## The POC Boundary
- A **short questionnaire** — a handful of the most important questions from the learner's 50 (name, interests, favorite stories, communication/hearing needs, subjects to avoid, "know but wait for them to bring it up").
- Answers turn into **companion instructions** modeled on the learner's GPT instructions.
- **One voice conversation:** the elder speaks and hears; no typing or reading needed.
- One demo elder profile, fictionalized from the learner's dad.

## Later
- The full 50-question questionnaire.
- Saved profiles for multiple families; family accounts.
- The elder adding or correcting information about themselves over time.
- Family feedback and "is it making a difference" questions.
- Smart speaker or dedicated device; tuning for multiple languages or voices.
- The AI movie-creation app with tweakable aspects (separate idea).

## Explicitly Cut
- **Accounts/logins and a real launch to other families** — not needed to prove the idea; adds privacy and security work beyond a proof of concept.
- **Long-term memory across conversations** — the questionnaire provides the background; persistent memory raises privacy questions the learner's instructions already flag.
- **Using real identifying details about the learner's dad** — the demo is public on GitHub and video.

## Open Risk
Voice is central. The learner thought voice companions weren't doable with today's frontier models; they are (spoken input and output can be layered onto an AI model in the browser, or via dedicated voice APIs), but speech recognition can struggle with older or soft voices. `4-spec` chooses the approach; a fallback for the demo may be worth discussing.
