"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, RefreshCcw, Send } from "lucide-react";
import {
  HONSELL_GIFT_CARD_CODE_ALPHABET,
  HONSELL_GIFT_CARD_CODE_LENGTH,
  formatHonsellGiftCardCode,
  isValidHonsellGiftCardFormat,
  normalizeHonsellGiftCardCode,
} from "@/lib/honsellGiftCardShared";

type PendingCard = {
  id: string;
  amountAznCents: number;
  purchasedAt: string; // ISO
  expiresAt: string; // ISO
  purchaser: { email: string; name: string | null } | null;
};

const dateFmt = new Intl.DateTimeFormat("az-AZ", {
  dateStyle: "medium",
  timeStyle: "short",
});

function randomCode(): string {
  let out = "";
  const a = HONSELL_GIFT_CARD_CODE_ALPHABET;
  for (let i = 0; i < HONSELL_GIFT_CARD_CODE_LENGTH; i++) {
    out += a[Math.floor(Math.random() * a.length)];
  }
  return out;
}

export default function PendingGiftCardsDelivery({ cards }: { cards: PendingCard[] }) {
  if (cards.length === 0) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <header className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-white">Təslim gözləyən kartlar</h2>
        </header>
        <p className="mt-2 text-xs text-zinc-500">
          Hazırda təslim gözləyən kart yoxdur. Yeni alış olduqda burada görünəcək.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-amber-100">
            Təslim gözləyən kartlar
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
              {cards.length}
            </span>
          </h2>
        </div>
        <p className="text-[11px] text-amber-200/70">
          Hər kart üçün 11 simvollu kodu daxil edib təslim edin. Müştəriyə avtomatik email göndəriləcək.
        </p>
      </header>

      <div className="mt-4 space-y-2">
        {cards.map((card) => (
          <DeliveryRow key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

function DeliveryRow({ card }: { card: PendingCard }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = useMemo(() => normalizeHonsellGiftCardCode(raw), [raw]);
  const valid = isValidHonsellGiftCardFormat(normalized);
  const preview = formatHonsellGiftCardCode(
    normalized.padEnd(HONSELL_GIFT_CARD_CODE_LENGTH, "•").slice(0, HONSELL_GIFT_CARD_CODE_LENGTH),
  );

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/honsell-gift-cards/deliver", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id, code: normalized }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Təslim alınmadı.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Şəbəkə xətası.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 ring-1 ring-violet-500/30">
              {(card.amountAznCents / 100).toFixed(2)} AZN
            </span>
            <span className="text-xs text-zinc-300">
              {card.purchaser?.email ?? <span className="text-zinc-500">Naməlum alıcı</span>}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Alındı: {dateFmt.format(new Date(card.purchasedAt))} · Bitir:{" "}
            {dateFmt.format(new Date(card.expiresAt))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (error) setError(null);
              }}
              placeholder="AAAA-BBB-CCCC"
              maxLength={20}
              spellCheck={false}
              autoCapitalize="characters"
              className="w-44 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-sm tracking-widest text-white outline-none focus:border-violet-500/60"
            />
            <button
              type="button"
              onClick={() => setRaw(randomCode())}
              title="Avtomatik kod yarat"
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Təslim et
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
        <span className={valid ? "font-mono text-emerald-300/90" : "font-mono text-zinc-600"}>
          {raw ? preview : "—"}
        </span>
        {error ? <span className="text-rose-400">{error}</span> : null}
      </div>
    </div>
  );
}
