import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { serviceProductLabel } from "@/lib/serviceProductLabel";
import { REVIEW_SERVICE_TYPES } from "@/lib/whatsappReviewProducts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ServiceProduct.type / Game.store → picker-də göstərilən qrup başlığı. */
function groupLabel(kind: "GAME" | "SERVICE", type: string, store?: string): string {
  if (kind === "GAME") return store === "EPIC" ? "Epic Games" : "PlayStation oyunları";
  switch (type) {
    case "STREAMING":
      return "Streaming";
    case "PLATFORM":
      return "Musiqi / Platforma";
    case "PS_PLUS":
      return "PS Plus";
    case "EA_PLAY":
      return "EA Play";
    case "TRY_BALANCE":
      return "PlayStation hədiyyə kartları (TRY balans)";
    case "HONSELL_GIFT_CARD":
      return "Honsell hədiyyə kartı";
    case "POINT_BLANK_TG":
      return "Point Blank TG";
    case "ACCOUNT_CREATION":
    case "EPIC_ACCOUNT_CREATION":
      return "Hesab açma";
    default:
      return "Digər";
  }
}

/**
 * Xidmət növünü tapmağa yarayan açar sözlər. Admin "500 TRY Balans" yazanda
 * `title` tam üst-üstə düşməyə bilər (DB-də "500 TL PSN…" ola bilər) — ona görə
 * söz-söz uyğunlaşma ilə növü tapır, qalan sözləri (məs. "500") başlıqda axtarır.
 */
const TYPE_KEYWORDS: Record<string, string[]> = {
  TRY_BALANCE: ["try", "tl", "balans", "balance", "psn", "hediyye", "kart", "kartlari", "gift", "card"],
  HONSELL_GIFT_CARD: ["honsell", "hediyye", "kart", "kartlari", "gift", "card"],
  PS_PLUS: ["ps", "plus", "playstation", "essential", "extra", "deluxe"],
  EA_PLAY: ["ea", "play"],
  STREAMING: ["streaming", "netflix", "hbo", "gain", "abune", "abunelik"],
  PLATFORM: ["platform", "spotify", "youtube", "linkedin", "chatgpt", "claude", "musiqi", "music"],
  ACCOUNT_CREATION: ["hesab", "acma", "acilis", "account", "psn"],
  EPIC_ACCOUNT_CREATION: ["epic", "hesab", "acma", "account"],
  POINT_BLANK_TG: ["point", "blank", "tg"],
};

/** Azərbaycan hərflərini sadələşdirir ki, "hədiyyə" ≈ "hediyye" olsun. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c");
}

/** ServiceProduct şəkli — paketin özününkü, yoxsa platformanın default şəkli. */
function serviceImage(imageUrl: string | null, metadata: unknown): string | null {
  if (imageUrl) return imageUrl;
  const m = (metadata as Record<string, unknown> | null) ?? {};
  return typeof m.platformImageUrl === "string" && m.platformImageUrl ? m.platformImageUrl : null;
}

/**
 * WhatsApp rəy dəvəti üçün vahid məhsul axtarışı — həm oyunları (`Game`), həm də
 * rəy yazıla bilən bütün xidmətləri (streaming, musiqi/platforma, PS Plus, EA Play,
 * TRY balans / hədiyyə kartları, Point Blank TG, hesab açma) axtarır.
 * Nəticə: `{ kind, id, type, title, priceAzn, imageUrl, store, group }`.
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  // Söz-söz AND axtarışı — söz sırası fərqli olsa da tapılır ("balans 500" ≈ "500 … balans").
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const titleAnd = tokens.map((t) => ({
    title: { contains: t, mode: "insensitive" as const },
  }));

  // Sorğudakı sözlərdən növ təxmini: açar sözə uyğun gələn növlər + qalan sözlər.
  const folded = tokens.map(fold);
  const matchedTypes = REVIEW_SERVICE_TYPES.filter((type) => {
    const kw = TYPE_KEYWORDS[type];
    return kw ? folded.some((t) => kw.includes(t)) : false;
  });
  const leftoverTokens = tokens.filter((t, i) => {
    const f = folded[i];
    return !matchedTypes.some((type) => TYPE_KEYWORDS[type]?.includes(f)) && t.length >= 2;
  });

  const [games, services, typeServices, settings] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true, AND: titleAnd },
      orderBy: { title: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        store: true,
        imageUrl: true,
        priceTryCents: true,
        discountTryCents: true,
        discountEndAt: true,
        priceUsdCents: true,
        discountUsdCents: true,
      },
    }),
    prisma.serviceProduct.findMany({
      where: {
        isActive: true,
        type: { in: [...REVIEW_SERVICE_TYPES] },
        AND: titleAnd,
      },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      take: 20,
      select: { id: true, title: true, type: true, priceAznCents: true, imageUrl: true, metadata: true },
    }),
    // Növ üzrə uyğunluq: "hədiyyə kartı" → bütün TRY balans kartları; "500 TRY
    // balans" → yalnız başlığında "500" olanlar.
    matchedTypes.length
      ? prisma.serviceProduct.findMany({
          where: {
            isActive: true,
            type: { in: [...matchedTypes] },
            ...(leftoverTokens.length
              ? {
                  AND: leftoverTokens.map((t) => ({
                    title: { contains: t, mode: "insensitive" as const },
                  })),
                }
              : {}),
          },
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
          take: 20,
          select: {
            id: true,
            title: true,
            type: true,
            priceAznCents: true,
            imageUrl: true,
            metadata: true,
          },
        })
      : Promise.resolve([]),
    getSettings(),
  ]);

  const gameResults = games.map((g) => {
    const price = computeDisplayPrice(g, settings);
    return {
      kind: "GAME" as const,
      id: g.id,
      type: "GAME",
      store: g.store,
      title: g.title,
      priceAzn: price.finalAzn,
      imageUrl: g.imageUrl ?? null,
      group: groupLabel("GAME", "GAME", g.store),
    };
  });

  // Başlıq + növ nəticələrini birləşdir (id üzrə dublikatsız).
  const seen = new Set<string>();
  const serviceResults = [...services, ...typeServices]
    .filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    })
    .map((s) => ({
      kind: "SERVICE" as const,
      id: s.id,
      type: s.type,
      store: null,
      title: serviceProductLabel(s.title, s.metadata),
      priceAzn: s.priceAznCents / 100,
      imageUrl: serviceImage(s.imageUrl, s.metadata),
      group: groupLabel("SERVICE", s.type),
    }));

  return NextResponse.json({ results: [...serviceResults, ...gameResults] });
}
