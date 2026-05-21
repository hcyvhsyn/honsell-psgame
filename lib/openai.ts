import OpenAI from "openai";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY env dəyişəni təyin olunmayıb.");
  }
  cached = new OpenAI({ apiKey });
  return cached;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
