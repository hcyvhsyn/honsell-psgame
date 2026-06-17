import Link from "next/link";
import { Megaphone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveDiscountedGames } from "@/lib/campaigns";
import { isWasenderConfigured } from "@/lib/wasender";
import { fmtDateTime } from "@/lib/format";
import CampaignComposer from "./CampaignComposer";
import ContactLog from "./ContactLog";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const [tiers, games, campaigns] = await Promise.all([
    prisma.customerTier.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    getActiveDiscountedGames({ limit: 300 }),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { clicks: true } },
      },
    }),
  ]);

  const waConfigured = isWasenderConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Megaphone className="h-6 w-6 text-violet-700" />
          Reklam / Kampaniya
        </h1>
        <p className="text-sm text-zinc-600">
          Seçilmiş müştərilərə seçilmiş endirimli oyunların qiymətlərini WhatsApp və
          Email ilə toplu göndərin.
        </p>
      </div>

      {!waConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700">
          WhatsApp inteqrasiyası (WASENDER) konfiqurasiya edilməyib — yalnız Email kanalı
          istifadə oluna bilər.
        </div>
      )}

      <CampaignComposer tiers={tiers} initialGames={games} waConfigured={waConfigured} />

      {/* Tarixçə */}
      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">Kampaniya tarixçəsi ({campaigns.length})</h2>
        </header>
        {campaigns.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">Hələ kampaniya göndərilməyib.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Başlıq</th>
                  <th className="px-4 py-2 text-left font-medium">Kanal</th>
                  <th className="px-4 py-2 text-left font-medium">Alıcı</th>
                  <th className="px-4 py-2 text-left font-medium">Email (✓/✗)</th>
                  <th className="px-4 py-2 text-left font-medium">WhatsApp (✓/✗)</th>
                  <th className="px-4 py-2 text-left font-medium">Klik</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Tarix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-line">
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 align-top">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-medium text-violet-700 hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.kind === "REVIEW_INVITE" && (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-300">
                          ⭐ Rəy dəvəti
                        </span>
                      )}
                      <div className="text-xs text-zinc-500">
                        {c.createdBy?.name ?? c.createdBy?.email ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top text-zinc-700">
                      {[c.sendEmail ? "Email" : null, c.sendWhatsapp ? "WhatsApp" : null]
                        .filter(Boolean)
                        .join(" + ") || "—"}
                    </td>
                    <td className="px-4 py-2 align-top text-zinc-700">{c.recipientCount}</td>
                    <td className="px-4 py-2 align-top">
                      <span className="text-emerald-700">{c.emailSent}</span>
                      {" / "}
                      <span className="text-rose-700">{c.emailFailed}</span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span className="text-emerald-700">{c.waSent}</span>
                      {" / "}
                      <span className="text-rose-700">{c.waFailed}</span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span className="font-medium text-violet-700">{c._count.clicks}</span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <StatusChip status={c.status} />
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap text-zinc-600">
                      {fmtDateTime(c.sentAt ?? c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Müştəri əlaqə jurnalı — anti-spam görünürlüyü */}
      <ContactLog />
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    SENT: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
    SENDING: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    FAILED: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
    DRAFT: "bg-admin-chip text-zinc-700 ring-admin-line2",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        map[status] ?? "bg-admin-chip text-zinc-700 ring-admin-line2"
      }`}
    >
      {status}
    </span>
  );
}
