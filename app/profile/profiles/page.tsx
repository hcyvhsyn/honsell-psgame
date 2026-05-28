import Link from "next/link";
import { Gamepad2, KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import ProfileCredentialCard from "@/components/profile/ProfileCredentialCard";
import PsnAccountsManager, {
  type PsnAccountSummary,
} from "@/components/PsnAccountsManager";
import EpicAccountsManager, {
  type EpicAccountSummary,
} from "@/components/EpicAccountsManager";

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

  const [transactions, psnAccounts, epicAccounts] = await Promise.all([
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
    prisma.epicAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        firstName: true,
        lastName: true,
        epicEmail: true,
        epicPassword: true,
        displayName: true,
        isDefault: true,
      },
    }),
  ]);

  const epicInitial: EpicAccountSummary[] = epicAccounts.map((a) => ({
    id: a.id,
    label: a.label,
    firstName: a.firstName,
    lastName: a.lastName,
    epicEmail: a.epicEmail,
    epicPassword: a.epicPassword,
    displayName: a.displayName,
    isDefault: a.isDefault,
  }));

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

  return (
    <section className="space-y-6">
      <header>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
          <KeyRound className="h-3.5 w-3.5" />
          Profillerim
        </div>
        <h2 className="mt-1 text-2xl font-bold text-white">Saxlanılan hesablar</h2>
        <p className="mt-1 text-sm text-zinc-400">
          PSN, LinkedIn, YouTube və digər platformalar üçün verdiyin email/şifrə məlumatları.
          Yalnız sənə görünür, yeni sifariş zamanı sənə kolaylıq olsun deyə burada saxlanılır.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ProfileGroup
          title="PSN hesabları"
          icon={<Gamepad2 className="h-4 w-4 text-indigo-300" />}
          count={psnInitial.length}
        >
          <PsnAccountsManager initial={psnInitial} />
        </ProfileGroup>

        <ProfileGroup
          title="Epic hesabları"
          icon={<Gamepad2 className="h-4 w-4 text-violet-300" />}
          count={epicInitial.length}
        >
          <EpicAccountsManager initial={epicInitial} />
        </ProfileGroup>

        <ProfileGroup
          title="LinkedIn Premium"
          icon={<KeyRound className="h-4 w-4 text-sky-300" />}
          count={linkedin.length}
          emptyHint="Hələ LinkedIn Premium almamısan."
        >
          {linkedin.map((p) => (
            <ProfileCredentialCard
              key={`linkedin-${p.email}-${p.orderId}`}
              accent="sky"
              topLabel={p.brandLabel}
              title={p.productTitle}
              subtitle={`Sifariş: ${fmtDate(p.orderedAt)}`}
              email={p.email}
              password={p.password}
              emailLabel="LinkedIn email"
              deleteIdentity={{ platformKind: "LINKEDIN", email: p.email }}
            />
          ))}
        </ProfileGroup>

        <ProfileGroup
          title="YouTube Premium"
          icon={<KeyRound className="h-4 w-4 text-red-300" />}
          count={youtube.length}
          emptyHint="Hələ YouTube Premium almamısan."
        >
          {youtube.map((p) => (
            <ProfileCredentialCard
              key={`youtube-${p.email}-${p.orderId}`}
              accent="rose"
              topLabel={p.brandLabel}
              title={p.productTitle}
              subtitle={`Sifariş: ${fmtDate(p.orderedAt)}`}
              email={p.email}
              password={p.password}
              emailLabel="Gmail ünvanı"
              deleteIdentity={{ platformKind: "YOUTUBE", email: p.email }}
            />
          ))}
        </ProfileGroup>
      </div>
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
    <div className="rounded-2xl border border-zinc-800/70 bg-zinc-900/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-200">
          {icon}
          {title}
          <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-300">
            {count}
          </span>
        </h3>
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
          <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-xs text-zinc-500">
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

