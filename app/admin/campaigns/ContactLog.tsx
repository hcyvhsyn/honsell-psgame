"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Mail, MessageSquare, History } from "lucide-react";

type Row = {
  id: string;
  userId: string;
  customerName: string | null;
  email: string;
  phone: string | null;
  channels: string[];
  sentAt: string;
  campaignId: string;
  campaignTitle: string;
  clickCount: number;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("az", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ContactLog() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/campaigns/contact-log?q=${encodeURIComponent(q)}&page=${page}`
        );
        const data = await res.json();
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, page]);

  // Axtarış dəyişəndə birinci səhifəyə qayıt.
  useEffect(() => {
    setPage(1);
  }, [q]);

  return (
    <section className="rounded-xl border border-admin-line bg-admin-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-cyan-700" />
          Müştəri əlaqə jurnalı
          <span className="text-xs font-normal text-zinc-500">({total})</span>
        </h2>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Müştəri axtar (ad / email / nömrə)…"
            className="w-full rounded-md border border-admin-line bg-admin-card py-1.5 pl-9 pr-3 text-sm outline-none focus:border-violet-500/40"
          />
        </div>
      </header>

      <p className="px-5 pt-3 text-xs text-zinc-500">
        Kimə, nə vaxt və hansı kanaldan mesaj göndərdiyimizi göstərir — müştəriləri
        təkrar bezdirməmək üçün.
      </p>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Müştəri</th>
              <th className="px-3 py-2 text-left font-medium">Kanal</th>
              <th className="px-3 py-2 text-left font-medium">Tarix</th>
              <th className="px-3 py-2 text-left font-medium">Kampaniya</th>
              <th className="px-3 py-2 text-left font-medium">Klik</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-line">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  {q ? "Bu müştəriyə mesaj tapılmadı." : "Hələ mesaj göndərilməyib."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-admin-chip">
                <td className="px-3 py-2 align-top">
                  <Link href={`/admin/users/${r.userId}`} className="hover:underline">
                    {r.customerName ?? r.email}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {r.email}
                    {r.phone ? ` · ${r.phone}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex gap-1.5">
                    {r.channels.includes("Email") && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-500/30">
                        <Mail className="h-2.5 w-2.5" /> Email
                      </span>
                    )}
                    {r.channels.includes("WhatsApp") && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/30">
                        <MessageSquare className="h-2.5 w-2.5" /> WhatsApp
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 align-top whitespace-nowrap text-zinc-600">
                  {fmt(r.sentAt)}
                </td>
                <td className="px-3 py-2 align-top">
                  <Link
                    href={`/admin/campaigns/${r.campaignId}`}
                    className="text-violet-700 hover:underline"
                  >
                    {r.campaignTitle}
                  </Link>
                </td>
                <td className="px-3 py-2 align-top">
                  {r.clickCount > 0 ? (
                    <span className="font-medium text-violet-700">{r.clickCount}</span>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-admin-line px-5 py-3 text-sm text-zinc-600">
          <span>
            Səhifə {page} / {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-admin-line px-3 py-1.5 hover:bg-admin-chip disabled:opacity-40"
            >
              ← Əvvəlki
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-md border border-admin-line px-3 py-1.5 hover:bg-admin-chip disabled:opacity-40"
            >
              Növbəti →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
