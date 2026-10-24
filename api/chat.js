// The chat helper: a Vercel serverless function at POST /api/chat.
// It is the only part of the app that holds the secret Anthropic key.
// The page sends { answers, history }; we stream the reply back as plain
// text while Claude writes it, so the page can start speaking early.

import Anthropic from "@anthropic-ai/sdk";
import { buildInstructions } from "./companion-instructions.js";

export const MODEL = "claude-haiku-5-5";

// The voice choice stays in the browser; only these answers shape the companion.
const ANSWER_FIELDS = ["name", "ageAndOrigin", "personality", "interests", "experiences", "holdBack", "communication", "upsetting"];

// Keeps only the questionnaire fields we expect, as plain text of a sensible length.
export function cleanAnswers(raw) {
  const answers = {};
  if (raw && typeof raw === "object") {
    for (const field of ANSWER_FIELDS) {
      if (typeof raw[field] === "string") {
        answers[field] = raw[field].slice(0, 2000);
      }
    }
  }
  return answers;
}

// Today's date, for the companion's sense of the season. The demo family is in
// New York; a later version could take the family's time zone from the browser.
export function todayInNewYork() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York",
  });
}

export const REFUSAL_REPLY = "Let's talk about something else. What's been on your mind today?";

// Asks Claude for a reply and passes each piece of text to `onText` as it
// arrives. Returns the whole reply. `client` is passed in so it can be
// swapped for a stand-in during testing.
export async function streamReply({ answers, history }, client, onText) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: buildInstructions(answers, todayInNewYork()),
    messages: history,
    output_config: { effort: "low" },
  });

  let reply = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      reply += event.delta.text;
      onText(event.delta.text);
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal" && reply.trim() === "") {
    reply = REFUSAL_REPLY;
    onText(REFUSAL_REPLY);
  }
  return reply;
}

let client;

// Limits that keep one request sensible: only the most recent part of a long
// conversation is sent, and no single message can be enormous.
export const MAX_TURNS = 40;
export const MAX_MESSAGE_CHARS = 4000;

// Checks the conversation the page sent. Returns the cleaned history, or an
// error message to send back.
export function cleanHistory(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "The conversation is empty." };
  }
  const messages = [];
  for (const message of raw) {
    if (!message || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") {
      return { error: "The conversation isn't in the expected form." };
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return { error: "That message is too long." };
    }
    messages.push({ role: message.role, content: message.content });
  }
  // Keep the most recent turns, starting with something the elder said.
  let recent = messages.slice(-MAX_TURNS);
  while (recent.length > 0 && recent[0].role !== "user") {
    recent = recent.slice(1);
  }
  if (recent.length === 0) {
    return { error: "The conversation is empty." };
  }
  return { history: recent };
}

// A short explanation for the family when something goes wrong with Claude.
function problemMessage(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { status: 500, error: "The companion's key isn't working. Check ANTHROPIC_API_KEY in Vercel's settings." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 503, error: "The companion is busy right now. Please try again in a minute." };
  }
  if (error instanceof Anthropic.APIError && error.status === 400 && /credit/i.test(error.message)) {
    return { status: 503, error: "The companion's account is out of credit. Add credit in the Anthropic Console." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, error: "The companion couldn't respond. Please try again." };
  }
  return { status: 500, error: "The companion couldn't respond." };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const { history, error } = cleanHistory(req.body?.history);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "The companion isn't set up yet: ANTHROPIC_API_KEY is missing in Vercel's settings." });
    return;
  }

  let started = false;
  try {
    client ??= new Anthropic();
    const answers = cleanAnswers(req.body?.answers);
    await streamReply({ answers, history }, client, (text) => {
      if (!started) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
        started = true;
      }
      res.write(text);
    });
    if (!started) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end();
  } catch (error) {
    console.error("Chat helper failed:", error);
    if (started) {
      res.end(); // the page notices the reply stopped short
    } else {
      const problem = problemMessage(error);
      res.status(problem.status).json({ error: problem.error });
    }
  }
}
