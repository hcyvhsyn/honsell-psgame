import ActivationMethodTabs from "@/components/ActivationMethodTabs";
import { getActivationMethodsCached } from "@/lib/activationSteps";

/**
 * «Məhsul necə aktivləşdirilir?» bölməsinin server qabığı.
 *
 * Məzmun tam admin paneldən gəlir (`/admin/activation-steps`): üsul, başlıq,
 * opsional izah və opsional ekran görüntüsü. Addım yoxdursa bölmə TAMAM render
 * olunmur — boş başlıq göstərmək səhifəni yalnız şişirdir.
 *
 * Nömrələmə/tab məntiqi client-dədir ([ActivationMethodTabs](./ActivationMethodTabs.tsx)),
 * çünki üsul seçimi interaktivdir. Data burada oxunur ki, `lib/prisma` client
 * bundle-a düşməsin.
 */
export default async function ActivationStepsSection({
  scope,
  id,
  title = "Məhsul necə aktivləşdirilir?",
  subtitle,
}: {
  scope: string;
  /** Hero-dan anchor keçidi üçün (`#aktivlesdirme`). */
  id?: string;
  title?: string;
  subtitle?: string;
}) {
  const groups = await getActivationMethodsCached(scope);
  const total = groups.reduce((n, g) => n + g.steps.length, 0);
  if (total === 0) return null;

  const multiMethod = groups.length > 1 && groups.every((g) => g.method.length > 0);
  // Çox üsul varsa "birini seç" xəbərdarlığı ƏSAS mesajdır — admin subtitle
  // yazmasa da göstərilir, yoxsa müştəri yenə hamısını etməli sanır.
  const lead =
    subtitle ??
    (multiMethod
      ? "Aşağıdaki üsullardan BİRİNİ seç — hər biri özlüyündə tam yoldur, hamısını etmək lazım deyil."
      : null);

  return (
    <section id={id} className="relative scroll-mt-24 overflow-hidden py-14 sm:py-20">
      {/* Fon işığı — bölmə səhifənin qalanından ayrılsın */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[min(900px,100%)] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="site-container relative">
        <header className="mb-9 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-violet-700 dark:text-violet-300">
            {multiMethod ? `${groups.length} üsul` : `${total} addım`}
          </span>
          <h2 className="mt-4 text-3xl font-black leading-[1.1] tracking-tight text-zinc-950 sm:text-4xl dark:text-white">
            {title.replace(/\?$/, "")}
            <span className="text-violet-500">?</span>
          </h2>
          {lead && (
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              {lead}
            </p>
          )}
        </header>

        <div className="max-w-3xl">
          <ActivationMethodTabs groups={groups} />
        </div>
      </div>
    </section>
  );
}
