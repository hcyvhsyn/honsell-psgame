"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gamepad2, Loader2, Package, Sparkles, Wallet } from "lucide-react";

import Modal from "@/components/Modal";
import ProductImage from "@/components/ProductImage";
import LootBoxPrizeModal, { type OpenedPrize } from "@/components/LootBoxPrizeModal";
import type { ShowcasePrizeData } from "@/components/LootBoxCard";
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
  // Köhnə ISR keşindən gələn cavabda bu sahə olmaya bilər — səhifə çökməsin.
  showcase = [],
  catalog = [],
}: {
  box: LootBoxDetail;
  odds: PublicOddsRow[];
  winners: WinnerRow[];
  /** Hovuzdaki real oyun nümunələri — rulet lenti bununla dolur. */
  showcase?: ShowcasePrizeData[];
  /** Hovuzdaki BÜTÜN oyunlar — "nə qazana bilərəm?" siyahısı. */
  catalog?: ShowcasePrizeData[];
}) {
  const { user, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState<OpenedPrize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [winners, setWinners] = useState(initialWinners);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [showAllCatalog, setShowAllCatalog] = useState(false);

  useEffect(() => {
    if (user) setBalanceCents(user.walletBalanceCents ?? 0);
  }, [user]);

  // Lent hovuzdaki real oyunlarla dolur; hovuz hələ yoxdursa son qazananlarla.
  const fillers: RevealPrize[] =
    showcase.length > 0
      ? showcase.map((s) => ({
          gameId: s.gameId,
          title: s.title,
          imageUrl: s.imageUrl,
          valueAznCents: s.valueAznCents,
        }))
      : winners.slice(0, 12).map((w) => ({
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
    // Təkrar açılışda köhnə hədiyyə modalı dərhal bağlanmalıdır, yoxsa yeni
    // nəticə gələnə qədər müştəri əvvəlki hədiyyəyə baxmağa davam edir.
    setOpened(null);
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`/api/loot-boxes/${box.slug}/open`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Qutu açıla bilmədi (HTTP ${res.status}).`);

      setOpened({
        openingId: data.openingId,
        orderCode: data.orderCode,
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
            {/* `relative` məcburidir — ProductImage `fill` işlədir. */}
            <div className="relative flex h-64 items-center justify-center">
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

          {/* Hovuzdaki bütün oyunlar — müştərinin əsas sualı: "nə qazana bilərəm?" */}
          {catalog.length > 0 && (
            <div className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
                <Gamepad2 className="h-5 w-5 text-fuchsia-500" /> Bu qutudan çıxa bilən oyunlar
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Hovuzdakı <strong>{catalog.length}</strong> oyunun hamısı burada. Qutunu açanda
                yalnız bu siyahıdan bir oyun çıxa bilər.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(showAllCatalog ? catalog : catalog.slice(0, 12)).map((g) => (
                  <div
                    key={g.gameId}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    {/* `relative` məcburidir — ProductImage `fill` işlədir. */}
                    <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage src={g.imageUrl} alt={g.title} className="h-full w-full object-cover" sizes="44px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{g.title}</div>
                      <div className="text-sm font-black text-amber-500">{formatAzn(g.valueAznCents)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {catalog.length > 12 && (
                <button
                  type="button"
                  onClick={() => setShowAllCatalog((v) => !v)}
                  className="mt-3 rounded-full border border-slate-300 px-5 py-2 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                >
                  {showAllCatalog ? "Yığ" : `Hamısını göstər (${catalog.length})`}
                </button>
              )}
            </div>
          )}

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
                    <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg">
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

      {/* Təkrar açılışda ekran boş qalmasın — nəticə gələnə qədər gözləmə. */}
      {opening && (
        <Modal open onClose={() => undefined} size="sm">
          <div className="relative overflow-hidden p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">Qutu hazırlanır…</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {box.title} üçün şansın seçilir. Bir az gözlə.
            </p>
          </div>
        </Modal>
      )}

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
        onOpenAgain={box.inStock ? () => void open() : undefined}
      />
    </div>
  );
}
