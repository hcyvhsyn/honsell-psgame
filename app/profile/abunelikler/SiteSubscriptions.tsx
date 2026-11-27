import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, ChevronDown, Gamepad2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtManat } from "@/lib/format";
import { withServiceFeeCents } from "@/lib/cartServiceFee";
import { STREAMING_SERVICE_LABELS, addMonths } from "@/lib/streamingCart";
import { backfillPlatformSubscriptionsForUser } from "@/lib/subscriptions";
import { readPlatformMeta } from "@/lib/platformSubscriptions";
import {
  DaysLeft,
  SubBrandIcon,
  daysLeftOf,
  fmtBakuDate,
  subBrandOf,
  type SubBrand,
} from "@/components/profile/subscriptionUi";
import AutoRenewToggle from "./AutoRenewToggle";

/**
 * Saytdan alınan abunəliklər (PS Plus / EA Play — cüzdandan avtomatik uzanma; saytdan alınmış streaming;
 * köhnə AI). /profile/abunelikler səhifəsi bunları üç yerə bölür (2026-11 redizayn):
 *   - `SiteActiveSubscriptions` — aktivlər, ən yuxarıda (CRM kartları ilə eyni görünüş),
 *   - `PastSubscriptions` — hamısının bitmişləri, aşağıda bir yığılan blok (əvvəl hər növ üçün ayrıca idi),
 *   - `PsPlusPromo` — aktiv PS Plus yoxdursa ən aşağıda bir sətir (əvvəl boş blok CRM siyahısının üstündə idi).
 * (2026-11-ə qədər ayrıca "Aktiv abunəliklər" səhifəsi idi — /profile/subscriptions indi yönləndirir.)
 */

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktiv",
  EXPIRED: "Bitib",
  CANCELLED: "Ləğv edilib",
  CANCELED: "Ləğv edilib",
  PAUSED: "Dayandırılıb",
};

