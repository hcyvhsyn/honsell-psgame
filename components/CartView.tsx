"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  AlertTriangle,
} from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

export type PsnOption = {
  id: string;
  label: string;
  psnEmail: string;
  isDefault: boolean;
};

export default function CartView({
  isAuthed,
  walletBalanceAzn,
  psnAccounts,
}: {
  isAuthed: boolean;
  walletBalanceAzn: number;
  psnAccounts: PsnOption[];
}) {
  const { items, totalAzn, setQty, remove, clear, hydrated } = useCart();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  // Default to the user's flagged-default PSN account; fall back to the first.
  const defaultId = psnAccounts.find((a) => a.isDefault)?.id ?? psnAccounts[0]?.id ?? "";
  const [psnAccountId, setPsnAccountId] = useState<string>(defaultId);

  useEffect(() => {
    setPsnAccountId(defaultId);
  }, [defaultId]);

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
        Səbət yüklənir…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">Səbətin boşdur.</p>
        <Link
          href="/"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Oyunlara bax
        </Link>
      </div>
    );
  }

  const insufficient = isAuthed && walletBalanceAzn < totalAzn;
  const noAccounts = isAuthed && psnAccounts.length === 0;

  async function checkout() {
    if (!isAuthed || noAccounts) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, qty: i.qty })),
          psnAccountId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        clear();
        const target = data.deliveredTo?.label ?? "hesabına";
        setMessage({
          kind: "ok",
          text: `Alış tamamlandı — ${data.purchaseCount} məhsul ${target} hesabına çatdırıldı. Yeni balans: ${data.newBalanceAzn.toFixed(2)} AZN.`,
        });
      } else {
        setMessage({ kind: "error", text: data.error ?? "Sifariş alınmadı." });
      }
    } catch {
      setMessage({ kind: "error", text: "Şəbəkə xətası. Yenidən cəhd et." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-3">
        {items.map((item) => (
          <CartLine
            key={item.id}
            item={item}
            onIncrement={() => setQty(item.id, item.qty + 1)}
            onDecrement={() => setQty(item.id, item.qty - 1)}
            onRemove={() => remove(item.id)}
          />
        ))}
      </ul>

      <aside className="h-fit space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Məhsul</span>
          <span className="font-medium">{items.length}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Cəmi</span>
          <span className="text-lg font-semibold text-white">
            {totalAzn.toFixed(2)} AZN
          </span>
        </div>

        {isAuthed && psnAccounts.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs uppercase tracking-wide text-zinc-500">
              <Gamepad2 className="h-3.5 w-3.5" /> Çatdırılma hesabı
            </label>
            {psnAccounts.length === 1 ? (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                <p className="font-medium">{psnAccounts[0].label}</p>
                <p className="text-xs text-zinc-500">{psnAccounts[0].psnEmail}</p>
              </div>
            ) : (
              <select
                value={psnAccountId}
                onChange={(e) => setPsnAccountId(e.target.value)}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                {psnAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.psnEmail}
                    {a.isDefault ? " (əsas)" : ""}
                  </option>
                ))}
              </select>
            )}
            <Link
              href="/profile/accounts"
              className="mt-1.5 inline-block text-xs text-indigo-400 hover:text-indigo-300"
            >
              Hesabları idarə et →
            </Link>
          </div>
        )}

        <div className="border-t border-zinc-800 pt-4">
          {!isAuthed ? (
            <Link
              href="/login?next=/cart"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Sifariş üçün daxil ol <ArrowRight className="h-4 w-4" />
            </Link>
          ) : noAccounts ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Sifarişi haraya çatdıracağımızı bilmək üçün PlayStation hesabı əlavə et.
              </p>
              <Link
                href="/profile/accounts"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                PSN hesabı əlavə et
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Cüzdan balansı
                </span>
                <span
                  className={
                    insufficient ? "text-red-400" : "text-zinc-200 font-medium"
                  }
                >
                  {walletBalanceAzn.toFixed(2)} AZN
                </span>
              </div>

              {insufficient ? (
                <Link
                  href="/wallet"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                >
                  Cüzdanı doldur ({(totalAzn - walletBalanceAzn).toFixed(2)} AZN
                  çatmır)
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={checkout}
                  disabled={busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {busy ? "İşlənir…" : "Cüzdanla ödə"}
                </button>
              )}
            </>
          )}
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
              message.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-red-500/10 text-red-300"
            }`}
          >
            {message.kind === "ok" && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => clear()}
          className="w-full text-xs text-zinc-500 hover:text-zinc-300"
        >
          Səbəti təmizlə
        </button>
      </aside>
    </div>
  );
}

function CartLine({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const isGame = item.productType === "GAME";
  return (
    <li className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-zinc-900">
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="80px"
            className="object-cover"
            unoptimized
          />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {labelForType(item.productType)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
            aria-label="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          {isGame ? (
            <span className="text-xs text-zinc-500">Tək lisenziya</span>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-md border border-zinc-800">
              <button
                type="button"
                onClick={onDecrement}
                className="rounded-l-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[1.5rem] text-center text-sm font-medium">
                {item.qty}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className="rounded-r-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <span className="text-sm font-semibold">
            {(item.finalAzn * item.qty).toFixed(2)} AZN
          </span>
        </div>
      </div>
    </li>
  );
}

function labelForType(t: string) {
  switch (t) {
    case "GAME":
      return "Oyun";
    case "ADDON":
      return "Əlavə / DLC";
    case "CURRENCY":
      return "Pul kartı";
    default:
      return "Digər";
  }
}
