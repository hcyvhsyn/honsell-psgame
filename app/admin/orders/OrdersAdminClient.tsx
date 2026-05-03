"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  PhoneForwarded,
  Loader2,
  Crown,
  Copy,
  KeyRound,
} from "lucide-react";
import {
  GAME_ORDER_STAGES,
  GAME_STAGE_LABEL_AZ,
  parseGameOrderMeta,
  type GameOrderStage,
} from "@/lib/gameOrderFulfillment";

type AnyOrder = {
  id: string;
  type: string;
  status: string;
  amountAznCents: number;
  createdAt: string;
  metadata?: string | null;
};

type PsnAccountSummary = {
  id: string;
  label: string;
  psnEmail: string;
  psnPassword: string;
  psModel: string;
};

type OrdersPayload = {
  gameOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    game: { id: string; title: string; imageUrl: string | null; platform: string | null } | null;
    psnAccount: PsnAccountSummary | null;
  })[];
  psPlusOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
    psnAccount: PsnAccountSummary | null;
  })[];
  giftCardOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string } | null;
    serviceCode: { id: string; code: string } | null;
  })[];
  accountCreationOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string } | null;
  })[];
};

function fmtAzn(cents: number) {
  return `${(Math.abs(cents) / 100).toFixed(2)} AZN`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPaymentSource(metadata?: string | null): "WALLET" | "REFERRAL" | "UNKNOWN" {
  if (!metadata) return "UNKNOWN";
  try {
    const m = JSON.parse(metadata) as { paymentSource?: string };
    if (m.paymentSource === "REFERRAL") return "REFERRAL";
    if (m.paymentSource === "WALLET") return "WALLET";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

const TABS = [
  { id: "game", label: "Oyun çatdırılması" },
  { id: "psplus", label: "PS Plus" },
  { id: "gift", label: "Hədiyyə kart (TRY)" },
  { id: "account", label: "Hesab açma" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function OrdersAdminClient() {
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("game");
  const [data, setData] = useState<OrdersPayload | null>(null);
  const [expandedGame, setExpandedGame] = useState<Set<string>>(new Set());
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [expandedPsPlus, setExpandedPsPlus] = useState<Set<string>>(new Set());

  function toggleExpandGame(id: string) {
    setExpandedGame((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandPsPlus(id: string) {
    setExpandedPsPlus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchGameOrder(id: string, body: object) {
    setBusyGameId(id);
    try {
      const res = await fetch(`/api/admin/game-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      // For terminal actions remove the row optimistically so the user sees
      // an instant response. For stage updates, do a silent reload to refresh
      // the row's metadata without flashing the whole list.
      const action = (body as { action?: string }).action;
      if (action === "SUCCESS" || action === "FAILED") {
        setData((prev) =>
          prev ? { ...prev, gameOrders: prev.gameOrders.filter((o) => o.id !== id) } : prev
        );
      } else {
        await load({ silent: true });
      }
    } finally {
      setBusyGameId(null);
    }
  }

  const counts = useMemo(() => {
    return {
      game: data?.gameOrders.length ?? 0,
      psplus: data?.psPlusOrders.length ?? 0,
      gift: data?.giftCardOrders.length ?? 0,
      account: data?.accountCreationOrders.length ?? 0,
    };
  }, [data]);

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Yükləmə xətası");
      if (!opts.silent) setLoading(false);
      return;
    }
    const payload = (await res.json()) as OrdersPayload;
    setData(payload);
    if (!opts.silent) setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function actService(
    id: string,
    action: "SUCCESS" | "FAILED",
    listKey: "psPlusOrders" | "giftCardOrders" | "accountCreationOrders"
  ) {
    if (!confirm(action === "SUCCESS" ? "Sifarişi tamamla?" : "Sifarişi rədd et?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/service-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      // Optimistic removal — same approach as the game tab.
      setData((prev) => {
        if (!prev) return prev;
        const list = prev[listKey].filter((o) => o.id !== id);
        return { ...prev, [listKey]: list };
      });
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sifarişlər</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Oyun çatdırılması, PS Plus, hədiyyə kart və hesab açma sifarişləri tək paneldə.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={pending || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Yenilə
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          const c = counts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 transition",
                active
                  ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30"
                  : "bg-zinc-900/60 text-zinc-300 ring-zinc-800 hover:bg-zinc-900",
              ].join(" ")}
            >
              {t.label}
              <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-zinc-800">
                {c}
              </span>
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}

      {loading || !data ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
          Yüklənir…
        </div>
      ) : (
        <>
          {tab === "game" && (
            data.gameOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
                Gözləyən oyun sifarişi yoxdur.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.gameOrders.map((o) => (
                  <GameOrderCard
                    key={o.id}
                    o={o}
                    expanded={expandedGame.has(o.id)}
                    toggleExpand={() => toggleExpandGame(o.id)}
                    busy={busyGameId === o.id}
                    onAction={(body) => patchGameOrder(o.id, body)}
                    paymentSource={getPaymentSource(o.metadata)}
                  />
                ))}
              </ul>
            )
          )}

          {tab === "psplus" && (
            data.psPlusOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
                Gözləyən PS Plus sifarişi yoxdur.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.psPlusOrders.map((o) => (
                  <PsPlusOrderCard
                    key={o.id}
                    o={o}
                    expanded={expandedPsPlus.has(o.id)}
                    toggleExpand={() => toggleExpandPsPlus(o.id)}
                    busy={pending}
                    onApprove={() => actService(o.id, "SUCCESS", "psPlusOrders")}
                    onReject={() => actService(o.id, "FAILED", "psPlusOrders")}
                    paymentSource={getPaymentSource(o.metadata)}
                  />
                ))}
              </ul>
            )
          )}

          {tab === "gift" && (
            <OrdersTable
              empty="Gözləyən hədiyyə kart sifarişi yoxdur."
              rows={data.giftCardOrders.map((o) => ({
                id: o.id,
                userId: o.user.id,
                userLabel: o.user.name ?? o.user.email,
                userSub: o.user.email,
                item: o.serviceProduct?.title ?? "TRY Balance",
                itemSub: o.serviceCode ? "Kod ayrılıb" : "Kod ayrılmayıb (stokdan seçiləcək)",
                paymentSource: getPaymentSource(o.metadata),
                amount: fmtAzn(o.amountAznCents),
                date: fmtDate(o.createdAt),
                actions: (
                  <RowActions
                    pending={pending}
                    onApprove={() => actService(o.id, "SUCCESS", "giftCardOrders")}
                    onReject={() => actService(o.id, "FAILED", "giftCardOrders")}
                  />
                ),
              }))}
            />
          )}

          {tab === "account" && (
            <OrdersTable
              empty="Gözləyən hesab açma sifarişi yoxdur."
              rows={data.accountCreationOrders.map((o) => ({
                id: o.id,
                userId: o.user.id,
                userLabel: o.user.name ?? o.user.email,
                userSub: o.user.email,
                item: o.serviceProduct?.title ?? "Hesab açma",
                itemSub: "Detallar metadata-dadır",
                paymentSource: getPaymentSource(o.metadata),
                amount: fmtAzn(o.amountAznCents),
                date: fmtDate(o.createdAt),
                actions: (
                  <RowActions
                    pending={pending}
                    onApprove={() => actService(o.id, "SUCCESS", "accountCreationOrders")}
                    onReject={() => actService(o.id, "FAILED", "accountCreationOrders")}
                  />
                ),
              }))}
            />
          )}
        </>
      )}

      <div className="text-xs text-zinc-500">
        Qeyd: daha geniş idarəetmə üçün köhnə səhifələr hələ də qalır:
        {" "}
        <Link className="underline hover:text-zinc-300" href="/admin/ps-plus">
          PS Plus
        </Link>
        {" · "}
        <Link className="underline hover:text-zinc-300" href="/admin/services">
          Gift Cardlar
        </Link>
        {" · "}
        <Link className="underline hover:text-zinc-300" href="/admin/account-creation">
          Hesab açılışı
        </Link>
      </div>
    </div>
  );
}

function GameOrderCard({
  o,
  expanded,
  toggleExpand,
  busy,
  onAction,
  paymentSource,
}: {
  o: OrdersPayload["gameOrders"][number];
  expanded: boolean;
  toggleExpand: () => void;
  busy: boolean;
  onAction: (body: object) => void;
  paymentSource: string;
}) {
  const meta = parseGameOrderMeta(o.metadata ?? null);
  const stage = meta.fulfillmentStage ?? ("NEW" as GameOrderStage);
  const amount = Math.abs(o.amountAznCents / 100).toFixed(2);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
            {o.game?.imageUrl ? (
              <Image src={o.game.imageUrl} alt="" fill className="object-cover" sizes="56px" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <Gamepad2 className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{o.game?.title ?? "—"}</p>
            <Link
              href={`/admin/users/${o.user.id}`}
              className="truncate text-xs text-zinc-500 hover:text-zinc-300"
            >
              {o.user.name || "—"} · {o.user.email}
            </Link>
            {meta.orderCode ? (
              <p className="text-[11px] font-mono text-amber-200/90">Kod: {meta.orderCode}</p>
            ) : null}
            {o.user.phone && <p className="text-[11px] text-zinc-500">Tel: {o.user.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-800">
            {paymentSource}
          </span>
          <span className="text-sm tabular-nums text-zinc-300">{amount} AZN</span>
          <button
            type="button"
            onClick={toggleExpand}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 px-4 py-2 text-[11px] text-zinc-500">
        <StageChip icon={<PhoneForwarded className="h-3 w-3" />} label={GAME_STAGE_LABEL_AZ[stage]} />
        {o.game?.platform && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">Platform: {o.game.platform}</span>
        )}
        {o.psnAccount && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            PSN: {o.psnAccount.label} — {o.psnAccount.psnEmail}
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800 bg-zinc-950/50 px-4 py-4">
          <PsnDetailsBlock psn={o.psnAccount} />

          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              value={stage}
              onChange={(e) => {
                const v = e.target.value as GameOrderStage;
                if (GAME_ORDER_STAGES.includes(v)) onAction({ action: "SET_STAGE", stage: v });
              }}
              disabled={busy}
            >
              {GAME_ORDER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {GAME_STAGE_LABEL_AZ[s]}
                </option>
              ))}
            </select>
            <span className="self-center text-[10px] text-zinc-500">İcra davamına uyğun mərhələ seçin</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Sifariş tamamlandı (oyun PSN-da alındı və ya yükləndi)?"))
                  onAction({ action: "SUCCESS" });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tamamla (çatdırıldı)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Sifarişi rədd et və məbləği geri köçür?"))
                  onAction({ action: "FAILED" });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Rədd · geri qaytarma
            </button>
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Yenilənir…
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function StageChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-200">
      {icon}
      {label}
    </span>
  );
}

function PsnDetailsBlock({ psn }: { psn: PsnAccountSummary | null }) {
  if (!psn) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        PSN hesabı seçilməyib. Müştəri hesab seçməyib və ya silib.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-200">
        <KeyRound className="h-3.5 w-3.5" /> PSN hesab məlumatları
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          {psn.label}
        </span>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          {psn.psModel}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <CredField label="Email" value={psn.psnEmail} />
        <CredField label="Şifrə" value={psn.psnPassword} />
      </dl>
    </div>
  );
}

function CredField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-100">{value}</span>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(value);
          }
        }}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title="Kopyala"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function PsPlusOrderCard({
  o,
  expanded,
  toggleExpand,
  busy,
  onApprove,
  onReject,
  paymentSource,
}: {
  o: OrdersPayload["psPlusOrders"][number];
  expanded: boolean;
  toggleExpand: () => void;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  paymentSource: string;
}) {
  const tier = (() => {
    const m = o.serviceProduct?.metadata as { tier?: string; durationMonths?: number } | null;
    return m?.tier ?? null;
  })();
  const dur = (() => {
    const m = o.serviceProduct?.metadata as { tier?: string; durationMonths?: number } | null;
    return m?.durationMonths ?? null;
  })();
  const amount = Math.abs(o.amountAznCents / 100).toFixed(2);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
            <Crown className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">
              {o.serviceProduct?.title ?? "PS Plus"}
            </p>
            <Link
              href={`/admin/users/${o.user.id}`}
              className="truncate text-xs text-zinc-500 hover:text-zinc-300"
            >
              {o.user.name || "—"} · {o.user.email}
            </Link>
            {o.user.phone && <p className="text-[11px] text-zinc-500">Tel: {o.user.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-800">
            {paymentSource}
          </span>
          <span className="text-sm tabular-nums text-zinc-300">{amount} AZN</span>
          <button
            type="button"
            onClick={toggleExpand}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 px-4 py-2 text-[11px] text-zinc-500">
        {tier && (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-amber-500/30">
            {tier}
          </span>
        )}
        {dur && <span className="rounded bg-zinc-800 px-2 py-0.5">{dur} ay</span>}
        {o.psnAccount ? (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            PSN: {o.psnAccount.label} — {o.psnAccount.psnEmail}
          </span>
        ) : (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-500/30">
            PSN seçilməyib
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800 bg-zinc-950/50 px-4 py-4">
          <PsnDetailsBlock psn={o.psnAccount} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tamamla
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Rədd
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function OrdersTable({
  rows,
  empty,
}: {
  rows: {
    id: string;
    userId: string;
    userLabel: string;
    userSub: string;
    item: string;
    itemSub: string;
    paymentSource: string;
    amount: string;
    date: string;
    actions: React.ReactNode;
  }[];
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Müştəri</Th>
            <Th>Məhsul</Th>
            <Th>Ödəniş</Th>
            <Th>Məbləğ</Th>
            <Th>Tarix</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-900/40">
                <Td>
                  <Link className="block" href={`/admin/users/${r.userId}`}>
                    <div className="truncate text-zinc-100">{r.userLabel}</div>
                    <div className="truncate text-xs text-zinc-500">{r.userSub}</div>
                  </Link>
                </Td>
                <Td>
                  <div className="truncate text-zinc-100">{r.item}</div>
                  <div className="truncate text-xs text-zinc-500">{r.itemSub}</div>
                </Td>
                <Td>
                  <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-800">
                    {r.paymentSource}
                  </span>
                </Td>
                <Td className="font-semibold text-zinc-100">{r.amount}</Td>
                <Td className="text-zinc-400">{r.date}</Td>
                <Td className="text-right">{r.actions}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({
  pending,
  onApprove,
  onReject,
}: {
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 px-2">
      <button
        type="button"
        disabled={pending}
        onClick={onReject}
        className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        Rədd
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onApprove}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        Təsdiq
      </button>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-5 py-3 text-left font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 align-top ${className}`}>{children}</td>;
}

