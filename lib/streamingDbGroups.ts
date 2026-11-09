import "server-only";
import { prisma } from "@/lib/prisma";
import {
  parseStreamingFeatures,
  resolvePlatformGroup,
  tierKeyFromSlug,
  type StreamingAccessMode,
  type StreamingFeature,
} from "@/lib/streamingAccess";

/** Admin-dən qurulan xidmətin bir planı (vitrin üçün). */
export type DbStreamingTier = {
  /** Plan kodu = paketlərin `metadata.service`-i. */
  code: string;
  slug: string;
  /** `?paket=` açarı. */
  key: string;
  name: string;
  mode: StreamingAccessMode;
  features: StreamingFeature[];
  rank: number;
};

/**
 * Üst xidmətin aktiv planları (lib/streamingAccess.ts). Netflix-ə ÇAĞIRMA — onun vitrini koddadır
 * (lib/streamingGroups.ts). DB miqrasiyası hələ düşməyibsə boş siyahı qaytarır, səhifə köhnə
 * (tək plan) görünüşündə qalır.
 */
export async function loadDbStreamingTiers(parent: { code: string; slug: string }): Promise<DbStreamingTier[]> {
  try {
    const rows = await prisma.streamingPlatform.findMany({
      where: { parentCode: parent.code.toUpperCase(), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    return rows.flatMap((row, index) => {
      const { accessMode } = resolvePlatformGroup(row);
      if (!accessMode) return [];
      return [
        {
          code: row.code.toUpperCase(),
          slug: row.slug,
          key: tierKeyFromSlug(row.slug, parent.slug, accessMode),
          name: row.tierName.trim() || row.label,
          mode: accessMode,
          features: parseStreamingFeatures(row.features),
          rank: index,
        },
      ];
    });
  } catch {
    return [];
  }
}
