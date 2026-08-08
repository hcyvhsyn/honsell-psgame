import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { gameDetailHref } from "@/lib/gameSlug";
import { dedupeEditions, editionSuffixLabel } from "@/lib/gameEditions";
import { rankReels } from "@/lib/reelRanking";

/**
 * Reels feed data qatı — TƏK mənbə.
 *
 *  • İlk səhifə `getFirstReelsPageCached()` ilə `unstable_cache` (tag "reels")
 *    arxasında keşlənir → RSC `app/reels/page.tsx` ilk posteri ilkin HTML-də verir.
 *    Admin CRUD `revalidateReels()` çağırıb bu tag-ı sıfırlayır.
 *  • Sonrakı səhifələr `/api/reels` (offset kursoru) ilə gəlir.
 *  • Per-user vəziyyət (bəyəndim/dislike/izləndi) BURADA YOXDUR — o, ayrıca
 *    `/api/reels/state` (dynamic) endpoint-indən gəlir ki, feed edge-keşlənən qalsın.
 */

export const REELS_PAGE_SIZE = 8;

/**
 * Feed kateqoriyası. `GAME`/`STREAMING` DB-də saxlanılan dəyərlərdir; `ALL` isə
 * yalnız BAXIŞDIR — süzgəcsiz feed deməkdir, heç vaxt `Reel.category`-yə yazılmır.
 */
export type ReelCategory = "GAME" | "STREAMING" | "ALL" | "SAVED";

/** Saxlanıla bilən kateqoriyalar (admin/Telegram yazma yolları üçün). */
export const STORED_REEL_CATEGORIES = ["GAME", "STREAMING"] as const;

/** Xarici girişi (query param, admin body) təhlükəsiz kateqoriyaya çevirir. */
export function normalizeReelCategory(value: unknown): ReelCategory {
  return value === "GAME" || value === "STREAMING" || value === "ALL" || value === "SAVED"
    ? value
    : "ALL";
}

export type ReelProduct = {
  /** CartItem.id — birbaşa `useCart().add({ id })`. Game/ServiceProduct DB id-si. */
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  /** Endirimdən ƏVVƏLKİ qiymət — yalnız aktiv endirim varsa dolu, yoxsa null. */
  originalAzn: number | null;
  /** Endirim faizi (məs. 35) — endirim yoxdursa/bitibsə null. */
  discountPct: number | null;
  productType: string;
  store: string;
  /** Məhsul səhifəsinə keçid (varsa). */
  href: string | null;
  /** Çipdə görünən sürüm adı — "Standart", "Ultimate Sürüm", … (yalnız oyunlarda). */
  editionName: string | null;
  /** "PS5" | "PS4" | "PS5,PS4" — sürümlər platformaya görə də fərqlənə bilir. */
  platform: string | null;
};

export type ReelFeedItem = {
  id: string;
  /** GAME | STREAMING — deep link açılanda client feed-i buna uyğunlaşdırır. */
  category: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  w: number;
  h: number;
  durationMs: number;
  platform: { code: string | null; label: string | null; logoUrl: string | null };
  cta: {
    type: string; // GAME | SERVICE | URL
    label: string;
    href: string | null;
    /** Əsas məhsul (admin seçdiyi `ctaTargetId`). */
    product: ReelProduct | null;
    /**
     * Oyunun bütün SÜRÜMLƏRİ — UCUZDAN BAHAYA sıralı, ona görə feed `[0]`-ı
     * default seçir (müştəri ən ucuzu dərhal görür). Əsas məhsul da bu siyahının
     * içindədir. Yalnız `ctaType=GAME` və admin sürüm təsdiqləyibsə 1-dən çox
     * element olur; əks halda ya boş, ya tək elementlidir.
     */
    editions: ReelProduct[];
  };
  counts: { likes: number; dislikes: number; views: number; comments: number };
};

type ReelRow = {
  id: string;
  category: string;
  title: string;
  caption: string | null;
  videoUrl: string;
  posterUrl: string;
  width: number;
  height: number;
  durationMs: number;
  platformCode: string | null;
  platformLabel: string | null;
  platformLogoUrl: string | null;
  ctaType: string;
  ctaTargetId: string | null;
  ctaHref: string | null;
  ctaLabel: string | null;
  editionGameIds: string[];
  viewCount: number;
  /** `rankReels` yaş səbətini bundan hesablayır (yenilər öndə). */
  createdAt: Date;
};

