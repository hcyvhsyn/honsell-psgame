"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Package, Sparkles, Wallet } from "lucide-react";

import ProductImage from "@/components/ProductImage";
import LootBoxPrizeModal, { type OpenedPrize } from "@/components/LootBoxPrizeModal";
import type { RevealPrize } from "@/components/LootBoxReveal";
import { useSession } from "@/components/SessionProvider";
import { formatAzn, type PublicOddsRow } from "@/lib/lootBoxShared";

export type LootBoxDetail = {
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  minPrizeCents: number;
  maxPrizeCents: number;
  sellBackPct: number;
  dailyLimitPerUser: number;
  inStock: boolean;
};

export type WinnerRow = {
  id: string;
  name: string;
  title: string;
  imageUrl: string | null;
  valueAznCents: number;
  createdAt: string;
};

/**
 * Qutu detal səhifəsi.
 *
 * Qutu məlumatı serverdən ISR ilə gəlir; istifadəçi vəziyyəti (balans) isə
 * `useSession()` ilə client-də yüklənir ki, səhifə statik qala bilsin.
 */
export default function LootBoxClient({
  box,
  odds,
  winners: initialWinners,
}: {
  box: LootBoxDetail;
  odds: PublicOddsRow[];
  winners: WinnerRow[];
}) {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<OpenedPrize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState(initialWinners);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  useEffect(() => {
    if (user) setBalanceCents(user.walletBalanceCents ?? 0);
  }, [user]);

  // Reveal lentini doldurmaq üçün son qazananların şəkillərindən istifadə edirik.
  const fillers: RevealPrize[] = winners.slice(0, 12).map((w) => ({
    gameId: w.id,
    title: w.title,
    imageUrl: w.imageUrl,
    valueAznCents: w.valueAznCents,
  }));

  const refreshWinners = useCallback(() => {
    fetch(`/api/loot-boxes/${box.slug}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.winners && setWinners(d.winners))
      .catch(() => {});
  }, [box.slug]);

  async function open() {
    if (!user) {
      router.push(`/login?next=/qutu/${box.slug}`);
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`/api/loot-boxes/${box.slug}/open`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Qutu açıla bilmədi.");

      setOpened({
        openingId: data.openingId,
        prize: data.prize,
        sellBackCents: data.sellBackCents,
        pricePaidCents: data.pricePaidCents,
      });
      setBalanceCents(data.walletBalanceAfter);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setOpening(false);
    }
  }

  const canAfford = balanceCents == null || balanceCents >= box.priceAznCents;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Sol: qutu */}
        <div>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-900 to-slate-950 dark:border-slate-800">
            <div className="flex h-64 items-center justify-center">
              {box.imageUrl ? (
                <ProductImage src={box.imageUrl} alt={box.title} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-24 w-24 text-white/20" />
              )}
            </div>
          </div>

          <h1 className="mt-5 text-3xl font-black text-slate-900 dark:text-white">{box.title}</h1>
          {box.description && (
            <p className="mt-2 text-slate-600 dark:text-slate-400">{box.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Ən az {formatAzn(box.minPrizeCents)}
            </span>
            <span className="rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-3 py-1 font-bold text-white">
              Ən çox {formatAzn(box.maxPrizeCents)}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              İstəməsən {box.sellBackPct}% balansa
            </span>
          </div>

          {/* Ehtimal cədvəli — tam şəffaflıq */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-amber-500" /> Qazanma şansları
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Bütün ehtimallar açıq göstərilir — gizli heç nə yoxdur.
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2">Hədiyyə dəyəri</th>
                    <th className="px-4 py-2">Şans</th>
                    <th className="px-4 py-2">Nisbət</th>
                  </tr>
                </thead>
                <tbody>
                  {odds.map((row) => (
                    <tr key={row.valueAznCents} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">
                        {formatAzn(row.valueAznCents)}
                      </td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.pct.toFixed(1)}%</td>
                      <td className="px-4 py-2">
                        <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600"
                            style={{ width: `${Math.max(2, row.pct)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {odds.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                        Bu qutu hazırlanır.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Son qazananlar */}
          {winners.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Son qazananlar</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {winners.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <div className="h-12 w-10 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage src={w.imageUrl} alt={w.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{w.title}</div>
                      <div className="text-xs text-slate-500">{w.name}</div>
                    </div>
                    <div className="shrink-0 text-sm font-black text-amber-500">
                      {formatAzn(w.valueAznCents)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sağ: açma paneli */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-sm text-slate-500">Qutu qiyməti</div>
            <div className="text-4xl font-black text-slate-900 dark:text-white">
              {formatAzn(box.priceAznCents)}
            </div>

            {!sessionLoading && user && balanceCents != null && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Wallet className="h-4 w-4" /> Balansınız: {formatAzn(balanceCents)}
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
                {error}
              </div>
            )}

            {!box.inStock ? (
              <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Bu qutu hazırda bitib
              </div>
            ) : (
              <button
                type="button"
                onClick={open}
                disabled={opening}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-5 py-3.5 text-base font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {opening ? <Loader2 className="h-5 w-5 animate-spin" /> : <Package className="h-5 w-5" />}
                {opening ? "Açılır…" : "Qutunu aç"}
              </button>
            )}

            {!sessionLoading && user && !canAfford && (
              <Link
                href="/profile/wallet"
                className="mt-3 block rounded-full border border-slate-300 px-5 py-2.5 text-center text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                Balans yüklə
              </Link>
            )}

            {box.dailyLimitPerUser > 0 && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Günlük limit: {box.dailyLimitPerUser} açılış
              </p>
            )}

            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>• Ödəniş cüzdan balansından tutulur.</li>
              <li>• Hədiyyəni istəməsən {box.sellBackPct}% balansa qaytara bilərsən.</li>
              <li>• Oyun adi sifariş kimi çatdırılır.</li>
            </ul>
          </div>
        </div>
      </div>

      <LootBoxPrizeModal
        opened={opened}
        fillers={fillers}
        onClose={() => {
          setOpened(null);
          refreshWinners();
          router.refresh();
        }}
        onResolved={(outcome) => {
          if (outcome === "SOLD_BACK" && opened) {
            setBalanceCents((b) => (b == null ? b : b + opened.sellBackCents));
          }
        }}
      />
    </div>
  );
}
