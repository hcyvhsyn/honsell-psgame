import type { Metadata } from "next";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import { getPublicReferralRates } from "@/lib/publicReferralRates";
import ReferralRatesExperience from "./ReferralRatesExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referal faizləri — dostlarını dəvət et, qazan",
  description:
    "Honsell referal proqramında real məhsul faizlərini gör, qazancını hesabla və dostlarını dəvət etməyə başla.",
  alternates: { canonical: "/referal-faizleri" },
};

export default async function ReferralRatesPublicPage() {
  const [groups, user] = await Promise.all([
    getPublicReferralRates(),
    getCurrentUser(),
  ]);

  return (
    <main className="min-h-screen">
      <SiteHeaderServer />
      <ReferralRatesExperience
        groups={groups}
        referralCode={user?.referralCode ?? null}
      />
    </main>
  );
}
