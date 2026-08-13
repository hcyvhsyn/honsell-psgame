import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { computeDisplayPrice, getSettings } from "@/lib/pricing";
import { normalizeToE164 } from "@/lib/wasender";
import { discountWaveKey, sendPriceWatchNow } from "@/lib/priceWatch";
import type { PriceWatchRow } from "@/lib/priceWatchShared";

export const runtime = "nodejs";

/**
 * Qiymət güdmə admin API-si.
 *
 * GET                → siyahı (hazırkı qiymətlərlə birlikdə)
 * GET ?q=<mətn>      → oyun axtarışı (formadaki seçici üçün)
 * POST               → yeni qeyd (mövcud nömrə+oyun cütü varsa YENİLƏYİR)
 * POST action=send   → "indi göndər" (endirim onsuz da aktivdirsə)
 * PATCH              → aktiv/dayandır, ad/qeyd redaktəsi
 * DELETE ?id=        → sil
 */

const GAME_SELECT = {
  id: true,
  productId: true,
  title: true,
  imageUrl: true,
  platform: true,
  isActive: true,
  priceTryCents: true,
  discountTryCents: true,
  discountEndAt: true,
  // Epic sətirləri mövqe modeli ilə qiymətlənir. Forma yalnız PS oyunu seçdirir,
  // amma köhnə/əl ilə yazılmış qeyd Epic ola bilər — bu sahələr olmasa
  // `computeDisplayPrice` Epic budağında yanlış qiymət verər.
  store: true,
  priceUsdCents: true,
  discountUsdCents: true,
} as const;

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);

  // ── Oyun axtarışı (forma seçicisi) ──────────────────────────────────────
  // `/api/admin/reels/products` ilə eyni qayda: yalnız aktiv PS sətirləri.
  const q = url.searchParams.get("q");
  if (q !== null) {
    const term = q.trim();
    if (term.length < 2) return NextResponse.json({ games: [] });

    const settings = await getSettings();
    const games = await prisma.game.findMany({
      where: {
        isActive: true,
        store: "PS",
        title: { contains: term, mode: "insensitive" },
      },
      orderBy: [{ isFeatured: "desc" }, { title: "asc" }],
      take: 20,
      select: GAME_SELECT,
    });

    return NextResponse.json({
      games: games.map((g) => {
        const d = computeDisplayPrice(g, settings);
        return {
          id: g.id,
          productId: g.productId,
          title: g.title,
          imageUrl: g.imageUrl,
          platform: g.platform,
          priceAzn: d.finalAzn,
          discountPct: d.discountPct,
        };
      }),
    });
  }

  // ── Siyahı ──────────────────────────────────────────────────────────────
  const settings = await getSettings();
  const rows = await prisma.gamePriceWatch.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      phone: true,
      name: true,
      note: true,
      isActive: true,
      basePriceAznCents: true,
      notifyCount: true,
      lastNotifiedAt: true,
      createdAt: true,
      game: { select: GAME_SELECT },
    },
  });

  const items: PriceWatchRow[] = rows.map((r) => {
    const d = computeDisplayPrice(r.game, settings);
    return {
      id: r.id,
      phone: r.phone,
      name: r.name,
      note: r.note,
      isActive: r.isActive,
      basePriceAznCents: r.basePriceAznCents,
      notifyCount: r.notifyCount,
      lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      game: {
        id: r.game.id,
        productId: r.game.productId,
        title: r.game.title,
        imageUrl: r.game.imageUrl,
        platform: r.game.platform,
      },
      currentPriceAzn: d.finalAzn,
      currentDiscountPct: d.discountPct,
      // `computeDisplayPrice` bitmiş endirimi özü ləğv edir, ona görə
      // `discountPct` canlı endirimin yeganə düzgün göstəricisidir —
      // `discountTryCents != null` yazsan bitmiş endirim də "aktiv" görünər.
      isOnSale: (d.discountPct ?? 0) > 0,
      isGameInactive: !r.game.isActive,
    };
  });

  return NextResponse.json({ items, wasenderConfigured: Boolean(process.env.WASENDER_API_KEY) });
}

export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  // ── "İndi göndər" ───────────────────────────────────────────────────────
  if (body.action === "send") {
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id tələb olunur." }, { status: 400 });

    const watch = await prisma.gamePriceWatch.findUnique({
      where: { id },
      select: { id: true, game: { select: GAME_SELECT } },
    });
    if (!watch) return NextResponse.json({ error: "Qeyd tapılmadı." }, { status: 404 });

    const settings = await getSettings();
    const d = computeDisplayPrice(watch.game, settings);

    const res = await sendPriceWatchNow({
      watchId: watch.id,
      game: {
        id: watch.game.id,
        productId: watch.game.productId,
        title: watch.game.title,
        discountEndAt: watch.game.discountEndAt,
      },
      finalAzn: d.finalAzn,
      discountPct: d.discountPct,
      discountStartedAt: discountWaveKey(watch.game.discountEndAt, new Date()),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Mesaj göndərilmədi: ${res.reason ?? "bilinməyən xəta"}` },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  // ── Yeni qeyd ───────────────────────────────────────────────────────────
  const phone = normalizeToE164(body.phone != null ? String(body.phone) : "");
  if (!phone) {
    return NextResponse.json(
      { error: "Telefon nömrəsi düzgün deyil (məs: +994501234567)." },
      { status: 400 }
    );
  }

  const gameId = String(body.gameId ?? "").trim();
  if (!gameId) return NextResponse.json({ error: "Oyun seçin." }, { status: 400 });

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: GAME_SELECT,
  });
  if (!game) return NextResponse.json({ error: "Oyun tapılmadı." }, { status: 400 });

  const name = String(body.name ?? "").trim() || null;
  const note = String(body.note ?? "").trim() || null;

  // Qeyd anındaki qiymət möhürü — mesajda "əvvəl X idi" sətri buradan gəlir.
  const settings = await getSettings();
  const basePriceAznCents = Math.round(computeDisplayPrice(game, settings).finalAzn * 100);

  // Təkrar əlavə → yeniləmə. Admin eyni müştərini ikinci dəfə yazanda xəta
  // görməkdənsə ad/qeydin təzələnməsi daha faydalıdır.
  //
  // ⚠️ `basePriceAznCents` yalnız YARADILANDA yazılır: mövcud qeyddə onu
  // üzərinə yazsaq müştərinin ilk soruşduğu (baha) qiymət itər və mesajdaki
  // "əvvəl 62 ₼ idi" müqayisəsi mənasız olar.
  const watch = await prisma.gamePriceWatch.upsert({
    where: { phone_gameId: { phone, gameId } },
    create: { phone, gameId, name, note, basePriceAznCents, isActive: true },
    update: { name, note, isActive: true },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, id: watch.id });
}

export async function PATCH(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => ({}) as Record<string, unknown>);

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id tələb olunur." }, { status: 400 });

  const data: { isActive?: boolean; name?: string | null; note?: string | null } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.name !== undefined) data.name = String(body.name ?? "").trim() || null;
  if (body.note !== undefined) data.note = String(body.note ?? "").trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Dəyişiklik yoxdur." }, { status: 400 });
  }

  await prisma.gamePriceWatch.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) return NextResponse.json({ error: "id tələb olunur." }, { status: 400 });

  await prisma.gamePriceWatch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
