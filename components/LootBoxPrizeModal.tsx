"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Gamepad2, Loader2, RotateCcw, Sparkles, Wallet } from "lucide-react";

import Modal from "./Modal";
import ProductImage from "./ProductImage";
import LootBoxReveal, { type RevealPrize } from "./LootBoxReveal";
import { formatAzn, PRIZE_TIER_LABELS, prizeTierFor, type PrizeTier } from "@/lib/lootBoxShared";

/**
 * Açılışdan sonra hədiyyə seçimi.
 *
 * Əvvəlcə reveal animasiyası oynayır, sonra iki seçim görünür:
 *   • Oyunu götür  → adi sifariş kimi PENDING olur, admin çatdırır
 *   • Balansa sat  → dəyərin `sellBackPct` faizi dərhal cüzdana yazılır
 */

export type OpenedPrize = {
  openingId: string;
  /** "BOX-A1B2C3" — müştəri hədiyyəni bu kodla soruşur. */
  orderCode: string;
  prize: RevealPrize & { store: string | null };
  sellBackCents: number;
  pricePaidCents: number;
};

const CHOICE_TIER_CHIPS: Record<PrizeTier, string> = {
  COMMON: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  STANDARD: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  RARE: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  LEGENDARY: "bg-gradient-to-r from-amber-500 to-fuchsia-600 text-white",
};

