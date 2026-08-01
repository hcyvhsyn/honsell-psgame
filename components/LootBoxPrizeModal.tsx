"use client";

import { useState } from "react";
import Link from "next/link";
import { Gamepad2, Loader2, Wallet } from "lucide-react";

import Modal from "./Modal";
import ProductImage from "./ProductImage";
import LootBoxReveal, { type RevealPrize } from "./LootBoxReveal";
import { formatAzn } from "@/lib/lootBoxShared";

/**
 * Açılışdan sonra hədiyyə seçimi.
 *
 * Əvvəlcə reveal animasiyası oynayır, sonra iki seçim görünür:
 *   • Oyunu götür  → adi sifariş kimi PENDING olur, admin çatdırır
 *   • Balansa sat  → dəyərin `sellBackPct` faizi dərhal cüzdana yazılır
 *
 * PSN/Epic hesabı yoxdursa server 400 qaytarır və istifadəçi profil linkinə
 * yönləndirilir (hesab seçimini server default hesabla özü həll edir).
 */

export type OpenedPrize = {
  openingId: string;
  prize: RevealPrize & { store: string | null };
  sellBackCents: number;
  pricePaidCents: number;
};

export default function LootBoxPrizeModal({
  opened,
  fillers,
  onClose,
  onResolved,
}: {
  opened: OpenedPrize | null;
  fillers: RevealPrize[];
  onClose: () => void;
  onResolved: (outcome: "CLAIMED_GAME" | "SOLD_BACK") => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState<"GAME" | "SELL_BACK" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAccount, setNeedsAccount] = useState(false);
  const [done, setDone] = useState<"CLAIMED_GAME" | "SOLD_BACK" | null>(null);

  if (!opened) return null;

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
      if (!res.ok) {
        if (data.code === "NO_PSN_ACCOUNT" || data.code === "NO_EPIC_ACCOUNT") setNeedsAccount(true);
        throw new Error(data.error ?? "Əməliyyat alınmadı.");
      }
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
      <div className="p-5 sm:p-6">
        {!revealed ? (
          <>
            <h2 className="mb-4 text-center text-xl font-black text-slate-900 dark:text-white">
              Qutu açılır…
            </h2>
            <LootBoxReveal
              prize={opened.prize}
              fillers={fillers}
              priceAznCents={opened.pricePaidCents}
              onDone={() => setRevealed(true)}
            />
          </>
        ) : done ? (
          <div className="py-6 text-center">
            <div className="text-4xl">{done === "SOLD_BACK" ? "💰" : "🎮"}</div>
            <h2 className="mt-3 text-xl font-black text-slate-900 dark:text-white">
              {done === "SOLD_BACK" ? "Balansa yazıldı" : "Sifariş yaradıldı"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
              {done === "SOLD_BACK"
                ? `${formatAzn(opened.sellBackCents)} cüzdanınıza əlavə edildi.`
                : "Oyun sifarişiniz hazırlanır — adi alış kimi operatorumuz sizinlə əlaqə saxlayacaq."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-gradient-to-r from-amber-500 to-fuchsia-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"
            >
              Bağla
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl">
                <ProductImage
                  src={opened.prize.imageUrl}
                  alt={opened.prize.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Qazandınız</div>
                <div className="truncate text-lg font-black text-slate-900 dark:text-white">
                  {opened.prize.title}
                </div>
                <div className="text-xl font-black text-amber-500">
                  {formatAzn(opened.prize.valueAznCents)}
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Nə etmək istəyirsiniz? Oyunu götürə, ya da istəmirsinizsə balansa sata bilərsiniz.
            </p>

            {error && (
              <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
                {error}
                {needsAccount && (
                  <Link href="/profile/accounts" className="ml-1 underline">
                    Hesab əlavə et
                  </Link>
                )}
              </div>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy != null}
                onClick={() => choose("GAME")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-fuchsia-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {busy === "GAME" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gamepad2 className="h-4 w-4" />}
                Oyunu götür
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => choose("SELL_BACK")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {busy === "SELL_BACK" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                Balansa sat — {formatAzn(opened.sellBackCents)}
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              Seçimi sonra da edə bilərsiniz — hədiyyə profilinizdə saxlanılır.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
