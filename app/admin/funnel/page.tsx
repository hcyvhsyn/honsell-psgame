import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtThousands } from "@/lib/format";
import { getTestAccountUserIds } from "@/lib/testAccounts";
import { HEARD_ABOUT_OPTIONS, heardAboutLabel } from "@/lib/heardAbout";
import { ABANDONED_MIN_AGE_HOURS } from "@/lib/abandoned-cart";
import { channelLabel } from "@/lib/analyticsShared";

export const dynamic = "force-dynamic";

/**
 * Satış hunisi — hansı kanal real AZN gətirir.
 *
 * İKİ MÜSTƏQİL MƏNBƏ, QƏSDƏN AYRI GÖSTƏRİLİR:
 *
 *  1. ÖLÇÜLMÜŞ (AnalyticsSession + OrderAttribution) — ziyarətçinin faktiki
 *     gəldiyi yer. Reklam blokerə görə ~10-25% itki var, amma GƏLİR rəqəmi
 *     itkisizdir: o, `Transaction`-dan gəlir, beacon-dan yox.
 *
 *  2. BƏYAN EDİLMİŞ (User.heardAboutSource) — qeydiyyatda MƏCBURİ soruşulan
 *     "Bizi haradan eşitdiniz?". Reklam bloker buna təsir etmir və offline
 *     kanalı (dost tövsiyəsi) da tutur — ölçmənin heç vaxt görə bilməyəcəyi şey.
 *
 * İkisi üst-üstə düşməyəndə bu, xəta deyil, məlumatdır: fərq adətən reklam
 * blokeri və cihazlararası keçiddir (telefonda görür, kompüterdə alır).
 *
 * ⚠️ UZLAŞMA: kanal cədvəlinin cəmi + "Mənbəsi bilinməyən" sətri HƏMİŞƏ
 * `/admin/sales`-dəki ümumi gəlirə bərabər olmalıdır. Aşağıda bu, ekranda
 * yoxlama sətri kimi göstərilir ki, sürüşmə özünü bildirsin.
 */

const REVENUE_TYPES = ["PURCHASE", "SERVICE_PURCHASE"];
const RANGES = [7, 30, 90] as const;
const REVIEW_AFFILIATE_KEY = '"reviewAffiliateId"';
const UNKNOWN = "__unknown__";

type FunnelRow = {
  key: string;
  label: string;
  sessions: number;
  sawProduct: number;
  addedToCart: number;
  beganCheckout: number;
  purchasedSessions: number;
  revenueCents: number;
  paidOrders: number;
};

