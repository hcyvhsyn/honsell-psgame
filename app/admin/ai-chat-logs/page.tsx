import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import type { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function AdminAiChatLogsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = String(searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  // Axtarış: sual mətni VƏ YA müştəri (email/ad) üzrə. Müştəri axtarışı üçün
  // əvvəlcə uyğun user id-lərini tapırıq.
  let where: Prisma.AiChatLogWhereInput = {};
  if (q) {
    const matchedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 100,
    });
    const ids = matchedUsers.map((u) => u.id);
    where = {
      OR: [
        { question: { contains: q, mode: "insensitive" } },
        ...(ids.length > 0 ? [{ userId: { in: ids } }] : []),
      ],
    };
  }

  const [total, logs] = await Promise.all([
    prisma.aiChatLog.count({ where }),
    prisma.aiChatLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  // Səhifədəki user-ləri bir sorğuda yığ (FK relation yoxdur).
  const userIds = [...new Set(logs.map((l) => l.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      ...(q ? { q } : {}),
      page: String(page),
      ...overrides,
    };
    return `/admin/ai-chat-logs?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Söhbətləri</h1>
        <p className="text-sm text-zinc-400">
          Hansı müştəri &laquo;AI-dan soruş&raquo; köməkçisinə nə soruşub — sual və
          köməkçinin cavabı. Cəmi {total} sorğu.
        </p>
      </div>

      {/* Axtarış */}
      <form method="GET" className="flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Müştəri (email/ad) və ya sual mətni..."
          className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm sm:w-80"
        />
        <button
          type="submit"
          className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Axtar
        </button>
        {q && (
          <Link
            href="/admin/ai-chat-logs"
            className="rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
          >
            Təmizlə
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
          {q ? "Bu axtarışa uyğun nəticə yoxdur." : "Hələ AI sorğusu yoxdur."}
        </div>
      ) : (
        <ul className="space-y-3">
          {logs.map((l) => {
            const u = userById.get(l.userId);
            return (
              <li
                key={l.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  {u ? (
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-sm font-semibold text-zinc-200 hover:text-indigo-300"
                    >
                      {u.name ?? u.email}
                      <span className="ml-2 text-xs font-normal text-zinc-500">{u.email}</span>
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-400">Naməlum istifadəçi</span>
                  )}
                  <div className="flex items-center gap-2">
                    {l.productCount > 0 && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-500/30">
                        {l.productCount} məhsul
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">{fmtDate(l.createdAt)}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="rounded-lg bg-violet-600/10 px-3 py-2 ring-1 ring-violet-500/20">
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-400">
                      Sual
                    </span>
                    <span className="text-zinc-100">{l.question}</span>
                  </div>
                  <div className="whitespace-pre-wrap rounded-lg bg-white/[0.03] px-3 py-2 text-zinc-300 ring-1 ring-white/5">
                    <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                      Cavab
                    </span>
                    {l.reply}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Səhifə {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                ← Əvvəlki
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                Sonrakı →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
