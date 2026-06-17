"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  X,
  Users,
  Gamepad2,
  MessageSquare,
  Mail,
  Send,
  Loader2,
  Check,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type Tier = { id: string; name: string };

type Game = {
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

type ManualUser = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  emailVerified: boolean;
};

type AudienceStats = {
  total: number;
  withEmail: number;
  withPhone: number;
  unsubscribed: number;
  cooledDown: number;
  sample: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    emailVerified: boolean;
    unsubscribed: boolean;
  }>;
};

// finalAzn/originalAzn AZN onluq vahidindədir (cents deyil) — 100-ə bölmə yoxdur.
function fmtAzn(aznValue: number): string {
  return `${aznValue.toFixed(2)} AZN`;
}

const STORE_BASE = "https://honsell.store";

/** Müştəri tərəfi — server `buildCampaignWhatsappText` ilə eyni format. */
const REVIEW_DEFAULT_TITLE = "Təcrübəni paylaş 💬";
const REVIEW_DEFAULT_MESSAGE =
  "Salam! Honsell-dən aldığın məhsuldan razı qaldınmı? Təcrübəni bizimlə paylaş — rəyin digər müştərilərə kömək edir və bizə daha yaxşı xidmət üçün dəstək olur. Cəmi bir neçə saniyə çəkir.";

function buildReviewWhatsappPreview(messageText: string): string {
  const lines: string[] = [];
  const intro = messageText.trim();
  if (intro) lines.push(intro, "");
  lines.push("⭐ Rəyini bura yaz:");
  lines.push(`   ${STORE_BASE}/#reyler`);
  lines.push("");
  lines.push("— Honsell PS Store");
  return lines.join("\n");
}

function buildWhatsappPreview(messageText: string, games: Game[]): string {
  const lines: string[] = [];
  const intro = messageText.trim();
  if (intro) lines.push(intro, "");
  for (const g of games) {
    const price = fmtAzn(g.finalAzn);
    if (g.originalAzn != null && g.discountPct != null) {
      lines.push(`🎮 ${g.title}`);
      lines.push(`   ${price}  (əvvəl ${fmtAzn(g.originalAzn)}, -${g.discountPct}%)`);
    } else {
      lines.push(`🎮 ${g.title} — ${price}`);
    }
    lines.push(`   ${STORE_BASE}/oyunlar/${g.productId}`);
  }
  if (games.length) lines.push("");
  lines.push("— Honsell PS Store");
  return lines.join("\n");
}

