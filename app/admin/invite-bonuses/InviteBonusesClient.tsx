"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, X, Loader2, ShieldAlert, ArrowRight } from "lucide-react";

type UserRef = { id: string; name: string | null; email: string };

export type AdminInviteBonus = {
  id: string;
  amountAzn: number;
  status: "PAID" | "HELD" | "REJECTED";
  suspicious: boolean;
  reasons: string[];
  createdAt: string;
  reviewedAt: string | null;
  referrer: UserRef;
  referee: UserRef;
};

type Tab = "held" | "paid" | "rejected";

const STATUS_LABEL: Record<AdminInviteBonus["status"], string> = {
  PAID: "Ödənildi",
  HELD: "Gözləyir",
  REJECTED: "Rədd edildi",
};

export default function InviteBonusesClient({ initial }: { initial: AdminInviteBonus[] }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>(
    initial.some((b) => b.status === "HELD") ? "held" : "paid"
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const held = useMemo(() => items.filter((b) => b.status === "HELD"), [items]);
  const paid = useMemo(() => items.filter((b) => b.status === "PAID"), [items]);
  const rejected = useMemo(() => items.filter((b) => b.status === "REJECTED"), [items]);
  const shown = tab === "held" ? held : tab === "paid" ? paid : rejected;

  function act(id: string, action: "approve" | "reject") {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/invite-bonuses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Əməliyyat alınmadı.");
          return;
        }
        const nextStatus: AdminInviteBonus["status"] =
          action === "approve" ? "PAID" : "REJECTED";
        setItems((prev) =>
          prev.map((b) =>
            b.id === id ? { ...b, status: nextStatus, reviewedAt: new Date().toISOString() } : b
          )
        );
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "held"} onClick={() => setTab("held")}>
          Gözləyən
          {held.length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-500/30">
              {held.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "paid"} onClick={() => setTab("paid")}>
          Ödənilən
          <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
            {paid.length}
          </span>
        </TabButton>
        <TabButton active={tab === "rejected"} onClick={() => setTab("rejected")}>
          Rədd edilən
          {rejected.length > 0 && (
            <span className="ml-1.5 rounded-full bg-rose-500/15 px-1.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-500/30">
              {rejected.length}
            </span>
          )}
        </TabButton>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center text-sm text-zinc-500">
          {tab === "held"
            ? "Yoxlama gözləyən dəvət yoxdur."
            : tab === "paid"
            ? "Ödənilən bonus yoxdur."
            : "Rədd edilən bonus yoxdur."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-admin-line bg-admin-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-zinc-900">
                      {b.referrer.name ?? b.referrer.email}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-zinc-700">
                      {b.referee.name ?? b.referee.email}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                      {b.amountAzn.toFixed(2)} AZN
                    </span>
                    <StatusBadge status={b.status} />
                  </div>

                  <div className="text-[11px] text-zinc-400">
                    Dəvət edən: {b.referrer.email} · Dəvətli: {b.referee.email}
                  </div>

                  {b.reasons.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <ShieldAlert className="h-3.5 w-3.5" /> Şübhə:
                      </span>
                      {b.reasons.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 ring-1 ring-amber-200"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-400">
                    {new Date(b.createdAt).toLocaleString("az-AZ")}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {b.status === "HELD" &&
                    (busyId === b.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => act(b.id, "approve")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" /> Təsdiqlə
                        </button>
                        <button
                          type="button"
                          onClick={() => act(b.id, "reject")}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                        >
                          <X className="h-3.5 w-3.5" /> Rədd et
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminInviteBonus["status"] }) {
  const cls =
    status === "PAID"
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30"
      : status === "HELD"
      ? "bg-amber-500/10 text-amber-700 ring-amber-500/30"
      : "bg-rose-500/10 text-rose-700 ring-rose-500/30";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/30"
          : "text-zinc-600 hover:bg-zinc-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