export default function LootBoxPrizeModal({
  opened,
  fillers,
  onClose,
  onResolved,
  onOpenAgain,
}: {
  opened: OpenedPrize | null;
  fillers: RevealPrize[];
  onClose: () => void;
  onResolved: (outcome: "CLAIMED_GAME" | "SOLD_BACK") => void;
  /** Verilsə "Yenidən şansını yoxla" düyməsi görünür və yeni açılış başlayır. */
  onOpenAgain?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<"GAME" | "SELL_BACK" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [done, setDone] = useState<"CLAIMED_GAME" | "SOLD_BACK" | null>(null);
  const openingId = opened?.openingId;

  useEffect(() => {
    if (!openingId) return;
    setRevealed(false);
    setBusy(null);
    setError(null);
    setNeedsAccount(false);
    setDone(null);
  }, [openingId]);

  if (!opened) return null;

  const tier = prizeTierFor(opened.prize.valueAznCents, opened.pricePaidCents);

  async function choose(choice: "GAME" | "SELL_BACK") {
    if (!opened) return;
    setBusy(choice);
    setError(null);
    setNeedsAccount(false);
    try {
      const res = await fetch(`/api/loot-boxes/openings/${opened.openingId}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Əməliyyat alınmadı (HTTP ${res.status}).`);
      // Hesab yoxsa sifariş yenə yaranır — sadəcə operator məlumatı soracaq.
      setNeedsAccount(Boolean(data.needsAccountInfo));
      setDone(data.outcome);
      onResolved(data.outcome);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="relative overflow-hidden p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-fuchsia-400/10" />
        <div aria-hidden className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-amber-300/10" />

        {!revealed ? (
          <div className="relative">
            <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> Premium açılış
            </div>
            <h2 className="text-center text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Qutu açılır…
            </h2>
            <p className="mx-auto mb-4 mt-1 max-w-sm text-center text-sm text-slate-500 dark:text-slate-400">
              Şansın seçilir, rulet dayanır və hədiyyən görünür.
            </p>
            <LootBoxReveal
              prize={opened.prize}
              fillers={fillers}
              priceAznCents={opened.pricePaidCents}
              onDone={() => setRevealed(true)}
            />
            {/* Animasiyanı gözləmək məcburi olmamalıdır — nəticə onsuz da hazırdır. */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="text-xs font-bold text-slate-500 underline underline-offset-4 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Keç — nə qazandığımı göstər
              </button>
            </div>
          </div>
        ) : done ? (
          <div className="relative py-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/25">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
              {done === "SOLD_BACK" ? "Balansa yazıldı" : "Sifariş yaradıldı"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {done === "SOLD_BACK" ? (
                <>
                  <strong>{formatAzn(opened.sellBackCents)}</strong> cüzdanınıza əlavə edildi.
                  İstədiyiniz məhsula xərcləyə bilərsiniz.
                </>
              ) : (
                <>
                  <strong>{opened.prize.title}</strong> sifarişiniz yaradıldı. Operatorumuz sizinlə
                  əlaqə saxlayıb oyunu hesabınıza yükləyəcək — əlavə heç nə etməyinizə ehtiyac yoxdur.
                </>
              )}
            </p>

            {/* Sifariş kodu olmasa müştəri "hədiyyəmi kimdən soruşum?" vəziyyətində qalır. */}
            {opened.orderCode && (
              <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-black tracking-wider text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                Sifariş kodu: {opened.orderCode}
              </p>
            )}

            {/* Hesab yoxdursa bu xəta DEYİL — sifariş yaranıb, sadəcə məlumat
                lazımdır. İstəsə indi əlavə edir, istəməsə operator soruşur. */}
            {needsAccount && done === "CLAIMED_GAME" && (
              <div className="mx-auto mt-4 max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-xs leading-5 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                Hesabınız qeydə alınmayıb. Problem yoxdur — operatorumuz sizinlə əlaqə saxlayıb
                PSN məlumatlarınızı soruşacaq. İstəsəniz indi özünüz əlavə edə bilərsiniz ki,
                çatdırılma daha tez olsun:{" "}
                <Link href="/profile/profiles" className="font-black underline">
                  Hesab əlavə et
                </Link>
              </div>
            )}

            <div className="mt-5 flex flex-col items-center gap-2">
              {/* Ən çox istənən addım budur — açılışdan sonra dərhal yenidən oynamaq. */}
              {onOpenAgain && (
                <button
                  type="button"
                  onClick={onOpenAgain}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-6 py-3 text-sm font-black text-white shadow-sm transition-transform hover:-translate-y-0.5"
                >
                  <RotateCcw className="h-4 w-4" /> Yenidən şansını yoxla
                </button>
              )}
              <Link
                href={done === "SOLD_BACK" ? "/profile/wallet" : "/profile/orders"}
                className={
                  onOpenAgain
                    ? "rounded-full border border-slate-300 px-6 py-2.5 text-sm font-bold text-slate-700 transition-transform hover:-translate-y-0.5 dark:border-slate-600 dark:text-slate-200"
                    : "rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5"
                }
              >
                {done === "SOLD_BACK" ? "Balansa bax" : "Sifarişə bax"}
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-500 underline underline-offset-4 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Bağla və davam et
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="mb-5 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">
                <Sparkles className="h-3.5 w-3.5" /> Hədiyyən hazırdır
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Seçimini et</h2>
            </div>

            <div className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-fuchsia-50/80 p-4 dark:border-white/10 dark:from-amber-400/[0.08] dark:via-white/[0.04] dark:to-fuchsia-400/[0.08]">
              <div className="flex items-center gap-4">
                {/* `relative` məcburidir — ProductImage `fill` işlədir. */}
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/20 bg-white/10">
                  <ProductImage
                    src={opened.prize.imageUrl}
                    alt={opened.prize.title}
                    className="h-full w-full object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${CHOICE_TIER_CHIPS[tier]}`}>
                    <Sparkles className="h-3 w-3" /> {PRIZE_TIER_LABELS[tier]}
                  </span>
                  <div className="mt-2 truncate text-lg font-black text-slate-900 dark:text-white">
                    {opened.prize.title}
                  </div>
                  <div className="text-xl font-black text-amber-500">{formatAzn(opened.prize.valueAznCents)}</div>
                </div>
              </div>
            </div>

            {/* Hər variantın NƏ edəcəyi açıq yazılır — "hədiyyəm haradadır?"
                sualı ümumiyyətlə yaranmasın. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <div className="mb-1 flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                  <Gamepad2 className="h-3.5 w-3.5" /> Oyunu götür
                </div>
                Adi alış kimi sifariş yaranır. Operatorumuz WhatsApp/e-poçt ilə sizinlə əlaqə
                saxlayır və oyunu PSN hesabınıza yükləyir. Gedişatı{" "}
                <strong>Profil → Sifarişlər</strong> bölməsindən izləyirsiniz.
              </div>
              <div className="rounded-2xl border border-slate-200 p-3 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <div className="mb-1 flex items-center gap-1.5 font-black text-slate-900 dark:text-white">
                  <Wallet className="h-3.5 w-3.5" /> Balansa sat
                </div>
                Oyunu istəmirsinizsə (məsələn artıq sizdədirsə){" "}
                <strong>{formatAzn(opened.sellBackCents)}</strong> dərhal cüzdanınıza yazılır və
                istədiyiniz məhsula xərcləyə bilərsiniz.
              </div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy != null}
                onClick={() => choose("GAME")}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy === "GAME" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                Oyunu götür
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => choose("SELL_BACK")}
                className="flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 transition-transform hover:-translate-y-0.5 hover:border-fuchsia-300 disabled:opacity-60 dark:border-slate-600 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-fuchsia-400/50"
              >
                {busy === "SELL_BACK" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Balansa sat — {formatAzn(opened.sellBackCents)}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              Seçimi sonra da edə bilərsiniz — hədiyyə profilinizdə saxlanılır.
            </p>

            {/* Seçim etməmiş yenidən açmaq təhlükəsizdir: bu hədiyyə itmir,
                profildə "seçim gözləyir" kimi qalır. */}
            {onOpenAgain && (
              <div className="mt-4 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={onOpenAgain}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-black text-amber-700 transition-transform hover:-translate-y-0.5 disabled:opacity-60 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
                >
                  <RotateCcw className="h-4 w-4" /> Yenidən şansını yoxla
                </button>
                <p className="mt-2 text-[11px] text-slate-500">
                  Bu hədiyyə itmir — profilinizdə seçim gözləyəcək.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
