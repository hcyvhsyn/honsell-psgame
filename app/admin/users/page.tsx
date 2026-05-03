import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
          { referralCode: { contains: q.toUpperCase() } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        _count: { select: { referrals: true, transactions: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-zinc-400">
            {total.toLocaleString()} {total === 1 ? "user" : "users"} total.
          </p>
        </div>

        <form className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email, name, referral code…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <Th>İstifadəçi</Th>
              <Th>Status</Th>
              <Th>Cüzdan</Th>
              <Th>Referallar</Th>
              <Th>Əməliyyat sayı</Th>
              <Th>Qeydiyyat</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                  No users match this search.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-900/40">
                <Td>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="block min-w-0"
                  >
                    <div className="truncate text-zinc-100">
                      {u.name ?? <span className="text-zinc-500">—</span>}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {u.email}
                    </div>
                    <div className="mt-0.5 inline-block rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 ring-1 ring-zinc-800">
                      {u.referralCode}
                    </div>
                  </Link>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    {u.emailVerified ? (
                      <span className="self-start rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                        Verified
                      </span>
                    ) : (
                      <span className="self-start rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300 ring-1 ring-amber-500/30">
                        Pending
                      </span>
                    )}
                    {u.role === "ADMIN" && (
                      <span className="self-start rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-indigo-500/30">
                        Admin
                      </span>
                    )}
                  </div>
                </Td>
                <Td>{fmtAzn(u.walletBalance)}</Td>
                <Td>{u._count.referrals}</Td>
                <Td>{u._count.transactions}</Td>
                <Td className="text-zinc-400">{fmtDate(u.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/users?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/users?${new URLSearchParams({
                  ...(q ? { q } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
