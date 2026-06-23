import { prisma } from "@/lib/prisma";
import InviteBonusesClient, { type AdminInviteBonus } from "./InviteBonusesClient";

export const dynamic = "force-dynamic";

export default async function AdminInviteBonusesPage() {
  const rows = await prisma.referralInviteBonus.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      amountCents: true,
      status: true,
      suspicious: true,
      flagReasons: true,
      createdAt: true,
      reviewedAt: true,
      referrer: { select: { id: true, name: true, email: true } },
      referee: { select: { id: true, name: true, email: true } },
    },
  });

  const bonuses: AdminInviteBonus[] = rows.map((r) => ({
    id: r.id,
    amountAzn: r.amountCents / 100,
    status: r.status as AdminInviteBonus["status"],
    suspicious: r.suspicious,
    reasons: parseReasons(r.flagReasons),
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    referrer: r.referrer,
    referee: r.referee,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dəvət bonusları</h1>
        <p className="text-sm text-zinc-600">
          Dəvət olunan istifadəçi nömrəsini təsdiqlədikdə dəvət edənə sabit bonus
          yazılır. Anti-spam şübhəli dəvətləri (təkrar/cəfəng ad, eyni IP, sürət)
          avtomatik gözləmədə saxlayır — burada təsdiqlə və ya rədd et. Təsdiqlənən
          bonus dəvət edənin referal balansına keçir. Məbləğləri{" "}
          <span className="font-medium">Tənzimləmələr</span> səhifəsindən idarə edirsən.
        </p>
      </div>

      <InviteBonusesClient initial={bonuses} />
    </div>
  );
}

function parseReasons(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
