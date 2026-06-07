import Link from "next/link";
import Logo from "@/components/Logo";

type AuthMode = "login" | "register";

export default function AuthPageShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: AuthMode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page-shell min-h-screen bg-[#141414] text-white">
      <div className="auth-page-canvas relative min-h-dvh overflow-hidden bg-[#141414]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_45%,rgba(112,42,214,0.34),transparent_27%),radial-gradient(circle_at_9%_77%,rgba(108,40,217,0.24),transparent_24%),linear-gradient(180deg,#141414_0%,#141414_58%,#15111f_100%)]" />

        <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col items-center px-4 py-6 sm:px-6 sm:py-8">
          <Logo href="/" height={32} priority className="auth-page-logo h-auto w-[10.75rem] sm:w-[12rem]" />

          <div className="auth-page-tabs mt-8 grid grid-cols-2 gap-2.5 sm:mt-10 sm:gap-3">
            <AuthTab href="/login" active={mode === "login"}>
              Daxil ol
            </AuthTab>
            <AuthTab href="/register" active={mode === "register"}>
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
