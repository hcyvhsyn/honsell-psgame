import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login olmuş istifadəçinin səbətini serverə sinxronlaşdırır — tərk edilmiş
 * səbət (abandoned cart) xatırlatma e-poçtları üçün CartSnapshot saxlayır.
 *
 *  • Login deyilsə → səssiz noop (200). Anonim səbətləri izləmirik (emailləri yox).
 *  • Səbət boşdursa → snapshot silinir (alış / təmizləmə sayılır).
 *  • TƏHLÜKƏSİZLİK: yalnız təhlükəsiz sahələr saxlanılır. Hesab açılışı /
 *    streaming parolları kimi həssas məlumatlar SERVERƏ YAZILMIR.
 */

type SafeCartItem = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  qty: number;
  productType: string;
  store?: string;
  /** Bu sətir dostuna HƏDİYYƏ kimi alınır? Eyni məhsul həm alış, həm hədiyyə ola bilər. */
  gift?: boolean;
};

function sanitizeItems(raw: unknown): SafeCartItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SafeCartItem[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const it = v as Record<string, unknown>;
    const id = typeof it.id === "string" ? it.id : null;
    const title = typeof it.title === "string" ? it.title : null;
    const finalAzn = typeof it.finalAzn === "number" ? it.finalAzn : null;
    const qty = typeof it.qty === "number" ? Math.max(1, Math.floor(it.qty)) : null;
    if (!id || !title || finalAzn == null || qty == null) continue;
    out.push({
      id,
      title,
      imageUrl: typeof it.imageUrl === "string" ? it.imageUrl : null,
      finalAzn,
      qty,
      productType: typeof it.productType === "string" ? it.productType : "",
      ...(typeof it.store === "string" ? { store: it.store } : {}),
      ...(it.gift ? { gift: true } : {}),
    });
  }
  return out;
}

/** Səbət tərkibinin imzası — id+qty dəyişikliyini aşkar etmək üçün. */
function cartSignature(items: SafeCartItem[]): string {
  const basis = items
    .map((i) => `${i.id}:${i.gift ? "g" : "n"}:${i.qty}`)
    .sort()
    .join("|");
  return crypto.createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  // Anonim istifadəçi — izləmirik, amma client xəta görməsin.
  if (!user) return NextResponse.json({ ok: true, tracked: false });

  const body = await req.json().catch(() => ({}));
  const items = sanitizeItems((body as Record<string, unknown>)?.items);

  // Boş səbət → mövcud snapshot-u sil (alış / təmizləmə).
  if (items.length === 0) {
    await prisma.cartSnapshot.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true, tracked: true, empty: true });
  }

  const itemCount = items.reduce((s, i) => s + i.qty, 0);
  const totalAznCents = Math.round(
    items.reduce((s, i) => s + i.qty * i.finalAzn, 0) * 100,
  );
  const signature = cartSignature(items);

  const existing = await prisma.cartSnapshot.findUnique({
    where: { userId: user.id },
    select: { signature: true },
  });

  // Tərkib dəyişibsə (və ya ilk dəfədirsə) reminderSentAt sıfırlanır →
  // yeni "tərk" üçün yenidən bir dəfə xatırlatma getməsinə icazə verir.
  const signatureChanged = !existing || existing.signature !== signature;

  await prisma.cartSnapshot.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      items: items as unknown as object,
      itemCount,
      totalAznCents,
      signature,
    },
    update: {
      items: items as unknown as object,
      itemCount,
      totalAznCents,
      signature,
      ...(signatureChanged ? { reminderSentAt: null } : {}),
    },
  });

  return NextResponse.json({ ok: true, tracked: true, itemCount });
}
