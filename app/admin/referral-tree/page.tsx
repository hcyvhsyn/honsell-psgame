import { Network } from "lucide-react";
import { prisma } from "@/lib/prisma";
import ReferralTreeClient, { type TreeNode } from "./ReferralTreeClient";

export const dynamic = "force-dynamic";

type RawUser = {
  id: string;
  name: string | null;
  email: string;
  referralCode: string;
  referredById: string | null;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: Date;
};

export default async function AdminReferralTreePage() {
  // Lightweight fetch of every user — we only need the affiliate edges to
  // reconstruct the full forest in memory.
  const users: RawUser[] = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      referredById: true,
      emailVerified: true,
      disabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const byId = new Map<string, RawUser>(users.map((u) => [u.id, u]));
  const childrenOf = new Map<string, RawUser[]>();
  for (const u of users) {
    // Treat a referrer that no longer exists as "no referrer" (orphan → root).
    const parentId = u.referredById && byId.has(u.referredById) ? u.referredById : null;
    if (!parentId) continue;
    const list = childrenOf.get(parentId);
    if (list) list.push(u);
    else childrenOf.set(parentId, [u]);
  }

  // Build a node + its subtree. `seen` guards against any accidental cycle.
  function build(u: RawUser, seen: Set<string>): TreeNode {
    seen.add(u.id);
    const kids = (childrenOf.get(u.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => build(c, seen));
    const descendantCount = kids.reduce((sum, k) => sum + 1 + k.descendantCount, 0);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      referralCode: u.referralCode,
      createdAt: u.createdAt.toISOString(),
      emailVerified: u.emailVerified,
      disabled: u.disabled,
      directCount: kids.length,
      descendantCount,
      children: kids,
    };
  }

  // Roots = top-of-chain users (no referrer / orphaned) that actually have a downline.
  const roots: TreeNode[] = [];
  for (const u of users) {
    const parentId = u.referredById && byId.has(u.referredById) ? u.referredById : null;
    if (parentId) continue;
    if (!childrenOf.has(u.id)) continue; // skip lonely roots with no referrals
    roots.push(build(u, new Set<string>()));
  }

  // Largest trees first.
  roots.sort((a, b) => b.descendantCount - a.descendantCount);

  const totalInTrees = roots.reduce((sum, r) => sum + 1 + r.descendantCount, 0);
  const maxDepth = roots.reduce((m, r) => Math.max(m, depthOf(r)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Network className="h-6 w-6 text-violet-700" />
            Referral ağacı
          </h1>
          <p className="text-sm text-zinc-600">
            Kim kimi dəvət edib — tam çoxsəviyyəli affiliate iyerarxiyası.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ağac (kök dəvətçi)" value={roots.length.toLocaleString()} />
        <Kpi label="Ağaclardakı istifadəçi" value={totalInTrees.toLocaleString()} tone="indigo" />
        <Kpi label="Ən böyük ağac" value={(roots[0]?.descendantCount ?? 0).toLocaleString()} tone="emerald" />
        <Kpi label="Maks. dərinlik" value={String(maxDepth)} tone="amber" />
      </div>

      <ReferralTreeClient roots={roots} />
    </div>
  );
}

function depthOf(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return 1 + node.children.reduce((m, c) => Math.max(m, depthOf(c)), 0);
}

function Kpi({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "indigo" | "emerald" | "amber";
}) {
  const ring =
    tone === "indigo"
      ? "ring-violet-500/20"
      : tone === "emerald"
        ? "ring-emerald-500/20"
        : tone === "amber"
          ? "ring-amber-500/20"
          : "ring-admin-line";
  return (
    <div className={`rounded-xl border border-admin-line bg-admin-card p-3 ring-1 ${ring}`}>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900">{value}</div>
    </div>
  );
}
