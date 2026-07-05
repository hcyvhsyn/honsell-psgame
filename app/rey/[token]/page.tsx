import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ReviewWizardClient from "./ReviewWizardClient";

export const dynamic = "force-dynamic";

export default async function WhatsappReviewPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await prisma.whatsappReviewInvite.findUnique({
    where: { token: params.token },
    select: {
      token: true,
      productTitle: true,
      status: true,
      usedAt: true,
      expiresAt: true,
      userId: true,
    },
  });

  if (!invite) notFound();

  const used = invite.usedAt != null || invite.status === "SUBMITTED";
  const expired = invite.expiresAt.getTime() < Date.now();

  // Mövcud müştəri: ad/email məlum olduğu üçün wizard həmin addımları atlayır.
  const knownCustomer = invite.userId
    ? await prisma.user
        .findUnique({
          where: { id: invite.userId },
          select: { name: true, email: true },
        })
        .then((u) =>
          u ? { name: u.name ?? "", email: u.email } : null
        )
        .catch(() => null)
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Link href="/" className="mb-6 inline-block text-xs text-zinc-500 hover:text-zinc-300">
          ← Honsell Store
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Rəyini bizimlə bölüş</h1>
          <p className="mt-2 text-sm text-zinc-400">
            <span className="text-zinc-200">{invite.productTitle}</span> üçün təcrübəni
            qiymətləndir. Bir neçə addımda tamamlanır — həm rəyin dərc olunur, həm də
            honsell.store hesabın yaranır.
          </p>
        </header>

        {used ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-sm text-emerald-200">
            Bu link üçün artıq rəy yazılıb. Töhfən üçün təşəkkürlər!
            <div className="mt-4">
              <Link
                href="/#reyler"
                className="inline-flex rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30"
              >
                Rəylərə bax
              </Link>
            </div>
          </div>
        ) : expired ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-200">
            Bu link köhnəldi (30 gün keçib). Yeni link almaq üçün dəstəklə əlaqə saxla.
          </div>
        ) : (
          <ReviewWizardClient
            token={invite.token}
            productTitle={invite.productTitle}
            knownCustomer={knownCustomer}
          />
        )}
      </div>
    </main>
  );
}
