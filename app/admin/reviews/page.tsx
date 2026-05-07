import { prisma } from "@/lib/prisma";
import ReviewsAdminClient from "./ReviewsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  const counts = await prisma.gameReview.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const countMap: Record<string, number> = {};
  for (const c of counts) countMap[c.status] = c._count._all;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Oyun rəyləri</h1>
        <p className="text-sm text-zinc-400">
          Oyun səhifələrində istifadəçilərin yazdığı rəylərin moderasiyası.
          PENDING — admin onayını gözləyir; APPROVED — public görünür;
          REJECTED — rədd edilib; HIDDEN — onaylanmış, sonradan gizlədilib.
        </p>
      </div>

      <ReviewsAdminClient initialCounts={countMap} />
    </div>
  );
}
