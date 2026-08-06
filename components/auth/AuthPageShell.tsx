import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";

/**
 * `forgot` — /forgot-password üçün: HEÇ bir tab aktiv olmur, çünki istifadəçi
 * nə login, nə register axınındadır. Tab-lar həmin halda geri qayıtma
 * naviqasiyası rolunu oynayır.
 */
type AuthMode = "login" | "register" | "forgot";

export default function AuthPageShell({
  mode,
  title,
  subtitle,
  children,
  next,
}: {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Girişdən/qeydiyyatdan sonra yönləndiriləcək ünvan — tab-lar arasında qorunur. */
  next?: string;
}) {
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <main className="auth-page-shell min-h-screen bg-[#141414] text-white">
      <div className="auth-page-canvas relative min-h-dvh overflow-hidden bg-[#141414]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_45%,rgba(112,42,214,0.34),transparent_27%),radial-gradient(circle_at_9%_77%,rgba(108,40,217,0.24),transparent_24%),linear-gradient(180deg,#141414_0%,#141414_58%,#15111f_100%)]" />

        {/* Auth səhifələrində navbar YOXDUR (SiteHeader render olunmur), ona görə
            sayta qayıtmaq üçün yeganə çıxış budur. Sol üstdə sabit saxlanılır ki,
            logo mərkəzdə qalsın. `/` linkidir, `router.back()` deyil — tarixçə
            boş olanda (reklamdan/birbaşa linkdən gələn) düymə işləməz qalmasın. */}
        <Link
          href="/"
          className="absolute left-4 top-5 z-20 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.12] hover:text-white sm:left-6 sm:top-7 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Ana səhifə</span>
          <span className="sm:hidden">Geri</span>
        </Link>

        <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
          <Logo href="/" height={32} priority className="auth-page-logo h-auto w-[10.75rem] sm:w-[12rem]" />

          <div className="auth-page-tabs mt-8 grid grid-cols-2 gap-2.5 sm:mt-10 sm:gap-3">
            <AuthTab href={`/login${suffix}`} active={mode === "login"}>
              Daxil ol
            </AuthTab>
            <AuthTab href={`/register${suffix}`} active={mode === "register"}>
              Qeydiyyatdan keç
            </AuthTab>
          </div>

          <div className="auth-page-copy mt-7 text-center sm:mt-8">
            <h1 className="text-2xl font-semibold leading-tight tracking-normal text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm font-medium leading-relaxed text-white/48 sm:text-base">
              {subtitle}
            </p>
          </div>

          <div className="auth-page-content mt-6 sm:mt-7">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 min-w-0 items-center justify-center rounded-full border px-2 text-center text-sm font-medium tracking-normal transition sm:h-12 sm:px-4 sm:text-base ${
        active
          ? "border-transparent bg-gradient-to-r from-[#7a00ff] to-[#4b00a8] text-white shadow-[0_18px_46px_-26px_rgba(122,0,255,0.95)]"
          : "border-[#6a08d8] bg-transparent text-white hover:border-[#8128ff] hover:bg-white/[0.03]"
      }`}
    >
      {children}
    </Link>
  );
}
