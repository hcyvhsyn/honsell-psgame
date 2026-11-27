import Link from "next/link";
import { Gamepad2, KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import ProfileCredentialCard from "@/components/profile/ProfileCredentialCard";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";
import PsnAccountsManager, {
  type PsnAccountSummary,
} from "@/components/PsnAccountsManager";

export const dynamic = "force-dynamic";

type PlatformProfile = {
  platformKind: "LINKEDIN" | "YOUTUBE" | "OTHER";
  brandLabel: string;
  email: string;
  password: string | null;
  productTitle: string;
  orderId: string;
  orderedAt: Date;
};

function parsePlatformMetadata(metadata: string | null): {
  ok: boolean;
  platformKind: "LINKEDIN" | "YOUTUBE" | "OTHER";
  brandLabel: string;
  email?: string;
  password?: string;
} {
  if (!metadata) return { ok: false, platformKind: "OTHER", brandLabel: "" };
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    if (m.kind !== "PLATFORM") return { ok: false, platformKind: "OTHER", brandLabel: "" };
    const gmail = typeof m.gmail === "string" ? m.gmail : undefined;
    const password = typeof m.customerPassword === "string" ? m.customerPassword : undefined;
    if (!gmail) return { ok: false, platformKind: "OTHER", brandLabel: "" };

    const category = String(m.category ?? "");
    const musicBrand = String(m.musicBrand ?? "");
    const planType = String(m.planType ?? "").toUpperCase();

    if (category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM") {
      return {
        ok: true,
        platformKind: "YOUTUBE",
        brandLabel: "YouTube Premium",
        email: gmail,
        password,
      };
    }
    if (category === "WORK" && (planType === "CAREER" || planType === "BUSINESS")) {
      return {
        ok: true,
        platformKind: "LINKEDIN",
        brandLabel: `LinkedIn ${planType === "CAREER" ? "Career" : "Business"}`,
        email: gmail,
        password,
      };
    }
    return { ok: false, platformKind: "OTHER", brandLabel: "" };
  } catch {
    return { ok: false, platformKind: "OTHER", brandLabel: "" };
  }
}

export default async function ProfilesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [transactions, psnAccounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        status: "SUCCESS",
        type: { in: ["PURCHASE", "SERVICE_PURCHASE"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        metadata: true,
        createdAt: true,
        serviceProduct: { select: { title: true } },
      },
    }),
    prisma.psnAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        psnEmail: true,
        psnPassword: true,
        psModel: true,
        isDefault: true,
      },
    }),
  ]);

  const platformProfilesByKey = new Map<string, PlatformProfile>();
  for (const t of transactions) {
    const parsed = parsePlatformMetadata(t.metadata);
    if (!parsed.ok || !parsed.email) continue;
    const key = `${parsed.platformKind}::${parsed.email.toLowerCase()}`;
    if (platformProfilesByKey.has(key)) continue;
    platformProfilesByKey.set(key, {
      platformKind: parsed.platformKind,
      brandLabel: parsed.brandLabel,
      email: parsed.email,
      password: parsed.password ?? null,
      productTitle: t.serviceProduct?.title ?? parsed.brandLabel,
      orderId: t.id,
      orderedAt: t.createdAt,
    });
  }

  const platformProfiles = Array.from(platformProfilesByKey.values());
  const youtube = platformProfiles.filter((p) => p.platformKind === "YOUTUBE");
  const linkedin = platformProfiles.filter((p) => p.platformKind === "LINKEDIN");

  const psnInitial: PsnAccountSummary[] = psnAccounts.map((a) => ({
    id: a.id,
    label: a.label,
    psnEmail: a.psnEmail,
    psnPassword: a.psnPassword,
    psModel: a.psModel,
    isDefault: a.isDefault,
  }));

  // LinkedIn/YouTube satılmır (lib/storeScope.ts) — bölmələr yalnız köhnə sifarişi olana görünür.
  const otherGroups = [
    { key: "linkedin", title: "LinkedIn Premium", items: linkedin, accent: "sky" as const, emailLabel: "LinkedIn email", kind: "LINKEDIN" as const, iconClass: "text-sky-500 dark:text-sky-300" },
    { key: "youtube", title: "YouTube Premium", items: youtube, accent: "rose" as const, emailLabel: "Gmail ünvanı", kind: "YOUTUBE" as const, iconClass: "text-red-500 dark:text-red-300" },
  ].filter((g) => g.items.length > 0);

  return (
    <section className="space-y-6">
      <ProfilePageHeader
        title="PSN hesablarım"
        description={
          <>
            Oyun və PS Plus sifarişlərinin yüklənəcəyi Türkiyə PSN hesabları. Yalnız sənə görünür — səbətdə
            hansına yükləniləcəyini seçirsən.{" "}
            <Link href="/hesab-acma" className="font-semibold text-violet-700 hover:underline dark:text-violet-300">
              TR hesabın yoxdur? Açaq
            </Link>
          </>
        }
      />

      <ProfileGroup
        title="PSN hesabları"
        icon={<Gamepad2 className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />}
        count={psnInitial.length}
      >
        <PsnAccountsManager initial={psnInitial} />
      </ProfileGroup>

      {otherGroups.length > 0 && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {otherGroups.map((g) => (
            <ProfileGroup
              key={g.key}
              title={g.title}
              icon={<KeyRound className={`h-4 w-4 ${g.iconClass}`} />}
              count={g.items.length}
            >
              {g.items.map((p) => (
                <ProfileCredentialCard
                  key={`${g.key}-${p.email}-${p.orderId}`}
                  accent={g.accent}
                  topLabel={p.brandLabel}
                  title={p.productTitle}
                  subtitle={`Sifariş: ${fmtDate(p.orderedAt)}`}
                  email={p.email}
                  password={p.password}
                  emailLabel={g.emailLabel}
                  deleteIdentity={{ platformKind: g.kind, email: p.email }}
                />
              ))}
            </ProfileGroup>
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileGroup({
  title,
  icon,
  count,
  emptyHint,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  /** Verildikdə count == 0 olduqda children əvəzinə bu hint göstərilir. Verilməyibsə
   *  group həmişə children-i render edir (məs. PsnAccountsManager öz “add” UI-na malikdir). */
  emptyHint?: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  const showEmptyHint = count === 0 && emptyHint;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800/70 dark:bg-zinc-900/30">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {icon}
          {title}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
            {count}
          </span>
        </h2>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="text-xs font-medium text-fuchsia-300 transition hover:text-fuchsia-200"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="mt-4">
        {showEmptyHint ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30">
            {emptyHint}
          </p>
        ) : count === 0 ? (
          children
        ) : (
          <div className="grid gap-3">{children}</div>
        )}
      </div>
    </div>
  );
}

