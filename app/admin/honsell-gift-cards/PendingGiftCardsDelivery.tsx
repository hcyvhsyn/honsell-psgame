"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Send } from "lucide-react";

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

export default function PendingGiftCardsDelivery({ cards }: { cards: PendingCard[] }) {
  if (cards.length === 0) {
    return (
      <section className="rounded-2xl border border-admin-line bg-admin-card p-5">
        <header className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Təslim gözləyən kartlar</h2>
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
          <Clock className="h-4 w-4 text-amber-700" />
          <h2 className="text-sm font-semibold text-amber-100">
            Təslim gözləyən kartlar
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-700">
              {cards.length}
            </span>
          </h2>
        </div>
        <p className="text-[11px] text-amber-700/70">
          Hər kart üçün “Təslim et” düyməsinə basın — sistem unikal kodu avtomatik yaradacaq,
          müştəriyə email və WhatsApp ilə təsdiq göndəriləcək.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/honsell-gift-cards/deliver", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: card.id }),
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
    <div className="rounded-xl border border-admin-line bg-admin-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700 ring-1 ring-violet-500/30">
              {(card.amountAznCents / 100).toFixed(2)} AZN
            </span>
            <span className="text-xs text-zinc-700">
              {card.purchaser?.email ?? <span className="text-zinc-500">Naməlum alıcı</span>}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Alındı: {dateFmt.format(new Date(card.purchasedAt))} · Bitir:{" "}
            {dateFmt.format(new Date(card.expiresAt))}
          </div>
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
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

      {error ? (
        <div className="mt-2 text-[11px] text-rose-600">{error}</div>
      ) : null}
    </div>
  );
}
