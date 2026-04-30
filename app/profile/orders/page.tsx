import Image from "next/image";
import Link from "next/link";
import { Receipt, Gamepad2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  type OrderRow = {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    amountAznCents: number;
    game: { id: string; title: string; imageUrl: string | null; platform: string | null; productType: string } | null;
    serviceProduct?: { title: string; type: string } | null;
    serviceCode?: { code: string } | null;
    psnAccount: { id: string; label: string; psnEmail: string } | null;
  };

  let rows: OrderRow[] = [];
  try {
    rows = (await prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        game: {
          select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
        },
        serviceProduct: {
          select: { title: true, type: true },
        },
        serviceCode: {
          select: { code: true },
        },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    })) as unknown as OrderRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Transaction.serviceProductId") || msg.includes("serviceProductId")) {
      rows = (await prisma.transaction.findMany({
        where: { userId: user.id, type: "PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          game: {
            select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
          },
          psnAccount: { select: { id: true, label: true, psnEmail: true } },
        },
      })) as unknown as OrderRow[];
    } else {
      throw err;
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Sifarişlər</h2>
        <p className="text-sm text-zinc-400">
          Etdiyin bütün alışlar və hansı PSN hesabına çatdırıldığı.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
          <Receipt className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">Hələ sifariş yoxdur.</p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                  {r.game?.imageUrl ? (
                    <Image src={r.game.imageUrl} alt={r.game.title} fill sizes="56px" className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      <Gamepad2 className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 sm:hidden">
                  <p className="truncate text-sm font-medium">{r.type === "SERVICE_PURCHASE" ? r.serviceProduct?.title : (r.game?.title ?? "Silinmiş məhsul")}</p>
                  <p className="text-[10px] uppercase text-emerald-400">{r.status}</p>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="hidden truncate text-sm font-medium sm:block">
                  {r.type === "SERVICE_PURCHASE" ? r.serviceProduct?.title : (r.game?.title ?? "Silinmiş məhsul")}
                </p>
                <div className="text-xs text-zinc-500">
                  {new Date(r.createdAt).toLocaleString("az-AZ")}
                  {r.psnAccount && (
                    <>
                      {" "}· <span className="text-zinc-300">{r.psnAccount.label}</span> ({r.psnAccount.psnEmail})
                    </>
                  )}
                </div>
                {r.serviceCode && (
                  <div className="mt-2 rounded bg-emerald-500/10 p-2 text-sm">
                    <span className="text-emerald-500/60 mr-2 text-xs">Kodunuz:</span>
                    <span className="select-all font-mono font-bold tracking-widest text-emerald-400">{r.serviceCode.code}</span>
                  </div>
                )}
                {r.type === "SERVICE_PURCHASE" && !r.serviceCode && (
                  <div className="mt-1 text-xs text-zinc-400">
                    {r.status === "PENDING" && "Admin tərəfindən icra edilir..."}
                    {r.status === "SUCCESS" && "Sifariş tamamlandı."}
                    {r.status === "FAILED" && <span className="text-rose-400">Sifariş rədd edildi (Balans qaytarıldı).</span>}
                  </div>
                )}
              </div>

              <div className="text-right sm:ml-auto">
                <p className="text-sm font-semibold">
                  {(Math.abs(r.amountAznCents) / 100).toFixed(2)} AZN
                </p>
                <p className={`mt-0.5 hidden text-[10px] uppercase tracking-wide sm:block ${
                  r.status === "SUCCESS" ? "text-emerald-400" : r.status === "PENDING" ? "text-amber-400" : "text-rose-400"
                }`}>
                  {r.status}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
