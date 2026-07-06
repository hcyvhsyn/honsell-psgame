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
  Reply,
  ImagePlus,
  X,
} from "lucide-react";
import { uploadAdminImage } from "@/lib/uploadImageClient";

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
  testimonialId: string | null;
  adminReply: string | null;
  adminReplyImageUrl: string | null;
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [phone, setPhone] = useState("");

  function toggleProduct(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedProducts = selectedIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is ProductOption => Boolean(p));
  const totalAzn = selectedProducts.reduce((sum, p) => sum + p.priceAzn, 0);

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
    if (selectedIds.length === 0) {
      setError("Ən azı bir məhsul seçin.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceProductIds: selectedIds, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dəvət yaradıla bilmədi.");
        return;
      }
      setPhone("");
      setMatched(null);
      setSelectedIds([]);
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

        <div className="space-y-4">
          <div>
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600">
              <span>Məhsul(lar) — müştəri birdən çox ala bilər</span>
              {selectedIds.length > 0 && (
                <span className="text-zinc-500">
                  {selectedIds.length} seçildi · cəmi {totalAzn.toFixed(2)} ₼
                </span>
              )}
            </span>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-300 p-1">
              {products.length === 0 && (
                <p className="px-2 py-2 text-sm text-zinc-500">Məhsul yoxdur</p>
              )}
              {products.map((p) => {
                const checked = selectedIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      checked ? "bg-violet-50 text-violet-900" : "hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 accent-violet-600"
                    />
                    <span className="flex-1">{p.title}</span>
                    <span className="text-xs text-zinc-500">{p.priceAzn.toFixed(2)} ₼</span>
                  </label>
                );
              })}
            </div>
            {selectedProducts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedProducts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800"
                  >
                    {p.title}
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className="text-violet-500 hover:text-violet-700"
                      aria-label="Sil"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <label className="block sm:max-w-xs">
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
                              {it.testimonialId && (
                                <ReplyEditor
                                  testimonialId={it.testimonialId}
                                  initialReply={it.adminReply}
                                  initialImageUrl={it.adminReplyImageUrl}
                                />
                              )}
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

// ── Admin cavabı redaktoru (hər rəy üçün) ──
function ReplyEditor({
  testimonialId,
  initialReply,
  initialImageUrl,
}: {
  testimonialId: string;
  initialReply: string | null;
  initialImageUrl: string | null;
}) {
  const [reply, setReply] = useState(initialReply ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const hasSaved = Boolean(initialReply || initialImageUrl);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await uploadAdminImage("/api/admin/whatsapp-reviews/image-upload", file);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setImageUrl(res.url);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/whatsapp-reviews/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonialId, reply, imageUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Yadda saxlanmadı.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      setError("Şəbəkə xətası.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
        <Reply className="h-3.5 w-3.5" />
        Honsell cavabı {hasSaved && <span className="font-normal text-violet-400">· dərc olunub</span>}
      </div>
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={1000}
        placeholder="Müştəriyə cavab yaz…"
        className="w-full resize-none rounded-md border border-violet-200 bg-white px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none"
      />

      {imageUrl && (
        <div className="mt-2 inline-flex items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Cavab şəkli" className="h-20 w-20 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            className="rounded-full bg-zinc-200 p-1 text-zinc-600 hover:bg-zinc-300"
            aria-label="Şəkli sil"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-2 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onPickImage}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-white disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
          {imageUrl ? "Şəkli dəyiş" : "Şəkil əlavə et"}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3" /> : null}
          {saved ? "Saxlanıldı" : "Cavabı yadda saxla"}
        </button>
      </div>
    </div>
  );
}
