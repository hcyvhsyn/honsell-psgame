"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Send,
  Copy,
  Check,
  MessageSquarePlus,
  CheckCircle2,
  Clock,
  Star,
  UserCheck,
  UserPlus,
} from "lucide-react";

type ProductOption = { id: string; title: string; priceAzn: number; type: string };

type MatchedCustomer = { id: string; name: string | null; email: string; phone: string | null };

type Invite = {
  id: string;
  token: string;
  phone: string;
  productTitle: string;
  status: string;
  name: string | null;
  reviewText: string | null;
  rating: number | null;
  userId: string | null;
  url: string;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export default function WhatsappReviewsAdminClient({
  products,
}: {
  products: ProductOption[];
}) {
  const [items, setItems] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceProductId, setServiceProductId] = useState(products[0]?.id ?? "");
  const [phone, setPhone] = useState("");

  const [matched, setMatched] = useState<MatchedCustomer | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/whatsapp-reviews");
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Telefon dəyişəndə debounced olaraq mövcud müştərini axtar.
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      setMatched(null);
      setLookingUp(false);
      return;
    }
    setLookingUp(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/whatsapp-reviews?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        setMatched(data.customer ?? null);
      } catch {
        setMatched(null);
      } finally {
        setLookingUp(false);
      }
    }, 400);
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [phone]);

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!serviceProductId) {
      setError("Məhsul seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceProductId, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dəvət yaradıla bilmədi.");
        return;
      }
      setPhone("");
      setMatched(null);
      const who = data.customer
        ? `Mövcud müştəri (${data.customer.name ?? data.customer.email}) — satış qeyd edildi.`
        : "Yeni müştəri — rəy tamamlananda hesab və satış yaranacaq.";
      setNotice(
        (data.whatsappSent
          ? "Dəvət WhatsApp-a göndərildi ✅. "
          : `Dəvət yaradıldı, WhatsApp göndərilmədi${
              data.whatsappError ? ` (${data.whatsappError})` : ""
            }. Linki əl ilə göndərin. `) + who
      );
      await load();
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Yeni dəvət formu ── */}
      <form
        onSubmit={submit}
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800">
          <MessageSquarePlus className="h-4 w-4" />
          Yeni rəy dəvəti
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Məhsul</span>
            <select
              value={serviceProductId}
              onChange={(e) => setServiceProductId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {products.length === 0 && <option value="">Məhsul yoxdur</option>}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} — {p.priceAzn.toFixed(2)} ₼
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Telefon (WhatsApp)
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+994501234567"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {/* Müştəri tanınması */}
        <div className="mt-2 min-h-[24px] text-xs">
          {lookingUp ? (
            <span className="inline-flex items-center gap-1 text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Yoxlanılır…
            </span>
          ) : matched ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" /> Mövcud müştəri:{" "}
              {matched.name ?? matched.email} · {matched.email} — təkrar qeydiyyat olmayacaq
            </span>
          ) : phone.replace(/\D/g, "").length >= 7 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">
              <UserPlus className="h-3.5 w-3.5" /> Yeni müştəri — link göndəriləcək
            </span>
          ) : null}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {notice}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Dəvət göndər
          </button>
        </div>
      </form>

      {/* ── Dəvətlər siyahısı ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-800">Göndərilmiş dəvətlər</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500">Hələ dəvət göndərilməyib.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Telefon</th>
                  <th className="px-4 py-2 font-medium">Məhsul</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((it) => {
                  const done = it.status === "SUBMITTED";
                  return (
                    <Fragment key={it.id}>
                      <tr className={done && it.reviewText ? "border-b-0" : ""}>
                        <td className="px-4 py-3 font-medium text-zinc-800">
                          {it.phone}
                          {it.userId && (
                            <span className="ml-1 inline-flex items-center align-middle text-emerald-500">
                              <UserCheck className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">
                          {it.productTitle}
                          {it.name && (
                            <span className="block text-xs text-zinc-400">{it.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {done ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Rəy yazıldı
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                              <Clock className="h-3 w-3" /> Gözləyir
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => copy(it.url, it.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                          >
                            {copied === it.id ? (
                              <>
                                <Check className="h-3 w-3" /> Kopyalandı
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" /> Linki kopyala
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                      {done && it.reviewText && (
                        <tr className="bg-zinc-50/60">
                          <td colSpan={4} className="px-4 pb-4 pt-0">
                            <div className="rounded-lg border border-zinc-200 bg-white p-3">
                              {it.rating != null && (
                                <div className="mb-1 flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star
                                      key={n}
                                      className={`h-3.5 w-3.5 ${
                                        n <= (it.rating ?? 0)
                                          ? "fill-amber-400 text-amber-400"
                                          : "fill-zinc-200 text-zinc-200"
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap text-sm text-zinc-700">
                                {it.reviewText}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