export default function CampaignComposer({
  tiers,
  initialGames,
  waConfigured,
}: {
  tiers: Tier[];
  initialGames: Game[];
  waConfigured: boolean;
}) {
  const router = useRouter();

  // ── Campaign kind ──
  const [kind, setKind] = useState<"PROMO" | "REVIEW_INVITE">("PROMO");
  const isReview = kind === "REVIEW_INVITE";

  // ── Message ──
  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");

  // ── Channels ──
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(waConfigured);

  // ── Games ──
  const [gameQuery, setGameQuery] = useState("");
  const [games, setGames] = useState<Game[]>(initialGames);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [selected, setSelected] = useState<Map<string, Game>>(new Map());

  // ── Audience filters ──
  const [emailVerified, setEmailVerified] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [hasOrders, setHasOrders] = useState(false);
  const [purchasedNotReviewed, setPurchasedNotReviewed] = useState(false);
  const [tierId, setTierId] = useState<string>("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  // Anti-spam: son N gündə mesaj alanları çıxar (0 = söndür).
  const [cooldownDays, setCooldownDays] = useState(7);

  // ── Manual include / exclude ──
  const [manualUsers, setManualUsers] = useState<ManualUser[]>([]);
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set());
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<ManualUser[]>([]);

  // ── Audience preview ──
  const [audience, setAudience] = useState<AudienceStats | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // ── Send ──
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  // Göndərişin modal-içi nəticəsi — admin aydın görsün, sonra özü bağlasın.
  const [sendResult, setSendResult] = useState<
    | { ok: true; recipientCount: number; emailSent: number; emailFailed: number; waSent: number; waFailed: number }
    | { ok: false; message: string }
    | null
  >(null);

  // ── Preview ──
  const [previewTab, setPreviewTab] = useState<"whatsapp" | "email">("whatsapp");
  const [emailHtml, setEmailHtml] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const selectedGames = useMemo(() => [...selected.values()], [selected]);

  // Debounced game search.
  useEffect(() => {
    const q = gameQuery.trim();
    const t = setTimeout(async () => {
      setGamesLoading(true);
      try {
        const res = await fetch(`/api/admin/campaigns/games?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setGames(data.games ?? []);
      } catch {
        /* ignore */
      } finally {
        setGamesLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [gameQuery]);

  // Debounced user search (manual add).
  useEffect(() => {
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/campaigns/users?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setUserResults(data.users ?? []);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  // Email önizləməsi — yalnız Email tab açıq olanda serverdən HTML çək (debounced).
  useEffect(() => {
    if (previewTab !== "email") return;
    // Promo-da oyun yoxdursa önizləmə yoxdur; rəy dəvətində oyun lazım deyil.
    if (kind === "PROMO" && selectedGames.length === 0) {
      setEmailHtml("");
      return;
    }
    const t = setTimeout(async () => {
      setEmailLoading(true);
      try {
        const res = await fetch("/api/admin/campaigns/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            kind,
            messageText,
            productIds: selectedGames.map((g) => g.productId),
          }),
        });
        const data = await res.json();
        setEmailHtml(data.emailHtml ?? "");
      } catch {
        /* ignore */
      } finally {
        setEmailLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [previewTab, title, kind, messageText, selectedGames]);

  function toggleGame(g: Game) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(g.productId)) next.delete(g.productId);
      else next.set(g.productId, g);
      return next;
    });
    setAudience(null);
  }

  function addManualUser(u: ManualUser) {
    setManualUsers((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u]));
    setExcludeIds((prev) => {
      const next = new Set(prev);
      next.delete(u.id);
      return next;
    });
    setUserQuery("");
    setUserResults([]);
    setAudience(null);
  }

  function removeManualUser(id: string) {
    setManualUsers((prev) => prev.filter((x) => x.id !== id));
    setAudience(null);
  }

  function filtersPayload() {
    return {
      filters: {
        emailVerified: emailVerified || undefined,
        hasPhone: hasPhone || undefined,
        hasOrders: hasOrders || undefined,
        purchasedNotReviewed: purchasedNotReviewed || undefined,
        tierId: tierId || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
      },
      includeUserIds: manualUsers.map((u) => u.id),
      excludeUserIds: [...excludeIds],
      cooldownDays,
    };
  }

  async function computeAudience() {
    setAudienceLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns/audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filtersPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Xəta");
      setAudience(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auditoriya hesablanmadı.");
    } finally {
      setAudienceLoading(false);
    }
  }

  const canSend =
    title.trim().length > 0 &&
    (isReview || selectedGames.length > 0) &&
    (sendEmail || sendWhatsapp);

  async function doTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/campaigns/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          kind,
          messageText,
          productIds: selectedGames.map((g) => g.productId),
          sendEmail,
          sendWhatsapp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Xəta");
      const parts: string[] = [];
      if (data.result.email) parts.push(`Email: ${data.result.email}`);
      if (data.result.whatsapp) parts.push(`WhatsApp: ${data.result.whatsapp}`);
      setTestResult(parts.join(" · ") || "Göndərildi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test göndərilmədi.");
    } finally {
      setTesting(false);
    }
  }

  async function doSend() {
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          kind,
          messageText,
          productIds: selectedGames.map((g) => g.productId),
          sendEmail,
          sendWhatsapp,
          ...filtersPayload(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Modal açıq qalır, xəta modal-ın içində göstərilir.
        setSendResult({ ok: false, message: data.error ?? `Server xətası (${res.status}).` });
        return;
      }
      const r = data.result ?? {};
      setSendResult({
        ok: true,
        recipientCount: r.recipientCount ?? 0,
        emailSent: r.emailSent ?? 0,
        emailFailed: r.emailFailed ?? 0,
        waSent: r.waSent ?? 0,
        waFailed: r.waFailed ?? 0,
      });
      // Tarixçə yenilənsin (nəticə modalı açıq qalır, admin özü bağlayır).
      router.refresh();
    } catch (e) {
      setSendResult({
        ok: false,
        message:
          e instanceof Error
            ? `Şəbəkə xətası: ${e.message}. Göndəriş başlamış ola bilər — tarixçəni yoxlayın.`
            : "Göndərmə alınmadı.",
      });
    } finally {
      setSending(false);
    }
  }

  // Nəticə modalını bağla; uğurlu göndərişdən sonra formu sıfırla.
  function closeSendResult() {
    const wasOk = sendResult?.ok;
    setConfirmOpen(false);
    setSendResult(null);
    if (wasOk) {
      setTitle("");
      setMessageText("");
      setSelected(new Map());
      setAudience(null);
    }
  }

  const waPreview = isReview
    ? buildReviewWhatsappPreview(messageText)
    : buildWhatsappPreview(messageText, selectedGames);

  function switchKind(next: "PROMO" | "REVIEW_INVITE") {
    setKind(next);
    setAudience(null);
    setEmailHtml("");
    if (next === "REVIEW_INVITE") {
      // Rəy dəvəti üçün məntiqli ilkin dəyərlər — admin dəyişə bilər.
      setPurchasedNotReviewed(true);
      setHasOrders(false);
      setSelected(new Map());
      if (!title.trim()) setTitle(REVIEW_DEFAULT_TITLE);
      if (!messageText.trim()) setMessageText(REVIEW_DEFAULT_MESSAGE);
    } else {
      setPurchasedNotReviewed(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}
      {testResult && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-sm text-emerald-700">
          {testResult}
        </div>
      )}

      {/* Kampaniya növü seçimi */}
      <div className="flex flex-col gap-2 rounded-xl border border-admin-line bg-admin-card p-3 sm:flex-row">
        <button
          type="button"
          onClick={() => switchKind("PROMO")}
          className={[
            "flex-1 rounded-lg border px-4 py-3 text-left transition",
            !isReview
              ? "border-violet-400 bg-violet-500/10"
              : "border-admin-line hover:bg-admin-chip",
          ].join(" ")}
        >
          <div className="text-sm font-semibold text-zinc-900">🎮 Endirim təklifi</div>
          <div className="text-xs text-zinc-600">Seçilmiş endirimli oyunları reklamla.</div>
        </button>
        <button
          type="button"
          onClick={() => switchKind("REVIEW_INVITE")}
          className={[
            "flex-1 rounded-lg border px-4 py-3 text-left transition",
            isReview
              ? "border-violet-400 bg-violet-500/10"
              : "border-admin-line hover:bg-admin-chip",
          ].join(" ")}
        >
          <div className="text-sm font-semibold text-zinc-900">⭐ Rəy dəvəti</div>
          <div className="text-xs text-zinc-600">Alıb rəy yazmayanları rəy yazmağa dəvət et (oyunsuz).</div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Step 1: Audience ── */}
        <Section icon={<Users className="h-4 w-4 text-cyan-700" />} title="1 · Auditoriya">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Toggle label="Email təsdiqli" on={emailVerified} set={setEmailVerified} />
              <Toggle label="Nömrəsi var" on={hasPhone} set={setHasPhone} />
              <Toggle label="Sifariş edənlər" on={hasOrders} set={setHasOrders} />
              <Toggle label="Alıb, rəy yazmayıb" on={purchasedNotReviewed} set={setPurchasedNotReviewed} />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-xs text-zinc-600">
                Seqment
                <select
                  value={tierId}
                  onChange={(e) => {
                    setTierId(e.target.value);
                    setAudience(null);
                  }}
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                >
                  <option value="">Hamısı</option>
                  <option value="none">Seqmentsiz</option>
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-600">
                Qeydiyyat (-dan)
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => {
                    setCreatedFrom(e.target.value);
                    setAudience(null);
                  }}
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Qeydiyyat (-dək)
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => {
                    setCreatedTo(e.target.value);
                    setAudience(null);
                  }}
                  className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-2 py-1.5 text-sm"
                />
              </label>
            </div>

            {/* Anti-spam cooldown */}
            <label className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800">
              <span>Son</span>
              <input
                type="number"
                min={0}
                max={365}
                value={cooldownDays}
                onChange={(e) => {
                  setCooldownDays(Math.max(0, Number(e.target.value) || 0));
                  setAudience(null);
                }}
                className="w-16 rounded border border-amber-500/40 bg-admin-card px-2 py-1 text-sm text-zinc-800"
              />
              <span>gündə artıq mesaj alanları çıxar (0 = söndür) — müştəriləri bezdirməmək üçün.</span>
            </label>

            {/* Manual add */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Əllə müştəri əlavə et (ad / email / nömrə)…"
                className="w-full rounded-md border border-admin-line bg-admin-card py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500/40"
              />
              {userResults.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-admin-line bg-admin-card shadow-lg">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addManualUser(u)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-admin-chip"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-zinc-900">{u.name ?? u.email}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {u.email} {u.phone ? `· ${u.phone}` : ""}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-violet-700" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {manualUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {manualUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700 ring-1 ring-violet-500/20"
                  >
                    {u.name ?? u.email}
                    <button type="button" onClick={() => removeManualUser(u.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={computeAudience}
              disabled={audienceLoading}
              className="inline-flex items-center gap-2 rounded-md border border-admin-line px-3 py-1.5 text-sm font-medium hover:bg-admin-chip disabled:opacity-50"
            >
              {audienceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Auditoriyanı hesabla
            </button>

            {audience && (
              <div className="rounded-md border border-admin-line bg-admin-chip/30 p-3 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-semibold text-zinc-900">{audience.total} alıcı</span>
                  <span className="text-zinc-600">Email: {audience.withEmail}</span>
                  <span className="text-zinc-600">WhatsApp: {audience.withPhone}</span>
                  {audience.unsubscribed > 0 && (
                    <span className="text-amber-700">Opt-out: {audience.unsubscribed}</span>
                  )}
                  {audience.cooledDown > 0 && (
                    <span className="text-amber-700">
                      Yaxınlarda mesaj alıb (çıxarıldı): {audience.cooledDown}
                    </span>
                  )}
                </div>
                {audience.sample.length > 0 && (
                  <div className="mt-2 text-xs text-zinc-500">
                    {audience.sample.map((s) => s.name ?? s.email).slice(0, 8).join(", ")}
                    {audience.total > 8 ? ` … +${audience.total - 8}` : ""}
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* ── Step 2: Games (yalnız endirim təklifində) ── */}
        {!isReview && (
        <Section icon={<Gamepad2 className="h-4 w-4 text-violet-700" />} title={`2 · Oyunlar (${selectedGames.length})`}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={gameQuery}
                onChange={(e) => setGameQuery(e.target.value)}
                placeholder="Endirimli oyun axtar…"
                className="w-full rounded-md border border-admin-line bg-admin-card py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500/40"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {gamesLoading && <div className="py-4 text-center text-sm text-zinc-500">Yüklənir…</div>}
              {!gamesLoading && games.length === 0 && (
                <div className="py-4 text-center text-sm text-zinc-500">Endirimli oyun tapılmadı.</div>
              )}
              {games.map((g) => {
                const on = selected.has(g.productId);
                return (
                  <button
                    key={g.productId}
                    type="button"
                    onClick={() => toggleGame(g)}
                    className={`flex w-full items-center gap-3 rounded-md border px-2.5 py-2 text-left transition ${
                      on
                        ? "border-violet-500/40 bg-violet-500/5"
                        : "border-admin-line hover:bg-admin-chip"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                        on ? "border-violet-600 bg-violet-600 text-white" : "border-admin-line2"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded bg-admin-chip" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-900">{g.title}</span>
                      <span className="block text-xs">
                        {g.originalAzn != null && (
                          <span className="mr-1.5 text-zinc-400 line-through">{fmtAzn(g.originalAzn)}</span>
                        )}
                        <span className="font-semibold text-zinc-900">{fmtAzn(g.finalAzn)}</span>
                        {g.discountPct != null && (
                          <span className="ml-1.5 rounded bg-violet-500/15 px-1 text-[10px] font-medium text-violet-700">
                            -{g.discountPct}%
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
        )}
      </div>

      {/* ── Step 3: Message + preview ── */}
      <Section icon={<MessageSquare className="h-4 w-4 text-amber-700" />} title="3 · Mesaj">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-xs text-zinc-600">
              Başlıq (email mövzusu + WhatsApp-da göstərilmir)
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Məs: Həftəsonu super endirimlər!"
                className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm outline-none focus:border-violet-500/40"
              />
            </label>
            <label className="block text-xs text-zinc-600">
              Giriş mətni
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={5}
                placeholder="Salam! Bu həftə seçdiyimiz oyunlarda möhtəşəm endirimlər var 👇"
                className="mt-1 w-full rounded-md border border-admin-line bg-admin-card px-3 py-2 text-sm outline-none focus:border-violet-500/40"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <Toggle label="Email" on={sendEmail} set={setSendEmail} icon={<Mail className="h-3.5 w-3.5" />} />
              <Toggle
                label="WhatsApp"
                on={sendWhatsapp}
                set={setSendWhatsapp}
                disabled={!waConfigured}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Preview (WhatsApp / Email) */}
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="mr-1 text-xs text-zinc-600">Önizləmə:</span>
              <PreviewTab
                active={previewTab === "whatsapp"}
                onClick={() => setPreviewTab("whatsapp")}
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                label="WhatsApp"
              />
              <PreviewTab
                active={previewTab === "email"}
                onClick={() => setPreviewTab("email")}
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
              />
            </div>

            {previewTab === "whatsapp" ? (
              <pre className="h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-emerald-600/20 bg-emerald-50/40 p-3 text-xs text-zinc-800">
                {!isReview && selectedGames.length === 0 ? "Oyun seçin…" : waPreview}
              </pre>
            ) : !isReview && selectedGames.length === 0 ? (
              <div className="grid h-72 place-items-center rounded-lg border border-admin-line bg-admin-card text-sm text-zinc-500">
                Oyun seçin…
              </div>
            ) : emailLoading && !emailHtml ? (
              <div className="grid h-72 place-items-center rounded-lg border border-admin-line bg-admin-card text-sm text-zinc-500">
                Yüklənir…
              </div>
            ) : (
              <iframe
                title="Email önizləmə"
                srcDoc={emailHtml}
                className="h-72 w-full rounded-lg border border-admin-line bg-white"
              />
            )}
          </div>
        </div>
      </Section>

      {/* ── Actions ── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canSend || sending || audienceLoading || (audience?.total ?? 0) === 0}
          onClick={() => setConfirmOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Kampaniyanı göndər
        </button>
        <button
          type="button"
          disabled={!canSend || testing}
          onClick={doTest}
          className="inline-flex items-center gap-2 rounded-md border border-admin-line px-4 py-2 text-sm font-medium hover:bg-admin-chip disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Özümə test göndər
        </button>
        {!audience && canSend && (
          <span className="text-xs text-zinc-500">Göndərmədən əvvəl auditoriyanı hesablayın.</span>
        )}
      </div>

      {/* ── Confirm modal ── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-admin-line bg-admin-card p-6 shadow-xl">
            {sendResult ? (
              // ── Nəticə görünüşü ──
              sendResult.ok ? (
                <>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" /> Göndərildi
                  </h3>
                  <div className="mt-3 space-y-1.5 text-sm text-zinc-700">
                    <p>
                      Cəmi <b>{sendResult.recipientCount}</b> alıcıya emal olundu.
                    </p>
                    {sendEmail && (
                      <p>
                        Email: <span className="font-semibold text-emerald-700">✓ {sendResult.emailSent}</span>
                        {" · "}
                        <span className="font-semibold text-rose-700">✗ {sendResult.emailFailed}</span>
                      </p>
                    )}
                    {sendWhatsapp && (
                      <p>
                        WhatsApp: <span className="font-semibold text-emerald-700">✓ {sendResult.waSent}</span>
                        {" · "}
                        <span className="font-semibold text-rose-700">✗ {sendResult.waFailed}</span>
                      </p>
                    )}
                    {sendResult.emailSent === 0 && sendResult.waSent === 0 && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        Heç bir mesaj çatmadı — alıcıların emaili təsdiqli deyil və ya nömrəsi yoxdur.
                        Detallar üçün kampaniyanın səhifəsinə baxın.
                      </p>
                    )}
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={closeSendResult}
                      className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Bağla
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-rose-700">
                    <AlertCircle className="h-5 w-5" /> Göndərilmədi
                  </h3>
                  <p className="mt-3 text-sm text-zinc-700">{sendResult.message}</p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSendResult(null)}
                      className="rounded-md border border-admin-line px-3 py-1.5 text-sm hover:bg-admin-chip"
                    >
                      Geri
                    </button>
                    <button
                      type="button"
                      onClick={doSend}
                      disabled={sending}
                      className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Yenidən cəhd et
                    </button>
                  </div>
                </>
              )
            ) : (
              // ── Təsdiq görünüşü ──
              <>
                <h3 className="text-lg font-semibold">Kampaniyanı göndər?</h3>
                <div className="mt-3 space-y-1.5 text-sm text-zinc-700">
                  <p>
                    <b>{audience?.total ?? 0}</b> alıcıya göndəriləcək.
                  </p>
                  <p>
                    Kanal:{" "}
                    {[sendEmail ? "Email" : null, sendWhatsapp ? "WhatsApp" : null]
                      .filter(Boolean)
                      .join(" + ")}
                  </p>
                  <p>
                    {isReview ? "⭐ Rəy dəvəti" : `${selectedGames.length} oyun`} · «{title}»
                  </p>
                  {sendEmail && (
                    <p className="text-xs text-zinc-500">
                      Email yalnız təsdiqli + opt-out etməmiş {audience?.withEmail ?? 0} nəfərə gedəcək.
                    </p>
                  )}
                  {sendWhatsapp && (
                    <p className="text-xs text-zinc-500">
                      WhatsApp yalnız nömrəsi olan {audience?.withPhone ?? 0} nəfərə gedəcək.
                    </p>
                  )}
                  {sending && (
                    <p className="flex items-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Göndərilir, zəhmət olmasa gözləyin — pəncərəni bağlamayın.
                    </p>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(false)}
                    disabled={sending}
                    className="rounded-md border border-admin-line px-3 py-1.5 text-sm hover:bg-admin-chip disabled:opacity-50"
                  >
                    Ləğv et
                  </button>
                  <button
                    type="button"
                    onClick={doSend}
                    disabled={sending}
                    className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? "Göndərilir…" : "Təsdiqlə və göndər"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-admin-line bg-admin-card">
      <header className="flex items-center gap-2 border-b border-admin-line px-5 py-3">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PreviewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        active
          ? "bg-violet-600 text-white"
          : "border border-admin-line text-zinc-600 hover:bg-admin-chip"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Toggle({
  label,
  on,
  set,
  disabled,
  icon,
}: {
  label: string;
  on: boolean;
  set: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => set(!on)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
        on
          ? "bg-violet-500/15 text-violet-700 ring-violet-500/30"
          : "bg-admin-card text-zinc-600 ring-admin-line hover:bg-admin-chip"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon}
      {label}
      {on && <Check className="h-3.5 w-3.5" />}
    </button>
  );
}
