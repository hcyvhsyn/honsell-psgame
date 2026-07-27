import { Suspense } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import WinnersHallClient from "./WinnersHallClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Qazananlar — ${SITE_NAME}`,
  description:
    "Honsell Store çəkilişlərinin real qazananları və onların rəyləri. Hədiyyələri həqiqətən veririk — özün bax.",
  alternates: { canonical: `${SITE_URL}/qazananlar` },
};

export default function WinnersHallPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <SiteHeader />
      <Suspense fallback={null}>
        <WinnersHallClient />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
