"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X, RefreshCw } from "lucide-react";

type AnyOrder = {
  id: string;
  type: string;
  status: string;
  amountAznCents: number;
  createdAt: string;
  metadata?: string | null;
};

type OrdersPayload = {
  gameOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    game: { id: string; title: string; imageUrl: string | null; platform: string | null } | null;
    psnAccount: { id: string; label: string; psnEmail: string } | null;
  })[];
  psPlusOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
    psnAccount: { id: string; label: string; psnEmail: string } | null;
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("game");
  const [data, setData] = useState<OrdersPayload | null>(null);

  const counts = useMemo(() => {
    return {
      game: data?.gameOrders.length ?? 0,
      psplus: data?.psPlusOrders.length ?? 0,
      gift: data?.giftCardOrders.length ?? 0,
      account: data?.accountCreationOrders.length ?? 0,
    };
  }, [data]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Yükləmə xətası");
      setLoading(false);
      return;
    }
    const payload = (await res.json()) as OrdersPayload;
    setData(payload);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function actGame(id: string, action: "SUCCESS" | "FAILED") {
    if (!confirm(action === "SUCCESS" ? "Sifarişi tamamla?" : "Sifarişi rədd et?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/game-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      await load();
      router.refresh();
    });
  }

  async function actService(id: string, action: "SUCCESS" | "FAILED") {
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
      await load();
      router.refresh();
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
          onClick={load}
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
            <OrdersTable
              empty="Gözləyən oyun sifarişi yoxdur."
              rows={data.gameOrders.map((o) => ({
                id: o.id,
                userId: o.user.id,
                userLabel: o.user.name ?? o.user.email,
                userSub: o.user.email,
                item: o.game?.title ?? "—",
                itemSub: o.game?.platform ?? "—",
                paymentSource: getPaymentSource(o.metadata),
                amount: fmtAzn(o.amountAznCents),
                date: fmtDate(o.createdAt),
                actions: (
                  <RowActions
                    pending={pending}
                    onApprove={() => actGame(o.id, "SUCCESS")}
                    onReject={() => actGame(o.id, "FAILED")}
                  />
                ),
              }))}
            />
          )}

          {tab === "psplus" && (
            <OrdersTable
              empty="Gözləyən PS Plus sifarişi yoxdur."
              rows={data.psPlusOrders.map((o) => ({
                id: o.id,
                userId: o.user.id,
                userLabel: o.user.name ?? o.user.email,
                userSub: o.user.email,
                item: o.serviceProduct?.title ?? "PS Plus",
                itemSub: o.psnAccount ? `${o.psnAccount.label} (${o.psnAccount.psnEmail})` : "PSN seçilməyib",
                paymentSource: getPaymentSource(o.metadata),
                amount: fmtAzn(o.amountAznCents),
                date: fmtDate(o.createdAt),
                actions: (
                  <RowActions
                    pending={pending}
                    onApprove={() => actService(o.id, "SUCCESS")}
                    onReject={() => actService(o.id, "FAILED")}
                  />
                ),
              }))}
            />
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
                    onApprove={() => actService(o.id, "SUCCESS")}
                    onReject={() => actService(o.id, "FAILED")}
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
                    onApprove={() => actService(o.id, "SUCCESS")}
                    onReject={() => actService(o.id, "FAILED")}
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
        <Link className="underline hover:text-zinc-300" href="/admin/game-orders">
          Oyun çatdırılması
        </Link>
        {" · "}
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

