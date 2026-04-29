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
  Crown,
  ChevronDown,
  Check,
} from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";

export type PsnOption = {
  id: string;
  label: string;
  psnEmail: string;
  psModel?: string;
  isDefault: boolean;
};

export default function CartView({
  isAuthed,
  walletBalanceAzn,
  psnAccounts,
  loyaltyCashbackPct = 0,
  onRequestLogin,
  onNavigate,
}: {
  isAuthed: boolean;
  walletBalanceAzn: number;
  psnAccounts: PsnOption[];
  /** Cashback % the buyer will earn after this purchase. 0 = none. */
  loyaltyCashbackPct?: number;
  /** When provided, replaces the “login” link with a callback (used in modal flow). */
  onRequestLogin?: () => void;
  /** Fired when the user clicks any internal Link inside the cart (used to close the modal). */
  onNavigate?: () => void;
}) {
  const { items, totalAzn, setQty, remove, clear, hydrated } = useCart();
  const cashbackAzn = (totalAzn * loyaltyCashbackPct) / 100;
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
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </button>
        ) : (
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </Link>
        )}
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

      <aside className="h-fit space-y-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5 shadow-2xl backdrop-blur-md">
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Xülasə</h2>
          <div className="flex items-end justify-between border-b border-zinc-800/60 pb-4">
            <span className="text-sm text-zinc-400">
              {items.length} məhsul
            </span>
            <span className="text-2xl font-bold tabular-nums text-white">
              {totalAzn.toFixed(2)} <span className="text-sm font-medium text-zinc-400">AZN</span>
            </span>
          </div>
        </div>

        {loyaltyCashbackPct > 0 && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm">
            <span className="flex items-start gap-2 text-amber-200/90">
              <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span className="leading-snug">
                <span className="block font-medium text-amber-300">Cashback</span>
                <span className="text-[11px] text-amber-400/60">Alışdan sonra +{loyaltyCashbackPct}%</span>
              </span>
            </span>
            <span className="font-semibold tabular-nums text-amber-400">
              +{cashbackAzn.toFixed(2)} AZN
            </span>
          </div>
        )}

        {isAuthed && psnAccounts.length > 0 && (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
              <span className="flex items-center gap-1.5"><Gamepad2 className="h-3.5 w-3.5" /> Hesab</span>
              <Link
                href="/profile/accounts"
                onClick={onNavigate}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                İdarə et
              </Link>
            </label>
            {psnAccounts.length === 1 ? (
              <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{psnAccounts[0].label}</span>
                  <span className="text-xs text-zinc-500">{psnAccounts[0].psnEmail}</span>
                </div>
                {psnAccounts[0].psModel && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                    {psnAccounts[0].psModel}
                  </span>
                )}
              </div>
            ) : (
              <AccountDropdown
                accounts={psnAccounts}
                value={psnAccountId}
                onChange={setPsnAccountId}
              />
            )}
          </div>
        )}

        <div className="pt-2">
          {!isAuthed ? (
            onRequestLogin ? (
              <button
                type="button"
                onClick={onRequestLogin}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
              >
                Daxil ol və Ödə <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/login?next=/cart"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
              >
                Daxil ol və Ödə <ArrowRight className="h-4 w-4" />
              </Link>
            )
          ) : noAccounts ? (
            <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="flex items-start gap-2 text-xs text-amber-200/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                Davam etmək üçün PlayStation hesabı əlavə edin.
              </p>
              <Link
                href="/profile/accounts"
                onClick={onNavigate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Hesab əlavə et
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-zinc-950/50 px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-zinc-400">
                  <Wallet className="h-4 w-4" /> Balans
                </span>
                <span className={`font-semibold tabular-nums ${insufficient ? "text-red-400" : "text-emerald-400"}`}>
                  {walletBalanceAzn.toFixed(2)} AZN
                </span>
              </div>

              {insufficient ? (
                <Link
                  href="/profile/wallet"
                  onClick={onNavigate}
                  className="group flex w-full items-center justify-between rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
                >
                  <span>Balansı artır</span>
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs">
                    {(totalAzn - walletBalanceAzn).toFixed(2)} AZN çatmır
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={checkout}
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98] disabled:opacity-50"
                >
                  {busy ? "İşlənir…" : "Cüzdanla ödə"}
                </button>
              )}
            </div>
          )}
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
              message.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-red-500/10 text-red-300 border border-red-500/20"
            }`}
          >
            {message.kind === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            )}
            <span className="leading-snug">{message.text}</span>
          </div>
        )}

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => clear()}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Səbəti təmizlə
          </button>
        </div>
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
    <li className="flex gap-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-3 shadow-sm transition hover:border-zinc-700/60 hover:bg-zinc-900/50">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-900 shadow-inner">
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

      <div className="flex flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="line-clamp-2 text-sm font-medium text-zinc-100 leading-snug">{item.title}</p>
            <p className="mt-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              {labelForType(item.productType)}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="group rounded-lg p-1.5 transition hover:bg-red-500/10"
            aria-label="Sil"
          >
            <Trash2 className="h-4 w-4 text-zinc-500 transition group-hover:text-red-400" />
          </button>
        </div>

        <div className="flex items-end justify-between">
          {isGame ? (
            <span className="rounded-md bg-zinc-800/50 px-2 py-1 text-[10px] font-medium text-zinc-400">
              Tək lisenziya
            </span>
          ) : (
            <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950/50 p-0.5">
              <button
                type="button"
                onClick={onDecrement}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1.5rem] text-center text-xs font-semibold tabular-nums text-zinc-200">
                {item.qty}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}

          <span className="text-sm font-bold tabular-nums text-white">
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

function AccountDropdown({
  accounts,
  value,
  onChange,
}: {
  accounts: PsnOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value) || accounts[0];

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!open) return;
    const handleDocClick = () => setOpen(false);
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    
    // Add small delay to prevent immediate close on the opening click
    const timer = setTimeout(() => {
      document.addEventListener("click", handleDocClick);
      document.addEventListener("keydown", handleKeydown);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex w-full items-center justify-between rounded-lg border bg-zinc-950/50 px-3 py-2.5 text-sm transition ${
          open
            ? "border-indigo-500/50 ring-1 ring-indigo-500/50"
            : "border-zinc-800/80 hover:border-zinc-700/80"
        }`}
      >
        <div className="flex flex-col text-left">
          <span className="flex items-center gap-2 font-medium text-zinc-200">
            {selected?.label}
            {selected?.psModel && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                {selected.psModel}
              </span>
            )}
          </span>
          <span className="text-xs text-zinc-500">{selected?.psnEmail}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 z-50 mt-2 w-full origin-top overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl"
          style={{ animation: "dropdown-in 150ms ease-out forwards" }}
        >
          <div className="flex max-h-60 flex-col overflow-y-auto">
            {accounts.map((a) => {
              const isSelected = a.id === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "bg-indigo-500/10 text-indigo-300"
                      : "text-zinc-300 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {a.label}
                      {a.psModel && (
                        <span className="text-[10px] text-zinc-500 opacity-80">
                          {a.psModel}
                        </span>
                      )}
                    </span>
                    <span className="text-xs opacity-70">{a.psnEmail}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                </button>
              );
            })}
          </div>
          <style jsx>{`
            @keyframes dropdown-in {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
