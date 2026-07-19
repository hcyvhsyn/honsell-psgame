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
import { REVIEW_CATEGORY_OPTIONS } from "@/lib/reviewCategoryShared";

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
  const [category, setCategory] = useState(""); // "" = avtomatik (məhsula görə)

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
        body: JSON.stringify({ serviceProductIds: selectedIds, phone, platform: category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Dəvət yaradıla bilmədi.");
        return;
      }
      setPhone("");
      setMatched(null);
      setSelectedIds([]);
      setCategory("");
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
      <form
        onSubmit={submit}
        className="rounded-2xl border border-admin-line bg-admin-card p-5 shadow-sm"
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          <MessageSquarePlus className="h-4 w-4" />
          Yeni rəy dəvəti
        </div>

        <div className="space-y-4">
          <div>
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <span>Məhsul(lar) — müştəri birdən çox ala bilər</span>
              {selectedIds.length > 0 && (
                <span className="text-zinc-500 dark:text-zinc-400">
                  {selectedIds.length} seçildi · cəmi {totalAzn.toFixed(2)} ₼
                </span>
              )}
            </span>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-admin-line bg-admin-chip/40 p-1">
              {products.length === 0 && (
                <p className="px-2 py-2 text-sm text-zinc-500 dark:text-zinc-400">Məhsul yoxdur</p>
              )}
              {products.map((p) => {
                const checked = selectedIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                      checked
                        ? "bg-violet-500/15 text-violet-700 dark:text-violet-200"
                        : "text-zinc-700 hover:bg-admin-chip2 dark:text-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 accent-violet-600"
                    />
                    <span className="flex-1">{p.title}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.priceAzn.toFixed(2)} ₼</span>
                  </label>
                );
              })}
            </div>
            {selectedProducts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedProducts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-200"
                  >
                    {p.title}
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      className="text-violet-500 transition hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-100"
                      aria-label="Sil"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="block sm:max-w-xs sm:flex-1">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Telefon (WhatsApp)
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+994501234567"
                className="w-full rounded-lg border border-admin-line bg-admin-chip px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </label>

            <label className="block sm:max-w-xs sm:flex-1">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Rəy kateqoriyası
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-admin-line bg-admin-chip px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 dark:text-zinc-100"
              >
                {REVIEW_CATEGORY_OPTIONS.map((o) => (
                  <option key={o.code || "auto"} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-2 min-h-[24px] text-xs">
          {lookingUp ? (
            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Yoxlanılır…
            </span>
          ) : matched ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
              <UserCheck className="h-3.5 w-3.5" /> Mövcud müştəri:{" "}
              {matched.name ?? matched.email} · {matched.email} — təkrar qeydiyyat olmayacaq
            </span>
          ) : phone.replace(/\D/g, "").length >= 7 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 font-medium text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
              <UserPlus className="h-3.5 w-3.5" /> Yeni müştəri — link göndəriləcək
            </span>
          ) : null}
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {notice}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Dəvət göndər
          </button>
        </div>
      </form>

      {/* ── Dəvətlər siyahısı ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-100">Göndərilmiş dəvətlər</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Hələ dəvət göndərilməyib.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-admin-line bg-admin-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-admin-chip text-left text-xs text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Telefon</th>
                  <th className="px-4 py-2 font-medium">Məhsul</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {items.map((it) => {
                  const done = it.status === "SUBMITTED";
                  return (
                    <Fragment key={it.id}>
                      <tr className={done && it.reviewText ? "border-b-0" : "transition hover:bg-admin-chip/40"}>
                        <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-100">
                          {it.phone}
                          {it.userId && (
                            <span className="ml-1 inline-flex items-center align-middle text-emerald-500 dark:text-emerald-400">
                              <UserCheck className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                          {it.productTitle}
                          {it.name && (
                            <span className="block text-xs text-zinc-400 dark:text-zinc-500">{it.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {done ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Rəy yazıldı
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
                              <Clock className="h-3 w-3" /> Gözləyir
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => copy(it.url, it.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-admin-line bg-admin-chip px-2 py-1 text-xs text-zinc-700 transition hover:bg-admin-chip2 dark:text-zinc-300"
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
                        <tr className="bg-admin-chip/30">
                          <td colSpan={4} className="px-4 pb-4 pt-0">
                            <div className="rounded-lg border border-admin-line bg-admin-card p-3">
                              {it.rating != null && (
                                <div className="mb-1 flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <Star
                                      key={n}
                                      className={`h-3.5 w-3.5 ${
                                        n <= (it.rating ?? 0)
                                          ? "fill-amber-400 text-amber-400"
                                          : "fill-zinc-300 text-zinc-300 dark:fill-zinc-700 dark:text-zinc-700"
                                      }`}
                                    />
                                  ))}
                                </div>
                              )}
                              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
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
    <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/10 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-200">
        <Reply className="h-3.5 w-3.5" />
        Honsell cavabı {hasSaved && <span className="font-normal text-violet-500/80 dark:text-violet-300/70">· dərc olunub</span>}
      </div>
      <textarea
        rows={2}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={1000}
        placeholder="Müştəriyə cavab yaz…"
        className="w-full resize-none rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />

      {imageUrl && (
        <div className="mt-2 inline-flex items-start gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Cavab şəkli" className="h-20 w-20 rounded-md border border-admin-line object-cover" />
          <button
            type="button"
            onClick={() => setImageUrl(null)}
            className="rounded-full bg-admin-chip p-1 text-zinc-600 transition hover:bg-admin-chip2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            aria-label="Şəkli sil"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}

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
          className="inline-flex items-center gap-1 rounded-lg border border-admin-line bg-admin-chip px-2 py-1 text-xs text-zinc-700 transition hover:bg-admin-chip2 disabled:opacity-60 dark:text-zinc-300"
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
