/**
 * Vitrinin HBO Max AZ dil məlumatı (server) — kataloq kartı və detal səhifəsi ortaq işlədir.
 *
 * ⚠️ Hamısı `HBOMAX_STOREFRONT_COVERAGE=1` arxasındadır: coverage sütunları və Provider*
 * cədvəlləri `prisma/pending-migrations/` miqrasiyaları ilə gəlir. Miqrasiya tətbiq
 * olunmamış DB-də (indiki Supabase) bayraq söndürülü qalmalıdır — əks halda sorğu sınır.
 */
import { prisma } from "@/lib/prisma";
import type { CoverageInfo } from "@/lib/streamingLanguageStates";

export const HBOMAX_COVERAGE_ENABLED = process.env.HBOMAX_STOREFRONT_COVERAGE === "1";

/** ContentLanguage.source — yalnız HBO Max AZ player proyeksiyasının sətirləri. */
export const HBOMAX_LANGUAGE_SOURCE = "HBOMAX_AZ_PLAYER";

type CoverageRow = { coverage: string | null; episodesAvailable: number | null; episodesTotal: number | null };

/** `${availabilityId}|${code}|${kind}` → coverage. Bayraq söndürülübsə boş. */
export async function loadHboCoverage(availabilityIds?: string[]): Promise<Map<string, CoverageRow>> {
  if (!HBOMAX_COVERAGE_ENABLED) return new Map();
  const rows = await prisma.contentLanguage.findMany({
    where: {
      source: HBOMAX_LANGUAGE_SOURCE,
      availability: { isAvailable: true },
      ...(availabilityIds ? { availabilityId: { in: availabilityIds } } : {}),
    },
    select: { availabilityId: true, code: true, kind: true, coverage: true, episodesAvailable: true, episodesTotal: true },
  });
  return new Map(rows.map((r) => [`${r.availabilityId}|${r.code}|${r.kind}`, r]));
}

export interface AvailabilityLangInput {
  id: string;
  languages: Array<{ code: string; kind: string }>;
}

/**
 * Bütün availability-lərin dillərini birləşdirir. HBO AZ coverage-i yalnız dil BAŞQA
 * platformada yoxdursa saxlanılır — Prime-da tam varsa "qismən" nişanı çaşdırar.
 */
export function mergeLanguages(availabilities: AvailabilityLangInput[], coverageMap: Map<string, CoverageRow>) {
  const audio = new Set<string>();
  const sub = new Set<string>();
  const coverage: Record<string, CoverageInfo> = {};
  const fromOtherPlatform = new Set<string>();
  for (const av of availabilities) {
    for (const l of av.languages) {
      if (l.kind !== "AUDIO" && l.kind !== "SUBTITLE") continue;
      const key = `${l.code}-${l.kind === "AUDIO" ? "dub" : "sub"}`;
      (l.kind === "AUDIO" ? audio : sub).add(l.code);
      const cov = coverageMap.get(`${av.id}|${l.code}|${l.kind}`);
      if (cov && (cov.coverage === "FULL" || cov.coverage === "PARTIAL") && cov.episodesTotal) {
        coverage[key] = { coverage: cov.coverage, available: cov.episodesAvailable ?? 0, total: cov.episodesTotal };
      } else {
        fromOtherPlatform.add(key);
      }
    }
  }
  for (const key of fromOtherPlatform) delete coverage[key];
  return { audio: [...audio], sub: [...sub], coverage: Object.keys(coverage).length ? coverage : undefined };
}
