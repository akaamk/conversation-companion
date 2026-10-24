# Conversation Companion

*Every story deserves a listener.*

A voice conversation companion for older adults. A family member answers a short questionnaire about their loved one, and it becomes a companion tailored to that person: someone to talk with who knows what they enjoy, speaks in short, clear sentences, and treats them as an intelligent adult with a lifetime of stories.

The companion can know a person's favorite stories but **hold them back until they bring them up**, so they stay the one telling their own life story.

**Try it:** https://conversation-companion-sand.vercel.app (Microsoft Edge or Google Chrome, with a microphone and speakers)

## How to use it

1. Open the link and press **Get started**.
2. A family member answers nine questions: the name they like to be called, their background and personality, favorite subjects, the stories they love to tell, which of those to wait for them to bring up, hearing and communication needs, subjects that upset them, and a man's or woman's voice.
3. Press **Create their companion**, hand over the device, and press the big **Start** button.
4. They just talk. There is nothing to type or read. A glowing light shows what's happening: **green** while listening, **gold** while thinking, **terracotta** while speaking. Tapping the screen interrupts the companion.
5. The conversation ends when they say goodbye (or "I have to go"), after a long silence and a gentle "Are you still there?", or right away with the small **Stop** button in the bottom-right corner. The microphone then turns off.

To try it without typing a profile, open `/questionnaire.html?demo` to fill in a fictional demo person, George.

## How it works

- **Three plain web pages** (HTML, CSS and JavaScript, no framework): Home, the questionnaire, and the conversation.
- **The browser's own speech features** turn the elder's words into text and read the companion's replies aloud (Edge's natural voices work best).
- **A small helper on Vercel** (`api/chat.js`) is the only part that holds the secret Anthropic key. It turns the questionnaire answers into the companion's instructions (`api/companion-instructions.js`) and streams a reply from **Claude Haiku 5.5**, so the companion can start speaking its first sentence while the rest is still being written.
- The page decides when someone has finished speaking by combining a short pause, extra patience after unfinished phrases like "yeah, um…", more patience for longer stories, and a sound meter, so hesitations aren't mistaken for the end of a turn.

## Privacy

- The questionnaire answers stay in the browser for that visit only and disappear when the tab is closed. Nothing is stored on a server.
- To create replies, the answers and the conversation are sent to Anthropic (Claude). The browser's speech recognition sends audio to Microsoft (Edge) or Google (Chrome) to be turned into text.
- There is no memory between conversations.

## Run your own copy

1. Fork this repository.
2. Create an API key in the [Anthropic Console](https://console.anthropic.com) and set a monthly spending limit.
3. In [Vercel](https://vercel.com), import the repository (Framework Preset: **Other**) and add an environment variable `ANTHROPIC_API_KEY` with your key.
4. Deploy, and open the link Vercel gives you.

Testing helpers: `?debug` on the conversation page shows what was heard and how long each part took; `?demo` uses the demo person; `&idle=10000` shortens the silence check-in; `/voices.html` plays every available voice.

## What it is not

It is not a caregiver, therapist, or medical tool, and it doesn't claim to treat or prevent dementia. It is a companion for conversation, meant to complement real relationships, not replace them.

## Built with

Built during Devpost's *Build With AI: Basics* hackathon, planning first (scope, product requirements, technical spec) and then building in small tested steps with Claude Code. The planning documents are in [`devpost/`](devpost/).
