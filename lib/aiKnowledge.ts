import { prisma } from "@/lib/prisma";
import {
  DEFAULT_AI_KNOWLEDGE,
  SITE_KNOWLEDGE,
  aiKnowledgeCategoryLabel,
} from "@/lib/aiKnowledgeShared";

/**
 * AI köməkçisinin bilik bazasının SERVER hissəsi — DB-dən yükləmə, seed və
 * cache. Client-safe sabitlər (kateqoriyalar, default girişlər, fallback mətn)
 * `lib/aiKnowledgeShared.ts`-dədir ki, prisma client bundle-a düşməsin.
 *
 * Qeyd: oyun və streaming kataloqu DİNAMİK olaraq (semantik axtarış / DB sorğusu)
 * chat route-da kontekstə əlavə olunur — burada yalnız sabit, izahedici bilik var.
 */

// Geriyə uyğunluq üçün re-export (server consumer-lər köhnə yoldan idxal edir).
export {
  AI_KNOWLEDGE_CATEGORIES,
  isValidAiKnowledgeCategory,
  aiKnowledgeCategoryLabel,
  DEFAULT_AI_KNOWLEDGE,
  SITE_KNOWLEDGE,
  type AiKnowledgeCategory,
} from "@/lib/aiKnowledgeShared";

type CacheEntry = { ts: number; block: string };
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000;

let seedPromise: Promise<void> | null = null;

/** Cədvəl boşdursa standart girişlərlə bir dəfə doldur. */
async function seedIfEmptyOnce(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const count = await prisma.aiKnowledge.count();
        if (count === 0) {
          await prisma.aiKnowledge.createMany({
            data: DEFAULT_AI_KNOWLEDGE.map((e) => ({ ...e, isActive: true })),
          });
        }
      } catch (e) {
        console.error("ai-knowledge: seed uğursuz", e);
      }
    })();
  }
  await seedPromise;
}

/** Chat route üçün aktiv biliyi (DB) mətn blokuna çevirir. Cache + fallback. */
export async function getAiKnowledge(): Promise<string> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.block;

  try {
    await seedIfEmptyOnce();
    const rows = await prisma.aiKnowledge.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { title: true, content: true, category: true },
    });

    if (rows.length === 0) {
      cache = { ts: Date.now(), block: SITE_KNOWLEDGE };
      return SITE_KNOWLEDGE;
    }

    const block = [
      "SAYTIN BİLİK BAZASI:",
      "",
      ...rows.map(
        (r) => `[${aiKnowledgeCategoryLabel(r.category)}] ${r.title}: ${r.content}`
      ),
    ].join("\n");

    cache = { ts: Date.now(), block };
    return block;
  } catch (e) {
    console.error("ai-knowledge: DB yükləmə uğursuz, statik fallback", e);
    return SITE_KNOWLEDGE;
  }
}

/** Admin dəyişiklik etdikdən sonra chat-ın dərhal yeni biliyi görməsi üçün. */
export function invalidateAiKnowledgeCache() {
  cache = null;
}
