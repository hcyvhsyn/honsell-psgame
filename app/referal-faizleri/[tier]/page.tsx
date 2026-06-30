import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import { getPublicTierViews } from "@/lib/publicReferralRates";
import ReferralRatesExperience from "../ReferralRatesExperience";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tier: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tier } = await params;
  const views = await getPublicTierViews();
  const view = views.find((v) => v.key === tier);
  if (!view || view.key === "default") return { title: "Referal faizləri" };
  return {
    title: `${view.label} — referal faizləri`,
    description: `${view.label} statusu üçün Honsell referal komissiya faizləri.`,
    alternates: { canonical: `/referal-faizleri/${view.key}` },
  };
}

export default async function AmbassadorRatesPage({ params }: Props) {
  const { tier } = await params;
  const [tierViews, user] = await Promise.all([getPublicTierViews(), getCurrentUser()]);

  const view = tierViews.find((v) => v.key === tier);
  // Yalnız mövcud Ambassador (qeyri-default) seqmentləri üçün ayrıca səhifə.
  if (!view || view.key === "default") notFound();

  return (
    <main className="min-h-screen">
      <SiteHeaderServer />
      <ReferralRatesExperience
        tierViews={tierViews}
        activeTierKey={tier}
        referralCode={user?.referralCode ?? null}
      />
    </main>
  );
}
