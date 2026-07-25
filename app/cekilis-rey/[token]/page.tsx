import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import WinnerReviewClient from "./WinnerReviewClient";

export const dynamic = "force-dynamic";

export default async function WinnerReviewPage({
  params,
}: {
  params: { token: string };
}) {
  const entry = await prisma.giveawayEntry.findUnique({
    where: { reviewToken: params.token },
    select: {
      isWinner: true,
      reviewStatus: true,
      user: { select: { name: true } },
      giveaway: { select: { title: true, prizeLabel: true, prizeImageUrl: true } },
    },
  });

  if (!entry || !entry.isWinner) notFound();

  const submitted = entry.reviewStatus === "SUBMITTED";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Link href="/" className="mb-6 inline-block text-xs text-zinc-500 hover:text-zinc-300">
          ← Honsell Store
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🎁 Təbriklər, qazandın!</h1>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="text-zinc-200">{entry.giveaway.title}</span> çəkilişində{" "}
            <span className="text-zinc-200">{entry.giveaway.prizeLabel}</span> mükafatını
            qazandın. Təcrübəni qısa rəy kimi bölüş — rəyin çəkilişin altında göstəriləcək,
            beləcə hamı hədiyyələri həqiqətən verdiyimizə əmin olacaq.
          </p>
        </header>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
            Rəyin qeydə alındı. Töhfən üçün təşəkkürlər! 💜
            <div className="mt-4">
              <Link
                href="/#cekilisler"
                className="inline-flex rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                Çəkilişlərə bax
              </Link>
            </div>
          </div>
        ) : (
          <WinnerReviewClient
            token={params.token}
            name={entry.user.name ?? ""}
            prizeLabel={entry.giveaway.prizeLabel}
          />
        )}
      </div>
    </main>
  );
}
