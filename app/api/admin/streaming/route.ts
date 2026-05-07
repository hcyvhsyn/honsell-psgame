import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  parseStreamingStock,
  serializeStreamingStock,
  type StreamingStockEntry,
} from "@/lib/streamingCart";

export const runtime = "nodejs";

const VALID_SERVICES = new Set(["HBO_MAX", "GAIN", "YOUTUBE_PREMIUM"]);
const VALID_DURATIONS = new Set([1, 2, 3, 6, 12]);
const VALID_SEATS = new Set([1, 2]);

function revalidateStreaming() {
  revalidatePath("/");
  revalidatePath("/streaming");
}

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
    return NextResponse.json(
      codes.map((c) => ({
        id: c.id,
        isUsed: c.isUsed,
        createdAt: c.createdAt,
        entry: parseStreamingStock(c.code),
        raw: c.code,
      }))
    );
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type: "STREAMING" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: {
      _count: { select: { codes: { where: { isUsed: false } } } },
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
      const { serviceProductId } = body;
      if (!serviceProductId) {
        return NextResponse.json({ error: "serviceProductId tələb olunur" }, { status: 400 });
      }

      const rawEntries = Array.isArray(body.entries) ? body.entries : [];
      const entries: StreamingStockEntry[] = [];
      for (const r of rawEntries) {
        if (!r || typeof r !== "object") continue;
        const accountEmail = String((r as Record<string, unknown>).accountEmail ?? "").trim();
        const accountPassword = String((r as Record<string, unknown>).accountPassword ?? "");
        const slotName = String((r as Record<string, unknown>).slotName ?? "").trim();
        const pinCode = String((r as Record<string, unknown>).pinCode ?? "").trim();
        if (!accountEmail || !accountPassword || !slotName) continue;
        entries.push({ accountEmail, accountPassword, slotName, pinCode });
      }

      if (entries.length === 0) {
        return NextResponse.json(
          { error: "Hər sətirdə email, şifrə və profil adı tələb olunur." },
          { status: 400 }
        );
      }

      await prisma.serviceCode.createMany({
        data: entries.map((e) => ({ serviceProductId, code: serializeStreamingStock(e) })),
        skipDuplicates: true,
      });
      revalidateStreaming();
      return NextResponse.json({ ok: true, count: entries.length });
    }

    if (action === "UPSERT_PRODUCT") {
      const { id, title, description, imageUrl, isActive, sortOrder } = body;
      const service = String(body.service ?? "");
      const durationMonths = Number(body.durationMonths);
      const seats = Number(body.seats ?? 1);
      const priceAzn = Number(body.priceAzn);
      const originalPriceAznRaw = body.originalPriceAzn;
      const originalPriceAzn =
        originalPriceAznRaw === "" || originalPriceAznRaw == null
          ? null
          : Number(originalPriceAznRaw);
      const inStock = body.inStock === undefined ? true : Boolean(body.inStock);

      if (!VALID_SERVICES.has(service)) {
        return NextResponse.json({ error: "Xidmət düzgün deyil." }, { status: 400 });
      }
      if (!VALID_DURATIONS.has(durationMonths)) {
        return NextResponse.json({ error: "Müddət 1/2/3/6/12 ay olmalıdır." }, { status: 400 });
      }
      if (!VALID_SEATS.has(seats)) {
        return NextResponse.json({ error: "Yalnız 1 və ya 2 nəfərlik qəbul olunur." }, { status: 400 });
      }
      if (!Number.isFinite(priceAzn) || priceAzn <= 0) {
        return NextResponse.json({ error: "Qiymət düzgün deyil." }, { status: 400 });
      }
      if (originalPriceAzn != null) {
        if (!Number.isFinite(originalPriceAzn) || originalPriceAzn <= 0) {
          return NextResponse.json({ error: "Köhnə qiymət düzgün deyil." }, { status: 400 });
        }
        if (originalPriceAzn <= priceAzn) {
          return NextResponse.json(
            { error: "Köhnə qiymət hazırkı qiymətdən böyük olmalıdır." },
            { status: 400 }
          );
        }
      }

      const deliveryMode = service === "YOUTUBE_PREMIUM" ? "GMAIL" : "CODE";

      const payload = {
        type: "STREAMING",
        title: String(title ?? "").trim() || `${service} ${durationMonths} ay`,
        description: typeof description === "string" ? description : null,
        imageUrl: typeof imageUrl === "string" ? imageUrl : null,
        priceAznCents: Math.round(priceAzn * 100),
        isActive: Boolean(isActive),
        metadata: {
          service,
          durationMonths,
          seats,
          deliveryMode,
          ...(originalPriceAzn != null
            ? { originalPriceAznCents: Math.round(originalPriceAzn * 100) }
            : {}),
          inStock,
        },
        sortOrder: Number(sortOrder || 0),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateStreaming();
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
      await prisma.$transaction([
        prisma.serviceCode.deleteMany({ where: { serviceProductId: id } }),
        prisma.serviceProduct.delete({ where: { id } }),
      ]);
      revalidateStreaming();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
