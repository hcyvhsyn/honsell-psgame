import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import StreamingPlanPicker from "@/components/StreamingPlanPicker";
import PlatformsPublicSection from "@/components/PlatformsPublicSection";
import StreamingFeaturedBanner, { type FeaturedSlide } from "@/components/StreamingFeaturedBanner";
import StreamingReviewsPreview from "@/components/StreamingReviewsPreview";
import PlatformGuidesSection from "@/components/PlatformGuidesSection";
import NewsSection from "@/components/NewsSection";
import StreamingVariantLanding, {
  type LandingVariant,
} from "@/components/StreamingVariantLanding";
import StreamingGroupChooser, {
  type StreamingGroupChoicePricing,
} from "@/components/StreamingGroupChooser";
import { getServiceVariantConfig } from "@/lib/streamingVariants";
import { getStreamingGroup, isStreamingGroupChild } from "@/lib/streamingGroups";
import {
  getStreamingServiceBySlug,
  streamingUsesCustomerEmail,
  type StreamingServiceMeta,
} from "@/lib/streamingCart";
import { getDbStreamingSlug, getPublicStreamingSlug } from "@/lib/streamingPlatforms";

type Props = {
  svc: StreamingServiceMeta;
  /** Back link hədəfi və ad/label — yerləşdiyi parent route. */
  parent: { href: string; label: string };
  /** Detal səhifəsinin tam URL-i (canonical / breadcrumb üçün). */
  detailHref: string;
  /**
   * Seçilmiş variant (tier) slug-ı — məs. "evimde". Verildikdə yalnız həmin
   * tier-in alış görünüşü göstərilir; verilmədikdə (və xidmətdə variantlar
   * varsa) variant müqayisə (landing) görünüşü göstərilir.
   */
  variantSlug?: string;
  /**
   * Qrup parent səhifəsində (məs. netflix) seçilmiş addım — `?secim=` param-ı.
   * "kabinet" → kabinet landing; əks halda 2-seçim chooser göstərilir.
   */
  groupSelection?: string;
};

