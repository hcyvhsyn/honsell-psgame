import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website Hazırlanması — Honsell",
  description:
    "Bizneslər üçün satış yönümlü, mobil uyğun və modern website hazırlayırıq. Layihə üçün müraciət edin.",
  alternates: { canonical: "/xidmetler/website" },
};

export default function WebsiteServicePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-violet-950 via-zinc-950 to-fuchsia-950 p-8 sm:p-12">
          <div className="relative z-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              Xidmət · Website hazırlanması
            </p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Bizneslər üçün satış yönümlü website hazırlanması
            </h1>
            <p className="mt-4 max-w-xl text-sm text-zinc-300 sm:text-base">
              Mobil uyğun, sürətli və modern dizaynlı websaytlar — biznesinizin
              online görünüşünü satış maşınına çevirir. Hər layihə fərdi qaydada
              hazırlanır.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/xidmetler/website/muraciet"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(124,58,237,0.7)] transition hover:from-violet-500 hover:to-fuchsia-500"
              >
                Layihə üçün müraciət et
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-zinc-400">
                150 AZN-dən başlayaraq · 3–5 gün ərzində təhvil
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* AI tahmini qiymət açıqlaması */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-fuchsia-950/30 p-8 sm:p-10">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                Layihəniz üçün təxmini qiymət — AI ilə dərhal
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-zinc-300">
                Hazır paket yoxdur — qiymət sizin tələblərinizə əsasən
                formalaşır. Müraciət formundakı qısa briefinizə və seçdiyiniz
                əlavə funksiyalara görə süni intellekt dərhal təxmini aralıq
                hesablayır. Final qiymət danışıqdan sonra təsdiqlənir.
              </p>
              <Link
                href="/xidmetler/website/muraciet"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white hover:from-violet-500 hover:to-fuchsia-500"
              >
                Formu doldur və qiyməti gör
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-black text-white sm:text-3xl">Necə işləyir?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: 1,
              t: "Müraciət göndər",
              d: "Layihə formunu doldur — sayt növü, briefin və istəklərini paylaş.",
            },
            {
              n: 2,
              t: "Təxmini qiymət",
              d: "AI sənin briefinə və əlavələrinə görə dərhal təxmini aralığı hesablayır.",
            },
            {
              n: 3,
              t: "Əlaqə və təklif",
              d: "Komandamız WhatsApp üzərindən əlaqə saxlayır, detalları aydınlaşdırıb final təklifi göndərir.",
            },
            {
              n: 4,
              t: "Təhvil və dəstək",
              d: "Sayt hazır olduqdan sonra təhvil verilir və ilkin dəstək təmin edilir.",
            },
          ].map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/15 font-black text-violet-300 ring-1 ring-violet-500/30">
                {s.n}
              </div>
              <h3 className="mt-3 text-sm font-bold text-white">{s.t}</h3>
              <p className="mt-1 text-xs text-zinc-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-gradient-to-br from-violet-950/40 to-fuchsia-950/40 p-8 text-center sm:p-12">
          <h3 className="text-2xl font-black text-white sm:text-3xl">
            Layihənizi danışmağa hazırıq
          </h3>
          <p className="max-w-xl text-sm text-zinc-300">
            Forma cəmi bir neçə dəqiqə vaxt aparır. AI dərhal təxmini qiyməti
            göstərir, sonra komandamız WhatsApp-da əlaqə saxlayır.
          </p>
          <Link
            href="/xidmetler/website/muraciet"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_30px_-10px_rgba(124,58,237,0.7)] transition hover:from-violet-500 hover:to-fuchsia-500"
          >
            Layihə üçün müraciət et
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
