import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtAzn, fmtDate } from "@/lib/format";
import DepositActions from "./DepositActions";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const STATUSES = ["PENDING", "ALL", "SUCCESS", "FAILED"] as const;
const RECEIPT_BUCKET = "receipts";
const SIGNED_EXPIRES_SECONDS = 60;

export default async function AdminDepositsPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const status = String(searchParams.status ?? "PENDING").toUpperCase();
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const where = {
    type: "DEPOSIT",
    ...(status !== "ALL" ? { status } : {}),
  };

  const [pendingCount, total, deposits] = await Promise.all([
    prisma.transaction.count({
      where: { type: "DEPOSIT", status: "PENDING" },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  const receiptSignedById = new Map<string, string>();
  const needsSigning = deposits.filter(
    (d) =>
      typeof d.receiptUrl === "string" &&
      d.receiptUrl.length > 0 &&
      !d.receiptUrl.startsWith("http://") &&
      !d.receiptUrl.startsWith("https://")
  );

  if (needsSigning.length > 0) {
    try {
      const supabase = getSupabaseAdmin();
      const signed = await Promise.all(
        needsSigning.map(async (d) => {
          const path = d.receiptUrl as string;
          const { data, error } = await supabase.storage
            .from(RECEIPT_BUCKET)
            .createSignedUrl(path, SIGNED_EXPIRES_SECONDS);
          if (error || !data?.signedUrl) return null;
          return { id: d.id, url: data.signedUrl };
        })
      );
      for (const s of signed) {
        if (s) receiptSignedById.set(s.id, s.url);
      }
    } catch {
      // If signing fails, the UI will show a non-clickable placeholder.
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      ...(status !== "PENDING" ? { status } : {}),
      page: String(page),
      ...overrides,
    };
    if (merged.status === "PENDING") delete merged.status;
    return `/admin/deposits?${new URLSearchParams(merged).toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Deposit requests</h1>
          <p className="text-sm text-zinc-400">
            {pendingCount > 0 ? (
              <>
                <span className="font-semibold text-amber-300">
                  {pendingCount}
                </span>{" "}
                pending — review the receipt and approve or reject.
              </>
            ) : (
              "No pending deposits."
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {STATUSES.map((s) => {
          const active = status === s;
          return (
            <Link
              key={s}
              href={buildHref({ status: s, page: "1" })}
              className={`rounded-md px-2.5 py-1 text-xs ring-1 ${
                active
                  ? "bg-indigo-500/15 text-indigo-300 ring-indigo-500/30"
                  : "bg-zinc-900 text-zinc-300 ring-zinc-800 hover:bg-zinc-800"
              }`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      {deposits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center text-sm text-zinc-500">
          Bu filterlə nəticə yoxdur.
        </div>
      ) : (
        <ul className="space-y-3">
          {deposits.map((d) => (
            <li
              key={d.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-4 sm:flex-1">
                {(() => {
                  const raw = d.receiptUrl;
                  if (!raw) return null;
                  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
                  return receiptSignedById.get(d.id) ?? null;
                })() ? (
                  <a
                    href={
                      (d.receiptUrl?.startsWith("http://") || d.receiptUrl?.startsWith("https://")
                        ? d.receiptUrl
                        : receiptSignedById.get(d.id)) ?? undefined
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-24 w-24 shrink-0 overflow-hidden rounded-md ring-1 ring-zinc-800"
                  >
                    {/^.+\.pdf$/i.test(d.receiptUrl ?? "") ? (
                      <span className="grid h-full w-full place-items-center bg-zinc-950 text-xs text-zinc-400">
                        PDF
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          (d.receiptUrl?.startsWith("http://") || d.receiptUrl?.startsWith("https://")
                            ? d.receiptUrl
                            : receiptSignedById.get(d.id)) ?? ""
                        }
                        alt="receipt"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </a>
                ) : (
                  <div className="grid h-24 w-24 shrink-0 place-items-center rounded-md bg-zinc-950 text-[10px] text-zinc-500 ring-1 ring-zinc-800">
                    no file
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold">
                    {fmtAzn(d.amountAznCents)}
                  </div>
                  <Link
                    href={`/admin/users/${d.user.id}`}
                    className="block truncate text-sm text-zinc-300 hover:text-indigo-300"
                  >
                    {d.user.name ?? d.user.email}
                  </Link>
                  <div className="truncate text-xs text-zinc-500">
                    {d.user.email}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {fmtDate(d.createdAt)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill status={d.status} />
                {d.status === "PENDING" && <DepositActions depositId={d.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-md border border-zinc-800 px-3 py-1.5 hover:bg-zinc-900"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
    SUCCESS: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    FAILED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  };
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${
        map[status] ?? "bg-zinc-800 text-zinc-300 ring-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}
