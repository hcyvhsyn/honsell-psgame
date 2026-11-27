import type { Metadata } from "next";
import Link from "next/link";
import { Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings, type PricingSettings } from "@/lib/pricing";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import GameCard, { type GameCardData } from "@/components/GameCard";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { gameDetailHref } from "@/lib/gameSlug";
import { buildGameCard, GAME_CARD_SELECT } from "@/lib/gameCardMapper";
import { sellableGameWhere } from "@/lib/storeScope";

export const revalidate = 600;

const PAGE_SIZE = 48;

export const metadata: Metadata = {
  title: "Endirimli PS Oyunları — Aktiv Endirim Kampaniyaları",
  description:
    "Azərbaycanda endirimli PlayStation oyunlarının canlı siyahısı. PS4 və PS5 üçün ən böyük endirim faizi ilə sıralanmış oyunlar — anında çatdırılma.",
  alternates: { canonical: "/endirimler" },
  openGraph: {
    title: "Endirimli PS Oyunları | Honsell Store",
    description:
      "PS Store-da aktiv endirim kampaniyaları. Endirim faizinə görə sıralanmış canlı siyahı.",
    url: "/endirimler",
  },
};

/** Sıralama üçün YALNIZ qiymət sütunları — `computeDisplayPrice` bunlardan başqa heç nə oxumur. */
const RANKING_SELECT = {
  id: true,
  store: true,
  priceTryCents: true,
  discountTryCents: true,
  discountEndAt: true,
  customMarginPct: true,
  customPriceAznCents: true,
  priceUsdCents: true,
  discountUsdCents: true,
} as const;

/**
 * Endirim faizinə görə sıralanmış `[gameId, faiz]` siyahısı.
 *
 * ⚠️ Əvvəl burada `SELECT *` idi: ~10 min sətir `Game.embedding` (512 Float) vektoru ilə
 * birlikdə çəkilirdi → hər açılış ~24 s, keş dəyəri də limitdən böyük olduğu üçün tutmurdu.
 * İndi keşdə yalnız id + faiz saxlanılır (bir neçə yüz KB), kart sütunları isə
 * səhifədəki 48 oyun üçün ayrıca çəkilir.
 *
 * `settingsKey` arqumenti keş açarının hissəsidir: admin marja/məzənnəni dəyişəndə sıra
 * köhnə qiymətlə qalmasın, yeni açarla yenidən hesablansın.
 */
const getDiscountRanking = unstable_cache(
  async (settingsKey: string): Promise<Array<[string, number]>> => {
    const settings = JSON.parse(settingsKey) as PricingSettings;
    const now = new Date();
    const rows = await prisma.game.findMany({
      where: {
        isActive: true,
        ...sellableGameWhere(),
        discountTryCents: { not: null },
        // Bitməmiş endirimlər: ya `discountEndAt` boşdur, ya da gələcəkdədir.
        // Stale endirimləri DB səviyyəsində filterləyirik ki, fantom təkliflər
        // səhifəyə düşməsin.
        OR: [{ discountEndAt: null }, { discountEndAt: { gt: now } }],
      },
      // Eyni faizli oyunlar arasında təzə yenilənənlər öndə qalsın (sort stabildir).
      orderBy: { lastScrapedAt: "desc" },
      select: RANKING_SELECT,
    });
    return rows
      .map((g): [string, number] => [g.id, computeDisplayPrice(g, settings).discountPct ?? 0])
      .filter(([, pct]) => pct > 0)
      .sort((a, b) => b[1] - a[1]);
  },
  ["endirimler-ranking-v3"],
  { revalidate: 600, tags: ["games"] }
);

