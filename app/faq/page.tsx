import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  HelpCircle,
  LifeBuoy,
  MessageCircle,
} from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { FAQ_SCOPES } from "@/lib/contentScopes";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import FaqSearchClient, { type FaqSearchGroup } from "./FaqSearchClient";

export const revalidate = 1800;

const description =
  "Honsell üzrə ən çox verilən suallar: sifariş, ödəniş, balans, PlayStation, streaming, abunəliklər və dəstək.";

export const metadata: Metadata = {
  title: "FAQ — Tez Verilən Suallar",
  description,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "FAQ — Tez Verilən Suallar | Honsell",
    description,
    url: "/faq",
    type: "website",
  },
};

type Faq = {
  id: string;
  question: string;
  answer: string;
  scope: string;
};

const FALLBACK_FAQS: Faq[] = [
  {
    id: "fallback-products",
    scope: "HOME",
    question: "Hansı məhsulları ala bilərəm?",
    answer:
      "PlayStation oyunları, PS Plus, gift card, Epic Games, streaming, musiqi, AI və iş platformaları bir yerdədir.",
  },
  {
    id: "fallback-delivery",
    scope: "HOME",
    question: "Sifariş nə qədər vaxta tamamlanır?",
    answer:
      "Avtomatik məhsullar adətən dərhal, hesab və manual aktivləşdirmə tələb edən sifarişlər isə statusla izlənərək tamamlanır.",
  },
  {
    id: "fallback-payment",
    scope: "HOME",
    question: "Ödəniş və balans necə işləyir?",
    answer:
      "Balansını artırıb məhsulu səbətdən ala bilərsən. Uğurlu ödənişdən sonra sifariş profilində görünür.",
  },
  {
    id: "fallback-support",
    scope: "HOME",
    question: "Kömək lazım olsa nə edim?",
    answer:
      "Saytdakı AI bot və dəstək kanalları sifariş, məhsul seçimi və aktivləşdirmə suallarında sənə kömək edir.",
  },
];

const scopeMetaByKey = new Map(FAQ_SCOPES.map((scope, index) => [scope.key, { ...scope, index }]));

function groupFaqs(items: Faq[]): FaqSearchGroup[] {
  const groups = new Map<string, Faq[]>();
  for (const item of items) {
    const list = groups.get(item.scope) ?? [];
    list.push(item);
    groups.set(item.scope, list);
  }

  return Array.from(groups.entries())
    .map(([scope, list]) => ({
      scope,
      label: scopeMetaByKey.get(scope)?.label ?? scope.replaceAll("_", " "),
      description: scopeMetaByKey.get(scope)?.description ?? "/faq",
      items: list.map(({ id, question, answer }) => ({ id, question, answer })),
      index: scopeMetaByKey.get(scope)?.index ?? 999,
    }))
    .sort((a, b) => a.index - b.index || a.label.localeCompare(b.label, "az"));
}

export default async function FaqPage() {
  const dbFaqs = await prisma.faqItem
    .findMany({
      where: { isActive: true },
      orderBy: [{ scope: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, question: true, answer: true, scope: true },
    })
    .catch(() => [] as Faq[]);

  const faqs = dbFaqs.length > 0 ? dbFaqs : FALLBACK_FAQS;
  const groups = groupFaqs(faqs);
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE_URL}/faq`,
    mainEntity: faqs.slice(0, 40).map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeaderServer />

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.24),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.72),rgba(9,9,11,0))]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8 lg:py-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-200">
              <HelpCircle className="h-3.5 w-3.5" />
              FAQ
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Tez verilən suallar
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Sifarişdən əvvəl və sonra ən çox soruşulan mövzular burada toplanıb.
              Cavab tapa bilməsən, AI bot və dəstək kanalları sənə kömək edəcək.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/oyunlar"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
              >
                Məhsullara bax
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/icma"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white transition hover:bg-white/[0.09]"
              >
                İcmaya keç
              </Link>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black text-white">Cavab tapmadın?</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  AI bot məhsul seçimi, sifariş və aktivləşdirmə suallarını cavablayır.
                </p>
              </div>
            </div>
            <Link
              href="/#niye-biz"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-zinc-900"
            >
              Dəstək məlumatları
              <MessageCircle className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </section>

      <FaqSearchClient groups={groups} />

      <section className="border-y border-violet-300/20 bg-violet-500/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-200">
              {SITE_NAME}
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Sualın cavabı yoxdursa, birbaşa yaz.
            </h2>
          </div>
          <a
            href="mailto:info@honsell.store"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
          >
            info@honsell.store
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
