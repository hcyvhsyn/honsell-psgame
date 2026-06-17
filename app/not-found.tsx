import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Gamepad2,
  Gift,
  Home,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Səhifə tapılmadı",
  robots: { index: false, follow: false },
};

const quickLinks = [
  { href: "/", label: "Ana səhifə", Icon: Home },
  { href: "/oyunlar", label: "Oyun kataloqu", Icon: Gamepad2 },
  { href: "/streaming", label: "Streaming", Icon: Sparkles },
  { href: "/hediyye-kartlari/honsell", label: "Hədiyyə kartları", Icon: Gift },
];

export default function NotFound() {
  return (
    <main className="relative z-[200] grid min-h-screen place-items-center overflow-hidden bg-[#080812] px-4 py-10 text-[#f8f7ff] sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(124,58,237,0.22),transparent_30%,rgba(14,165,233,0.14)_64%,rgba(16,185,129,0.14))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.45)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-300/45 to-transparent" />

      <section className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <Link href="/" aria-label="Honsell ana səhifə" className="mb-10 inline-flex">
          <Image
            src="/honsell-logo.svg"
            alt="Honsell"
            width={176}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-violet-100 shadow-[0_18px_58px_-34px_rgba(124,58,237,0.95)] backdrop-blur">
          <Search className="h-3.5 w-3.5 text-cyan-200" />
          404
        </div>

        <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] tracking-tight text-[#f8f7ff] sm:text-7xl lg:text-8xl">
          Bu səhifə artıq burada deyil
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-[#c8c3d8] sm:text-lg">
          Link dəyişmiş, məhsul köçürülmüş və ya ünvan səhv yazılmış ola bilər.
          Səni ən doğru yerə qaytaraq.
        </p>

        <div className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f8f7ff] px-5 py-3 text-sm font-black text-[#0d0d18] shadow-[0_22px_60px_-32px_rgba(255,255,255,0.9)] transition hover:-translate-y-0.5 hover:bg-[#ebe8ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <Home className="h-4 w-4" />
            Ana səhifəyə qayıt
          </Link>
          <Link
            href="/oyunlar"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-black text-[#f8f7ff] shadow-[0_18px_48px_-34px_rgba(14,165,233,0.9)] backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:bg-white/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
          >
            <Search className="h-4 w-4 text-cyan-200" />
            Kataloqda axtar
          </Link>
        </div>

        <div className="mt-9 grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {quickLinks.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-4 text-sm font-bold text-[#ddd8ee] transition hover:-translate-y-0.5 hover:border-violet-200/40 hover:bg-white/[0.08] hover:text-[#f8f7ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/65"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-[#0d1020]/70 text-violet-100 transition group-hover:border-cyan-200/35 group-hover:text-cyan-100">
                <Icon className="h-5 w-5" />
              </span>
              <span className="leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/faq"
          className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#a9a3bc] transition hover:text-[#f8f7ff]"
        >
          <MessageCircle className="h-4 w-4 text-emerald-200" />
          Yardım bölməsinə keç
        </Link>

        <div className="mt-10 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#77708c]">
          <ArrowLeft className="h-3.5 w-3.5" />
          Honsell Store
        </div>
      </section>
    </main>
  );
}
