"use client";

import { useEffect, useState } from "react";

type Game = {
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

type Preview = {
  weekStart: string;
  newGames: number;
  games: Game[];
  activeRecipients: number;
  alreadySentThisWeek: number;
  pendingThisWeek: number;
  unsubscribed: number;
};

type SendStats = {
  newGames: number;
  recipients: number;
  sent: number;
  skippedDedup: number;
  failed: number;
  errors: string[];
};

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className="mt-1 text-xs text-zinc-400">{label}</div>
    </div>
  );
}

export default function DiscountDigestClient() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/discount-digest", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPreview(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Önizləmə yüklənmədi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPreview();
  }, []);

  async function sendNow() {
    if (!preview) return;
    const ok = window.confirm(
      `${preview.pendingThisWeek} aktiv müştəriyə ${preview.newGames} endirimlik bülleten göndərilsin?`
    );
    if (!ok) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/discount-digest", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data.stats);
      await loadPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Göndərmə alınmadı");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-zinc-400">Yüklənir…</div>;
  }

  if (error && !preview) {
    return (
      <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!preview) return null;

  const nothingToSend = preview.newGames === 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Bu həftə yeni endirim" value={preview.newGames} />
        <Stat label="Aktiv alıcı" value={preview.activeRecipients} />
        <Stat label="Bu həftə göndərilib" value={preview.alreadySentThisWeek} />
        <Stat label="Gözləyən (təkrarsız)" value={preview.pendingThisWeek} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendNow}
          disabled={sending || nothingToSend || preview.pendingThisWeek === 0}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Göndərilir…" : "İndi göndər"}
        </button>
        <button
          type="button"
          onClick={loadPreview}
          disabled={sending}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-40"
        >
          Yenilə
        </button>
        <span className="text-xs text-zinc-500">
          {preview.unsubscribed} nəfər abunəlikdən çıxıb
        </span>
      </div>

      {nothingToSend && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          Son 7 gündə yeni endirim aşkarlanmayıb — bülleten göndərilməyəcək.
        </div>
      )}

      {preview.pendingThisWeek === 0 && !nothingToSend && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400">
          Bu həftəki bülleten artıq bütün aktiv müştərilərə göndərilib.
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4 text-sm text-emerald-200">
          <div className="font-semibold">Göndəriş tamamlandı</div>
          <div className="mt-1 text-emerald-300/80">
            Göndərildi: {result.sent} · Təkrar (keçildi): {result.skippedDedup} ·
            Uğursuz: {result.failed}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-rose-300">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {preview.games.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">
            Bülletendə görünəcək oyunlar (önizləmə)
          </h2>
          <div className="space-y-2">
            {preview.games.map((g) => (
              <div
                key={g.productId}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
              >
                {g.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{g.title}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">
                    {g.originalAzn != null && (
                      <span className="mr-2 line-through">{g.originalAzn.toFixed(2)} AZN</span>
                    )}
                    <span className="font-semibold text-white">{g.finalAzn.toFixed(2)} AZN</span>
                  </div>
                </div>
                {g.discountPct != null && (
                  <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-1 text-xs font-bold text-violet-300">
                    -{g.discountPct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
