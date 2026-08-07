import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtThousands } from "@/lib/format";
import { getTestAccountUserIds } from "@/lib/testAccounts";
import { HEARD_ABOUT_OPTIONS, heardAboutLabel } from "@/lib/heardAbout";
import { ABANDONED_MIN_AGE_HOURS } from "@/lib/abandoned-cart";

export const dynamic = "force-dynamic";

/**
 * Satış hunisi — FAZA 0 (yalnız MÖVCUD data, heç bir yeni tracking yoxdur).
 *
 * NİYƏ BU SƏHİFƏ VAR:
 * Admin paneldə gəlir/mənfəət hesabatı var (`/admin`, `/admin/sales`), amma
 * "hansı kanal real pul gətirir" sualına heç yerdə cavab verilmirdi. Halbuki
 * qeydiyyatda MƏCBURİ soruşulan `User.heardAboutSource` (Instagram / TikTok /
 * Dost tövsiyəsi / Digər) indiyə qədər yalnız admin bildiriş e-poçtunda
 * göstərilirdi — heç vaxt aqreqasiya olunmurdu. Bu səhifə həmin sahəni gəlirlə
 * birləşdirir, yəni **bu gün mövcud olan kanal → AZN hesabatıdır**.
 *
 * ÖLÇÜLƏ BİLMƏYƏNLƏR (qəsdən göstərilmir, yalan rəqəm verməmək üçün):
 *  • Ziyarətçi sayı və ziyarətçi → səbət konversiyası — anonim trafik heç yerdə
 *    qeyd olunmur. FAZA 2 (`/api/t` + VisitorTracker) bunu gətirəcək.
 *  • Tərk edilmiş səbətin BƏRPA nisbəti — səbət boşalanda `CartSnapshot` silinir
 *    (`app/api/cart/sync/route.ts:75`), yəni **bərpa olunan səbət iz qoymur**.
 *    Ona görə aşağıda yalnız "hazırda gözləyən" mütləq rəqəmlər var.
 *  • Dəqiq sifariş sayı — bir sifariş N `Transaction` sətri yaradır və sətirdə
 *    `orderCode` sütunu yoxdur (FAZA 3 əlavə edəcək). Müvəqqəti proksi:
 *    eyni istifadəçinin eyni dəqiqədəki sətirləri bir sifariş sayılır.
 */

const REVENUE_TYPES = ["PURCHASE", "SERVICE_PURCHASE"];
const RANGES = [7, 30, 90] as const;
const REVIEW_AFFILIATE_KEY = '"reviewAffiliateId"';

type ChannelRow = {
  key: string;
  label: string;
  revenueCents: number;
  orders: number;
  buyers: number;
  registrations: number;
  convertedRegistrations: number;
};

