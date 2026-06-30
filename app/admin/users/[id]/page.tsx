import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Hash,
  Wallet,
  Calendar,
  Phone,
  User as UserIcon,
  Cake,
  Gamepad2,
  Star,
  Heart,
  MessageSquare,
  Repeat,
  Activity,
  Globe,
  Monitor,
  ScrollText,
  KeyRound,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";
import RoleToggle from "./RoleToggle";
import UserAdminActions from "./UserAdminActions";
import CancelPurchaseButton from "./CancelPurchaseButton";
import DisableUserButton from "./DisableUserButton";
import TierSelect from "./TierSelect";
import TierBadge from "@/components/TierBadge";
import { getEffectiveTier } from "@/lib/customerTier";
import { Sparkles } from "lucide-react";
import AdminNotesSection from "./AdminNotesSection";
import QuickActionsBar from "./QuickActionsBar";
import CopyableField from "@/components/CopyableField";
import { Ban } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      referredBy: {
        select: { id: true, email: true, name: true, referralCode: true },
      },
      referrals: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          emailVerified: true,
          walletBalance: true,
        },
        orderBy: { createdAt: "desc" },
      },
      psnAccounts: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { title: true, platform: true } },
          psnAccount: { select: { label: true, psnEmail: true } },
          serviceProduct: { select: { title: true, type: true } },
          serviceCode: { select: { code: true } },
        },
      },
      commissions: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { email: true } } },
      },
      gameReviews: {
        orderBy: { createdAt: "desc" },
        include: { game: { select: { title: true, platform: true } } },
      },
      favorites: {
        orderBy: { createdAt: "desc" },
        include: {
          game: { select: { id: true, title: true, platform: true } },
        },
        take: 50,
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: {
          serviceProduct: { select: { title: true } },
          psnAccount: { select: { label: true } },
        },
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { email: true, name: true } },
        },
      },
      adminAuditEntries: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          actor: { select: { email: true, name: true } },
        },
      },
      tier: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!user) notFound();

  const [tiers, effectiveTier] = await Promise.all([
    prisma.customerTier.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, displayName: true, slug: true, kind: true, isDefault: true },
    }),
    getEffectiveTier(user.id),
  ]);

  const purchases = user.transactions.filter((t) => t.type === "PURCHASE");
  const servicePurchases = user.transactions.filter(
    (t) => t.type === "SERVICE_PURCHASE"
  );
  const deposits = user.transactions.filter((t) => t.type === "DEPOSIT");

  function parseYoutubeCreds(meta: string | null): {
    isYoutube: boolean;
    gmail?: string;
    password?: string;
    accounts?: { email: string; password: string }[];
  } {
    if (!meta) return { isYoutube: false };
    try {
      const m = JSON.parse(meta) as Record<string, unknown>;
      const isYoutube =
        m.kind === "PLATFORM" && String(m.musicBrand ?? "") === "YOUTUBE_PREMIUM";
      const accounts =
        m.kind === "PLATFORM" && Array.isArray(m.accounts)
          ? (m.accounts as unknown[])
              .map((a) => {
                const o = a && typeof a === "object" ? (a as Record<string, unknown>) : null;
                return {
                  email: o && typeof o.email === "string" ? o.email : "",
                  password: o && typeof o.password === "string" ? o.password : "",
                };
              })
              .filter((a) => a.email)
          : undefined;
      return {
        isYoutube,
        gmail: typeof m.gmail === "string" ? m.gmail : undefined,
        password: typeof m.customerPassword === "string" ? m.customerPassword : undefined,
        accounts: accounts?.length ? accounts : undefined,
      };
    } catch {
      return { isYoutube: false };
    }
  }

  type PlatformProfileRow = {
    kind: "LINKEDIN" | "YOUTUBE";
    brandLabel: string;
    email: string;
    password: string | null;
    productTitle: string;
    orderedAt: Date;
    transactionId: string;
  };

  function parsePlatformProfile(
    meta: string | null,
    productTitle: string,
  ): Omit<PlatformProfileRow, "orderedAt" | "transactionId"> | null {
    if (!meta) return null;
    try {
      const m = JSON.parse(meta) as Record<string, unknown>;
      if (m.kind !== "PLATFORM") return null;
      const gmail = typeof m.gmail === "string" ? m.gmail : undefined;
      if (!gmail) return null;
      const password = typeof m.customerPassword === "string" ? m.customerPassword : null;
      const category = String(m.category ?? "");
      const musicBrand = String(m.musicBrand ?? "");
      const planType = String(m.planType ?? "").toUpperCase();

      if (category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM") {
        return {
          kind: "YOUTUBE",
          brandLabel: "YouTube Premium",
          email: gmail,
          password,
          productTitle,
        };
      }
      if (category === "WORK" && (planType === "CAREER" || planType === "BUSINESS")) {
        return {
          kind: "LINKEDIN",
          brandLabel: `LinkedIn ${planType === "CAREER" ? "Career" : "Business"}`,
          email: gmail,
          password,
          productTitle,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  const platformProfiles: PlatformProfileRow[] = [];
  {
    const seen = new Set<string>();
    for (const t of user.transactions) {
      if (t.status !== "SUCCESS") continue;
      if (t.type !== "PURCHASE" && t.type !== "SERVICE_PURCHASE") continue;
      const parsed = parsePlatformProfile(
        t.metadata,
        t.serviceProduct?.title ?? "—",
      );
      if (!parsed) continue;
      const key = `${parsed.kind}::${parsed.email.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      platformProfiles.push({
        ...parsed,
        orderedAt: t.createdAt,
        transactionId: t.id,
      });
    }
  }

  function parseAdminAdjust(meta: string | null): {
    field?: string;
    prev?: number;
    next?: number;
  } | null {
    if (!meta) return null;
    try {
      const parsed = JSON.parse(meta);
      if (parsed && parsed.kind === "ADMIN_ADJUST") return parsed;
    } catch {
      /* not JSON */
    }
    return null;
  }

  const adminAdjusts = deposits.filter((t) => parseAdminAdjust(t.metadata));
  const userDeposits = deposits.filter((t) => !parseAdminAdjust(t.metadata));

  const allPurchases = [...purchases, ...servicePurchases];
  const successPurchases = allPurchases.filter((t) => t.status === "SUCCESS");
  const failedPurchases = allPurchases.filter((t) => t.status === "FAILED");

  const purchasedTotal = successPurchases.reduce(
    (sum, t) => sum + Math.abs(t.amountAznCents),
    0
  );
  const depositedTotal = deposits.reduce(
    (sum, t) => sum + t.amountAznCents,
    0
  );

  const totalSavings = allPurchases.reduce(
    (sum, t) => sum + (t.savingsAznCents ?? 0),
    0
  );

  const avgOrderValueCents =
    successPurchases.length > 0
      ? Math.round(purchasedTotal / successPurchases.length)
      : 0;

  const cancellationRate =
    allPurchases.length > 0
      ? Math.round((failedPurchases.length / allPurchases.length) * 100)
      : 0;

  const lastPurchase = successPurchases[0];
  const firstPurchase = successPurchases[successPurchases.length - 1];
  const daysSinceLastPurchase = lastPurchase
    ? Math.floor(
        (Date.now() - lastPurchase.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-admin-line bg-admin-card p-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">
            {user.name ?? user.email}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user.disabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-500/40">
                <Ban className="h-3 w-3" /> BLOKLANIB
              </span>
            )}
            {user.emailVerified ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/30">
                Email təsdiqlənib
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-500/30">
                Email gözləyir
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                user.role === "ADMIN"
                  ? "bg-violet-500/15 text-violet-700 ring-violet-500/30"
                  : "bg-admin-chip text-zinc-700 ring-admin-line2"
              }`}
            >
              {user.role}
            </span>
            <TierBadge tier={effectiveTier} full />
            {effectiveTier?.isManual && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30">
                <Sparkles className="h-3 w-3" /> əl ilə
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <RoleToggle userId={user.id} role={user.role} />
            <TierSelect userId={user.id} currentTierId={user.tierId} tiers={tiers} />
            <DisableUserButton
              userId={user.id}
              disabled={user.disabled}
              isAdminTarget={user.role === "ADMIN"}
            />
          </div>
          <QuickActionsBar
            userId={user.id}
            emailVerified={user.emailVerified}
          />
        </div>
      </header>

      {user.disabled && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rose-500/20 ring-1 ring-rose-500/40">
              <Ban className="h-5 w-5 text-rose-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-rose-700">
                Bu hesab bloklanıb
              </div>
              <div className="mt-1 text-xs text-rose-700/80">
                {user.disabledAt && (
                  <>Bloklanma tarixi: <span className="font-medium">{fmtDate(user.disabledAt)}</span></>
                )}
              </div>
              {user.disabledReason && (
                <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-100">
                  <span className="text-[10px] uppercase tracking-wider text-rose-700/70">Səbəb</span>
                  <div className="mt-0.5 whitespace-pre-line">{user.disabledReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AdminNotesSection userId={user.id} notes={user.adminNotes} />

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-cyan-700" />
            Login aktivliyi
          </h2>
          <span className="text-xs text-zinc-500">
            Ümumi login: <span className="font-semibold text-zinc-700">{user.loginCount}</span>
          </span>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileField
            icon={<Calendar className="h-4 w-4" />}
            label="Son login"
            value={user.lastLoginAt ? fmtDate(user.lastLoginAt) : null}
          />
          <ProfileField
            icon={<Globe className="h-4 w-4" />}
            label="IP ünvan"
            value={user.lastLoginIp}
            mono
          />
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500">
              <Monitor className="h-4 w-4 text-zinc-600" />
              User-Agent
            </dt>
            <dd className="mt-1 truncate font-mono text-xs text-zinc-700" title={user.lastUserAgent ?? ""}>
              {user.lastUserAgent ?? "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">Profil məlumatları</h2>
        </header>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField icon={<UserIcon className="h-4 w-4" />} label="Ad Soyad" value={user.name} />
          <ProfileField icon={<Mail className="h-4 w-4" />} label="Email" value={user.email} mono />
          <ProfileField icon={<Phone className="h-4 w-4" />} label="Telefon" value={user.phone} />
          <ProfileField
            icon={<Cake className="h-4 w-4" />}
            label="Doğum tarixi"
            value={user.birthDate ? fmtDate(user.birthDate) : null}
          />
          <ProfileField
            icon={<UserIcon className="h-4 w-4" />}
            label="Cins"
            value={
              user.gender === "MALE"
                ? "Kişi"
                : user.gender === "FEMALE"
                  ? "Qadın"
                  : user.gender === "OTHER"
                    ? "Digər"
                    : null
            }
          />
          <ProfileField icon={<Hash className="h-4 w-4" />} label="Referral kodu" value={user.referralCode} mono />
          <ProfileField
            icon={<Calendar className="h-4 w-4" />}
            label="Qeydiyyat tarixi"
            value={fmtDate(user.createdAt)}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">
            PSN hesabları ({user.psnAccounts.length})
          </h2>
        </header>
        {user.psnAccounts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Bu istifadəçi hələ PSN hesabı əlavə etməyib.
          </p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {user.psnAccounts.map((p) => (
              <li key={p.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">{p.label}</span>
                      {p.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-500/30">
                          <Star className="h-3 w-3" /> Default
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/30">
                        <Gamepad2 className="h-3 w-3" /> {p.psModel}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">
                    Əlavə edilib: {fmtDate(p.createdAt)}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs text-zinc-500">PSN email</span>
                    <span className="truncate font-mono text-zinc-800">{p.psnEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs text-zinc-500">Şifrə</span>
                    <span className="truncate font-mono text-zinc-800">{p.psnPassword}</span>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-fuchsia-700" />
            Platform profilləri ({platformProfiles.length})
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            LinkedIn · YouTube
          </span>
        </header>
        {platformProfiles.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Bu istifadəçi hələ LinkedIn və ya YouTube Premium sifariş edib öz hesab məlumatlarını
            verməyib.
          </p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {platformProfiles.map((p) => {
              const accent =
                p.kind === "LINKEDIN"
                  ? "bg-sky-500/15 text-sky-700 ring-sky-500/30"
                  : "bg-red-500/15 text-red-700 ring-red-500/30";
              return (
                <li key={`${p.kind}-${p.transactionId}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${accent}`}
                        >
                          {p.brandLabel}
                        </span>
                        <span className="truncate text-sm font-semibold text-zinc-900">
                          {p.productTitle}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">
                      Sifariş: {fmtDate(p.orderedAt)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <CopyableField
                      label={p.kind === "LINKEDIN" ? "Email" : "Gmail"}
                      value={p.email}
                      mono
                    />
                    {p.password ? (
                      <CopyableField label="Şifrə" value={p.password} mono masked />
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-admin-line bg-admin-card px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                            Şifrə
                          </div>
                          <div className="mt-0.5 truncate text-sm italic text-zinc-500">
                            Saxlanılmayıb
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Wallet balance"
          value={fmtAzn(user.walletBalance)}
          icon={<Wallet className="h-4 w-4" />}
          tint="text-cyan-700 bg-cyan-500/10 ring-cyan-500/30"
        />
        <Stat
          label="Cashback"
          value={fmtAzn(user.cashbackBalanceCents)}
          tint="text-emerald-700 bg-emerald-500/10 ring-emerald-500/30"
        />
        <Stat
          label="Referral balance"
          value={fmtAzn(user.referralBalanceCents)}
          tint="text-amber-700 bg-amber-500/10 ring-amber-500/30"
        />
        <Stat
          label="Total deposited"
          value={fmtAzn(depositedTotal)}
          tint="text-fuchsia-700 bg-fuchsia-500/10 ring-fuchsia-500/30"
        />
        <Stat
          label="Total spent"
          value={fmtAzn(purchasedTotal)}
          tint="text-violet-700 bg-violet-500/10 ring-violet-500/30"
        />
      </section>

      <UserAdminActions
        userId={user.id}
        email={user.email}
        walletBalance={user.walletBalance}
        cashbackBalanceCents={user.cashbackBalanceCents}
        referralBalanceCents={user.referralBalanceCents}
        referralCode={user.referralCode}
        referredByCode={user.referredBy?.referralCode ?? null}
      />

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">Aktivlik göstəriciləri</h2>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Uğurlu sifarişlər" value={successPurchases.length.toString()} />
          <Metric
            label="Orta sifariş"
            value={successPurchases.length > 0 ? fmtAzn(avgOrderValueCents) : "—"}
          />
          <Metric
            label="Ümumi qənaət"
            value={totalSavings > 0 ? fmtAzn(totalSavings) : "—"}
            tone={totalSavings > 0 ? "emerald" : "default"}
          />
          <Metric
            label="Ləğv olunan"
            value={`${failedPurchases.length}${
              allPurchases.length > 0 ? ` (${cancellationRate}%)` : ""
            }`}
            tone={cancellationRate >= 20 ? "rose" : "default"}
          />
          <Metric
            label="Son alış"
            value={
              daysSinceLastPurchase === null
                ? "Yoxdur"
                : daysSinceLastPurchase === 0
                  ? "Bu gün"
                  : `${daysSinceLastPurchase} gün öncə`
            }
            tone={
              daysSinceLastPurchase !== null && daysSinceLastPurchase > 90
                ? "amber"
                : "default"
            }
          />
          <Metric
            label="İlk alış"
            value={firstPurchase ? fmtDate(firstPurchase.createdAt) : "Yoxdur"}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">Affiliate</h2>
        </header>
        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Referred by
            </div>
            {user.referredBy ? (
              <Link
                href={`/admin/users/${user.referredBy.id}`}
                className="mt-2 flex items-center justify-between rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm hover:border-violet-500/40"
              >
                <div>
                  <div>{user.referredBy.name ?? user.referredBy.email}</div>
                  <div className="text-xs text-zinc-500">
                    {user.referredBy.email}
                  </div>
                </div>
                <span className="font-mono text-xs text-zinc-600">
                  {user.referredBy.referralCode}
                </span>
              </Link>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                Joined directly — no referrer.
              </div>
            )}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Referred users ({user.referrals.length})
            </div>
            {user.referrals.length === 0 ? (
              <div className="mt-2 text-sm text-zinc-500">
                Nobody has used this referral code yet.
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-admin-line rounded-md border border-admin-line bg-admin-card">
                {user.referrals.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/users/${r.id}`}
                      className="flex items-center justify-between px-3 py-2 text-sm hover:bg-admin-chip"
                    >
                      <div className="min-w-0">
                        <div className="truncate">
                          {r.name ?? r.email}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {r.email} · {fmtDate(r.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] ring-1 ${
                          r.emailVerified
                            ? "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30"
                            : "bg-amber-500/15 text-amber-700 ring-amber-500/30"
                        }`}
                      >
                        {r.emailVerified ? "Verified" : "Pending"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-admin-line bg-admin-card">
          <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Heart className="h-4 w-4 text-rose-700" />
              Favorit oyunlar ({user.favorites.length})
            </h2>
          </header>
          {user.favorites.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">Favorit yoxdur.</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {user.favorites.slice(0, 12).map((f) => (
                <li key={f.gameId} className="flex items-center justify-between px-5 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-900">
                      {f.game.title}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {f.game.platform ?? "—"} · {fmtDate(f.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
              {user.favorites.length > 12 && (
                <li className="px-5 py-2 text-center text-xs text-zinc-500">
                  və daha {user.favorites.length - 12} oyun…
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-admin-line bg-admin-card">
          <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Repeat className="h-4 w-4 text-cyan-700" />
              Abunəliklər ({user.subscriptions.length})
            </h2>
          </header>
          {user.subscriptions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">Aktiv abunəlik yoxdur.</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {user.subscriptions.map((s) => (
                <li key={s.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900">
                          {s.serviceProduct.title}
                        </span>
                        <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/30">
                          {s.tier}
                        </span>
                        {s.autoRenew && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/30">
                            Auto-renew
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {s.psnAccount?.label ?? "—"} · {s.durationMonths} ay ·{" "}
                        {fmtAzn(s.priceAznCents)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Bitir: <span className="text-zinc-700">{fmtDate(s.expiresAt)}</span>
                      </div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4 text-amber-700" />
            Oyun rəyləri ({user.gameReviews.length})
          </h2>
        </header>
        {user.gameReviews.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">Rəy yazmayıb.</p>
        ) : (
          <ul className="divide-y divide-admin-line">
            {user.gameReviews.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {r.game.title}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-700">
                        <Star className="h-3 w-3 fill-current" />
                        {r.rating}/5
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-1.5 line-clamp-3 text-sm text-zinc-600">
                      {r.body}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-zinc-500">
                    {fmtDate(r.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">
            Purchases ({purchases.length})
          </h2>
        </header>
        {purchases.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <Th>Game</Th>
                  <Th>Platform</Th>
                  <Th>PSN account</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {purchases.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.game?.title ?? "—"}</Td>
                    <Td className="text-zinc-600">{t.game?.platform ?? "—"}</Td>
                    <td
                      className="max-w-[220px] truncate px-4 py-2 align-top text-zinc-600"
                      title={
                        t.psnAccount
                          ? `${t.psnAccount.label} (${t.psnAccount.psnEmail})`
                          : ""
                      }
                    >
                      {t.psnAccount
                        ? `${t.psnAccount.label} (${t.psnAccount.psnEmail})`
                        : "—"}
                    </td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-rose-700">
                      −{fmtAzn(Math.abs(t.amountAznCents))}
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-600">{fmtDate(t.createdAt)}</Td>
                    <Td className="text-right">
                      {t.status !== "FAILED" ? (
                        <CancelPurchaseButton
                          transactionId={t.id}
                          kind="game"
                          title={t.game?.title ?? "Oyun sifarişi"}
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">
            Servis sifarişləri ({servicePurchases.length})
          </h2>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            PS Plus · Gift card · TRY balance · Account
          </span>
        </header>
        {servicePurchases.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            Servis sifarişi yoxdur.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <Th>Məhsul</Th>
                  <Th>Tip</Th>
                  <Th>Kod / Detal</Th>
                  <Th>Status</Th>
                  <Th>Məbləğ</Th>
                  <Th>Tarix</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {servicePurchases.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.serviceProduct?.title ?? "—"}</Td>
                    <Td className="text-zinc-600">
                      <span className="rounded-full bg-admin-chip px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 ring-1 ring-admin-line2">
                        {t.serviceProduct?.type ?? "—"}
                      </span>
                    </Td>
                    <td className="min-w-[220px] max-w-[280px] px-4 py-2 align-top text-xs text-zinc-700">
                      {(() => {
                        const ytCreds = parseYoutubeCreds(t.metadata);
                        if (ytCreds.accounts?.length) {
                          return (
                            <div className="space-y-2">
                              {ytCreds.accounts.map((acc, idx) => (
                                <div
                                  key={idx}
                                  className="space-y-1 border-l-2 border-emerald-500/30 pl-2"
                                >
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                                    Hesab {idx + 1}
                                  </div>
                                  <CopyableField label="Email" value={acc.email} />
                                  {acc.password && (
                                    <CopyableField label="Şifrə" value={acc.password} masked mono />
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                        if (ytCreds.isYoutube && (ytCreds.gmail || ytCreds.password)) {
                          return (
                            <div className="space-y-1">
                              {ytCreds.gmail && (
                                <CopyableField label="Gmail" value={ytCreds.gmail} />
                              )}
                              {ytCreds.password && (
                                <CopyableField
                                  label="Şifrə"
                                  value={ytCreds.password}
                                  masked
                                  mono
                                />
                              )}
                            </div>
                          );
                        }
                        return (
                          <span
                            className="block max-w-[260px] truncate font-mono"
                            title={t.serviceCode?.code ?? t.metadata ?? ""}
                          >
                            {t.serviceCode?.code ?? t.metadata ?? "—"}
                          </span>
                        );
                      })()}
                    </td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="whitespace-nowrap font-medium text-rose-700">
                      −{fmtAzn(Math.abs(t.amountAznCents))}
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-600">{fmtDate(t.createdAt)}</Td>
                    <Td className="text-right">
                      {t.status !== "FAILED" ? (
                        <CancelPurchaseButton
                          transactionId={t.id}
                          kind="service"
                          title={t.serviceProduct?.title ?? "Servis sifarişi"}
                        />
                      ) : (
                        <span className="text-[11px] text-zinc-600">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {user.adminAuditEntries.length > 0 && (
        <section className="rounded-xl border border-admin-line bg-admin-card">
          <header className="flex items-center justify-between border-b border-admin-line px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ScrollText className="h-4 w-4 text-violet-700" />
              Admin əməliyyatları tarixçəsi ({user.adminAuditEntries.length})
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              Son 50 əməliyyat
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <Th>Əməliyyat</Th>
                  <Th>Admin</Th>
                  <Th>Detal</Th>
                  <Th>Tarix</Th>
                </tr>
              </thead>
            <tbody className="divide-y divide-admin-line">
              {user.adminAuditEntries.map((e) => (
                <tr key={e.id}>
                  <Td>
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] text-violet-700 ring-1 ring-violet-500/30">
                      {e.action}
                    </span>
                  </Td>
                  <Td className="text-zinc-700">
                    {e.actor
                      ? (e.actor.name ?? e.actor.email)
                      : <span className="text-zinc-500">silinmiş</span>}
                  </Td>
                  <td
                    className="max-w-md truncate px-4 py-2 align-top font-mono text-[11px] text-zinc-500"
                    title={e.details ?? ""}
                  >
                    {e.details ?? "—"}
                  </td>
                  <Td className="whitespace-nowrap text-zinc-600">
                    {fmtDate(e.createdAt)}
                  </Td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adminAdjusts.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5">
          <header className="flex items-center justify-between border-b border-amber-500/20 px-5 py-3">
            <h2 className="text-sm font-semibold text-amber-700">
              Admin manual balans dəyişiklikləri ({adminAdjusts.length})
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-amber-700/70">
              Audit
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-amber-500/5 text-xs uppercase tracking-wider text-amber-700/70">
                <tr>
                  <Th>Sahə</Th>
                  <Th>Köhnə</Th>
                  <Th>Yeni</Th>
                  <Th>Delta</Th>
                  <Th>Tarix</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {adminAdjusts.map((t) => {
                const adj = parseAdminAdjust(t.metadata);
                return (
                  <tr key={t.id}>
                    <Td className="text-zinc-800">{adj?.field ?? "wallet"}</Td>
                    <Td className="text-zinc-600">
                      {adj?.prev != null ? fmtAzn(adj.prev) : "—"}
                    </Td>
                    <Td className="text-zinc-600">
                      {adj?.next != null ? fmtAzn(adj.next) : "—"}
                    </Td>
                    <Td
                      className={`font-medium ${
                        t.amountAznCents >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {t.amountAznCents >= 0 ? "+" : ""}
                      {fmtAzn(t.amountAznCents)}
                    </Td>
                    <Td className="whitespace-nowrap text-zinc-600">{fmtDate(t.createdAt)}</Td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">
            Deposits & commissions ({userDeposits.length + user.commissions.length})
          </h2>
        </header>
        {userDeposits.length + user.commissions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">
            No wallet activity yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <Th>Type</Th>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Amount</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {[...userDeposits, ...user.commissions]
                  .sort(
                    (a, b) =>
                      b.createdAt.getTime() - a.createdAt.getTime()
                  )
                  .map((t) => (
                    <tr key={t.id}>
                      <Td>
                        <span className="rounded-full bg-admin-chip px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-700 ring-1 ring-admin-line2">
                          {t.type}
                        </span>
                      </Td>
                      <td
                        className="max-w-[260px] truncate px-4 py-2 align-top text-zinc-600"
                        title={
                          t.type === "COMMISSION" && "user" in t && t.user
                            ? `from ${t.user.email}`
                            : t.metadata ?? ""
                        }
                      >
                        {t.type === "COMMISSION" && "user" in t && t.user
                          ? `from ${t.user.email}`
                          : t.metadata ?? "—"}
                      </td>
                      <Td>
                        <StatusBadge status={t.status} />
                      </Td>
                      <Td className="whitespace-nowrap font-medium text-emerald-700">
                        +{fmtAzn(t.amountAznCents)}
                      </Td>
                      <Td className="whitespace-nowrap text-zinc-600">{fmtDate(t.createdAt)}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-zinc-500">
        <span className="text-zinc-600">{icon}</span>
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm ${value ? "text-zinc-900" : "text-zinc-500"} ${
          mono ? "font-mono" : ""
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-admin-line bg-admin-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        {icon && (
          <span className={`grid h-7 w-7 place-items-center rounded-md ring-1 ${tint}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-zinc-900";
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    FAILED: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        map[status] ?? "bg-admin-chip text-zinc-700 ring-admin-line2"
      }`}
    >
      {status}
    </span>
  );
}

function Th({
  children,
  className = "text-left",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-2 font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 align-top ${className}`}>{children}</td>;
}
