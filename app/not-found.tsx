import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Gamepad2,
  Home,
  Monitor,
  Music,
  Search,
  Tv,
} from "lucide-react";
import SiteHeaderServer from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Səhifə tapılmadı",
  robots: { index: false, follow: false },
};

const quickLinks = [
  { href: "/playstation", label: "PlayStation", Icon: Gamepad2 },
  { href: "/epic-games", label: "PC oyunları", Icon: Monitor },
  { href: "/streaming", label: "Streaming", Icon: Tv },
  { href: "/music", label: "Musiqi", Icon: Music },
  { href: "/ai", label: "AI", Icon: Brain },
];

export default function NotFound() {
  return (
    <>
      <SiteHeaderServer />
      <main className="relative isolate min-h-[calc(100vh-220px)] overflow-hidden bg-[#07080c] text-[#ffffff]">
        <div className="absolute inset-0 grid grid-cols-2 opacity-35 sm:grid-cols-4">
          {[
            { src: "/ps-controller.png", label: "PlayStation" },
            { src: "/youtube.png", label: "YouTube" },
            { src: "/epic-white-logo.png", label: "Epic Games" },
            { src: "/honsell-logo.svg", label: "Honsell" },
          ].map((item) => (
            <div
              key={item.label}
              className="relative min-h-[190px] border border-white/5"
              style={{ position: "relative", minHeight: 190 }}
            >
              <Image
                src={item.src}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-contain p-12 opacity-80"
                style={{ objectFit: "contain", padding: "3rem", opacity: 0.8 }}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,12,0.98)_0%,rgba(7,8,12,0.86)_48%,rgba(7,8,12,0.52)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(14,165,233,0.18),transparent_34%),radial-gradient(circle_at_20%_80%,rgba(244,63,94,0.16),transparent_34%)]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-sky-400 to-rose-400" />

        <section className="relative mx-auto grid min-h-[calc(100vh-220px)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-white/[0.78] backdrop-blur-md">
              404 · Səhifə tapılmadı
            </p>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-[#ffffff] sm:text-7xl lg:text-8xl">
              Bu keçid artıq burada deyil.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/[0.72] sm:text-lg">
              Link köhnəlmiş, ünvan səhv yazılmış və ya məhsul başqa bölməyə
              köçürülmüş ola bilər. Kataloqdan davam edə bilərsən.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 shadow-[0_18px_50px_-22px_rgba(255,255,255,0.7)] transition hover:bg-zinc-100"
              >
                <Home className="h-4 w-4" />
                Ana səhifə
              </Link>
              <Link
                href="/oyunlar"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-[#ffffff] backdrop-blur-md transition hover:bg-white/[0.15]"
              >
                <Search className="h-4 w-4" />
                Kataloqda axtar
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/[0.12] bg-white/[0.08] p-4 shadow-[0_28px_90px_-52px_rgba(255,255,255,0.55)] backdrop-blur-md sm:p-5">
            <div className="rounded-[22px] border border-white/[0.10] bg-black/20 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.10] pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                    Sürətli keçidlər
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-[#ffffff]">
                    Hansı bölməyə qayıdaq?
                  </h2>
                </div>
                <span className="hidden rounded-full border border-white/[0.12] bg-white/[0.08] px-3 py-1 text-sm font-black text-white/70 sm:inline-flex">
                  404
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {quickLinks.map(({ href, label, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex min-h-[64px] items-center justify-between rounded-2xl border border-white/[0.10] bg-white/[0.06] px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white/[0.11] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.12]">
                        <Icon className="h-5 w-5 !text-white" />
                      </span>
                      <span className="truncate text-sm font-bold text-[#ffffff]">{label}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/70 transition group-hover:translate-x-1 group-hover:!text-white" />
                  </Link>
                ))}
              </div>

              <Link
                href="/"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-black/20 px-4 py-3 text-sm font-bold text-white/80 transition hover:bg-black/30 hover:!text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Başlanğıca dön
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
