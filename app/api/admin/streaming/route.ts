import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const VALID_SERVICES = new Set(["HBO_MAX", "GAIN", "YOUTUBE_PREMIUM"]);
const VALID_DURATIONS = new Set([1, 2, 3, 6, 12]);
const VALID_SEATS = new Set([1, 2]);

function revalidateStreaming() {
  revalidatePath("/");
  revalidatePath("/streaming");
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.serviceProduct.findMany({
    where: { type: "STREAMING" },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
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
        },
        sortOrder: Number(sortOrder || 0),
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateStreaming();
      return NextResponse.json(p);
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
