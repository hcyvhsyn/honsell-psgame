import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { getCurrentUser } from "@/lib/auth";
import { getPublicStudentRates } from "@/lib/publicReferralRates";
import StudentPartnerExperience from "../StudentPartnerExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Student Partner — tələbələr üçün referal faizləri",
  description:
    "Honsell Student Partner proqramı: tələbələr üçün referal komissiya faizlərini gör, qazancını hesabla və kampusda paylaşmağa başla.",
  alternates: { canonical: "/referal-faizleri/telebe" },
};

export default async function StudentPartnerRatesPage() {
  const [groups, user] = await Promise.all([getPublicStudentRates(), getCurrentUser()]);

  // Student tier hələ seed olunmayıbsa səhifə yoxdur.
  if (!groups) notFound();

  return (
    <main className="min-h-screen">
      <SiteHeaderServer />
      <StudentPartnerExperience
        groups={groups}
        referralCode={user?.referralCode ?? null}
        standalone
      />
    </main>
  );
}
