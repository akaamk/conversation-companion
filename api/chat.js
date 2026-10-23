// The chat helper: a Vercel serverless function at POST /api/chat.
// It is the only part of the app that holds the secret Anthropic key.
// The page sends { answers, history }; we stream the reply back as plain
// text while Claude writes it, so the page can start speaking early.

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";

// Placeholder companion for slices 1–2. Slice 3 replaces this with the
// full rules built from the family's questionnaire answers.
const PLACEHOLDER_INSTRUCTIONS = `You are a warm, friendly conversation companion for an older adult.
Your replies are spoken aloud, so keep them to two or three short, clear sentences.
Use plain words. Do not use lists, symbols, or emoji.
Ask at most one question at a time.`;

export const REFUSAL_REPLY = "Let's talk about something else. What's been on your mind today?";

// Asks Claude for a reply and passes each piece of text to `onText` as it
// arrives. Returns the whole reply. `client` is passed in so it can be
// swapped for a stand-in during testing.
export async function streamReply({ history }, client, onText) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: PLACEHOLDER_INSTRUCTIONS,
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (history.length === 0) {
    res.status(400).json({ error: "The conversation is empty." });
    return;
  }

  let started = false;
  try {
    client ??= new Anthropic();
    await streamReply({ history }, client, (text) => {
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
      res.status(500).json({ error: "The companion couldn't respond." });
    }
  }
}
