import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServices } from "@/lib/revalidate";
import { getSettings } from "@/lib/pricing";
import {
  baseRateFromAnchor,
  computeGiftCardPriceTable,
  validateDiscountPct,
  validateGiftCardPriceRule,
  type GiftCardNominal,
} from "@/lib/giftCardPriceRuleShared";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const codesFor = url.searchParams.get("codesFor");

  if (codesFor) {
    const codes = await prisma.serviceCode.findMany({
      where: { serviceProductId: codesFor },
      orderBy: [{ isUsed: "asc" }, { createdAt: "desc" }],
      select: { id: true, code: true, isUsed: true, createdAt: true },
    });
    return NextResponse.json(codes);
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type: "TRY_BALANCE" },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: {
      _count: {
        select: {
          codes: { where: { isUsed: false } },
        },
      },
    },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "ADD_CODES") {
      const { serviceProductId, codesText } = body;
      const codes = codesText
        .split("\n")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      if (!codes.length) return NextResponse.json({ error: "Kod daxil edilməyib" }, { status: 400 });

      await prisma.serviceCode.createMany({
        data: codes.map((c: string) => ({
          serviceProductId,
          code: c,
        })),
        skipDuplicates: true,
      });
      return NextResponse.json({ ok: true, count: codes.length });
    }

    if (action === "UPSERT_PRODUCT") {
      // `sortOrder` QƏSDƏN oxunmur — dəyər `tryAmount`-dan hesablanır (aşağıda).
      const { id, type, title, description, imageUrl, isActive, metadata, aznPrice } = body;

      if (String(type) !== "TRY_BALANCE") {
        return NextResponse.json(
          { error: "Bu endpoint yalnız TRY_BALANCE üçün istifadə olunur." },
          { status: 400 }
        );
      }

      const tryAmount = Number((metadata as { tryAmount?: unknown } | null)?.tryAmount);
      if (!Number.isFinite(tryAmount) || tryAmount <= 0) {
        return NextResponse.json({ error: "TRY məbləği düzgün deyil!" }, { status: 400 });
      }

      const aznPriceNum = Number(aznPrice);
      if (!Number.isFinite(aznPriceNum) || aznPriceNum <= 0) {
        return NextResponse.json({ error: "AZN satış qiyməti düzgün deyil!" }, { status: 400 });
      }
      const priceAznCents = Math.round(aznPriceNum * 100);

      // Mövcud metadata OXUNUR və birləşdirilir. Əvvəl `metadata: metadata || {}`
      // yazılırdı, yəni hər saxlama `priceRule` kimi digər açarları SİLİRDİ —
      // qiymət generatorunun yazdığı endirim faizi ilk redaktədə itərdi.
      const existing = id
        ? await prisma.serviceProduct.findUnique({
            where: { id: String(id) },
            select: { metadata: true, costAznCents: true },
          })
        : null;
      if (id && !existing) {
        return NextResponse.json({ error: "Məhsul tapılmadı" }, { status: 404 });
      }
      const existingMeta =
        existing?.metadata && typeof existing.metadata === "object"
          ? (existing.metadata as Record<string, unknown>)
          : {};
      const incomingMeta =
        metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};

      // Yeni sətirdə maya boş qalmasın — Settings kursundan toxum dəyər yazılır.
      // Mövcud sətrin (generatorun yazdığı) mayası ÜZƏRİNƏ YAZILMIR.
      let costAznCents = existing?.costAznCents ?? 0;
      if (!id || costAznCents <= 0) {
        const settings = await getSettings();
        costAznCents = Math.round(tryAmount * settings.tryToAznRate * 100);
      }

      const payload = {
        type,
        title,
        description: typeof description === "string" ? description : null,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        priceAznCents,
        costAznCents,
        isActive: Boolean(isActive),
        metadata: { ...existingMeta, ...incomingMeta, tryAmount },
        // Sıralama nominaldan gəlir (250 → 500 → 750 → 1000), admin əl ilə
        // rəqəm yazmır. Bütün vitrinlər `sortOrder asc` işlədir.
        sortOrder: Math.round(tryAmount),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id: String(id) }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateServices();
      return NextResponse.json(p);
    }

    /**
     * Qaydaya görə bütün TRY kartlarının qiymətini yenidən hesablayıb yazır.
     *
     * Client hesablanmış QİYMƏTLƏRİ göndərmir, QAYDANI göndərir — server eyni
     * saf funksiya ilə (`lib/giftCardPriceRuleShared`) yenidən hesablayır. Belə
     * olanda UI-dəki hesablama səhvi səssizcə bazaya düşə bilmir.
     *
     * `expectedPriceAznCents` ötürülübsə uyğunsuzluqda 409 qaytarılır — bu,
     * deploy zamanı brauzerdə köhnə JS bundle qalıbsa (server yeni, client köhnə
     * formul) səhv qiymət yazılmasının qarşısını alır.
     */
    if (action === "APPLY_PRICE_RULE") {
      const anchorTryAmount = Number(body?.anchor?.tryAmount);
      const anchorPriceAzn = Number(body?.anchor?.priceAzn);
      const costAznPerTry = Number(body?.costAznPerTry);
      const syncSortOrder = body?.syncSortOrder !== false;
      const allowBelowCost = Boolean(body?.allowBelowCost);
      const items: unknown = body?.items;

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "Heç bir kart seçilməyib." }, { status: 400 });
      }

      const settings = await getSettings();
      const rule = {
        baseAznPerTry: baseRateFromAnchor(anchorTryAmount, anchorPriceAzn),
        costAznPerTry,
        epointFeePct: settings.epointFeePct,
      };
      const ruleError = validateGiftCardPriceRule(rule);
      if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 });

      const wanted = new Map<string, { discountPct: number; expected: number | null }>();
      for (const raw of items) {
        const it = raw as { id?: unknown; discountPct?: unknown; expectedPriceAznCents?: unknown };
        const itemId = String(it.id ?? "");
        if (!itemId) return NextResponse.json({ error: "Sətir id-si yoxdur." }, { status: 400 });
        const pctError = validateDiscountPct(it.discountPct);
        if (pctError) return NextResponse.json({ error: pctError }, { status: 400 });
        const expected = Number(it.expectedPriceAznCents);
        wanted.set(itemId, {
          discountPct: Number(it.discountPct),
          expected: Number.isFinite(expected) ? expected : null,
        });
      }

      // Sətirləri server ÖZÜ oxuyur — client-in siyahısına etibar etmir.
      const products = await prisma.serviceProduct.findMany({
        where: { type: "TRY_BALANCE" },
        select: {
          id: true,
          metadata: true,
          priceAznCents: true,
          isActive: true,
        },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      for (const itemId of wanted.keys()) {
        if (!byId.has(itemId)) {
          return NextResponse.json(
            { error: "Yalnız TRY_BALANCE məhsulları qiymətləndirilə bilər." },
            { status: 400 },
          );
        }
      }

      function tryAmountOf(metadata: unknown): number | null {
        const n = Number((metadata as { tryAmount?: unknown } | null)?.tryAmount);
        return Number.isFinite(n) && n > 0 ? n : null;
      }

      const nominals: GiftCardNominal[] = [];
      for (const [itemId, want] of wanted) {
        const p = byId.get(itemId)!;
        nominals.push({
          id: p.id,
          tryAmount: tryAmountOf(p.metadata),
          discountPct: want.discountPct,
          currentPriceAznCents: p.priceAznCents,
          isActive: p.isActive,
        });
      }

      const { rows, totals } = computeGiftCardPriceTable(nominals, rule);
      const writableRows = rows.filter((r) => r.writable);
      if (writableRows.length === 0) {
        return NextResponse.json(
          { error: "Yazıla bilən sətir yoxdur — nominal və ya kurs səhvdir." },
          { status: 400 },
        );
      }

      // Köhnə client bundle-ı aşkarlayır.
      const mismatches = writableRows
        .map((r) => ({ r, expected: wanted.get(r.id)?.expected ?? null }))
        .filter((x) => x.expected !== null && x.expected !== x.r.priceAznCents)
        .map((x) => ({ id: x.r.id, expected: x.expected, computed: x.r.priceAznCents }));
      if (mismatches.length > 0) {
        return NextResponse.json(
          {
            error:
              "Önizləmə ilə server hesablaması uyğun gəlmir. Səhifəni yenilə və yenidən sına.",
            mismatches,
          },
          { status: 409 },
        );
      }

      if (!allowBelowCost) {
        const losing = writableRows.filter((r) => r.warnings.includes("BELOW_COST"));
        if (losing.length > 0) {
          return NextResponse.json(
            {
              error: `${losing.length} kart mayadan aşağı qiymətə düşür. Davam etmək üçün «Zərərlə satışa icazə ver» seçimini işarələ.`,
              belowCostIds: losing.map((r) => r.id),
            },
            { status: 400 },
          );
        }
      }

      const updates = writableRows.map((r) => {
        const p = byId.get(r.id)!;
        const meta =
          p.metadata && typeof p.metadata === "object"
            ? (p.metadata as Record<string, unknown>)
            : {};
        return prisma.serviceProduct.update({
          where: { id: r.id },
          data: {
            priceAznCents: r.priceAznCents,
            costAznCents: r.costAznCents,
            sortOrder: Math.round(r.tryAmount),
            metadata: {
              ...meta,
              tryAmount: r.tryAmount,
              // ⚠️ `metadata` PUBLİKDİR — /hediyye-kartlari və /playstation onu
              // bütövlükdə client-ə ötürür. Ona görə burada YALNIZ satış
              // qiymətindən onsuz da çıxarıla bilən dəyərlər saxlanılır.
              // Maya kursu QƏTİYYƏN buraya yazılmır — o, `costAznCents`-dədir.
              priceRule: {
                discountPct: r.discountPct,
                baseAznPerTry: rule.baseAznPerTry,
                appliedAt: new Date().toISOString(),
              },
            },
          },
        });
      });

      // Sıralama qiymət qərarı DEYİL: qiymətləndirmədən kənarda qalan kartların
      // da sırası düzəlir, yoxsa vitrində boşluq qalır.
      let sortOrderUpdated = writableRows.length;
      if (syncSortOrder) {
        const priced = new Set(writableRows.map((r) => r.id));
        for (const p of products) {
          if (priced.has(p.id)) continue;
          const t = tryAmountOf(p.metadata);
          if (t === null) continue;
          updates.push(
            prisma.serviceProduct.update({
              where: { id: p.id },
              data: { sortOrder: Math.round(t) },
            }),
          );
          sortOrderUpdated += 1;
        }
      }

      await prisma.$transaction(updates);
      revalidateServices();

      return NextResponse.json({
        ok: true,
        updated: writableRows.length,
        sortOrderUpdated,
        baseAznPerTry: rule.baseAznPerTry,
        costAznPerTry: rule.costAznPerTry,
        epointFeePct: rule.epointFeePct,
        rows,
        totals,
        skipped: rows
          .filter((r) => !r.writable)
          .map((r) => ({ id: r.id, reason: r.warnings[0] ?? "UNKNOWN" })),
      });
    }

    if (action === "DELETE_CODE") {
      const { codeId } = body;
      if (!codeId) return NextResponse.json({ error: "codeId tələb olunur" }, { status: 400 });
      const code = await prisma.serviceCode.findUnique({ where: { id: codeId } });
      if (!code) return NextResponse.json({ error: "Kod tapılmadı" }, { status: 404 });
      if (code.isUsed) {
        return NextResponse.json(
          { error: "İstifadə olunmuş kodu silmək olmaz" },
          { status: 400 }
        );
      }
      await prisma.serviceCode.delete({ where: { id: codeId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      // ServiceCode has ON DELETE RESTRICT to ServiceProduct; remove unused codes first.
      // Used codes are referenced by transactions (ON DELETE SET NULL), so deletable too.
      await prisma.$transaction([
        prisma.serviceCode.deleteMany({ where: { serviceProductId: id } }),
        prisma.serviceProduct.delete({ where: { id } }),
      ]);
      revalidateServices();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
