"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  User as UserIcon,
  Users as UsersIcon,
  Ban,
} from "lucide-react";

export type TreeNode = {
  id: string;
  name: string | null;
  email: string;
  referralCode: string;
  createdAt: string; // ISO
  emailVerified: boolean;
  disabled: boolean;
  directCount: number;
  descendantCount: number;
  children: TreeNode[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("az", { day: "2-digit", month: "short", year: "numeric" });
}

/** Filter a node to the paths that lead to a query match. Returns null if nothing matches. */
function filterNode(node: TreeNode, q: string): TreeNode | null {
  const selfMatch =
    (node.name?.toLowerCase().includes(q) ?? false) ||
    node.email.toLowerCase().includes(q) ||
    node.referralCode.toLowerCase().includes(q);

  const keptChildren = node.children
    .map((c) => filterNode(c, q))
    .filter((c): c is TreeNode => c !== null);

  if (!selfMatch && keptChildren.length === 0) return null;
  return { ...node, children: keptChildren };
}

export default function ReferralTreeClient({ roots }: { roots: TreeNode[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredRoots = useMemo(() => {
    if (!q) return roots;
    return roots
      .map((r) => filterNode(r, q))
      .filter((r): r is TreeNode => r !== null);
  }, [roots, q]);

  // When searching we force every rendered branch open; otherwise the caret
  // state is owned per-node by the Node component.
  const searching = q.length > 0;

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad, email və ya referral kodu ilə axtar…"
          className="w-full rounded-md border border-admin-line bg-admin-card py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-500/40"
        />
      </div>

      {filteredRoots.length === 0 ? (
        <div className="rounded-xl border border-admin-line bg-admin-card px-5 py-12 text-center text-sm text-zinc-500">
          {searching
            ? "Axtarışa uyğun referral ağacı tapılmadı."
            : "Hələ heç bir istifadəçi başqasını dəvət etməyib."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRoots.map((root) => (
            <div
              key={root.id}
              className="overflow-hidden rounded-xl border border-admin-line bg-admin-card"
            >
              <div className="flex items-center gap-2 border-b border-admin-line bg-admin-chip/40 px-4 py-2.5">
                <UsersIcon className="h-4 w-4 text-violet-700" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Kök dəvətçi
                </span>
                <span className="ml-auto text-xs text-zinc-500">
                  {root.descendantCount.toLocaleString()} nəfər downline ·{" "}
                  {root.directCount} birbaşa
                </span>
              </div>
              <div className="p-2">
                <Node node={root} depth={0} forceOpen={searching} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Node({
  node,
  depth,
  forceOpen,
}: {
  node: TreeNode;
  depth: number;
  forceOpen: boolean;
}) {
  // Root (depth 0) defaults open so each tree shows its first level immediately.
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isOpen = forceOpen || open;

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-admin-chip"
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={forceOpen}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-zinc-500 hover:bg-admin-line hover:text-zinc-800 disabled:opacity-50"
            aria-label={isOpen ? "Yığ" : "Aç"}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="grid h-5 w-5 shrink-0 place-items-center text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
        )}

        <UserIcon className="h-4 w-4 shrink-0 text-zinc-400" />

        <Link
          href={`/admin/users/${node.id}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <span className="truncate text-sm text-zinc-900 group-hover:underline">
            {node.name ?? <span className="text-zinc-500">(adsız)</span>}
          </span>
          {node.disabled && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-500/30">
              <Ban className="h-2.5 w-2.5" /> blok
            </span>
          )}
          <span className="truncate text-xs text-zinc-500">{node.email}</span>
          <span className="hidden shrink-0 font-mono text-[10px] text-zinc-400 sm:inline">
            {node.referralCode}
          </span>
        </Link>

        {hasChildren && (
          <span
            className="shrink-0 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-500/20"
            title={`${node.directCount} birbaşa dəvət`}
          >
            {node.directCount}
          </span>
        )}
        <span className="hidden shrink-0 text-xs text-zinc-400 md:inline">
          {fmtDate(node.createdAt)}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="relative">
          {node.children.map((child) => (
            <Node key={child.id} node={child} depth={depth + 1} forceOpen={forceOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
