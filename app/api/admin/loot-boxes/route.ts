import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateLootBoxes } from "@/lib/revalidate";
import {
  generatePool,
  previewPoolEconomics,
  getLootBoxStats,
  getOdds,
  lootBoxConfigOf,
  validateLootBoxConfig,
  LootBoxError,
} from "@/lib/lootBoxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOX_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  priceAznCents: true,
  targetMarginPct: true,
  minPrizePct: true,
  maxPrizePct: true,
  poolSize: true,
  sellBackPct: true,
  refillAtRemaining: true,
  dailyLimitPerUser: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
} as const;

/** "12,99" / "12.99" → 1299 qəpik. Boş və ya keçərsizdirsə null. */
function parseAznCents(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const normalized = typeof raw === "string" ? raw.replace(",", ".").trim() : raw;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function parseInt0(raw: unknown, fallback: number): number {
  const num = Number(raw);
  return Number.isFinite(num) ? Math.floor(num) : fallback;
}

/**
 * Admin siyahısı: hər qutu üçün CANLI hesablanmış resept iqtisadiyyatı,
 * hovuz vəziyyəti və realizə olunmuş marja.
 */
export async function GET() {
  await requireAdmin();

  const boxes = await prisma.lootBox.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: BOX_SELECT,
  });

  const detailed = await Promise.all(
    boxes.map(async (box) => {
      const [preview, stats, odds, pools] = await Promise.all([
        previewPoolEconomics(box),
        getLootBoxStats(box.id),
        getOdds(box.id),
        prisma.lootBoxPool.findMany({
          where: { lootBoxId: box.id },
          orderBy: { seq: "desc" },
          take: 10,
          select: {
            id: true,
            seq: true,
            status: true,
            totalTickets: true,
            plannedCostCents: true,
            plannedValueCents: true,
            budgetCostCents: true,
            createdAt: true,
            _count: { select: { tickets: true } },
          },
        }),
      ]);

      // Hər hovuz üçün neçə bilet qaldığını ayrıca sayırıq.
      const remainingByPool = await prisma.lootBoxTicket.groupBy({
        by: ["poolId"],
        where: { poolId: { in: pools.map((p) => p.id) }, status: "AVAILABLE" },
        _count: { _all: true },
      });
      const remainingMap = new Map(remainingByPool.map((r) => [r.poolId, r._count._all]));

      return {
        ...box,
        createdAt: box.createdAt.toISOString(),
        config: lootBoxConfigOf(box),
        templates: preview.specs,
        economics: preview.economics,
        odds,
        stats,
        pools: pools.map((p) => ({
          id: p.id,
          seq: p.seq,
          status: p.status,
          totalTickets: p.totalTickets,
          remainingTickets: remainingMap.get(p.id) ?? 0,
          plannedCostCents: p.plannedCostCents,
          plannedValueCents: p.plannedValueCents,
          budgetCostCents: p.budgetCostCents,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    })
  );

  return NextResponse.json({ boxes: detailed });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  // ── Qutunun özü ────────────────────────────────────────────────────────────
  if (action === "UPSERT_BOX") {
    const id = typeof body.id === "string" && body.id ? body.id : null;
    const payload = {
      slug: String(body.slug ?? "").trim().toLowerCase(),
      title: String(body.title ?? "").trim(),
      priceAznCents: parseAznCents(body.priceAzn) ?? 0,
      poolSize: parseInt0(body.poolSize, 100),
      targetMarginPct: Number(body.targetMarginPct),
      minPrizePct: parseInt0(body.minPrizePct, 60),
      maxPrizePct: parseInt0(body.maxPrizePct, 200),
      sellBackPct: parseInt0(body.sellBackPct, 70),
      refillAtRemaining: parseInt0(body.refillAtRemaining, 20),
    };

    const errors = validateLootBoxConfig(payload);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const data = {
      ...payload,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null,
      dailyLimitPerUser: Math.max(0, parseInt0(body.dailyLimitPerUser, 0)),
      sortOrder: parseInt0(body.sortOrder, 0),
    };

    // Slug unikallığını öncədən yoxlayıb aydın mesaj veririk.
    const clash = await prisma.lootBox.findFirst({
      where: { slug: data.slug, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json({ error: "Bu slug artıq istifadə olunur." }, { status: 400 });
    }

    const box = id
      ? await prisma.lootBox.update({ where: { id }, data, select: BOX_SELECT })
      : await prisma.lootBox.create({ data, select: BOX_SELECT });

    revalidateLootBoxes();
    return NextResponse.json({ ok: true, box: { ...box, createdAt: box.createdAt.toISOString() } });
  }

  if (action === "TOGGLE_ACTIVE") {
    const id = String(body.id ?? "");
    const box = await prisma.lootBox.findUnique({ where: { id } });
    if (!box) return NextResponse.json({ error: "Qutu tapılmadı." }, { status: 404 });

    // Aktivləşdirmədən əvvəl bilet olduğuna əmin oluruq — boş qutu satışa
    // çıxsa müştəri ödəyib "bilet qalmayıb" xətası alardı.
    if (!box.isActive) {
      const available = await prisma.lootBoxTicket.count({
        where: { status: "AVAILABLE", pool: { lootBoxId: box.id, status: "OPEN" } },
      });
      if (available === 0) {
        return NextResponse.json(
          { error: "Aktivləşdirmək üçün əvvəlcə hovuz yaradın — hazırda bilet yoxdur." },
          { status: 400 }
        );
      }
    }

    await prisma.lootBox.update({ where: { id }, data: { isActive: !box.isActive } });
    revalidateLootBoxes();
    return NextResponse.json({ ok: true, isActive: !box.isActive });
  }

  if (action === "DELETE_BOX") {
    const id = String(body.id ?? "");
    const openings = await prisma.lootBoxOpening.count({ where: { lootBoxId: id } });
    if (openings > 0) {
      return NextResponse.json(
        { error: `Bu qutuda ${openings} açılış var — maliyyə qeydi olduğu üçün silinə bilməz. Deaktiv edin.` },
        { status: 400 }
      );
    }
    await prisma.lootBox.delete({ where: { id } });
    revalidateLootBoxes();
    return NextResponse.json({ ok: true });
  }

  // ── Resept (template) ──────────────────────────────────────────────────────
  if (action === "UPSERT_TEMPLATE") {
    const lootBoxId = String(body.lootBoxId ?? "");
    const gameId = String(body.gameId ?? "");
    const ticketCount = parseInt0(body.ticketCount, 0);

    if (!lootBoxId || !gameId) {
      return NextResponse.json({ error: "Qutu və oyun seçilməlidir." }, { status: 400 });
    }
    if (ticketCount < 1) {
      return NextResponse.json({ error: "Bilet sayı ən azı 1 olmalıdır." }, { status: 400 });
    }

    const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });
    if (!game) return NextResponse.json({ error: "Oyun tapılmadı." }, { status: 404 });

    await prisma.lootBoxTemplate.upsert({
      where: { lootBoxId_gameId: { lootBoxId, gameId } },
      create: { lootBoxId, gameId, ticketCount },
      update: { ticketCount, isActive: true },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "DELETE_TEMPLATE") {
    const id = String(body.id ?? "");
    await prisma.lootBoxTemplate.delete({ where: { id } }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  // ── Hovuz ──────────────────────────────────────────────────────────────────
  if (action === "GENERATE_POOL") {
    const lootBoxId = String(body.lootBoxId ?? "");
    try {
      const { pool, economics } = await generatePool({ lootBoxId, adminId: admin.id });
      revalidateLootBoxes();
      return NextResponse.json({ ok: true, poolId: pool.id, seq: pool.seq, economics });
    } catch (err) {
      if (err instanceof LootBoxError) {
        // Büdcə pozuntusu — bu, sistemin əsas qorunmasıdır, 400 ilə qaytarılır.
        return NextResponse.json(
          { error: err.message, code: err.code, violations: err.violations },
          { status: err.code === "BOX_NOT_FOUND" ? 404 : 400 }
        );
      }
      console.error("loot box pool generation failed", lootBoxId, err);
      return NextResponse.json({ error: "Hovuz yaradıla bilmədi." }, { status: 500 });
    }
  }

  if (action === "RETIRE_POOL") {
    const id = String(body.id ?? "");
    await prisma.lootBoxPool.update({ where: { id }, data: { status: "RETIRED" } });
    revalidateLootBoxes();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
}