export default async function EndirimlerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const pageRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number(pageRaw) || 1);

  const settings = await getSettings();
  const ranking = await getDiscountRanking(JSON.stringify(settings));

  const total = ranking.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageIds = ranking.slice(offset, offset + PAGE_SIZE).map(([id]) => id);

  // Yalnız bu səhifənin kartları — sıranı `ranking` müəyyən edir (`in` sorğusu sıranı qorumur).
  const pageRows = pageIds.length
    ? await prisma.game.findMany({ where: { id: { in: pageIds } }, select: GAME_CARD_SELECT })
    : [];
  const rowById = new Map(pageRows.map((g) => [g.id, g]));
  const slice = pageIds.flatMap((id) => {
    const game = rowById.get(id);
    return game ? [{ game, price: computeDisplayPrice(game, settings) }] : [];
  });

  const cards: GameCardData[] = slice.map(({ game, price }) =>
    buildGameCard(game, price)
  );

  const maxDiscount = ranking[0]?.[1] ?? 0;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Endirimli PlayStation oyunları",
    numberOfItems: total,
    itemListElement: slice.slice(0, 24).map(({ game, price }, i) => ({
      "@type": "ListItem",
      position: offset + i + 1,
      url: `${SITE_URL}${gameDetailHref(game) ?? "/oyunlar"}`,
      name: game.title,
      ...(price.discountPct != null
        ? {
            offers: {
              "@type": "Offer",
              priceCurrency: "AZN",
              price: price.finalAzn.toFixed(2),
              availability: "https://schema.org/InStock",
              seller: { "@type": "Organization", name: SITE_NAME },
            },
          }
        : {}),
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-600/15 via-fuchsia-700/10 to-zinc-900/40 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
            <Tag className="h-3.5 w-3.5" />
            Canlı endirim kampaniyaları
          </div>
          <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
            Endirimli PlayStation Oyunları
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Azərbaycanda PS Store-un aktiv endirim kampaniyaları. Hər oyun ən böyük endirim faizinə görə sıralanır — sənə qənaət üçün doğru sıra. Cəmi {total.toLocaleString("az-AZ")} aktiv təklif{maxDiscount > 0 ? `, ən yüksəyi ${maxDiscount}%` : ""}.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center text-zinc-500">
            Hazırda aktiv endirim yoxdur. Tezliklə yeni kampaniyalar əlavə olunacaq.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((g, i) => (
              <GameCard key={g.id} game={g} priority={i < 4} />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Səhifələmə">
            <PaginationLink page={safePage - 1} disabled={safePage <= 1}>
              <ChevronLeft className="h-4 w-4" /> Əvvəlki
            </PaginationLink>

            <span className="px-4 text-sm text-zinc-400">
              Səhifə <span className="font-semibold text-white">{safePage}</span> / {totalPages}
            </span>

            <PaginationLink page={safePage + 1} disabled={safePage >= totalPages}>
              Növbəti <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </nav>
        )}

        {/* SEO content block — long-tail keywords */}
        <div className="mt-16 rounded-2xl border border-white/5 bg-zinc-900/30 p-8">
          <h2 className="text-xl font-bold text-white">PS Store endirimləri haqqında</h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-400">
            <p>
              Bu səhifədə PlayStation Store-un Türkiyə bölgəsində aktiv olan endirim kampaniyalarını görürsən. Qiymətlər hər saatda yenilənir və PS4, PS5 oyunları üzrə ən sərfəli təklifləri əhatə edir.
            </p>
            <p>
              Endirimlərdən maksimum yararlanmaq üçün <Link href="/ps-plus" className="text-indigo-400 hover:text-indigo-300">PS Plus üzvlüyü</Link> də əlavə endirim hüququ verir. Wallet-i doldurmaq istəyirsənsə, <Link href="/hediyye-kartlari" className="text-indigo-400 hover:text-indigo-300">TRY hədiyyə kartlarımıza</Link> baxa bilərsən.
            </p>
            <p>
              Bütün PS Store kataloqunu görmək üçün <Link href="/oyunlar" className="text-indigo-400 hover:text-indigo-300">oyunlar səhifəmizə</Link> keç.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PaginationLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const baseClass =
    "inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition";
  if (disabled) {
    return (
      <span className={`${baseClass} cursor-not-allowed opacity-40`} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link href={page === 1 ? "/endirimler" : `/endirimler?page=${page}`} className={`${baseClass} hover:bg-white/10`}>
      {children}
    </Link>
  );
}