export default async function StreamingServiceDetail({
  svc,
  parent,
  detailHref,
  variantSlug,
  groupSelection,
}: Props) {
  const isMusic = svc.category === "MUSIC";

  const [products, featured] = await Promise.all([
    // Music kateqoriyasında paketlər PLATFORM tipində saxlanılır (musicBrand
    // ilə taglənir), digər streaming xidmətləri STREAMING tipində.
    prisma.serviceProduct.findMany({
      where: { isActive: true, type: isMusic ? "PLATFORM" : "STREAMING" },
      orderBy: [{ sortOrder: "asc" }, { priceAznCents: "asc" }],
      include: { _count: { select: { codes: { where: { isUsed: false } } } } },
    }),
    isMusic
      ? Promise.resolve([])
      : prisma.streamingFeatured.findMany({
          where: {
            scope: svc.code,
            isActive: true,
            title: { isActive: true, azAvailable: true, service: svc.code },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          include: { title: true },
          take: 12,
        }),
  ]);

  const filtered = products.filter((p) => {
    const meta = (p.metadata as Record<string, unknown> | null) ?? null;
    if (isMusic) {
      // Music xidmətləri üçün: category=MUSIC + musicBrand xidmət koduna uyğun.
      return (
        String(meta?.category ?? "") === "MUSIC" &&
        String(meta?.musicBrand ?? "") === svc.code
      );
    }
    return String(meta?.service ?? "").toUpperCase() === svc.code;
  });

  // ── Variant (tier) qruplaşması ──────────────────────────────────────────
  // Variant display məlumatı koddakı config-dən gəlir (lib/streamingVariants);
  // məhsul yalnız metadata.variantSlug saxlayır. Bir xidmətdə (məs. Netflix)
  // variantlar varsa, /streaming/netflix müqayisə (landing) səhifəsinə çevrilir;
  // hər tier öz alt səhifəsində (məs. /streaming/netflix/evimde) alınır.
  const variantConfig = isMusic ? null : getServiceVariantConfig(svc.code);

  const productVariantSlug = (p: (typeof filtered)[number]): string => {
    const m = (p.metadata as Record<string, unknown> | null) ?? null;
    return m && typeof m.variantSlug === "string" ? m.variantSlug.trim() : "";
  };

  // Config-dəki variantlar ∩ aktiv məhsulu olan variantlar.
  const variantGroups = (variantConfig?.variants ?? [])
    .map((v) => {
      const prods = filtered.filter((p) => productVariantSlug(p) === v.slug);
      if (prods.length === 0) return null;
      const fromPpm = Math.min(
        ...prods.map(
          (p) => p.priceAznCents / (Number((p.metadata as Record<string, unknown>)?.durationMonths) || 1),
        ),
      );
      const imageUrl =
        prods.find((p) => p.imageUrl)?.imageUrl ??
        (typeof (prods[0].metadata as Record<string, unknown>)?.platformImageUrl === "string"
          ? String((prods[0].metadata as Record<string, unknown>).platformImageUrl)
          : null);
      return { variant: v, fromPpm, imageUrl };
    })
    .filter((g): g is { variant: NonNullable<typeof variantConfig>["variants"][number]; fromPpm: number; imageUrl: string | null } => g !== null);

  const hasVariants = variantGroups.length > 1;
  const activeGroup = variantSlug
    ? variantGroups.find((g) => g.variant.slug === variantSlug) ?? null
    : null;
  const activeVariant = activeGroup?.variant ?? null;
  // URL-də variant slug var, amma uyğun tier (config + aktiv məhsul) yoxdur → 404.
  if (variantSlug && !activeVariant) {
    notFound();
  }
  // Konkret tier seçilməyibsə və variantlar varsa → müqayisə (landing) görünüşü.
  // inlineVariantPicker konfiqurasiyalı xidmətlər (məs. Netflix Hesab) ayrıca
  // landing GÖSTƏRMİR — tier-lər birbaşa picker-in içində tab kimi seçilir.
  const showVariantLanding =
    hasVariants && !activeVariant && !variantConfig?.inlineVariantPicker;
  const commonFeatures = variantConfig?.common ?? [];

  const landingVariants: LandingVariant[] = variantGroups.map((g) => ({
    slug: g.variant.slug,
    name: g.variant.name,
    fromPerMonthAzn: g.fromPpm / 100,
    features: g.variant.features,
    href: `${detailHref}/${g.variant.slug}`,
    imageUrl: g.imageUrl,
  }));

  // ── Qrup (parent) seçim ekranı ──────────────────────────────────────────
  // Bəzi xidmətlər (məs. Netflix) alt-paketlərə bölünmüş AYRICA platformalar
  // kimi qurulub. Parent səhifə (/streaming/netflix) müqayisə ekranı göstərir,
  // hər kart isə öz müstəqil platforma səhifəsinə yönləndirir.
  const group = isMusic ? null : getStreamingGroup(svc.slug);
  let groupLanding: LandingVariant[] = [];
  let groupCommon = commonFeatures;
  let groupChoicePricing: StreamingGroupChoicePricing[] = [];
  if (group) {
    const groupSlugs = Array.from(
      new Set([
        ...group.children.map((c) => c.platformSlug),
        ...(group.chooser ?? []).flatMap((c) => (c.platformSlug ? [c.platformSlug] : [])),
      ]),
    );
    const dbGroupSlugs = Array.from(new Set(groupSlugs.map(getDbStreamingSlug)));
    const childRows = await prisma.streamingPlatform.findMany({
      where: { slug: { in: dbGroupSlugs }, isActive: true },
      select: { slug: true, code: true },
    });
    const codeBySlug = new Map(childRows.map((r) => [getPublicStreamingSlug(r.slug), r.code.toUpperCase()]));
    groupCommon = getServiceVariantConfig(group.variantServiceCode)?.common ?? [];

    const productMeta = (p: (typeof products)[number]): Record<string, unknown> =>
      (p.metadata as Record<string, unknown> | null) ?? {};
    const productDurationMonths = (p: (typeof products)[number]): number | null => {
      const months = Number(productMeta(p).durationMonths);
      return Number.isFinite(months) && months > 0 ? months : null;
    };
    const productServiceCode = (p: (typeof products)[number]): string =>
      String(productMeta(p).service ?? "").toUpperCase();
    const fromPerMonthAzn = (rows: Array<(typeof products)[number]>): number | null => {
      let best = Infinity;
      for (const p of rows) {
        const months = productDurationMonths(p);
        if (!months) continue;
        best = Math.min(best, p.priceAznCents / months / 100);
      }
      return Number.isFinite(best) ? best : null;
    };
    const productsForCode = (code: string | null | undefined) =>
      code ? products.filter((p) => productServiceCode(p) === code.toUpperCase()) : [];

    groupChoicePricing = (group.chooser ?? []).map((choice) => {
      const href = choice.platformSlug
        ? `/streaming/${choice.platformSlug}`
        : `${detailHref}?secim=${choice.selection ?? ""}`;

      if (choice.platformSlug) {
        const code =
          codeBySlug.get(choice.platformSlug) ??
          getStreamingServiceBySlug(choice.platformSlug)?.code;
        const targetProducts = productsForCode(code);
        const targetConfig = code ? getServiceVariantConfig(code) : null;
        const plans =
          targetConfig?.variants.map((variant) => {
            const variantProducts = targetProducts.filter(
              (p) => String(productMeta(p).variantSlug ?? "").trim() === variant.slug,
            );
            return {
              name: variant.name,
              fromPerMonthAzn: fromPerMonthAzn(variantProducts),
              href,
              note: variant.features[0]?.text ?? null,
            };
          }) ?? [];

        return {
          accent: choice.accent,
          fromPerMonthAzn: fromPerMonthAzn(targetProducts),
          plans: plans.length
            ? plans
            : [
                {
                  name: choice.title,
                  fromPerMonthAzn: fromPerMonthAzn(targetProducts),
                  href,
                  note: choice.subtitle,
                },
              ],
        };
      }

      const childPlans = group.children.map((child) => {
        const code = codeBySlug.get(child.platformSlug);
        const childProducts = productsForCode(code);
        return {
          name: child.name,
          fromPerMonthAzn: fromPerMonthAzn(childProducts),
          href: `/streaming/${child.platformSlug}`,
          note: child.features[0]?.text ?? null,
        };
      });

      return {
        accent: choice.accent,
        fromPerMonthAzn: fromPerMonthAzn(
          group.children.flatMap((child) => productsForCode(codeBySlug.get(child.platformSlug))),
        ),
        plans: childPlans,
      };
    });

    groupLanding = group.children
      .map((child): LandingVariant | null => {
        const code = codeBySlug.get(child.platformSlug);
        if (!code) return null; // platforma yoxdur/gizlidir → kartı göstərmə
        const prods = products.filter(
          (p) =>
            String((p.metadata as Record<string, unknown> | null)?.service ?? "").toUpperCase() ===
            code,
        );
        const fromPpm = prods.length
          ? Math.min(
              ...prods.map(
                (p) =>
                  p.priceAznCents /
                  (Number((p.metadata as Record<string, unknown>)?.durationMonths) || 1),
              ),
            )
          : null;
        const imageUrl =
          prods.find((p) => p.imageUrl)?.imageUrl ??
          (typeof (prods[0]?.metadata as Record<string, unknown> | undefined)?.platformImageUrl ===
          "string"
            ? String((prods[0].metadata as Record<string, unknown>).platformImageUrl)
            : null);
        return {
          slug: child.platformSlug,
          name: child.name,
          fromPerMonthAzn: fromPpm != null ? fromPpm / 100 : null,
          features: child.features,
          href: `/streaming/${child.platformSlug}`,
          imageUrl,
        };
      })
      .filter((x): x is LandingVariant => x !== null);
  }
  // Parent chooser (məs. /streaming/netflix) — "secim" verilməyibsə 2 seçim
  // göstərilir; "kabinet" verilibsə kabinet landing açılır.
  const groupChooser = group?.chooser ?? null;
  const showGroupChooser = !!groupChooser && !activeVariant && groupSelection !== "kabinet";
  const showGroupLanding = groupLanding.length > 0 && !activeVariant && !showGroupChooser;
  // Header/icmal/featured bölmələrini gizlədən "landing" rejimi.
  const landingMode = showVariantLanding || showGroupLanding || showGroupChooser;
  // Qrup alt-paket səhifəsidirsə (məs. netflix-yanimda) icmallar gizlənir —
  // icmallar yalnız ümumi parent səhifədə (məs. /streaming/netflix) göstərilir.
  const isGroupChild = !isMusic && isStreamingGroupChild(svc.slug);

  // Picker-ə ötürüləcək məhsullar: konkret tier seçilibsə yalnız onun paketləri.
  const pickerProducts = activeVariant
    ? filtered.filter((p) => productVariantSlug(p) === activeVariant.slug)
    : filtered;

  // Config-dəki variant məlumatını (ad/fərqlər/cihazlar/ortaq) hər məhsulun öz
  // variantSlug-ına görə metadata-ya inject edirik ki, picker dəyişmədən tier
  // tab-larını qursun. Konkret tier seçilibsə də (activeVariant) eyni işləyir.
  const pickerMetaFor = (p: (typeof filtered)[number]): Record<string, unknown> | null => {
    const base = (p.metadata as Record<string, unknown> | null) ?? {};
    if (!variantConfig) return base;
    const slug = activeVariant?.slug ?? productVariantSlug(p);
    const v = variantConfig.variants.find((x) => x.slug === slug);
    if (!v) return base;
    return {
      ...base,
      variant: v.name,
      variantSlug: v.slug,
      variantRank: v.rank,
      variantFeatures: v.features,
      commonFeatures: variantConfig.common,
      devices: v.devices,
    };
  };

  const slides: FeaturedSlide[] = featured.map((r) => ({
    id: r.id,
    titleId: r.titleId,
    title: r.title.title,
    service: r.title.service,
    kind: r.title.kind === "SERIES" ? "SERIES" : "MOVIE",
    year: r.title.year,
    description: r.title.description,
    posterUrl: r.title.posterUrl,
    backdropUrl: r.title.backdropUrl,
    genres: Array.isArray(r.title.genres) ? (r.title.genres as string[]) : [],
    trailerUrl: r.title.trailerUrl,
  }));

  const isYoutube = svc.code === "YOUTUBE_PREMIUM";

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: parent.label, item: parent.href },
      { "@type": "ListItem", position: 2, name: svc.label, item: detailHref },
      ...(activeVariant
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: `${svc.label} ${activeVariant.name}`,
              item: `${detailHref}/${activeVariant.slug}`,
            },
          ]
        : []),
    ],
  };


  return (
    <main className="honsell-streaming-dark min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href={parent.href}
          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> {parent.label}
        </Link>

        <h1 className="sr-only">{svc.label} — {svc.tagline}</h1>

        {isMusic && svc.heroImageUrl && (
          <div className="mt-4 overflow-hidden rounded-3xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={svc.heroImageUrl} alt={svc.label} className="h-48 w-full object-cover sm:h-64" />
          </div>
        )}

        {!isMusic && !activeVariant && !showGroupLanding && !showGroupChooser && slides.length > 0 && (
          <div className="mt-4">
            <StreamingFeaturedBanner slides={slides} />
          </div>
        )}
      </section>

      <section id="plan-sec" className="mx-auto max-w-7xl px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        {!landingMode && (
          <header className="mb-6">
            <h2 className="text-2xl font-black text-white sm:text-3xl">
              {isMusic
                ? `${svc.label} paketləri`
                : activeVariant
                  ? `${svc.label} ${activeVariant.name}`
                  : "Plan seç"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {isMusic
                ? "Müddətini seç, sifarişdən sonra hesab məlumatları emailinə göndəriləcək."
                : "Müddətini seç, ödənişdən sonra giriş məlumatları sənə göndəriləcək."}
            </p>
          </header>
        )}
        {showGroupChooser ? (
          <StreamingGroupChooser
            serviceLabel={svc.label}
            basePath={detailHref}
            choices={groupChooser!}
            pricing={groupChoicePricing}
          />
        ) : landingMode ? (
          <StreamingVariantLanding
            serviceLabel={svc.label}
            variants={showGroupLanding ? groupLanding : landingVariants}
            commonFeatures={showGroupLanding ? groupCommon : commonFeatures}
          />
        ) : isYoutube ? (
          <StreamingPlanPicker
            productType="PLATFORM"
            authMode="GMAIL_PASSWORD"
            platformKind="YOUTUBE"
            heroImageUrl={svc.heroImageUrl ?? null}
            serviceOverride={{ code: svc.code, label: svc.label, tagline: svc.tagline, description: svc.description }}
            products={filtered.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: (p.metadata as Record<string, unknown> | null) ?? null,
              availableStock: 0,
            }))}
          />
        ) : isMusic ? (
          <PlatformsPublicSection
            products={filtered.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: (p.metadata as Record<string, unknown> | null) ?? null,
            }))}
          />
        ) : pickerProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
            {svc.label} üçün aktiv plan yoxdur.
          </div>
        ) : (
          <StreamingPlanPicker
            allowAnyEmail={streamingUsesCustomerEmail(svc.code)}
            serviceOverride={{
              code: svc.code,
              label: svc.label,
              tagline: svc.tagline,
              description: svc.description,
            }}
            products={pickerProducts.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              priceAznCents: p.priceAznCents,
              metadata: pickerMetaFor(p),
              availableStock: p._count.codes,
            }))}
          />
        )}
      </section>

      {!isMusic && !landingMode && !activeVariant && !isGroupChild && (
        <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <header className="mb-5">
            <h2 className="text-2xl font-black text-white sm:text-3xl">
              {svc.label} icmalları
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Müştərilərimizin {svc.label}-da izlədikləri haqqında son rəyləri.
            </p>
          </header>
          <StreamingReviewsPreview service={svc.code} limit={3} />
        </section>
      )}

      <NewsSection
        scope={`STREAMING_${svc.code}`}
        title={`${svc.label} xəbərləri`}
        subtitle={`${svc.label} kataloqundan yeni anonslar, premyera tarixləri və xüsusi təkliflər.`}
      />

      <PlatformGuidesSection scope={`STREAMING_${svc.code}`} />
    </main>
  );
}
