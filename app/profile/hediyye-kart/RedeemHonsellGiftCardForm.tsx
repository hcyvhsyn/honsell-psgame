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
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6">
      <div className="grid gap-2 text-xs text-zinc-500 sm:flex sm:items-center sm:justify-between">
        <span>Hazırkı cüzdan balansı</span>
        <span className="text-base font-semibold text-white sm:text-sm">
          {currentWalletAzn.toFixed(2)} AZN
        </span>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        <label className="block text-xs font-medium text-zinc-400">
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
          placeholder="XXXX-XXX-XXXX"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-white outline-none focus:border-violet-500/60"
        />
        <div className="text-[11px] text-zinc-500">
          {normalized.length}/{HONSELL_GIFT_CARD_CODE_LENGTH} simvol
        </div>

        <button
          type="submit"
          disabled={!isComplete || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 transition disabled:cursor-not-allowed disabled:opacity-50 hover:from-violet-500 hover:to-fuchsia-500"
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

      {result?.kind === "success" && (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Check className="h-4 w-4" /> Uğurla aktivləşdirildi
          </div>
          <p className="mt-2 text-xs text-emerald-200/80">
            <span className="font-mono">{result.formattedCode}</span> kartı üzrə {" "}
            <b>{result.creditedAzn.toFixed(2)} AZN</b> cüzdan balansına köçürüldü.
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">
            Yeni balans: <b>{result.newWalletBalanceAzn.toFixed(2)} AZN</b>
          </p>
        </div>
      )}

      {result?.kind === "error" && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {result.text}
        </div>
      )}
    </section>
  );
}
