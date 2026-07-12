import { Suspense } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import GiveawayLandingClient from "./GiveawayLandingClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const g = await prisma.giveaway.findFirst({
    where: { id: params.id, status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { title: true, prizeLabel: true, prizeImageUrl: true },
  });

  if (!g) {
    return { title: `Çəkiliş — ${SITE_NAME}` };
  }

  const title = `${g.title} — ${SITE_NAME}`;
  const description = `🎁 ${g.prizeLabel} — çəkilişə qoşul, qeydiyyatdan keç və qazan!`;
  const url = `${SITE_URL}/cekilis/${params.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: g.prizeImageUrl ? [{ url: g.prizeImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: g.prizeImageUrl ? [g.prizeImageUrl] : undefined,
    },
  };
}

export default function GiveawayLandingPage({ params }: { params: { id: string } }) {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950">
      <SiteHeader />
      <Suspense fallback={null}>
        <GiveawayLandingClient id={params.id} />
      </Suspense>
      <SiteFooter />
    </main>
  );
}
