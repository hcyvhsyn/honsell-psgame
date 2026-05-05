import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getSettings, tryCentsToAznWithMargin } from "@/lib/pricing";
import { revalidateServices } from "@/lib/revalidate";

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
      const { id, type, title, description, imageUrl, isActive, metadata, sortOrder } = body;

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

      const s = await getSettings();
      const rate = s.tryToAznRate;
      const margin = s.profitMarginGiftCardsPct ?? s.profitMarginPct;

      const computedAzn = tryCentsToAznWithMargin(
        Math.round(tryAmount * 100),
        rate,
        margin
      );
      const priceAznCents = Math.round(computedAzn * 100);

      const payload = {
        type,
        title,
        description: typeof description === "string" ? description : null,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        priceAznCents,
        isActive: Boolean(isActive),
        metadata: metadata || {},
        sortOrder: Number(sortOrder || 0),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateServices();
      return NextResponse.json(p);
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