function emptyRow(key: string, label: string): FunnelRow {
  return {
    key,
    label,
    sessions: 0,
    sawProduct: 0,
    addedToCart: 0,
    beganCheckout: 0,
    purchasedSessions: 0,
    revenueCents: 0,
    paidOrders: 0,
  };
}

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; attr?: string }>;
}) {
  const sp = await searchParams;
  const rangeDays: number = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const attr: "first" | "last" = sp.attr === "last" ? "last" : "first";

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (rangeDays - 1));

  const testUserIds = await getTestAccountUserIds();
  const excludeTest = testUserIds.length > 0 ? { notIn: testUserIds } : undefined;

  const revenueWhere = {
    type: { in: REVENUE_TYPES },
    status: "SUCCESS",
    ...(excludeTest ? { userId: excludeTest } : {}),
  };
  const sessionWhere = { startedAt: { gte: since }, isBot: false };

  const [
    rangeRows,
    buyerGroups,
    newUsers,
    totalUsers,
    neverPurchasedCount,
    idleWallet,
    liveCarts,
    sessionRows,
    channelGroups,
    landingGroups,
  ] = await Promise.all([
    // Dövrün bütün gəlir sətirləri. `orderCode` atributsiya join-u üçün,
    // `metadata` isə rəy affiliate payı üçün — ikisi də ayrıca sorğu tələb etmir.
    prisma.transaction.findMany({
      where: { ...revenueWhere, createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        amountAznCents: true,
        metadata: true,
        orderCode: true,
      },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: revenueWhere,
      _sum: { amountAznCents: true },
      orderBy: { userId: "asc" },
    }),
    prisma.user.findMany({
      where: {
        createdAt: { gte: since },
        ...(excludeTest ? { id: excludeTest } : {}),
      },
      select: { id: true, heardAboutSource: true },
    }),
    prisma.user.count({ where: excludeTest ? { id: excludeTest } : undefined }),
    prisma.user.count({
      where: {
        ...(excludeTest ? { id: excludeTest } : {}),
        transactions: {
          none: { type: { in: REVENUE_TYPES }, status: "SUCCESS" },
        },
      },
    }),
    prisma.user.aggregate({
      where: {
        walletBalance: { gt: 0 },
        ...(excludeTest ? { id: excludeTest } : {}),
        transactions: {
          none: { type: { in: REVENUE_TYPES }, status: "SUCCESS" },
        },
      },
      _count: { _all: true },
      _sum: { walletBalance: true },
    }),
    prisma.cartSnapshot.findMany({
      where: {
        itemCount: { gt: 0 },
        ...(excludeTest ? { userId: excludeTest } : {}),
      },
      select: { totalAznCents: true, reminderSentAt: true, updatedAt: true },
    }),
    // Yalnız iki sütun — həm fərqli ziyarətçi sayı, həm günlük qrafik bundan çıxır.
    prisma.analyticsSession.findMany({
      where: sessionWhere,
      select: { visitorId: true, startedAt: true },
    }),
    // ⚠️ Bütün huni TƏK groupBy sorğusudur — bayraqlar `Int` olduğuna görə
    // `_sum` işləyir (sxemdəki şərhə bax).
    attr === "first"
      ? prisma.analyticsSession.groupBy({
          by: ["firstChannel"],
          where: sessionWhere,
          _count: { _all: true },
          _sum: {
            sawProduct: true,
            addedToCart: true,
            beganCheckout: true,
            purchased: true,
          },
          orderBy: { firstChannel: "asc" },
        })
      : prisma.analyticsSession.groupBy({
          by: ["lastChannel"],
          where: sessionWhere,
          _count: { _all: true },
          _sum: {
            sawProduct: true,
            addedToCart: true,
            beganCheckout: true,
            purchased: true,
          },
          orderBy: { lastChannel: "asc" },
        }),
    prisma.analyticsSession.groupBy({
      by: ["landingPath"],
      where: sessionWhere,
      _count: { _all: true },
      _sum: {
        addedToCart: true,
        beganCheckout: true,
        purchased: true,
      },
      orderBy: { landingPath: "asc" },
    }),
  ]);

  // ── Sifariş proksisi (orderCode yoxdursa): eyni istifadəçi + eyni dəqiqə ──
  const orderKeys = new Set<string>();
  const rangeBuyers = new Set<string>();
  let rangeRevenue = 0;
  let affiliateRevenue = 0;
  let affiliateOrders = 0;

  const revenueByUser = new Map<string, number>();
  const ordersByUser = new Map<string, Set<string>>();
  /** orderCode → cəm gəlir (bir sifariş = N Transaction sətri). */
  const revenueByOrderCode = new Map<string, number>();
  let untrackedRevenue = 0;

  for (const row of rangeRows) {
    const amount = Math.abs(row.amountAznCents);
    const orderKey = `${row.userId}|${Math.floor(row.createdAt.getTime() / 60000)}`;

    rangeRevenue += amount;
    rangeBuyers.add(row.userId);
    orderKeys.add(orderKey);
    revenueByUser.set(row.userId, (revenueByUser.get(row.userId) ?? 0) + amount);

    let set = ordersByUser.get(row.userId);
    if (!set) {
      set = new Set();
      ordersByUser.set(row.userId, set);
    }
    set.add(orderKey);

    if (row.orderCode) {
      revenueByOrderCode.set(
        row.orderCode,
        (revenueByOrderCode.get(row.orderCode) ?? 0) + amount,
      );
    } else {
      // FAZA 3-dən əvvəlki sifarişlər — atributsiya mümkün deyil.
      untrackedRevenue += amount;
    }

    if (row.metadata?.includes(REVIEW_AFFILIATE_KEY)) {
      affiliateRevenue += amount;
      affiliateOrders += 1;
    }
  }

  const rangeOrders = orderKeys.size;
  const aov = rangeOrders > 0 ? Math.round(rangeRevenue / rangeOrders) : 0;

  // ── Ölçülmüş huni: gəliri kanala bağla ───────────────────────────────────
  const orderCodes = Array.from(revenueByOrderCode.keys());
  const attributions =
    orderCodes.length > 0
      ? await prisma.orderAttribution.findMany({
          where: { orderCode: { in: orderCodes } },
          select: {
            orderCode: true,
            firstChannel: true,
            lastChannel: true,
            firstLandingPath: true,
          },
        })
      : [];
  const attrByCode = new Map(attributions.map((a) => [a.orderCode, a]));

  const funnelRows = new Map<string, FunnelRow>();
  function rowFor(key: string): FunnelRow {
    let row = funnelRows.get(key);
    if (!row) {
      row = emptyRow(key, key === UNKNOWN ? "Mənbəsi bilinməyən" : channelLabel(key));
      funnelRows.set(key, row);
    }
    return row;
  }

  for (const g of channelGroups) {
    const key =
      "firstChannel" in g ? g.firstChannel : (g as { lastChannel: string }).lastChannel;
    const row = rowFor(key);
    row.sessions += g._count._all;
    row.sawProduct += g._sum.sawProduct ?? 0;
    row.addedToCart += g._sum.addedToCart ?? 0;
    row.beganCheckout += g._sum.beganCheckout ?? 0;
    row.purchasedSessions += g._sum.purchased ?? 0;
  }

  // Atributsiyası olmayan sifarişlərin gəliri (köhnə tarixçə + bloklanmış beacon).
  let unattributedRevenue = untrackedRevenue;
  for (const [code, revenue] of revenueByOrderCode) {
    const a = attrByCode.get(code);
    if (!a) {
      unattributedRevenue += revenue;
      continue;
    }
    const row = rowFor(attr === "first" ? a.firstChannel : a.lastChannel);
    row.revenueCents += revenue;
    row.paidOrders += 1;
  }
  if (unattributedRevenue > 0) {
    const row = rowFor(UNKNOWN);
    row.revenueCents += unattributedRevenue;
  }

  const channelTable = Array.from(funnelRows.values()).sort(
    (a, b) => b.revenueCents - a.revenueCents || b.sessions - a.sessions,
  );

  // Ümumi huni — bütün kanalların cəmi.
  const totals = channelTable.reduce(
    (acc, r) => ({
      sessions: acc.sessions + r.sessions,
      sawProduct: acc.sawProduct + r.sawProduct,
      addedToCart: acc.addedToCart + r.addedToCart,
      beganCheckout: acc.beganCheckout + r.beganCheckout,
      purchasedSessions: acc.purchasedSessions + r.purchasedSessions,
      revenueCents: acc.revenueCents + r.revenueCents,
      paidOrders: acc.paidOrders + r.paidOrders,
    }),
    {
      sessions: 0,
      sawProduct: 0,
      addedToCart: 0,
      beganCheckout: 0,
      purchasedSessions: 0,
      revenueCents: 0,
      paidOrders: 0,
    },
  );

  const uniqueVisitors = new Set(sessionRows.map((s) => s.visitorId)).size;
  const trackingLive = sessionRows.length > 0;

  const landingTable = landingGroups
    .map((g) => ({
      path: g.landingPath,
      sessions: g._count._all,
      addedToCart: g._sum.addedToCart ?? 0,
      beganCheckout: g._sum.beganCheckout ?? 0,
      purchased: g._sum.purchased ?? 0,
    }))
    .sort((a, b) => b.purchased - a.purchased || b.sessions - a.sessions)
    .slice(0, 30);

  // ── Bəyan edilmiş mənbə (heardAboutSource) ───────────────────────────────
  const buyerIdsInRange = Array.from(rangeBuyers);
  const buyerChannels =
    buyerIdsInRange.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: buyerIdsInRange } },
          select: { id: true, heardAboutSource: true },
        })
      : [];
  const declaredByUser = new Map(
    buyerChannels.map((u) => [u.id, u.heardAboutSource ?? UNKNOWN]),
  );

  type DeclaredRow = {
    key: string;
    label: string;
    revenueCents: number;
    buyers: number;
    registrations: number;
    converted: number;
  };
  const declaredRows = new Map<string, DeclaredRow>(
    [...HEARD_ABOUT_OPTIONS.map((o) => o.value), UNKNOWN].map((key) => [
      key,
      {
        key,
        label: key === UNKNOWN ? "Bilinməyən (köhnə hesab)" : heardAboutLabel(key),
        revenueCents: 0,
        buyers: 0,
        registrations: 0,
        converted: 0,
      },
    ]),
  );

  const allTimeBuyerIds = new Set(buyerGroups.map((g) => g.userId));

  for (const [userId, revenue] of revenueByUser) {
    const row = declaredRows.get(declaredByUser.get(userId) ?? UNKNOWN);
    if (!row) continue;
    row.revenueCents += revenue;
    row.buyers += 1;
  }
  for (const u of newUsers) {
    const row = declaredRows.get(u.heardAboutSource ?? UNKNOWN);
    if (!row) continue;
    row.registrations += 1;
    if (allTimeBuyerIds.has(u.id)) row.converted += 1;
  }
  const declaredTable = Array.from(declaredRows.values()).sort(
    (a, b) => b.revenueCents - a.revenueCents || b.registrations - a.registrations,
  );

  // ── Müştəri davranışı ────────────────────────────────────────────────────
  let repeatBuyers = 0;
  for (const set of ordersByUser.values()) if (set.size >= 2) repeatBuyers += 1;
  const repeatRate =
    rangeBuyers.size > 0 ? (repeatBuyers / rangeBuyers.size) * 100 : 0;

  const abandonThreshold = new Date(
    Date.now() - ABANDONED_MIN_AGE_HOURS * 60 * 60 * 1000,
  );
  const cartValue = liveCarts.reduce((acc, c) => acc + c.totalAznCents, 0);
  const staleCarts = liveCarts.filter((c) => c.updatedAt <= abandonThreshold);
  const remindedCarts = liveCarts.filter((c) => c.reminderSentAt !== null);
  const staleUnreminded = staleCarts.filter((c) => c.reminderSentAt === null);

  const newRegistrations = newUsers.length;
  const convertedNew = newUsers.filter((u) => allTimeBuyerIds.has(u.id)).length;

  function href(next: { range?: number; attr?: string }) {
    const params = new URLSearchParams();
    const r = next.range ?? rangeDays;
    const a = next.attr ?? attr;
    if (r !== 30) params.set("range", String(r));
    if (a !== "first") params.set("attr", a);
    const qs = params.toString();
    return qs ? `/admin/funnel?${qs}` : "/admin/funnel";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Satış hunisi</h1>
        <p className="text-sm text-zinc-600">
          Hansı kanal real AZN gətirir və müştəri harada itir.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <Chips
          label="Dövr"
          current={String(rangeDays)}
          options={RANGES.map((r) => ({ value: String(r), label: `${r} gün` }))}
          build={(v) => href({ range: Number(v) })}
        />
        <Chips
          label="Atributsiya"
          current={attr}
          options={[
            { value: "first", label: "İlk toxunuş" },
            { value: "last", label: "Son toxunuş" },
          ]}
          build={(v) => href({ attr: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SumCard label={`Gəlir (${rangeDays} gün)`} value={fmtAzn(rangeRevenue)} accent="emerald" />
        <SumCard label="Sifariş" value={fmtThousands(rangeOrders)} hint="eyni dəqiqə = 1 sifariş" />
        <SumCard label="Orta sifariş (AOV)" value={fmtAzn(aov)} />
        <SumCard label="Alan müştəri" value={fmtThousands(rangeBuyers.size)} />
      </div>

      {/* ── ÖLÇÜLMÜŞ HUNİ ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Ölçülmüş huni</h2>
          <p className="text-sm text-zinc-600">
            Faktiki ziyarətçi davranışı. Reklam blokerə görə ziyarətçi sayında
            ~10–25% itki ola bilər — <strong>gəlir rəqəmi isə itkisizdir</strong>,
            çünki o, tranzaksiyalardan gəlir.
          </p>
        </div>

        {!trackingLive ? (
          <Callout tone="info">
            Bu dövrdə hələ heç bir seans qeyd olunmayıb. Deploy-dan sonra ilk
            ziyarətçilər gələn kimi bu bölmə dolacaq. Yoxlama:{" "}
            <code>SELECT count(*) FROM &quot;AnalyticsSession&quot;;</code>
          </Callout>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <FunnelStep label="Ziyarətçi" value={uniqueVisitors} />
              <FunnelStep
                label="Seans"
                value={totals.sessions}
                prev={uniqueVisitors}
                skipDrop
              />
              <FunnelStep
                label="Məhsula baxdı"
                value={totals.sawProduct}
                prev={totals.sessions}
              />
              <FunnelStep
                label="Səbətə atdı"
                value={totals.addedToCart}
                prev={totals.sawProduct}
              />
              <FunnelStep
                label="Ödədi"
                value={totals.purchasedSessions}
                prev={totals.beganCheckout}
                accent
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-admin-line">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <Th>Kanal</Th>
                    <Th className="text-right">Seans</Th>
                    <Th className="text-right">Məhsula baxdı</Th>
                    <Th className="text-right">Səbətə atdı</Th>
                    <Th className="text-right">Ödənişə keçdi</Th>
                    <Th className="text-right">Ödənilmiş sifariş</Th>
                    <Th className="text-right">Gəlir</Th>
                    <Th className="text-right">Konversiya</Th>
                    <Th className="text-right">AZN / seans</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-line">
                  {channelTable.map((r) => {
                    const conv =
                      r.sessions > 0 ? (r.purchasedSessions / r.sessions) * 100 : 0;
                    const perSession =
                      r.sessions > 0 ? Math.round(r.revenueCents / r.sessions) : 0;
                    return (
                      <tr key={r.key} className="hover:bg-admin-chip">
                        <Td className="font-medium text-zinc-900">{r.label}</Td>
                        <Td className="text-right text-zinc-700">{fmtThousands(r.sessions)}</Td>
                        <Td className="text-right text-zinc-700">{fmtThousands(r.sawProduct)}</Td>
                        <Td className="text-right text-zinc-700">{fmtThousands(r.addedToCart)}</Td>
                        <Td className="text-right text-zinc-700">{fmtThousands(r.beganCheckout)}</Td>
                        <Td className="text-right text-zinc-700">{fmtThousands(r.paidOrders)}</Td>
                        <Td className="text-right font-semibold text-emerald-700">
                          {fmtAzn(r.revenueCents)}
                        </Td>
                        <Td className="text-right text-zinc-700">
                          {r.sessions > 0 ? `${conv.toFixed(2)}%` : "—"}
                        </Td>
                        <Td className="text-right text-zinc-700">
                          {r.sessions > 0 ? fmtAzn(perSession) : "—"}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Reconciliation
              channelSum={totals.revenueCents}
              actual={rangeRevenue}
            />

            {landingTable.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-900">
                  Giriş səhifələri (ən çox alış gətirən 30)
                </h3>
                <div className="overflow-x-auto rounded-xl border border-admin-line">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <Th>Səhifə</Th>
                        <Th className="text-right">Seans</Th>
                        <Th className="text-right">Səbətə atdı</Th>
                        <Th className="text-right">Ödənişə keçdi</Th>
                        <Th className="text-right">Ödədi</Th>
                        <Th className="text-right">Konversiya</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-line">
                      {landingTable.map((r) => (
                        <tr key={r.path} className="hover:bg-admin-chip">
                          <Td className="font-mono text-xs text-zinc-800">{r.path}</Td>
                          <Td className="text-right text-zinc-700">{fmtThousands(r.sessions)}</Td>
                          <Td className="text-right text-zinc-700">{fmtThousands(r.addedToCart)}</Td>
                          <Td className="text-right text-zinc-700">{fmtThousands(r.beganCheckout)}</Td>
                          <Td className="text-right font-semibold text-zinc-900">
                            {fmtThousands(r.purchased)}
                          </Td>
                          <Td className="text-right text-zinc-700">
                            {r.sessions > 0
                              ? `${((r.purchased / r.sessions) * 100).toFixed(2)}%`
                              : "—"}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── BƏYAN EDİLMİŞ MƏNBƏ ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Bəyan edilmiş mənbə</h2>
          <p className="text-sm text-zinc-600">
            Qeydiyyatda məcburi soruşulan «Bizi haradan eşitdiniz?». Reklam
            blokerdən asılı deyil və <strong>dost tövsiyəsi kimi offline kanalı da
            tutur</strong> — ölçmənin heç vaxt görə bilməyəcəyi şey. Ölçülmüş
            hunidən fərqlənməsi normaldır.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-admin-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <Th>Mənbə</Th>
                <Th className="text-right">Gəlir</Th>
                <Th className="text-right">Payı</Th>
                <Th className="text-right">Alıcı</Th>
                <Th className="text-right">Qeydiyyat</Th>
                <Th className="text-right">Çevrildi</Th>
                <Th className="text-right">Konversiya</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {declaredTable.map((r) => {
                const share =
                  rangeRevenue > 0 ? (r.revenueCents / rangeRevenue) * 100 : 0;
                const conv =
                  r.registrations > 0 ? (r.converted / r.registrations) * 100 : 0;
                return (
                  <tr key={r.key} className="hover:bg-admin-chip">
                    <Td className="font-medium text-zinc-900">{r.label}</Td>
                    <Td className="text-right font-semibold text-emerald-700">
                      {fmtAzn(r.revenueCents)}
                    </Td>
                    <Td className="text-right text-zinc-600">{share.toFixed(1)}%</Td>
                    <Td className="text-right text-zinc-700">{fmtThousands(r.buyers)}</Td>
                    <Td className="text-right text-zinc-700">{fmtThousands(r.registrations)}</Td>
                    <Td className="text-right text-zinc-700">{fmtThousands(r.converted)}</Td>
                    <Td
                      className={`text-right font-semibold ${
                        conv >= 20 ? "text-emerald-700" : "text-zinc-700"
                      }`}
                    >
                      {r.registrations > 0 ? `${conv.toFixed(1)}%` : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-admin-card text-xs font-semibold text-zinc-700">
              <tr>
                <Td>Cəm</Td>
                <Td className="text-right text-emerald-700">{fmtAzn(rangeRevenue)}</Td>
                <Td className="text-right">100%</Td>
                <Td className="text-right">{fmtThousands(rangeBuyers.size)}</Td>
                <Td className="text-right">{fmtThousands(newRegistrations)}</Td>
                <Td className="text-right">{fmtThousands(convertedNew)}</Td>
                <Td className="text-right">
                  {newRegistrations > 0
                    ? `${((convertedNew / newRegistrations) * 100).toFixed(1)}%`
                    : "—"}
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── SƏBƏT VƏZİYYƏTİ ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Səbət vəziyyəti (indiki an)</h2>
          <p className="text-sm text-zinc-600">
            Səbət boşalanda snapshot silinir — hər sətir «hələ alınmayıb»
            deməkdir. Bu səbəbdən <strong>bərpa nisbəti hesablana bilmir</strong>:
            bərpa olunan səbət geridə iz qoymur.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SumCard label="Dolu səbət" value={fmtThousands(liveCarts.length)} />
          <SumCard label="Səbətlərdəki dəyər" value={fmtAzn(cartValue)} accent="emerald" />
          <SumCard
            label={`${ABANDONED_MIN_AGE_HOURS} saatdan köhnə`}
            value={fmtThousands(staleCarts.length)}
            hint="tərk edilmiş sayılır"
          />
          <SumCard
            label="Xatırlatma göndərilib"
            value={fmtThousands(remindedCarts.length)}
            hint="göndərilib, hələ almayıb"
          />
        </div>

        {staleUnreminded.length > 0 && (
          <Callout tone="warn">
            <strong>{fmtThousands(staleUnreminded.length)}</strong> tərk edilmiş
            səbətə (cəmi{" "}
            {fmtAzn(staleUnreminded.reduce((a, c) => a + c.totalAznCents, 0))})
            hələ xatırlatma göndərilməyib. Kod hazırdır
            (<code>/api/cron/abandoned-cart</code>) — cron həqiqətən işləyirmi,
            serverdə <code>crontab -l</code> ilə yoxla.{" "}
            <code>vercel.json</code>-dakı cədvəl self-host mühitdə{" "}
            <strong>işləmir</strong>.
          </Callout>
        )}
      </section>

      {/* ── MÜŞTƏRİ DAVRANIŞI ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Müştəri davranışı</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SumCard
            label="Təkrar alış nisbəti"
            value={`${repeatRate.toFixed(1)}%`}
            hint={`${rangeDays} gündə ≥2 sifariş`}
          />
          <SumCard
            label="Ümumi alıcı (bütün zaman)"
            value={fmtThousands(allTimeBuyerIds.size)}
            hint={`${totalUsers > 0 ? ((allTimeBuyerIds.size / totalUsers) * 100).toFixed(1) : "0"}% qeydiyyatın`}
          />
          <SumCard label="Alış etməyən hesab" value={fmtThousands(neverPurchasedCount)} />
          <SumCard
            label="İşlənməyən cüzdan pulu"
            value={fmtAzn(idleWallet._sum.walletBalance ?? 0)}
            hint={`${fmtThousands(idleWallet._count._all)} hesabda`}
          />
        </div>

        <div className="rounded-xl border border-admin-line bg-admin-card p-4 text-sm">
          <p className="font-semibold text-zinc-900">Rəy affiliate ilə gələn gəlir</p>
          <p className="mt-1 text-zinc-600">
            {affiliateOrders > 0 ? (
              <>
                <span className="font-semibold text-emerald-700">
                  {fmtAzn(affiliateRevenue)}
                </span>{" "}
                (
                {rangeRevenue > 0
                  ? ((affiliateRevenue / rangeRevenue) * 100).toFixed(1)
                  : "0"}
                % ümumi gəlirin), {fmtThousands(affiliateOrders)} sətirdə. Mənbə:{" "}
                <code>?via=</code> linki (<code>middleware.ts</code>).
              </>
            ) : (
              <>
                Bu dövrdə <code>?via=</code> linki ilə gələn alış yoxdur. Rəy
                müəllifləri linklərini paylaşmırsa bu kanal boş qalır.
              </>
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

/** Kanal cədvəlinin cəmi `/admin/sales` ilə uzlaşırmı — sürüşmə özünü bildirsin. */
function Reconciliation({
  channelSum,
  actual,
}: {
  channelSum: number;
  actual: number;
}) {
  const diff = actual - channelSum;
  const ok = Math.abs(diff) < 1; // 1 qəpikdən az fərq = yuvarlaqlaşma
  return (
    <p
      className={`text-xs ${ok ? "text-zinc-500" : "font-semibold text-amber-700"}`}
    >
      Yoxlama: kanal cəmi {fmtAzn(channelSum)} · faktiki gəlir {fmtAzn(actual)}
      {ok ? " · uzlaşır ✓" : ` · FƏRQ ${fmtAzn(diff)} — hesabatda sızma var`}
    </p>
  );
}

function FunnelStep({
  label,
  value,
  prev,
  accent,
  skipDrop,
}: {
  label: string;
  value: number;
  prev?: number;
  accent?: boolean;
  skipDrop?: boolean;
}) {
  const rate = prev && prev > 0 ? (value / prev) * 100 : null;
  return (
    <div className="rounded-xl border border-admin-line bg-admin-card p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-emerald-700" : "text-zinc-900"
        }`}
      >
        {fmtThousands(value)}
      </p>
      {rate !== null && !skipDrop && (
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {rate.toFixed(1)}% keçdi · {(100 - rate).toFixed(1)}% itdi
        </p>
      )}
    </div>
  );
}

function Chips({
  label,
  current,
  options,
  build,
}: {
  label: string;
  current: string;
  options: Array<{ value: string; label: string }>;
  build: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wider text-zinc-500">{label}</span>
      {options.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={build(o.value)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
              active
                ? "border-violet-500 bg-violet-500/15 text-violet-700"
                : "border-admin-line text-zinc-600 hover:border-admin-line2 hover:text-zinc-900"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

function SumCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "emerald";
}) {
  return (
    <div className="rounded-xl border border-admin-line bg-admin-card p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent === "emerald" ? "text-emerald-700" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "warn" | "info";
  children: React.ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-sky-300 bg-sky-50 text-sky-900";
  return <div className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</div>;
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2.5 text-left font-semibold ${className}`}>{children}</th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
