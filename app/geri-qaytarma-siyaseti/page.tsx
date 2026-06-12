import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  Mail,
  RotateCcw,
  ShoppingCart,
  Undo2,
} from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { SITE_NAME } from "@/lib/site";

const description =
  "PlayStation Store-dan alınan rəqəmsal oyunların geri qaytarılması və ödənişin geri ödənilməsi ilə bağlı qaydalar. Səbətə əlavə edilib alınmış rəqəmsal məhsul geri qaytarıla bilmir.";

export const metadata: Metadata = {
  title: "Geri qaytarma və ödəniş qaydaları",
  description,
  alternates: { canonical: "/geri-qaytarma-siyaseti" },
  openGraph: {
    title: "Geri qaytarma və ödəniş qaydaları | Honsell PS Store",
    description,
    url: "/geri-qaytarma-siyaseti",
    type: "website",
  },
};

const updatedAt = "9 iyun 2026";

const sections = [
  {
    title: "Geri qaytarma mümkün olmayan hallar",
    items: [
      "Səbətə əlavə edilib sifarişi tamamlanmış və ödənişi həyata keçirilmiş rəqəmsal oyunlar geri qaytarılmır.",
      "Hesaba yüklənmiş və ya aktivləşdirilmiş oyun, DLC, abunəlik və ya hədiyyə kartı kodu geri qaytarıla bilmir.",
      "İstifadəçinin səhv ölkə, səhv hesab və ya səhv məhsul seçməsi geri qaytarma üçün əsas deyil.",
      "Endirimli və ya kampaniya çərçivəsində alınmış rəqəmsal məhsullar geri qaytarılmır.",
    ],
  },
  {
    title: "Niyə rəqəmsal oyunlar geri qaytarılmır?",
    items: [
      "PlayStation Store rəqəmsal məhsulları satışdan sonra geri qaytarmaq imkanı vermir.",
      "Oyun hesaba çatdırıldıqdan sonra kod və ya məzmun artıq istifadə olunmuş sayılır.",
      "Biz bu məhsulları sizin adınıza əldə edirik, ona görə də satış tamamlandıqdan sonra ləğv edilə bilmir.",
      "Bu qayda bütün rəqəmsal mağazalar üçün ümumi sənaye standartıdır.",
    ],
  },
  {
    title: "Sifarişdən əvvəl nəyə diqqət edin",
    items: [
      "Oyunun platformasını (PS4 / PS5) və bölgəsini sifarişdən əvvəl yoxlayın.",
      "Hesab məlumatlarının və seçilmiş məhsulun düzgünlüyünə əmin olun.",
      "Suallarınız olarsa, ödənişdən əvvəl bizimlə əlaqə saxlayın — sifarişdən sonra dəyişiklik mümkün olmaya bilər.",
      "Ödənişi yalnız bütün detalları yoxladıqdan sonra təsdiqləyin.",
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            <RotateCcw className="h-3.5 w-3.5" />
            Geri qaytarma
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Geri qaytarma və ödəniş qaydaları
          </h1>
          <p className="mt-5 text-base leading-8 text-zinc-300">
            Bu səhifə {SITE_NAME} üzərindən PlayStation Store rəqəmsal məhsullarının geri
            qaytarılması qaydalarını izah edir. Rəqəmsal oyun səbətə əlavə edilib sifarişi
            tamamlandıqda və ödənişi həyata keçirildikdə geri qaytarılması{" "}
            <span className="font-semibold text-amber-200">mümkün deyil</span>. Sifariş verməklə bu
            şərtləri qəbul etmiş olursunuz.
          </p>
          <p className="mt-3 text-sm text-zinc-500">Son yenilənmə: {updatedAt}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="flex items-start gap-4 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-6">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <div>
            <h2 className="text-lg font-black text-white">Diqqət: rəqəmsal məhsullar geri qaytarılmır</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-300">
              Səbətə əlavə edilib alınan oyun, abunəlik və ya kod təhvil verildikdən sonra geri
              qaytarıla və ya başqa məhsulla dəyişdirilə bilməz. Zəhmət olmasa ödənişdən əvvəl
              məhsulu, platformanı və bölgəni diqqətlə yoxlayın.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 sm:px-6 lg:px-8 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <ShoppingCart className="h-6 w-6 text-amber-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Satış qətidir</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Səbətə əlavə edilib ödənişi tamamlanan rəqəmsal sifariş yekun sayılır və geri
            qaytarılmır.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <Undo2 className="h-6 w-6 text-amber-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Dəyişdirmə yoxdur</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Təhvil verilmiş oyun və ya kod başqa məhsulla dəyişdirilə və ya geri alına bilməz.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <BadgeCheck className="h-6 w-6 text-amber-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Əvvəlcədən yoxlayın</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Platforma, bölgə və hesab məlumatlarını ödənişdən əvvəl yoxlamaq narahatlığın
            qarşısını alır.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-2xl border border-white/10 bg-zinc-900/45 p-6">
            <Mail className="h-7 w-7 text-amber-200" />
            <h2 className="mt-4 text-2xl font-black text-white">Probleminiz var?</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Sifarişlə bağlı texniki problem (məsələn, kod işləmir və ya yanlış məhsul təhvil
              verilib) olarsa, bizimlə əlaqə saxlayın. Belə halları fərdi qaydada araşdırırıq.
            </p>
            <a
              href="mailto:info@honsell.store"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white transition hover:bg-white/[0.09]"
            >
              <Mail className="h-4 w-4" />
              info@honsell.store
            </a>
          </aside>

          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-white/10 bg-zinc-900/45 p-6">
                <h2 className="text-xl font-black text-white">{section.title}</h2>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 text-sm leading-7 text-zinc-400">
          <p>
            Bu qaydalarda dəyişiklik olduqda bu səhifədə yenilənmiş tarix göstəriləcək. Əlavə
            suallar üçün{" "}
            <Link href="/haqqimizda" className="font-semibold text-white hover:text-amber-200">
              Haqqımızda
            </Link>{" "}
            səhifəsindəki əlaqə məlumatlarından və ya{" "}
            <Link href="/mexfilik-siyaseti" className="font-semibold text-white hover:text-amber-200">
              Məxfilik siyasəti
            </Link>{" "}
            səhifəsindən istifadə edə bilərsiniz.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
