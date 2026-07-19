import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import WinbackReasonClient from "./WinbackReasonClient";

export const dynamic = "force-dynamic";

export default async function WinbackReasonPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await prisma.whatsappWinbackInvite.findUnique({
    where: { token: params.token },
    select: {
      token: true,
      productTitle: true,
      status: true,
      submittedAt: true,
      expiresAt: true,
    },
  });

  if (!invite) notFound();

  const used = invite.submittedAt != null || invite.status === "SUBMITTED";
  const expired = invite.expiresAt.getTime() < Date.now();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Link href="/" className="mb-6 inline-block text-xs text-zinc-500 hover:text-zinc-300">
          ← Honsell Store
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Niyə davam etmədin?</h1>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="text-zinc-200">{invite.productTitle}</span> abunəliyin bitdi və davam
            etmədin. Səbəbini bizimlə bölüşsən, xidmətimizi sənin üçün daha yaxşı edə bilərik.
            Bir neçə saniyə çəkir 🙏
          </p>
        </header>

        {used ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
            Cavabın üçün təşəkkürlər! Fikrini nəzərə alacağıq.
            <div className="mt-4">
              <Link
                href="/"
                className="inline-flex rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                Honsell Store-a keç
              </Link>
            </div>
          </div>
        ) : expired ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
            Bu link köhnəldi (30 gün keçib). Fikrini bildirmək üçün dəstəklə əlaqə saxla.
          </div>
        ) : (
          <WinbackReasonClient token={invite.token} />
        )}
      </div>
    </main>
  );
}
