// The chat helper: a Vercel serverless function at POST /api/chat.
// It is the only part of the app that holds the secret Anthropic key.
// The page sends { answers, history }; we send back { reply }.

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-haiku-5-5";

// Placeholder companion for slice 1. Slice 2 replaces this with the
// full rules built from the family's questionnaire answers.
const PLACEHOLDER_INSTRUCTIONS = `You are a warm, friendly conversation companion for an older adult.
Your replies are spoken aloud, so keep them to two or three short, clear sentences.
Use plain words. Do not use lists, symbols, or emoji.
Ask at most one question at a time.`;

// Builds the request for Claude and returns the reply text.
// `client` is passed in so it can be swapped for a stand-in during testing.
export async function getReply({ history }, client) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: PLACEHOLDER_INSTRUCTIONS,
    messages: history,
    output_config: { effort: "low" },
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();

  return text;
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

  try {
    client ??= new Anthropic();
    const reply = await getReply({ history }, client);
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Chat helper failed:", error);
    res.status(500).json({ error: "The companion couldn't respond." });
  }
}
