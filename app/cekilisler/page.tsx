import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import GiveawaysArchiveClient from "./GiveawaysArchiveClient";

export const metadata: Metadata = {
  title: `Çəkilişlər — ${SITE_NAME}`,
  description: "Honsell Store aktiv və keçmiş hədiyyə çəkilişləri. Qoşul, qeydiyyatdan keç və qazan!",
  alternates: { canonical: `${SITE_URL}/cekilisler` },
};

export default function GiveawaysArchivePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <SiteHeader />
      <GiveawaysArchiveClient />
      <SiteFooter />



      
    </main>
  );
}
