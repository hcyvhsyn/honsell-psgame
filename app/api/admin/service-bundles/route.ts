import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { revalidateServiceBundles } from "@/lib/revalidate";
import { loadAdminServiceBundles, loadBundleableServices } from "@/lib/serviceBundles";
import { canBundleServiceType } from "@/lib/serviceBundleShared";

export const runtime = "nodejs";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ə/g, "e")
    .replace(/ı/g, "i")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Seçici üçün ayrıca axtarış endpoint-i yoxdur — xidmətlərin sayı azdır
  // (onlarla, minlərlə deyil), ona görə hamısı bir dəfəyə göndərilir.
  const [bundles, services] = await Promise.all([
    loadAdminServiceBundles(),
    loadBundleableServices(),
  ]);
  return NextResponse.json({ bundles, services });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "UPSERT") {
      const {
        id,
        slug,
        title,
        subtitle,
        description,
        imageUrl,
        badgeText,
        isActive,
        isFeatured,
        sortOrder,
        startsAt,
        endsAt,
      } = body;
      if (!title) return NextResponse.json({ error: "Başlıq tələb olunur" }, { status: 400 });
      const finalSlug = slug ? slugify(String(slug)) : slugify(String(title));
      if (!finalSlug) return NextResponse.json({ error: "Slug yaradıla bilmədi" }, { status: 400 });

      const payload = {
        slug: finalSlug,
        title: String(title),
        subtitle: subtitle || null,
        description: description || null,
        imageUrl: imageUrl || null,
        badgeText: badgeText || null,
        isActive: Boolean(isActive ?? true),
        isFeatured: Boolean(isFeatured ?? false),
        sortOrder: Number(sortOrder || 0),
        startsAt: parseDate(startsAt),
        endsAt: parseDate(endsAt),
      };

      const b = id
        ? await prisma.serviceBundle.update({ where: { id }, data: payload })
        : await prisma.serviceBundle.create({ data: payload });
      revalidateServiceBundles();
      return NextResponse.json(b);
    }

    if (action === "DELETE") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id tələb olunur" }, { status: 400 });
      await prisma.serviceBundle.delete({ where: { id } });
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER") {
      const { ids } = body;
      if (!Array.isArray(ids))
        return NextResponse.json({ error: "ids massiv olmalıdır" }, { status: 400 });
      await prisma.$transaction(
        ids.map((id: string, index: number) =>
          prisma.serviceBundle.update({ where: { id: String(id) }, data: { sortOrder: index } }),
        ),
      );
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "ADD_SERVICE") {
      const { bundleId, serviceProductId } = body;
      if (!bundleId || !serviceProductId)
        return NextResponse.json(
          { error: "bundleId və serviceProductId tələb olunur" },
          { status: 400 },
        );

      // Hesab açılışı / Honsell hədiyyə kartı dəstə salına bilməz — `isServiceBundleSellable`
      // onları onsuz da bloklayır, amma admin səbəbi bilmədən "dəst görünmür" ilə
      // üzləşməsin deyə burada dərhal xəta qaytarılır.
      const service = await prisma.serviceProduct.findUnique({
        where: { id: String(serviceProductId) },
        select: { type: true },
      });
      if (!service) return NextResponse.json({ error: "Xidmət tapılmadı" }, { status: 404 });
      if (!canBundleServiceType(service.type)) {
        return NextResponse.json(
          { error: `"${service.type}" tipli xidmət dəstə salına bilməz.` },
          { status: 400 },
        );
      }

      const max = await prisma.serviceBundleItem.aggregate({
        where: { bundleId: String(bundleId) },
        _max: { position: true },
      });
      const nextPos = (max._max.position ?? -1) + 1;
      await prisma.serviceBundleItem.upsert({
        where: {
          bundleId_serviceProductId: {
            bundleId: String(bundleId),
            serviceProductId: String(serviceProductId),
          },
        },
        create: {
          bundleId: String(bundleId),
          serviceProductId: String(serviceProductId),
          position: nextPos,
        },
        update: {},
      });
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REMOVE_SERVICE") {
      const { bundleId, serviceProductId } = body;
      if (!bundleId || !serviceProductId)
        return NextResponse.json(
          { error: "bundleId və serviceProductId tələb olunur" },
          { status: 400 },
        );
      await prisma.serviceBundleItem.delete({
        where: {
          bundleId_serviceProductId: {
            bundleId: String(bundleId),
            serviceProductId: String(serviceProductId),
          },
        },
      });
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    if (action === "REORDER_SERVICES") {
      const { bundleId, serviceProductIds } = body;
      if (!bundleId || !Array.isArray(serviceProductIds))
        return NextResponse.json(
          { error: "bundleId və serviceProductIds tələb olunur" },
          { status: 400 },
        );
      await prisma.$transaction(
        serviceProductIds.map((serviceProductId: string, index: number) =>
          prisma.serviceBundleItem.update({
            where: {
              bundleId_serviceProductId: {
                bundleId: String(bundleId),
                serviceProductId: String(serviceProductId),
              },
            },
            data: { position: index },
          }),
        ),
      );
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    // Xidmətin dəst daxilindəki qiyməti. `null` → xidmətin adi qiyməti.
    // Serverdə hər halda list qiymətlə kəsilir (`computeServiceBundlePricing`),
    // yəni admin səhvən baha rəqəm yazsa müştəri dəstdə daha baha ödəmir.
    if (action === "SET_ITEM_PRICE") {
      const { bundleId, serviceProductId, priceAznCents } = body;
      if (!bundleId || !serviceProductId)
        return NextResponse.json(
          { error: "bundleId və serviceProductId tələb olunur" },
          { status: 400 },
        );
      const raw = priceAznCents;
      const value =
        raw === null || raw === undefined || raw === ""
          ? null
          : Math.max(0, Math.round(Number(raw) || 0));
      await prisma.serviceBundleItem.update({
        where: {
          bundleId_serviceProductId: {
            bundleId: String(bundleId),
            serviceProductId: String(serviceProductId),
          },
        },
        data: { priceAznCents: value },
      });
      revalidateServiceBundles();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinməyən action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Xəta baş verdi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
