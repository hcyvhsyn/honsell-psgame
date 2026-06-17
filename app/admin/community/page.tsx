import { prisma } from "@/lib/prisma";
import CommunityAdminClient from "./CommunityAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminCommunityPage() {
  const counts = await prisma.communityPost.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.status] = c._count._all;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">İcma paylaşımları</h1>
        <p className="text-sm text-zinc-600">
          Honsell İcması divarında istifadəçilərin yazdığı fikirlərin moderasiyası.
          PENDING — admin onayını gözləyir; APPROVED — public görünür;
          REJECTED — rədd edilib; HIDDEN — onaylanmış, sonradan gizlədilib.
        </p>
      </div>

      <CommunityAdminClient initialCounts={countMap} />
    </div>
  );
}
