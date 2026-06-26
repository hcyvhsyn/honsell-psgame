import { prisma } from "@/lib/prisma";
import {
  STREAMING_SERVICE_META,
  type StreamingServiceCategory,
  type StreamingServiceMeta,
} from "@/lib/streamingCart";

/**
 * Platforma kimliyi həqiqət mənbəyi olaraq `StreamingPlatform` DB cədvəlindədir.
 * `STREAMING_SERVICE_META` (lib/streamingCart.ts) seed + fallback rolunu oynayır:
 * DB boşdursa və ya əlçatmazdırsa statik defaults qaytarılır, beləliklə ~26
 * sinxron istifadəçi sınmadan işləyir.
 *
 * devices / vpnRequired / platformImageUrl burada DEYIL — onlar paket
 * (serviceProduct) metadata-sında saxlanır (admin API pattern-i ilə).
 */

export const DEFAULT_STREAMING_PLATFORMS: StreamingServiceMeta[] = Object.values(
  STREAMING_SERVICE_META,
);

const PUBLIC_SLUG_BY_DB_SLUG: Record<string, string> = {
  "netflix-vvip": "netflix-hesab",
};

const DB_SLUG_BY_PUBLIC_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_SLUG_BY_DB_SLUG).map(([dbSlug, publicSlug]) => [publicSlug, dbSlug]),
);

export function getPublicStreamingSlug(slug: string): string {
  return PUBLIC_SLUG_BY_DB_SLUG[slug] ?? slug;
}

export function getDbStreamingSlug(slug: string): string {
  return DB_SLUG_BY_PUBLIC_SLUG[slug] ?? slug;
}

function isCategory(value: string): value is StreamingServiceCategory {
  return value === "STREAMING" || value === "MUSIC";
}

function toMeta(row: {
  code: string;
  slug: string;
  label: string;
  category: string;
  tagline: string;
  description: string;
  heroImageUrl?: string | null;
}): StreamingServiceMeta {
  return {
    code: row.code,
    slug: getPublicStreamingSlug(row.slug),
    label: row.label,
    category: isCategory(row.category) ? row.category : "STREAMING",
    tagline: row.tagline,
    description: row.description,
    heroImageUrl: row.heroImageUrl ?? null,
  };
}

/**
 * Aktiv platformaların sırasıyla siyahısı. DB sətirlərini code üzrə statik
 * defaults üzərinə birləşdirir (DB üstünlük təşkil edir). DB əlçatmazdırsa
 * defaults qaytarır.
 */
export async function getStreamingPlatforms(): Promise<StreamingServiceMeta[]> {
  try {
    const rows = await prisma.streamingPlatform.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
    if (rows.length === 0) return DEFAULT_STREAMING_PLATFORMS;
    return rows.map(toMeta);
  } catch {
    return DEFAULT_STREAMING_PLATFORMS;
  }
}

export async function getStreamingPlatformsByCategory(
  category: StreamingServiceCategory,
): Promise<StreamingServiceMeta[]> {
  const all = await getStreamingPlatforms();
  return all.filter((p) => p.category === category);
}

export async function getStreamingPlatformBySlug(
  slug: string,
): Promise<StreamingServiceMeta | null> {
  const dbSlug = getDbStreamingSlug(slug);
  try {
    const row = await prisma.streamingPlatform.findFirst({
      where: { slug: dbSlug, isActive: true },
    });
    if (row) return toMeta(row);
  } catch {
    // DB əlçatmazdırsa fallback-a düş.
  }
  return DEFAULT_STREAMING_PLATFORMS.find((p) => p.slug === slug) ?? null;
}

export async function getStreamingPlatformByCode(
  code: string,
): Promise<StreamingServiceMeta | null> {
  const normalized = code.toUpperCase();
  try {
    const row = await prisma.streamingPlatform.findUnique({
      where: { code: normalized },
    });
    if (row) return toMeta(row);
  } catch {
    // fallback
  }
  return DEFAULT_STREAMING_PLATFORMS.find((p) => p.code === normalized) ?? null;
}