export default async function AdminFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const rangeDays: number =
    RANGES.find((r) => String(r) === sp.range) ?? 30;

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (rangeDays - 1));

  const testUserIds = await getTestAccountUserIds();
  const excludeTest =
    testUserIds.length > 0 ? { notIn: testUserIds } : undefined;

  const revenueWhere = {
    type: { in: REVENUE_TYPES },
    status: "SUCCESS",
    ...(excludeTest ? { userId: excludeTest } : {}),
  };

  const [
    rangeRows,
    buyerGroups,
    newUsers,
    totalUsers,
    neverPurchasedCount,
    idleWallet,
    liveCarts,
  ] = await Promise.all([
    // Seçilmiş dövrün bütün gəlir sətirləri. `metadata` da gətirilir ki, rəy
    // affiliate payı üçün ikinci sorğu lazım olmasın.
    prisma.transaction.findMany({
      where: { ...revenueWhere, createdAt: { gte: since } },
      select: {
        userId: true,
        createdAt: true,
        amountAznCents: true,
        metadata: true,
      },
    }),
    // Bütün zamanlar üzrə alıcılar — sətir gətirmir, yalnız aqreqat.
    prisma.transaction.groupBy({
      by: ["userId"],
      where: revenueWhere,
      _sum: { amountAznCents: true },
      orderBy: { userId: "asc" },
    }),
    // Dövr ərzində qeydiyyatdan keçənlər (kohorta konversiyası üçün).
    prisma.user.findMany({
      where: {
        createdAt: { gte: since },
        ...(excludeTest ? { id: excludeTest } : {}),
      },
      select: { id: true, heardAboutSource: true },
    }),
    prisma.user.count({
      where: excludeTest ? { id: excludeTest } : undefined,
    }),
    // Heç vaxt alış etməyənlər — əlaqə filtri ilə, SQL tərəfdə.
    prisma.user.count({
      where: {
        ...(excludeTest ? { id: excludeTest } : {}),
        transactions: {
          none: { type: { in: REVENUE_TYPES }, status: "SUCCESS" },
        },
      },
    }),
    // Cüzdanda pul var, amma heç vaxt almayıb — "ölü pul".
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
    // Hazırda yaşayan səbətlər. Səbət boşalanda sətir silinir, ona görə hər
    // sətir "hələ alınmayıb" deməkdir.
    prisma.cartSnapshot.findMany({
      where: {
        itemCount: { gt: 0 },
        ...(excludeTest ? { userId: excludeTest } : {}),
      },
      select: { totalAznCents: true, reminderSentAt: true, updatedAt: true },
    }),
  ]);

  // ── Sifariş proksisi: eyni istifadəçi + eyni dəqiqə = bir sifariş ──────────
  const orderKeys = new Set<string>();
  const rangeBuyers = new Set<string>();
  let rangeRevenue = 0;
  let affiliateRevenue = 0;
  let affiliateOrders = 0;

  const revenueByUser = new Map<string, number>();
  const ordersByUser = new Map<string, Set<string>>();

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

    if (row.metadata?.includes(REVIEW_AFFILIATE_KEY)) {
      affiliateRevenue += amount;
      affiliateOrders += 1;
    }
  }

  const rangeOrders = orderKeys.size;
  const aov = rangeOrders > 0 ? Math.round(rangeRevenue / rangeOrders) : 0;

  // ── Bütün zamanlar üzrə alıcı çoxluğu ────────────────────────────────────
  const allTimeBuyerIds = new Set(buyerGroups.map((g) => g.userId));
  const allTimeBuyers = allTimeBuyerIds.size;

  // Təkrar alış — dövr daxilində ≥2 fərqli sifarişi olan alıcılar.
  let repeatBuyers = 0;
  for (const set of ordersByUser.values()) {
    if (set.size >= 2) repeatBuyers += 1;
  }
  const repeatRate =
    rangeBuyers.size > 0 ? (repeatBuyers / rangeBuyers.size) * 100 : 0;

  // ── Kanal cədvəli: heardAboutSource → gəlir ──────────────────────────────
  const buyerIdsInRange = Array.from(rangeBuyers);
  const buyerChannels =
    buyerIdsInRange.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: buyerIdsInRange } },
          select: { id: true, heardAboutSource: true },
        })
      : [];
  const channelByUser = new Map(
    buyerChannels.map((u) => [u.id, u.heardAboutSource ?? "UNKNOWN"]),
  );

  const channelKeys = [...HEARD_ABOUT_OPTIONS.map((o) => o.value), "UNKNOWN"];
  const rows = new Map<string, ChannelRow>(
    channelKeys.map((key) => [
      key,
      {
        key,
        label: key === "UNKNOWN" ? "Bilinməyən (köhnə hesab)" : heardAboutLabel(key),
        revenueCents: 0,
        orders: 0,
        buyers: 0,
        registrations: 0,
        convertedRegistrations: 0,
      },
    ]),
  );

  for (const [userId, revenue] of revenueByUser) {
    const row = rows.get(channelByUser.get(userId) ?? "UNKNOWN");
    if (!row) continue;
    row.revenueCents += revenue;
    row.orders += ordersByUser.get(userId)?.size ?? 0;
    row.buyers += 1;
  }

  for (const u of newUsers) {
    const row = rows.get(u.heardAboutSource ?? "UNKNOWN");
    if (!row) continue;
    row.registrations += 1;
    if (allTimeBuyerIds.has(u.id)) row.convertedRegistrations += 1;
  }

  const channelRows = Array.from(rows.values()).sort(
    (a, b) => b.revenueCents - a.revenueCents || b.registrations - a.registrations,
  );

  // ── Səbət vəziyyəti ──────────────────────────────────────────────────────
  const abandonThreshold = new Date(
    Date.now() - ABANDONED_MIN_AGE_HOURS * 60 * 60 * 1000,
  );
  const cartValue = liveCarts.reduce((acc, c) => acc + c.totalAznCents, 0);
  const staleCarts = liveCarts.filter((c) => c.updatedAt <= abandonThreshold);
  const remindedCarts = liveCarts.filter((c) => c.reminderSentAt !== null);
  const staleUnreminded = staleCarts.filter((c) => c.reminderSentAt === null);

  const newRegistrations = newUsers.length;
  const convertedNew = newUsers.filter((u) => allTimeBuyerIds.has(u.id)).length;

  function rangeHref(days: number) {
    return days === 30 ? "/admin/funnel" : `/admin/funnel?range=${days}`;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Satış hunisi</h1>
        <p className="text-sm text-zinc-600">
          Hansı kanal real pul gətirir. Mənbə: qeydiyyatdakı «Bizi haradan
          eşitdiniz?» cavabı — bu gün mövcud olan yeganə kanal atributsiyası.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Dövr
        </span>
        {RANGES.map((r) => (
          <Link
            key={r}
            href={rangeHref(r)}
            className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
              r === rangeDays
                ? "border-violet-500 bg-violet-500/15 text-violet-700"
                : "border-admin-line text-zinc-600 hover:border-admin-line2 hover:text-zinc-900"
            }`}
          >
            {r} gün
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SumCard label={`Gəlir (${rangeDays} gün)`} value={fmtAzn(rangeRevenue)} accent="emerald" />
        <SumCard label="Sifariş" value={fmtThousands(rangeOrders)} hint="eyni dəqiqə = 1 sifariş" />
        <SumCard label="Orta sifariş (AOV)" value={fmtAzn(aov)} />
        <SumCard label="Alan müştəri" value={fmtThousands(rangeBuyers.size)} />
      </div>

      {/* ── Kanal → gəlir ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Kanal → gəlir</h2>
          <p className="text-sm text-zinc-600">
            Gəlir alıcının qeydiyyatda göstərdiyi mənbəyə görə bölünüb.
            «Qeydiyyat» və «çevrildi» sütunları isə yalnız bu dövrdə
            qeydiyyatdan keçənlərə aiddir (kohorta).
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-admin-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <Th>Kanal</Th>
                <Th className="text-right">Gəlir</Th>
                <Th className="text-right">Payı</Th>
                <Th className="text-right">Sifariş</Th>
                <Th className="text-right">Alıcı</Th>
                <Th className="text-right">Qeydiyyat</Th>
                <Th className="text-right">Çevrildi</Th>
                <Th className="text-right">Konversiya</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {channelRows.map((r) => {
                const share =
                  rangeRevenue > 0 ? (r.revenueCents / rangeRevenue) * 100 : 0;
                const conv =
                  r.registrations > 0
                    ? (r.convertedRegistrations / r.registrations) * 100
                    : 0;
                return (
                  <tr key={r.key} className="hover:bg-admin-chip">
                    <Td className="font-medium text-zinc-900">{r.label}</Td>
                    <Td className="text-right font-semibold text-emerald-700">
                      {fmtAzn(r.revenueCents)}
                    </Td>
                    <Td className="text-right text-zinc-600">
                      {share.toFixed(1)}%
                    </Td>
                    <Td className="text-right text-zinc-700">
                      {fmtThousands(r.orders)}
                    </Td>
                    <Td className="text-right text-zinc-700">
                      {fmtThousands(r.buyers)}
                    </Td>
                    <Td className="text-right text-zinc-700">
                      {fmtThousands(r.registrations)}
                    </Td>
                    <Td className="text-right text-zinc-700">
                      {fmtThousands(r.convertedRegistrations)}
                    </Td>
                    <Td
                      className={`text-right font-semibold ${
                        conv >= 20
                          ? "text-emerald-700"
                          : conv > 0
                            ? "text-zinc-700"
                            : "text-zinc-400"
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
                <Td className="text-right text-emerald-700">
                  {fmtAzn(rangeRevenue)}
                </Td>
                <Td className="text-right">100%</Td>
                <Td className="text-right">{fmtThousands(rangeOrders)}</Td>
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

      {/* ── Səbət vəziyyəti ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Səbət vəziyyəti (indiki an)</h2>
          <p className="text-sm text-zinc-600">
            Səbət boşalanda snapshot silinir — yəni aşağıdakı hər sətir «hələ
            alınmayıb» deməkdir. Bu, dövrə görə deyil, **anlıq** mənzərədir.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SumCard label="Dolu səbət" value={fmtThousands(liveCarts.length)} />
          <SumCard
            label="Səbətlərdəki dəyər"
            value={fmtAzn(cartValue)}
            accent="emerald"
          />
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
            <strong>{fmtThousands(staleUnreminded.length)}</strong> ədəd tərk
            edilmiş səbətə (cəmi {fmtAzn(
              staleUnreminded.reduce((a, c) => a + c.totalAznCents, 0),
            )}) hələ xatırlatma göndərilməyib. Kod hazırdır
            (<code>/api/cron/abandoned-cart</code>) — cron həqiqətən işləyirmi,
            serverdə <code>crontab -l</code> ilə yoxla.{" "}
            <code>vercel.json</code>-dakı cron cədvəli self-host mühitdə
            <strong> işləmir</strong>.
          </Callout>
        )}
      </section>

      {/* ── Müştəri davranışı ────────────────────────────────────────────── */}
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
            value={fmtThousands(allTimeBuyers)}
            hint={`${totalUsers > 0 ? ((allTimeBuyers / totalUsers) * 100).toFixed(1) : "0"}% qeydiyyatın`}
          />
          <SumCard
            label="Alış etməyən hesab"
            value={fmtThousands(neverPurchasedCount)}
          />
          <SumCard
            label="İşlənməyən cüzdan pulu"
            value={fmtAzn(idleWallet._sum.walletBalance ?? 0)}
            hint={`${fmtThousands(idleWallet._count._all)} hesabda`}
          />
        </div>

        <div className="rounded-xl border border-admin-line bg-admin-card p-4 text-sm">
          <p className="font-semibold text-zinc-900">
            Rəy affiliate ilə gələn gəlir
          </p>
          <p className="mt-1 text-zinc-600">
            {affiliateOrders > 0 ? (
              <>
                <span className="font-semibold text-emerald-700">
                  {fmtAzn(affiliateRevenue)}
                </span>{" "}
                ({rangeRevenue > 0
                  ? ((affiliateRevenue / rangeRevenue) * 100).toFixed(1)
                  : "0"}
                % ümumi gəlirin), {fmtThousands(affiliateOrders)} sətirdə.
                Mənbə: <code>?via=</code> linki ilə gələn ziyarətçilər
                (<code>middleware.ts</code>). Bu, tam kanal atributsiyasının
                artıq işləyən kiçik nümunəsidir.
              </>
            ) : (
              <>
                Bu dövrdə <code>?via=</code> linki ilə gələn alış yoxdur. Rəy
                müəllifləri öz linklərini paylaşmırsa, bu kanal boş qalır.
              </>
            )}
          </p>
        </div>
      </section>

      <Callout tone="info">
        <strong>Bu səhifədə ziyarətçi rəqəmi yoxdur</strong> — anonim trafik
        hazırda heç yerdə qeyd olunmur, ona görə «ziyarətçi → səbət»
        konversiyası hesablana bilmir. Onu FAZA 2 (<code>/api/t</code> +{" "}
        <code>VisitorTracker</code>) gətirəcək. Buradakı bütün rəqəmlər
        qeydiyyatdan keçmiş istifadəçilərə aiddir.
      </Callout>
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
  return (
    <div className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2.5 text-left font-semibold ${className}`}>
      {children}
    </th>
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