function daysUntil(d: Date): number {
  const ms = new Date(d).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Avtomatik uzanan abunəlik (PS Plus / EA Play / köhnə AI) — `Subscription` sətri. */
type RenewableCard = {
  kind: "renewable";
  id: string;
  brand: SubBrand;
  title: string;
  detail: string | null;
  expiresAt: Date;
  months: number;
  autoRenew: boolean;
  /** Xidmət haqqı daxil (cron eyni məbləği tutur). */
  renewCents: number;
};

/** Saytdan alınmış streaming — uzanma yoxdur, yalnız müddət. */
type StreamingCard = {
  kind: "streaming";
  id: string;
  brand: SubBrand;
  title: string;
  detail: string;
  expiresAt: Date;
};

export type SiteActiveCard = RenewableCard | StreamingCard;
export type SitePastRow = { id: string; title: string; range: string; status: string; sortAt: number };

export type SiteSubscriptionsData = {
  active: SiteActiveCard[];
  past: SitePastRow[];
  hasActivePsPlus: boolean;
  walletCents: number;
};

export async function loadSiteSubscriptions(user: { id: string; walletBalance: number }): Promise<SiteSubscriptionsData> {
  // Köhnə AI/PLATFORM alışları üçün çatışmayan Subscription sətirləri — hələ aktiv köhnə abunəlikdə
  // avtomatik uzanma açarı görünsün.
  await backfillPlatformSubscriptionsForUser(user.id);

  const [subscriptions, streamingPurchases, aiPurchases] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      include: {
        serviceProduct: { select: { title: true, type: true, metadata: true } },
        psnAccount: { select: { label: true, psnEmail: true, psModel: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "SERVICE_PURCHASE", status: "SUCCESS", serviceProduct: { type: "STREAMING" } },
      orderBy: { createdAt: "desc" },
      include: { serviceProduct: { select: { id: true, title: true, metadata: true, type: true } } },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: "SERVICE_PURCHASE", status: "SUCCESS", serviceProduct: { type: "PLATFORM" } },
      orderBy: { createdAt: "desc" },
      include: { serviceProduct: { select: { id: true, title: true, metadata: true, type: true } } },
    }),
  ]);

  const renewableSubs = subscriptions.filter(
    (s) =>
      s.serviceProduct.type === "PS_PLUS" ||
      s.serviceProduct.type === "EA_PLAY" ||
      (s.serviceProduct.type === "PLATFORM" && s.tier === "AI"),
  );
  const range = (from: Date, to: Date) => `${fmtBakuDate(from)} → ${fmtBakuDate(to)}`;

  const active: SiteActiveCard[] = [];
  const past: SitePastRow[] = [];

  for (const s of renewableSubs) {
    const isAi = s.serviceProduct.type === "PLATFORM";
    if (s.status !== "ACTIVE") {
      past.push({ id: s.id, title: s.serviceProduct.title, range: range(s.startsAt, s.expiresAt), status: s.status, sortAt: s.expiresAt.getTime() });
      continue;
    }
    active.push({
      kind: "renewable",
      id: s.id,
      brand: isAi ? "ai" : s.serviceProduct.type === "EA_PLAY" ? "ea" : "playstation",
      title: s.serviceProduct.title,
      detail: s.psnAccount ? `PSN: ${s.psnAccount.label} (${s.psnAccount.psnEmail})` : null,
      expiresAt: s.expiresAt,
      months: s.durationMonths,
      autoRenew: s.autoRenew,
      renewCents: withServiceFeeCents(s.priceAznCents),
    });
  }

  // Subscription sətrinə düşməmiş köhnə (bitmiş) AI alışları — yalnız tarixçədə.
  const aiSubTxIds = new Set(renewableSubs.map((s) => s.lastRenewalTxId).filter((v): v is string => !!v));
  for (const p of aiPurchases) {
    const m = (p.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
    if (String(m.category ?? "") !== "AI" || aiSubTxIds.has(p.id)) continue;
    const months = readPlatformMeta(m).durationMonths ?? 0;
    const expiresAt = months > 0 ? addMonths(p.createdAt, months) : p.createdAt;
    past.push({ id: p.id, title: p.serviceProduct?.title ?? "AI abunəlik", range: range(p.createdAt, expiresAt), status: "EXPIRED", sortAt: expiresAt.getTime() });
  }

  const now = Date.now();
  for (const p of streamingPurchases) {
    const m = (p.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
    const serviceKey = String(m.service ?? "");
    const label = STREAMING_SERVICE_LABELS[serviceKey] ?? serviceKey;
    const months = Number(m.durationMonths ?? 0);
    const seats = Number(m.seats ?? 1);
    const title = p.serviceProduct?.title ?? "Streaming";
    const expiresAt = months > 0 ? addMonths(p.createdAt, months) : p.createdAt;
    if (expiresAt.getTime() <= now) {
      past.push({ id: p.id, title: `${label} · ${title}`, range: range(p.createdAt, expiresAt), status: "EXPIRED", sortAt: expiresAt.getTime() });
      continue;
    }
    active.push({
      kind: "streaming",
      id: p.id,
      brand: subBrandOf(`${label} ${title}`),
      title,
      detail: `${seats} nəfər · ${months} ay`,
      expiresAt,
    });
  }

  active.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  past.sort((a, b) => b.sortAt - a.sortAt);

  return {
    active,
    past,
    hasActivePsPlus: active.some((c) => c.brand === "playstation" || c.brand === "ea"),
    walletCents: user.walletBalance,
  };
}

const cardCls = "honsell-glow-card rounded-3xl p-4 sm:p-5";

export function SiteActiveSubscriptions({ data }: { data: SiteSubscriptionsData }) {
  if (data.active.length === 0) return null;
  return (
    <ul className="space-y-4">
      {data.active.map((c) => (
        <li key={c.id} className={cardCls}>
          <div className="flex items-start gap-3">
            <SubBrandIcon brand={c.brand} />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-black leading-tight text-zinc-900 dark:text-white sm:text-lg">{c.title}</h3>
              {c.detail && <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{c.detail}</p>}
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
                Bitir: <span className="font-bold text-zinc-900 dark:text-white">{fmtBakuDate(c.expiresAt)}</span>
              </p>
            </div>
            <DaysLeft {...daysLeftOf(daysUntil(c.expiresAt))} />
          </div>
          {c.kind === "renewable" && <AutoRenewRow card={c} walletCents={data.walletCents} />}
        </li>
      ))}
    </ul>
  );
}

function AutoRenewRow({ card, walletCents }: { card: RenewableCard; walletCents: number }) {
  const lowBalance = card.autoRenew && daysUntil(card.expiresAt) <= 3 && walletCents < card.renewCents;
  return (
    <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-zinc-900 dark:text-white">Avtomatik uzat</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {card.autoRenew
              ? `Bitəndə balansdan ${fmtManat(card.renewCents)} (xidmət haqqı daxil) tutulur, ${card.months} ay uzanır`
              : "Söndürülüb — bitəndə uzanmayacaq"}
          </p>
        </div>
        <AutoRenewToggle subscriptionId={card.id} initial={card.autoRenew} />
      </div>
      {lowBalance && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-rose-500/30 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            Balans çatmır: {fmtManat(card.renewCents)} lazımdır, balansında {fmtManat(walletCents)} var.
          </span>
          <Link
            href="/profile/wallet"
            className="shrink-0 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-black text-white transition hover:bg-rose-500"
          >
            Balansı artır
          </Link>
        </div>
      )}
    </div>
  );
}

/** Bütün bitmiş abunəliklər — bir yığılan blok (default bağlı; `<details>` JS-siz işləyir). */
export function PastSubscriptions({ rows }: { rows: SitePastRow[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group honsell-glow-card overflow-hidden rounded-3xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-black text-zinc-900 dark:text-white sm:px-5 [&::-webkit-details-marker]:hidden">
        Bitmiş abunəliklər ({rows.length})
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="max-h-[280px] divide-y divide-zinc-200 overflow-y-auto border-t border-zinc-200 dark:divide-white/10 dark:border-white/10">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{r.title}</p>
              <p className="text-xs text-zinc-500">{r.range}</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-zinc-500">{STATUS_LABEL[r.status] ?? r.status}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Aktiv PS Plus yoxdursa — ən aşağıda bir sətir (boş blok əsas siyahının üstündə yer tuturdu). */
export function PsPlusPromo() {
  return (
    <Link
      href="/ps-plus"
      className="group honsell-glow-card flex items-center gap-3 rounded-3xl px-4 py-3 sm:px-5"
    >
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ background: "#0070d1", color: "#ffffff" }}
      >
        <Gamepad2 className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-zinc-900 dark:text-white">PS Plus və EA Play</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">Saytdan alanda burada görünür və avtomatik uzanır</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-violet-600 transition group-hover:translate-x-0.5 dark:text-violet-300" aria-hidden />
    </Link>
  );
}
