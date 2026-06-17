import { getOpenAI, isOpenAIConfigured } from "@/lib/openai";

const COMMUNITY_MODERATION_MODEL =
  process.env.COMMUNITY_MODERATION_MODEL ||
  process.env.AI_CHAT_MODEL ||
  "gpt-4o-mini";

type CleanupKind = "post" | "comment" | "title";

export type CommunityCleanupResult = {
  text: string;
  changed: boolean;
  aiUsed: boolean;
  safeToPublish: boolean;
  reason: string | null;
};

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bcox\b/gi, "çox"],
  [/\bcunki\b/gi, "çünki"],
  [/\bolar\?/gi, "olar?"],
  [/\bsagol\b/gi, "sağ ol"],
  [/\btesekkur\b/gi, "təşəkkür"],
  [/\bzehmet\b/gi, "zəhmət"],
  [/\bduzgun\b/gi, "düzgün"],
  [/\byaxsi\b/gi, "yaxşı"],
];

function compactText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function localCleanup(input: string): CommunityCleanupResult {
  let text = compactText(input);
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  const reason = detectLocalBlockReason(text);
  return {
    text,
    changed: text !== compactText(input),
    aiUsed: false,
    safeToPublish: reason === null,
    reason,
  };
}

// Reklam / xarici əlaqə siqnalları.
const AD_PATTERNS = [
  /(https?:\/\/|www\.|t\.me\/|wa\.me\/|instagram\.com\/|fb\.com\/|youtu)/i,
  /[a-z0-9-]{2,}\.(az|com|net|org|ru|tr|info|biz|store|shop|online|site)\b/i,
  /@[a-z0-9._]{3,}/i, // sosial handle (@username)
  /(\+?994|\b0)\s*\(?\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/, // AZ nömrə
  /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/,
  /\b\d{9,}\b/,
  /\b(reklam|sponsor|promo\s?kod|promokod|endirim\s?kod)/i,
  /\b(kanal[ıi]m|s[eə]hif[eə]m|profil[iı]m[eə]?|abun[eə]\s?ol|follow|izl[eə]\s?kanal)/i,
  /\b(wp|whatsapp|vatsap|telegram|teleqram|insta(gram)?|inbox|direct)\b/i,
  /\b(sat[ıi]ram|sat[ıi]l[ıi]r|bizd[eə]n al|[eə]laq[eə]\s?saxla|sifari[şs]\s?[uü][cç][uü]n)/i,
];

// Söyüş / təhqir siqnalları — yalnız tipik söyüş sonluqları ilə (yumşaq sözlər yox).
const PROFANITY_PATTERNS = [
  /\b(s[iı]k(dir|tir|i[şs]|im|ir|di|d[iı]n)|am[ıi]na|amc[ıi]q|oros(pu|p)|q[eə]hb[eə]|gavat|p[eə]z[eə]v[eə]ng|g[oö]tver[eə]n)/i,
  /\b(s[öo]y[uü][şs]|t[eə]hqir|nifr[eə]t\s?nitqi)/i,
];

/**
 * AI olmayanda (və ya AI cavabı qeyri-müəyyən olanda) işləyən lokal yoxlama.
 * Bloklanmalıdırsa səbəb kodunu ("PROFANITY" | "AD"), əks halda null qaytarır.
 * Söyüş reklamdan daha ağır sayıldığı üçün əvvəl o yoxlanır.
 */
function detectLocalBlockReason(text: string): string | null {
  const normalized = text.toLocaleLowerCase("az");
  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(normalized))) return "PROFANITY";
  if (AD_PATTERNS.some((pattern) => pattern.test(normalized))) return "AD";
  return null;
}

function safeSlice(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength).trim();
  const lastSpace = sliced.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.75 ? sliced.slice(0, lastSpace) : sliced).trim();
}

export async function cleanupCommunityText(params: {
  text: string;
  kind: CleanupKind;
  maxLength: number;
}): Promise<CommunityCleanupResult> {
  const original = compactText(params.text);
  if (!original) {
    return { text: "", changed: false, aiUsed: false, safeToPublish: true, reason: null };
  }

  if (!isOpenAIConfigured()) {
    const fallback = localCleanup(original);
    return { ...fallback, text: safeSlice(fallback.text, params.maxLength) };
  }

  try {
    const client = getOpenAI();
    const res = await client.chat.completions.create({
      model: COMMUNITY_MODERATION_MODEL,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You moderate and clean text for an Azerbaijani Latin customer community. Return only JSON: {\"text\":\"...\",\"changed\":true|false,\"safeToPublish\":true|false,\"reason\":\"OK|AD|PROFANITY|HARASSMENT|SEXUAL|HATE|THREAT|SPAM|OTHER\"}. Fix spelling, casing and punctuation only when the text is safe. Mark safeToPublish=false for advertisements, external promotion/contact links, spam, profanity, sexual content, hate, harassment, threats, or abusive wording. If unsafe, keep text close to the original so an admin can inspect it; do not sanitize it into a publishable version. Do not add facts, apologies, warnings, emojis, markdown or explanations.",
        },
        {
          role: "user",
          content: JSON.stringify({
            kind: params.kind,
            maxLength: params.maxLength,
            text: original,
          }),
        },
      ],
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      text?: unknown;
      changed?: unknown;
      safeToPublish?: unknown;
      reason?: unknown;
    };
    const text = typeof parsed.text === "string" ? compactText(parsed.text) : "";
    if (!text) return localCleanup(original);

    const finalText = safeSlice(text, params.maxLength);
    const safeToPublish =
      typeof parsed.safeToPublish === "boolean"
        ? parsed.safeToPublish
        : detectLocalBlockReason(finalText) === null;
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim().slice(0, 80)
        : safeToPublish
          ? null
          : "AI_BLOCKED";

    return {
      text: finalText,
      changed: Boolean(parsed.changed) || finalText !== original,
      aiUsed: true,
      safeToPublish,
      reason,
    };
  } catch (error) {
    console.error("community cleanup failed", error);
    const fallback = localCleanup(original);
    return { ...fallback, text: safeSlice(fallback.text, params.maxLength) };
  }
}
