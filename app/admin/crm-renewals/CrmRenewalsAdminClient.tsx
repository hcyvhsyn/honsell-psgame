"use client";

import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  orderCode: string;
  phone: string;
  ref: string;
  kind: string;
  title: string;
  months: number;
  amountAznCents: number;
  chargedAznCents: number;
  status: "PENDING" | "SUCCESS" | "FAILED";
  crmStatus: string | null;
  crmSyncedAt: string | null;
  crmSyncError: string | null;
  resultEndDate: string | null;
  failReason: string | null;
  refundStatus: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string } | null;
};

const CRM_STATUS: Record<string, string> = {
  PROCESSING: "CRM emal edir",
  AWAITING_VENDOR: "Vendorda",
  AWAITING_ADMIN: "CRM admini gözləyir",
  NEEDS_ADMIN: "CRM-də baxış lazımdır",
  COMPLETED: "CRM tamamladı",
  FAILED: "CRM uğursuz",
};

const KIND: Record<string, string> = {
  SLOT: "Kabinet",
  FAMILY: "Music Family",
  SI: "Spotify Individual",
  NI: "Netflix Individual",
  PS: "PlayStation",
};

const FILTERS = [
  { key: "PENDING", label: "Gözləyən" },
  { key: "FAILED", label: "Uğursuz" },
  { key: "SUCCESS", label: "Tamamlanan" },
  { key: "", label: "Hamısı" },
] as const;

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baku",
  });
}

export default function CrmRenewalsAdminClient() {
  const [filter, setFilter] = useState<string>("PENDING");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/admin/crm-renewals${filter ? `?status=${filter}` : ""}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error || "Yüklənmədi");
      setRows([]);
      return;
    }
    setRows(data.rows as Row[]);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: string, confirmText?: string) => {
    let reason: string | undefined;
    if (action === "mark-failed") {
      const r = prompt("Səbəb (müştəriyə geri ödəniş ediləcək):", "");
      if (r === null) return;
      reason = r;
    } else if (confirmText && !confirm(confirmText)) return;
    setBusy(id);
    const res = await fetch(`/api/admin/crm-renewals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) alert(data?.error || "Alınmadı");
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              filter === f.key ? "bg-zinc-900 text-white" : "border border-admin-line bg-admin-card text-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-zinc-500">Yüklənir…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-line p-8 text-center text-sm text-zinc-500">
          Bu filtrdə sifariş yoxdur.
        </p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-admin-line bg-admin-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${
                      r.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status === "SUCCESS" ? "Tamamlandı" : r.status === "FAILED" ? "Uğursuz" : "Gözləyir"}
                  </span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">{KIND[r.kind] ?? r.kind}</span>
                  <span className="font-mono text-zinc-500">{r.orderCode}</span>
                  {r.crmStatus && <span className="text-zinc-500">· {CRM_STATUS[r.crmStatus] ?? r.crmStatus}</span>}
                </div>
                <p className="text-sm font-semibold text-zinc-900">
                  {r.title} · {r.months} ay · {(r.amountAznCents / 100).toFixed(2)} ₼
                  {r.chargedAznCents !== r.amountAznCents && (
                    <span className="ml-1 text-xs font-normal text-zinc-500">
                      (kartdan {(r.chargedAznCents / 100).toFixed(2)} ₼, fərq cüzdana)
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-600">
                  {r.user?.name || "—"} · {r.user?.email} · {r.phone} · {fmt(r.createdAt)}
                  {r.resultEndDate ? ` · yeni bitiş ${fmt(r.resultEndDate).slice(0, 10)}` : ""}
                </p>
                {r.crmSyncError && !r.crmSyncedAt && (
                  <p className="text-xs font-semibold text-red-600">CRM-ə çatmadı: {r.crmSyncError}</p>
                )}
                {r.failReason && <p className="text-xs text-red-700">Səbəb: {r.failReason}</p>}
                {r.status === "FAILED" && (
                  <p className={`text-xs font-bold ${r.refundStatus ? "text-emerald-700" : "text-red-700"}`}>
                    {r.refundStatus === "WALLET" ? "Cüzdana qaytarılıb" : r.refundStatus ? `Qaytarılıb (${r.refundStatus})` : "Geri ödəniş lazımdır"}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "crm-push")}
                    className="rounded-lg border border-admin-line bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 disabled:opacity-50"
                  >
                    CRM-ə yenidən göndər
                  </button>
                )}
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "mark-success", "CRM-də abunəlik uzadılıb? Sifariş tamamlanacaq.")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Tamamlandı
                  </button>
                )}
                {r.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, "mark-failed")}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                  >
                    Uğursuz
                  </button>
                )}
                {r.status === "FAILED" && !r.refundStatus && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() =>
                      act(r.id, "refund-wallet", `${(r.amountAznCents / 100).toFixed(2)} ₼ müştərinin cüzdanına qaytarılsın?`)
                    }
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Cüzdana qaytar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
