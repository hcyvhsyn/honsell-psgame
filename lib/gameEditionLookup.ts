import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { baseGameTitle, editionSearchPrefix, editionSuffixLabel, isSameGameFamily } from "@/lib/gameEditions";

/**
 * Bir oyunun SÜRÜM namizədlərini DB-dən tapır (server-only — prisma işlədir).
 *
 * Admin paneli (checkbox siyahısı) və Telegram axını (avto doldurma) EYNİ mənbəni
 * işlətsin deyə buradadır; iki yerdə təkrarlansaydı biri dəyişəndə digəri
 * səssizcə fərqli sürüm dəsti verərdi.
 *
 * İki mərhələ, çünki baza başlığı SQL-də hesablaya bilmirik:
 *   1. RECALL    — `title startsWith <prefiks>` (DB işi, geniş tutur).
 *   2. PRECISION — `isSameGameFamily` ilə JS-də dəqiq süzgəc; "God of War" kimi
 *                  qohum-amma-fərqli oyunları atır.
 *
 * Nəticə UCUZDAN BAHAYA sıralıdır — feed də, admin siyahısı da bu sıranı gözləyir.
 */
export type EditionCandidate = {
  id: string;
  title: string;
  imageUrl: string | null;
  platform: string | null;
  editionName: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  /** Axtarışın başladığı oyun (admin seçdiyi / Telegram-da tapılan). */
  isPrimary: boolean;
};

export async function findEditionCandidates(
  gameId: string,
): Promise<{ baseTitle: string; items: EditionCandidate[] } | null> {
  const base = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true, productType: true, store: true },
  });
  if (!base) return null;

  const prefix = editionSearchPrefix(base.title);
  if (!prefix) return { baseTitle: baseGameTitle(base.title), items: [] };

  const [candidates, settings] = await Promise.all([
    prisma.game.findMany({
      where: {
        isActive: true,
        // Sürümlər eyni məhsul tipində olur; DLC/valyuta sətirləri sürüm deyil.
        productType: base.productType,
        // Eyni MAĞAZA — eyni başlıqlı Epic sətri PS oyununun "sürümü" kimi
        // görünüb səbətə yad məhsul ata bilər.
        store: base.store,
        title: { startsWith: prefix, mode: "insensitive" },
      },
      take: 200,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        platform: true,
        store: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    getSettings(),
  ]);

  const items = candidates
    // ⚠️ PC sətirləri: `store` "PS" olsa da `platform` "PC" ola bilir (idxal
    // qalıqları). Reels yalnız PlayStation-dur, ona görə belə sətir sürüm çipi
    // kimi görünməməlidir.
    //
    // Süzgəc JS-dədir, SQL-də DEYİL: `platform: { not: "PC" }` yazsaq
    // `NULL != 'PC'` → `NULL` olduğu üçün platforması boş sətirlər də atılardı.
    .filter((g) => g.platform !== "PC")
    .filter((g) => isSameGameFamily(base.title, g.title))
    .map((g) => {
      const d = computeDisplayPrice(g, settings);
      const discounted = d.discountPct != null && d.discountPct > 0;
      return {
        id: g.id,
        title: g.title,
        imageUrl: g.imageUrl,
        platform: g.platform,
        editionName: editionSuffixLabel(g.title),
        finalAzn: d.finalAzn,
        originalAzn: discounted ? d.originalAzn : null,
        discountPct: discounted ? d.discountPct : null,
        isPrimary: g.id === base.id,
      };
    })
    .sort((a, b) => a.finalAzn - b.finalAzn);

  return { baseTitle: baseGameTitle(base.title), items };
}
