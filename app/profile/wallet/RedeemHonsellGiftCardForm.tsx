"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import {
  HONSELL_GIFT_CARD_CODE_LENGTH,
  formatHonsellGiftCardCode,
  normalizeHonsellGiftCardCode,
} from "@/lib/honsellGiftCardShared";

type Result =
  | { kind: "success"; formattedCode: string; creditedAzn: number; newWalletBalanceAzn: number }
  | { kind: "error"; text: string };

export default function RedeemHonsellGiftCardForm({
  currentWalletAzn,
}: {
  currentWalletAzn: number;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const normalized = normalizeHonsellGiftCardCode(code);
  const isComplete = normalized.length === HONSELL_GIFT_CARD_CODE_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/gift-cards/honsell/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setResult({
          kind: "success",
          formattedCode: data.formattedCode ?? formatHonsellGiftCardCode(normalized),
          creditedAzn: Number(data.creditedAzn ?? 0),
          newWalletBalanceAzn: Number(data.newWalletBalanceAzn ?? currentWalletAzn),
        });
        setCode("");
        router.refresh();
      } else {
        setResult({ kind: "error", text: data?.error ?? "Aktivləşdirmə uğursuz oldu." });
      }
    } catch {
      setResult({ kind: "error", text: "Şəbəkə xətası. Yenidən cəhd et." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <label className="sr-only" htmlFor="honsell-gift-code">
          Hədiyyə kart kodu
        </label>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          value={code}
          onChange={(e) => {
            const v = e.target.value;
            // 11 simvol limiti, ancaq defislərlə birlikdə (4-3-4) görüntülənir
            const cleaned = normalizeHonsellGiftCardCode(v).slice(0, HONSELL_GIFT_CARD_CODE_LENGTH);
            setCode(formatHonsellGiftCardCode(cleaned));
          }}
          id="honsell-gift-code"
          placeholder="XXXX-XXX-XXXX"
          aria-describedby="honsell-gift-code-hint"
          className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-center font-mono text-base tracking-[0.25em] text-zinc-900 outline-none focus:border-violet-500/60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white sm:flex-1"
        />

        <button
          type="submit"
          disabled={!isComplete || busy}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Yoxlanılır…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Aktivləşdir
            </>
          )}
        </button>
      </form>
      <p id="honsell-gift-code-hint" className="mt-1.5 text-[11px] text-zinc-500">
        {normalized.length}/{HONSELL_GIFT_CARD_CODE_LENGTH} simvol · kartın məbləği dərhal cüzdana köçür
      </p>

      {result?.kind === "success" && (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
            <Check className="h-4 w-4" /> Uğurla aktivləşdirildi
          </div>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-200/80">
            <span className="font-mono">{result.formattedCode}</span> kartı üzrə {" "}
            <b>{result.creditedAzn.toFixed(2)} ₼</b> cüzdan balansına köçürüldü.
          </p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-200/80">
            Yeni balans: <b>{result.newWalletBalanceAzn.toFixed(2)} ₼</b>
          </p>
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-200">
          {result.text}
        </div>
      )}
    </div>
  );
}