/** Bir reels səhifəsinin CTA məhsullarını + reaksiya/şərh saylarını topluca doldurur. */
async function hydrateReels(rows: ReelRow[]): Promise<ReelFeedItem[]> {
  if (rows.length === 0) return [];

  // Əsas oyun + admin təsdiqlədiyi sürümlər BİR sorğuda gəlir (reel başına sorğu
  // açmaq feed-i N+1-ə salardı).
  const gameIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        r.ctaType === "GAME" ? [...(r.ctaTargetId ? [r.ctaTargetId] : []), ...r.editionGameIds] : [],
      ),
    ),
  );
  const serviceIds = rows
    .filter((r) => r.ctaType === "SERVICE" && r.ctaTargetId)
    .map((r) => r.ctaTargetId!);
  const reelIds = rows.map((r) => r.id);

  const [games, services, settings, likeGroups, dislikeGroups, commentGroups] = await Promise.all([
    gameIds.length
      ? prisma.game.findMany({
          // isActive: kataloqdan çıxarılmış sürüm səbətə atıla bilməməlidir.
          where: { id: { in: gameIds }, isActive: true },
          select: {
            id: true,
            productId: true,
            slug: true,
            title: true,
            imageUrl: true,
            store: true,
            platform: true,
            productType: true,
            priceTryCents: true,
            discountTryCents: true,
            discountEndAt: true,
            priceUsdCents: true,
            discountUsdCents: true,
          },
        })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.serviceProduct.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, title: true, imageUrl: true, priceAznCents: true, type: true },
        })
      : Promise.resolve([]),
    getSettings(),
    prisma.reelReaction.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, value: 1 },
      _count: { _all: true },
    }),
    prisma.reelReaction.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, value: -1 },
      _count: { _all: true },
    }),
    prisma.reelComment.groupBy({
      by: ["reelId"],
      where: { reelId: { in: reelIds }, isHidden: false },
      _count: { _all: true },
    }),
  ]);

  const gameById = new Map(games.map((g) => [g.id, g]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const likeById = new Map(likeGroups.map((g) => [g.reelId, g._count._all]));
  const dislikeById = new Map(dislikeGroups.map((g) => [g.reelId, g._count._all]));
  const commentById = new Map(commentGroups.map((g) => [g.reelId, g._count._all]));

  /** Game sətrini feed məhsuluna çevirir — qiymət + endirim burada hesablanır. */
  function toGameProduct(g: (typeof games)[number]): ReelProduct {
    // computeDisplayPrice BİTMİŞ endirimləri özü ləğv edir (discountEndAt keçibsə
    // tam qiymət qaytarır) — "endirim bitəndə endirimsiz qiymət görünsün"
    // tələbi buradan gəlir, ayrıca yoxlama lazım deyil.
    const d = computeDisplayPrice(g, settings);
    const discounted = d.discountPct != null && d.discountPct > 0;
    return {
      id: g.id,
      title: g.title,
      imageUrl: g.imageUrl,
      finalAzn: d.finalAzn,
      originalAzn: discounted ? d.originalAzn : null,
      discountPct: discounted ? d.discountPct : null,
      productType: g.productType,
      store: g.store === "EPIC" || g.platform === "PC" ? "EPIC" : "PS",
      href: gameDetailHref(g) ?? "/oyunlar",
      editionName: editionSuffixLabel(g.title),
      platform: g.platform,
    };
  }

  return rows.map((r) => {
    let product: ReelProduct | null = null;
    let editions: ReelProduct[] = [];

    if (r.ctaType === "GAME" && r.ctaTargetId) {
      const g = gameById.get(r.ctaTargetId);
      if (g) product = toGameProduct(g);

      // Sürüm siyahısı = əsas oyun + admin təsdiqlədikləri, UCUZDAN BAHAYA.
      // Feed [0]-ı default seçir, ona görə sıralama məhsul qərarıdır, kosmetika deyil.
      const ids = Array.from(new Set([r.ctaTargetId, ...r.editionGameIds]));
      editions = dedupeEditions(
        ids
          .map((id) => gameById.get(id))
          .filter((g): g is NonNullable<typeof g> => Boolean(g))
          // PC sətirləri çipdən çıxır — `findEditionCandidates` artıq mənbədə
          // süzür, amma MÖVCUD reels-in `editionGameIds`-ində PC id-si yazılıb
          // qalıb. (JS-də süzülür; SQL-də `not: "PC"` NULL-ları da atardı.)
          .filter((g) => g.platform !== "PC")
          .map(toGameProduct)
          .sort((a, b) => a.finalAzn - b.finalAzn),
      );

      // Süzgəclərdən sonra siyahı boşalarsa panel tamamilə yox olardı — əsas
      // məhsulu tək sürüm kimi saxlayırıq ki, müştəri heç olmasa onu ala bilsin.
      if (editions.length === 0 && product) editions = [product];
    } else if (r.ctaType === "SERVICE" && r.ctaTargetId) {
      const s = serviceById.get(r.ctaTargetId);
      if (s) {
        product = {
          id: s.id,
          title: s.title,
          imageUrl: s.imageUrl,
          finalAzn: s.priceAznCents / 100,
          originalAzn: null,
          discountPct: null,
          productType: s.type,
          store: "SERVICE",
          href: null,
          editionName: null,
          platform: null,
        };
        editions = [product];
      }
    }

    return {
      id: r.id,
      category: r.category,
      title: r.title,
      caption: r.caption,
      videoUrl: r.videoUrl,
      posterUrl: r.posterUrl,
      w: r.width,
      h: r.height,
      durationMs: r.durationMs,
      platform: {
        code: r.platformCode,
        label: r.platformLabel,
        logoUrl: r.platformLogoUrl,
      },
      cta: {
        type: r.ctaType,
        label: r.ctaLabel || (product ? "Al" : "Bax"),
        href: r.ctaType === "URL" ? r.ctaHref : (product?.href ?? null),
        product,
        editions,
      },
      counts: {
        likes: likeById.get(r.id) ?? 0,
        dislikes: dislikeById.get(r.id) ?? 0,
        views: r.viewCount,
        comments: commentById.get(r.id) ?? 0,
      },
    };
  });
}

const REEL_ORDER = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * Feed səhifəsi (offset kursoru ilə). Publik yalnız `isPublished` reels.
 * `nextCursor` növbəti offset (və ya null).
 */
export async function getReelsPage(opts: {
  cursor?: number;
  limit?: number;
  /** `ALL` (default) süzgəc tətbiq etmir. */
  category?: ReelCategory;
  /** Yalnız film feed-ində — platforma çipi süzgəci. */
  platformCode?: string | null;
}): Promise<{ items: ReelFeedItem[]; nextCursor: number | null }> {
  const skip = Math.max(0, opts.cursor ?? 0);
  const limit = Math.min(24, Math.max(1, opts.limit ?? REELS_PAGE_SIZE));
  const category = opts.category ?? "ALL";

  const rows = (await prisma.reel.findMany({
    // Süzgəc SERVERDƏ tətbiq olunur: client-də süzsək offset kursoru süzülmüş
    // dəstlə uyğunsuzlaşır və səhifələmə element atlayır.
    where: {
      isPublished: true,
      ...(category === "ALL" ? {} : { category }),
      ...(opts.platformCode ? { platformCode: opts.platformCode } : {}),
    },
    orderBy: REEL_ORDER,
    skip,
    take: limit + 1, // +1 ilə növbəti səhifə var-yoxunu bilirik
  })) as ReelRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = await hydrateReels(pageRows);
  return { items, nextCursor: hasMore ? skip + limit : null };
}

/**
 * İlk səhifə — keşlənmiş (tag "reels"). RSC ilk paint üçün.
 *
 * `unstable_cache` funksiya ARQUMENTLƏRİNİ avtomatik keş açarına daxil edir, ona
 * görə hər kateqoriya öz girişini alır. Tag hamısında eynidir ki,
 * `revalidateReels()` bir çağırışla hamısını sıfırlasın.
 */
export const getFirstReelsPageCached = unstable_cache(
  async (
    category: ReelCategory,
  ): Promise<{ items: ReelFeedItem[]; nextCursor: number | null }> => {
    return getReelsPage({ cursor: 0, limit: REELS_PAGE_SIZE, category });
  },
  ["reels-feed-v2"],
  { tags: ["reels"], revalidate: 300 },
);

/**
 * Namizəd hovuzunun yuxarı həddi. Sıralama JS-də (saf funksiya ilə) aparılır, ona
 * görə hovuz məhduddur — kataloq bundan böyüyəndə ən yeni 200 sətir kifayətdir,
 * çünki köhnə səbətlər onsuz da siyahının sonundadır.
 */
const RANKING_POOL_SIZE = 200;

/** Client-dən gələn `excludeIds` həddi — client-ə etibar etmirik. */
const MAX_EXCLUDE_IDS = 500;

/**
 * ŞƏXSİLƏŞDİRİLMİŞ feed səhifəsi — görülmüşləri çıxarır və ziyarətə məxsus `seed`
 * ilə qarışdırır (yenilər öndə, bax `lib/reelRanking.ts`).
 *
 * Keşlənmir və keşlənə də bilməz: nəticə istifadəçinin dəftərindən asılıdır. Statik
 * ilk səhifə (`getFirstReelsPageCached`) ilk paint üçün qalır, bu isə onu əvəz edir.
 *
 * `cursor` sıralanmış siyahıya offset kimi tətbiq olunur — eyni `seed` → eyni sıra,
 * ona görə səhifələmə sabitdir.
 */
export async function getPersonalizedReelsPage(opts: {
  cursor?: number;
  limit?: number;
  category?: ReelCategory;
  platformCode?: string | null;
  excludeIds?: string[];
  seed: string;
  /** `SAVED` kateqoriyası üçün məcburi — kimin saxladıqları. */
  userId?: string | null;
}): Promise<{ items: ReelFeedItem[]; nextCursor: number | null; exhausted: boolean }> {
  const skip = Math.max(0, opts.cursor ?? 0);
  const limit = Math.min(24, Math.max(1, opts.limit ?? REELS_PAGE_SIZE));
  const category = opts.category ?? "ALL";
  const exclude = (opts.excludeIds ?? []).slice(-MAX_EXCLUDE_IDS);

  // ─── "Saxladıqlarım" ──────────────────────────────────────────────────────
  // İki mənbədən yığılır: film/serial `ReelBookmark`-da, oyunlar isə mövcud
  // FAVORİTLƏR-də saxlanılır (orada endirim bildirişləri var). Favorit konkret
  // OYUN-a aiddir, ona görə reel-i həm `ctaTargetId`, həm də `editionGameIds`
  // üzrə uyğunlaşdırırıq — istifadəçi Ultimate sürümü saxlayıbsa reel yenə çıxsın.
  //
  // Burada NƏ görülmüş süzgəci, NƏ də qarışdırma tətbiq olunmur: saxlanılan
  // siyahı proqnozlaşdırılan olmalıdır, ən son saxlanılan əvvəldə.
  if (category === "SAVED") {
    if (!opts.userId) return { items: [], nextCursor: null, exhausted: false };

    const [bookmarks, favorites] = await Promise.all([
      prisma.reelBookmark.findMany({
        where: { userId: opts.userId },
        select: { reelId: true },
        orderBy: { createdAt: "desc" },
        take: RANKING_POOL_SIZE,
      }),
      prisma.favorite.findMany({
        where: { userId: opts.userId },
        select: { gameId: true },
        orderBy: { createdAt: "desc" },
        take: RANKING_POOL_SIZE,
      }),
    ]);

    const bookmarkIds = bookmarks.map((b) => b.reelId);
    const favIds = favorites.map((f) => f.gameId);
    if (bookmarkIds.length === 0 && favIds.length === 0) {
      return { items: [], nextCursor: null, exhausted: false };
    }

    const savedRows = (await prisma.reel.findMany({
      where: {
        isPublished: true,
        OR: [
          ...(bookmarkIds.length ? [{ id: { in: bookmarkIds } }] : []),
          ...(favIds.length ? [{ ctaTargetId: { in: favIds } }] : []),
          ...(favIds.length ? [{ editionGameIds: { hasSome: favIds } }] : []),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RANKING_POOL_SIZE,
    })) as ReelRow[];

    const pageRows = savedRows.slice(skip, skip + limit);
    const items = await hydrateReels(pageRows);
    return {
      items,
      nextCursor: skip + limit < savedRows.length ? skip + limit : null,
      exhausted: false,
    };
  }

  const pool = (await prisma.reel.findMany({
    where: {
      isPublished: true,
      ...(category === "ALL" ? {} : { category }),
      ...(opts.platformCode ? { platformCode: opts.platformCode } : {}),
      ...(exclude.length > 0 ? { id: { notIn: exclude } } : {}),
    },
    // Hovuzu ən yenidən götürürük; yekun sıra rankReels-dədir.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RANKING_POOL_SIZE,
  })) as ReelRow[];

  // Görülməmiş heç nə qalmayıb → client "Hamısını gördün" ekranını göstərir.
  if (pool.length === 0) {
    return { items: [], nextCursor: null, exhausted: true };
  }

  const ranked = rankReels(pool, opts.seed, Date.now());
  const pageRows = ranked.slice(skip, skip + limit);
  const items = await hydrateReels(pageRows);
  const nextCursor = skip + limit < ranked.length ? skip + limit : null;
  return { items, nextCursor, exhausted: false };
}

/** Deep link (`/reels?r=<id>`) üçün tək reel — feed-in başına qoyulur. */
export async function getReelById(id: string): Promise<ReelFeedItem | null> {
  const row = (await prisma.reel.findFirst({
    where: { id, isPublished: true },
  })) as ReelRow | null;
  if (!row) return null;
  const [item] = await hydrateReels([row]);
  return item ?? null;
}
