import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServices } from "@/lib/revalidate";
import { parseBynogameText } from "@/lib/bynogameParser";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["PUBG_UC", "POINT_BLANK_TG"] as const;
type InGameType = (typeof ALLOWED_TYPES)[number];

const CURRENCY_BY_TYPE: Record<InGameType, string> = {
  PUBG_UC: "UC",
  POINT_BLANK_TG: "TG",
};

const TITLE_PREFIX: Record<InGameType, string> = {
  PUBG_UC: "PUBG UC",
  POINT_BLANK_TG: "Point Blank",
};

function isInGameType(s: string): s is InGameType {
  return (ALLOWED_TYPES as readonly string[]).includes(s);
}

function buildTitle(type: InGameType, amount: number) {
  return type === "POINT_BLANK_TG"
    ? `${TITLE_PREFIX[type]} ${amount} ${CURRENCY_BY_TYPE[type]}`
    : `${TITLE_PREFIX[type]} ${amount}`;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type") ?? "";
  const mode = url.searchParams.get("mode");

  if (!isInGameType(typeParam)) {
    return NextResponse.json({ error: "type düzgün deyil" }, { status: 400 });
  }
  const type: InGameType = typeParam;

  if (mode === "orders") {
    const orders = await prisma.transaction.findMany({
      where: { type: "SERVICE_PURCHASE", status: "PENDING", serviceProduct: { type } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        amountAznCents: true,
        metadata: true,
        user: { select: { id: true, email: true, name: true } },
        serviceProduct: { select: { id: true, title: true, metadata: true } },
      },
    });
    return NextResponse.json(orders);
  }

  const products = await prisma.serviceProduct.findMany({
    where: { type },
    orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
    include: {
      // Stokda qalan (istifadə olunmamış) e-pin kodlarının sayı — admin paneldə
      // hər variant üçün "stok" sütununda göstərilir.
      _count: { select: { codes: { where: { isUsed: false } } } },
    },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, type: typeParam } = body as { action?: string; type?: string };

  if (typeof typeParam !== "string" || !isInGameType(typeParam)) {
    return NextResponse.json({ error: "type düzgün deyil" }, { status: 400 });
  }
  const type: InGameType = typeParam;

  try {
    if (action === "UPSERT_PRODUCT") {
      const {
        id,
        amount,
        tryPrice,
        aznPrice,
        isActive,
        sortOrder,
        deliveryMethod,
        imageUrl,
        description,
      } = body;

      const amt = Number(amount);
      const aznPriceNum = Number(aznPrice);
      // Point Blank sadələşdirilmiş formdadır: yalnız miqdar + AZN qiymət + şəkil.
      // TRY maya və çatdırılma üsulu yoxdur (həmişə e-pin kod stoku ilə təhvil).
      const isPointBlank = type === "POINT_BLANK_TG";
      const delivery = isPointBlank ? "EPIN" : String(deliveryMethod ?? "EPIN").toUpperCase();

      if (!Number.isFinite(amt) || amt <= 0 || !Number.isInteger(amt)) {
        return NextResponse.json({ error: "Miqdar müsbət tam ədəd olmalıdır" }, { status: 400 });
      }

      // TRY maya qiyməti yalnız PUBG UC (və ya dəyər göndərilibsə) üçün tələb olunur.
      const tryPriceRaw = tryPrice === undefined || tryPrice === null || tryPrice === "" ? null : Number(tryPrice);
      if (!isPointBlank) {
        if (tryPriceRaw === null || !Number.isFinite(tryPriceRaw) || tryPriceRaw <= 0) {
          return NextResponse.json({ error: "TRY (maya) qiyməti düzgün deyil" }, { status: 400 });
        }
        if (delivery !== "EPIN" && delivery !== "ID_TOPUP") {
          return NextResponse.json({ error: "Çatdırılma üsulu düzgün deyil" }, { status: 400 });
        }
      } else if (tryPriceRaw !== null && (!Number.isFinite(tryPriceRaw) || tryPriceRaw < 0)) {
        return NextResponse.json({ error: "TRY (maya) qiyməti düzgün deyil" }, { status: 400 });
      }

      if (!Number.isFinite(aznPriceNum) || aznPriceNum <= 0) {
        return NextResponse.json({ error: "AZN satış qiyməti düzgün deyil" }, { status: 400 });
      }

      const tryPriceCents = tryPriceRaw !== null ? Math.round(tryPriceRaw * 100) : 0;
      const priceAznCents = Math.round(aznPriceNum * 100);
      const baseTitle = buildTitle(type, amt);
      // PB üçün başlıqda E-PIN/ID suffix-i yoxdur — sadə "Point Blank N TG".
      const title = isPointBlank
        ? baseTitle
        : delivery === "ID_TOPUP"
          ? `${baseTitle} (ID yükləmə)`
          : `${baseTitle} (E-PIN)`;

      const payload = {
        type,
        title,
        priceAznCents,
        imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
        description:
          typeof description === "string" && description.trim() ? description.trim() : null,
        isActive: Boolean(isActive ?? true),
        sortOrder: Number(sortOrder || 0),
        metadata: {
          amount: amt,
          currency: CURRENCY_BY_TYPE[type],
          tryPriceCents,
          deliveryMethod: delivery,
        },
      };

      const p = id
        ? await prisma.serviceProduct.update({ where: { id }, data: payload })
        : await prisma.serviceProduct.create({ data: payload });
      revalidateServices();
      return NextResponse.json(p);
    }

    if (action === "PREVIEW_IMPORT") {
      // Mətni parse edib admin-ə nəticələri preview üçün qaytarır,
      // verilənlər bazasına heç nə yazılmır.
      if (type !== "PUBG_UC") {
        return NextResponse.json(
          { error: "Hələ yalnız PUBG UC import dəstəklənir" },
          { status: 400 },
        );
      }
      const text = String(body.text ?? "");
      if (!text.trim()) {
        return NextResponse.json({ error: "Mətn boşdur" }, { status: 400 });
      }
      const parsed = parseBynogameText(text);
      return NextResponse.json({ items: parsed });
    }

    if (action === "IMPORT_FROM_TEXT") {
      if (type !== "PUBG_UC") {
        return NextResponse.json(
          { error: "Hələ yalnız PUBG UC import dəstəklənir" },
          { status: 400 },
        );
      }
      const text = String(body.text ?? "");
      const marginPct = Number(body.marginPct ?? 0);

      if (!text.trim()) {
        return NextResponse.json({ error: "Mətn boşdur" }, { status: 400 });
      }
      if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct > 500) {
        return NextResponse.json({ error: "Xeyir % düzgün deyil (0-500)" }, { status: 400 });
      }

      const parsed = parseBynogameText(text);
      if (parsed.length === 0) {
        return NextResponse.json(
          { error: "Mətndən heç bir variant tapılmadı. Format düz deyilmi?" },
          { status: 400 },
        );
      }

      const settings = await prisma.settings.findFirst();
      const tryRate = settings?.tryToAznRate ?? 0.053;

      let created = 0;
      let updated = 0;

      // Mövcud bütün PUBG_UC variantlarını bir dəfəyə çəkirik, parse zamanı
      // her item üçün ayrı sorğu atmamaq üçün.
      const existing = await prisma.serviceProduct.findMany({
        where: { type: "PUBG_UC" },
      });

      type Meta = { amount?: number; deliveryMethod?: "EPIN" | "ID_TOPUP" };
      const findExisting = (amount: number, delivery: "EPIN" | "ID_TOPUP") =>
        existing.find((p) => {
          const m = p.metadata as Meta | null;
          return m?.amount === amount && (m?.deliveryMethod ?? "EPIN") === delivery;
        });

      for (const item of parsed) {
        const tryPriceCents = Math.round(item.tryPrice * 100);
        // AZN = TRY × tryToAznRate × (1 + margin%)
        const aznPrice = item.tryPrice * tryRate * (1 + marginPct / 100);
        const priceAznCents = Math.round(aznPrice * 100);
        const baseTitle = `PUBG UC ${item.amount}`;
        const title =
          item.deliveryMethod === "ID_TOPUP" ? `${baseTitle} (ID yükləmə)` : `${baseTitle} (E-PIN)`;

        const existingRow = findExisting(item.amount, item.deliveryMethod);

        if (existingRow) {
          // Mövcud variantı yeniləyirik — şəkil və description toxunulmur
          const oldMeta = (existingRow.metadata as Meta | null) ?? {};
          await prisma.serviceProduct.update({
            where: { id: existingRow.id },
            data: {
              priceAznCents,
              metadata: {
                ...oldMeta,
                amount: item.amount,
                currency: "UC",
                tryPriceCents,
                deliveryMethod: item.deliveryMethod,
              },
            },
          });
          updated++;
        } else {
          // Yeni variant yaradırıq (şəkil yoxdur, admin sonra yükləyəcək)
          await prisma.serviceProduct.create({
            data: {
              type: "PUBG_UC",
              title,
              priceAznCents,
              imageUrl: null,
              description: null,
              isActive: false, // Şəkil yüklənənə qədər müştəri tərəfində gizlədirik
              sortOrder: item.amount,
              metadata: {
                amount: item.amount,
                currency: "UC",
                tryPriceCents,
                deliveryMethod: item.deliveryMethod,
              },
            },
          });
          created++;
        }
      }

      revalidateServices();
      return NextResponse.json({
        ok: true,
        created,
        updated,
        total: parsed.length,
        tryRate,
        marginPct,
      });
    }

    if (action === "DELETE_PRODUCT") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });

      const existing = await prisma.serviceProduct.findUnique({
        where: { id },
        select: { type: true },
      });
      if (!existing || existing.type !== type) {
        return NextResponse.json({ error: "Məhsul tapılmadı" }, { status: 404 });
      }

      // ServiceCode → ServiceProduct ON DELETE RESTRICT olduğu üçün əvvəlcə bu
      // variantın bütün kodlarını silirik. İstifadə olunmuş kodlar transaction-dan
      // ON DELETE SET NULL ilə bağlıdır, ona görə silinə bilir.
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
