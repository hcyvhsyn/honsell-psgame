import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MousePointerClick, ShoppingCart, Users, Send } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDateTime } from "@/lib/format";
import type { CampaignGame } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      createdBy: { select: { name: true, email: true } },
      recipients: {
        orderBy: [{ clickCount: "desc" }, { createdAt: "asc" }],
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!campaign) notFound();

  const games = (campaign.gamesSnapshot as unknown as CampaignGame[]) ?? [];
  const productIds = games.map((g) => g.productId);

  // ── Klik statistikası ──
  const totalClicks = campaign.recipients.reduce((s, r) => s + r.clickCount, 0);
  const uniqueClickers = campaign.recipients.filter((r) => r.clickCount > 0).length;

  // ── Konversiya (satış) atribusiyası ──
  // Kampaniya göndərildikdən sonra, alıcıların kampaniyadakı oyunlardan birini
  // uğurla almasını sayırıq.
  const recipientUserIds = campaign.recipients.map((r) => r.userId);
  const since = campaign.sentAt ?? campaign.createdAt;

  const purchases =
    productIds.length > 0 && recipientUserIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            userId: { in: recipientUserIds },
            status: "SUCCESS",
            type: "PURCHASE",
            createdAt: { gte: since },
            game: { is: { productId: { in: productIds } } },
          },
          select: {
            userId: true,
            amountAznCents: true,
            createdAt: true,
            game: { select: { title: true, productId: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const buyerIds = new Set(purchases.map((p) => p.userId));
  const revenueCents = purchases.reduce((s, p) => s + Math.abs(p.amountAznCents), 0);
  const purchasesByUser = new Map<string, number>();
  for (const p of purchases) {
    purchasesByUser.set(p.userId, (purchasesByUser.get(p.userId) ?? 0) + 1);
  }

  const channels = [campaign.sendEmail ? "Email" : null, campaign.sendWhatsapp ? "WhatsApp" : null]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="space-y-6">
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" /> Bütün kampaniyalar
      </Link>

      <header className="rounded-xl border border-admin-line bg-admin-card p-6">
        <h1 className="text-2xl font-semibold">{campaign.title}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {channels || "—"} · {fmtDateTime(campaign.sentAt ?? campaign.createdAt)} ·{" "}
          {campaign.createdBy?.name ?? campaign.createdBy?.email ?? "—"}
        </p>
        {campaign.messageText && (
          <p className="mt-3 whitespace-pre-line rounded-md bg-admin-chip/40 p-3 text-sm text-zinc-700">
            {campaign.messageText}
          </p>
        )}
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Send className="h-4 w-4" />} label="Alıcı" value={campaign.recipientCount.toLocaleString()} />
        <Kpi
          label="Email ✓ / ✗"
          value={`${campaign.emailSent} / ${campaign.emailFailed}`}
        />
        <Kpi
          label="WhatsApp ✓ / ✗"
          value={`${campaign.waSent} / ${campaign.waFailed}`}
        />
        <Kpi
          icon={<MousePointerClick className="h-4 w-4" />}
          label="Klik (unikal)"
          value={`${totalClicks} (${uniqueClickers})`}
          tone="indigo"
        />
        <Kpi
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Satış (nəfər)"
          value={`${purchases.length} (${buyerIds.size})`}
          tone="emerald"
        />
        <Kpi label="Gəlir" value={fmtAzn(revenueCents)} tone="emerald" />
      </div>

      {/* Oyunlar */}
      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="border-b border-admin-line px-5 py-3">
          <h2 className="text-sm font-semibold">Kampaniya oyunları ({games.length})</h2>
        </header>
        <div className="flex flex-wrap gap-2 p-4">
          {games.map((g) => (
            <span
              key={g.productId}
              className="inline-flex items-center gap-1.5 rounded-full bg-admin-chip px-2.5 py-1 text-xs text-zinc-700 ring-1 ring-admin-line2"
            >
              {g.title}
              <span className="font-semibold text-zinc-900">{g.finalAzn.toFixed(2)} AZN</span>
              {g.discountPct != null && (
                <span className="text-violet-700">-{g.discountPct}%</span>
              )}
            </span>
          ))}
        </div>
      </section>

      {/* Alıcılar */}
      <section className="rounded-xl border border-admin-line bg-admin-card">
        <header className="flex items-center gap-2 border-b border-admin-line px-5 py-3">
          <Users className="h-4 w-4 text-cyan-700" />
          <h2 className="text-sm font-semibold">Alıcılar ({campaign.recipients.length})</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-admin-card text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Müştəri</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">WhatsApp</th>
                <th className="px-4 py-2 text-left font-medium">Klik</th>
                <th className="px-4 py-2 text-left font-medium">Son klik</th>
                <th className="px-4 py-2 text-left font-medium">Aldı?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-line">
              {campaign.recipients.map((r) => {
                const bought = purchasesByUser.get(r.userId) ?? 0;
                return (
                  <tr key={r.id} className="hover:bg-admin-chip">
                    <td className="px-4 py-2 align-top">
                      <Link href={`/admin/users/${r.userId}`} className="hover:underline">
                        {r.user.name ?? r.email}
                      </Link>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <ChannelStatus status={r.emailStatus} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <ChannelStatus status={r.waStatus} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      {r.clickCount > 0 ? (
                        <span className="font-semibold text-violet-700">{r.clickCount}</span>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 align-top whitespace-nowrap text-zinc-600">
                      {r.lastClickAt ? fmtDateTime(r.lastClickAt) : "—"}
                    </td>
                    <td className="px-4 py-2 align-top">
                      {bought > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/30">
                          <ShoppingCart className="h-3 w-3" /> {bought} alış
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChannelStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    SENT: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
    FAILED: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
    SKIPPED: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
    N_A: "bg-admin-chip text-zinc-500 ring-admin-line2",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${
        map[status] ?? "bg-admin-chip text-zinc-700 ring-admin-line2"
      }`}
    >
      {status === "N_A" ? "—" : status}
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "indigo" | "emerald";
}) {
  const ring =
    tone === "indigo"
      ? "ring-violet-500/20"
      : tone === "emerald"
        ? "ring-emerald-500/20"
        : "ring-admin-line";
  return (
    <div className={`rounded-xl border border-admin-line bg-admin-card p-3 ring-1 ${ring}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
