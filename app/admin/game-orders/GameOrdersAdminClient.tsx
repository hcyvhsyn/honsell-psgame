"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Check,
  X as XIcon,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  PhoneForwarded,
} from "lucide-react";
import {
  GAME_ORDER_STAGES,
  GAME_STAGE_LABEL_AZ,
  parseGameOrderMeta,
  type GameOrderStage,
} from "@/lib/gameOrderFulfillment";

type Row = {
  id: string;
  status: string;
  amountAznCents: number;
  metadata: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
  game: { id: string; title: string; imageUrl: string | null; platform: string | null } | null;
  psnAccount: { id: string; label: string; psnEmail: string } | null;
};

export default function GameOrdersAdminClient() {
  const router = useRouter();
  const [orders, setOrders] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/game-orders", { cache: "no-store" });
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchOrder(id: string, body: object) {
    setBusyId(id);
    await fetch(`/api/admin/game-orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    load();
    router.refresh();
  }

  const pending = orders.filter((o) => o.status === "PENDING");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Oyun çatdırılması</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ödəniş alınıb — müştəri ilə əlaqə, PSN hesabına giriş, mağaza üzrə alış. Sonunda «Tamamla» və ya
            «Rədd» (balans geri).
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-sm">
          <span className="text-zinc-500">Gözləyən: </span>
          <span className="font-bold text-amber-400">{pending.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-zinc-500">
          Gözləyən oyun sifarişi yoxdur.
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((o) => (
            <OrderRowInner
              key={o.id}
              o={o}
              expanded={expanded.has(o.id)}
              toggleExpand={() => toggleExpand(o.id)}
              busy={busyId === o.id}
              onAction={(body) => patchOrder(o.id, body)}
            />
          ))}
        </ul>
      )}

      {orders.some((o) => o.status === "SUCCESS" || o.status === "FAILED") ? (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-300">Son tamamlanan / bağlanmış</h2>
          <ul className="space-y-2 opacity-80">
            {orders
              .filter((o) => o.status !== "PENDING")
              .slice(0, 20)
              .map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-3 py-2 text-sm"
                >
                  <span className="truncate text-zinc-300">{o.game?.title}</span>
                  <span className="text-zinc-500">{o.user.email}</span>
                  <span
                    className={
                      o.status === "SUCCESS"
                        ? "text-emerald-400"
                        : o.status === "FAILED"
                          ? "text-rose-400"
                          : "text-zinc-500"
                    }
                  >
                    {o.status}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OrderRowInner({
  o,
  expanded,
  toggleExpand,
  busy,
  onAction,
}: {
  o: Row;
  expanded: boolean;
  toggleExpand: () => void;
  busy: boolean;
  onAction: (body: object) => void;
}) {
  const meta = parseGameOrderMeta(o.metadata);
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
            <p className="text-xs text-zinc-500">{o.user.name || "—"} · {o.user.email}</p>
            {meta.orderCode ? (
              <p className="text-[11px] font-mono text-amber-200/90">Kod: {meta.orderCode}</p>
            ) : null}
            {o.user.phone && <p className="text-[11px] text-zinc-500">Tel: {o.user.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        {o.psnAccount && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            PSN: {o.psnAccount.label} — {o.psnAccount.psnEmail}
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800 bg-zinc-950/50 px-4 py-4">
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
              onClick={() =>
                patchConfirm(
                  onAction,
                  "Sifariş tamamlandı (oyun PSN-da alındı və ya yükləndi)?"
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tamamla (çatdırıldı)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patchConfirm(
                  onAction,
                  "Sifarişi rədd et və məbləği geri köçür?",
                  false
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <XIcon className="h-3.5 w-3.5" /> Rədd · geri qaytarma
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

function patchConfirm(onAction: (body: object) => void, msg: string, successAction = true) {
  const ok =
    typeof window !== "undefined" ? window.confirm(msg) : false;
  if (!ok) return;
  if (successAction) onAction({ action: "SUCCESS" });
  else onAction({ action: "FAILED" });
}

function StageChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-200">
      {icon}
      {label}
    </span>
  );
}
