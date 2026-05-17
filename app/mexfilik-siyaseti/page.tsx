import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Database, LockKeyhole, Mail, ShieldCheck, UserCheck } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import { SITE_NAME } from "@/lib/site";

const description =
  "Honsell PS Store istifadəçi məlumatlarını necə topladığı, istifadə etdiyi və qoruduğu haqqında məxfilik siyasəti.";

export const metadata: Metadata = {
  title: "Məxfilik siyasəti",
  description,
  alternates: { canonical: "/mexfilik-siyaseti" },
  openGraph: {
    title: "Məxfilik siyasəti | Honsell PS Store",
    description,
    url: "/mexfilik-siyaseti",
    type: "website",
  },
};

const updatedAt = "12 may 2026";

const sections = [
  {
    title: "Topladığımız məlumatlar",
    items: [
      "Qeydiyyat və profil üçün ad, e-poçt, telefon və hesab məlumatları.",
      "Sifarişlərin icrası üçün səbət, məhsul, çatdırılma, PSN və xidmətə aid tələb olunan məlumatlar.",
      "Balans, bonus, referal, rəy, favorit və abunəlik əməliyyatlarının tarixçəsi.",
      "Saytın təhlükəsizliyi və işləməsi üçün IP ünvanı, cihaz, brauzer və texniki log məlumatları.",
    ],
  },
  {
    title: "Məlumatlardan istifadə",
    items: [
      "Sifarişləri qəbul etmək, ödənişi yoxlamaq və rəqəmsal məhsulu istifadəçiyə çatdırmaq.",
      "Hesab balansı, cashback, referal və istifadəçi dəstəyini idarə etmək.",
      "Fırıldaqçılıq, icazəsiz giriş və texniki problemlərin qarşısını almaq.",
      "Sayt performansını, məhsul seçimini və istifadəçi təcrübəsini yaxşılaşdırmaq.",
    ],
  },
  {
    title: "Paylaşım və xidmət təminatçıları",
    items: [
      "Ödəniş prosesi Epoint kimi ödəniş təminatçıları vasitəsilə aparıla bilər.",
      "E-poçt bildirişləri, hosting, analitika və təhlükəsizlik üçün etibarlı texniki xidmətlərdən istifadə edə bilərik.",
      "Qanuni tələb olduqda məlumatlar səlahiyyətli qurumlarla paylaşılır.",
      "Məlumatları marketinq məqsədi ilə üçüncü tərəflərə satmırıq.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeaderServer />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Məxfilik
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Məxfilik siyasəti
          </h1>
          <p className="mt-5 text-base leading-8 text-zinc-300">
            Bu siyasət {SITE_NAME} istifadəçilərinin məlumatlarının hansı məqsədlə toplandığını,
            necə istifadə edildiyini və qorunduğunu izah edir. Saytdan istifadə etməklə bu
            prinsiplərlə tanış olduğunuzu qəbul etmiş olursunuz.
          </p>
          <p className="mt-3 text-sm text-zinc-500">Son yenilənmə: {updatedAt}</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 sm:px-6 lg:px-8 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <Database className="h-6 w-6 text-emerald-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Minimum məlumat</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Xidməti göstərmək üçün lazım olan məlumatları toplayır və istifadə məqsədi bitdikdə
            artıq məlumatı azaltmağa çalışırıq.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <CreditCard className="h-6 w-6 text-emerald-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Kart məlumatları</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Kart ödənişləri ödəniş tərəfdaşı tərəfindən emal olunur. Honsell tam kart nömrəsini
            və CVV məlumatını öz sistemində saxlamır.
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <LockKeyhole className="h-6 w-6 text-emerald-200" />
          <h2 className="mt-4 text-lg font-bold text-white">Giriş təhlükəsizliyi</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Sessiya, sifariş və ödəniş məlumatları icazəsiz giriş riskini azaltmaq üçün qorunan
            sistemlərdə idarə olunur.
          </p>
        </article>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-2xl border border-white/10 bg-zinc-900/45 p-6">
            <UserCheck className="h-7 w-7 text-emerald-200" />
            <h2 className="mt-4 text-2xl font-black text-white">İstifadəçi hüquqları</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              Hesab məlumatlarına baxmaq, yanlış məlumatların düzəldilməsini istəmək və mümkün
              hallarda hesabın silinməsi ilə bağlı müraciət etmək üçün bizimlə əlaqə saxlaya
              bilərsiniz.
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
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
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
            Məxfilik siyasətində dəyişiklik olduqda bu səhifədə yenilənmiş tarix göstəriləcək.
            Əlavə suallar üçün <Link href="/haqqimizda" className="font-semibold text-white hover:text-emerald-200">Haqqımızda</Link>{" "}
            səhifəsindəki əlaqə məlumatlarından istifadə edə bilərsiniz.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
