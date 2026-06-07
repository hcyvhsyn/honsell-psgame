import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Gift, LogIn } from "lucide-react";
import SiteHeader from "@/components/SiteHeaderServer";
import SiteFooter from "@/components/SiteFooter";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ClaimGiftForm from "./ClaimGiftForm";

export const metadata: Metadata = {
  title: "Hədiyyəni aç — Honsell PS Store",
  description: "Dostunuzdan aldığınız hədiyyə kodunu daxil edib hədiyyənizi açın.",
};

export const dynamic = "force-dynamic";

export default async function ClaimGiftPage({
  searchParams,
}: {
  searchParams?: { code?: string | string[] };
}) {
  const user = await getCurrentUser();
  const rawCode = Array.isArray(searchParams?.code)
    ? searchParams?.code[0]
    : searchParams?.code;
  const initialCode = typeof rawCode === "string" ? rawCode : "";

  return (
    <main className="gift-claim-page min-h-screen bg-zinc-950 text-zinc-100">
      <SiteHeader />
      <section className="gift-claim-stage mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="gift-hero-shell relative mb-6 overflow-hidden p-6 sm:p-8">
          <span className="gift-hero-spark gift-hero-spark-one" />
          <span className="gift-hero-spark gift-hero-spark-two" />
          <span className="gift-hero-spark gift-hero-spark-three" />
          <div className="gift-hero-art absolute -right-8 -top-10 h-52 w-52 opacity-95 sm:-right-2 sm:-top-12 sm:h-64 sm:w-64">
            <Image
              src="/gift.svg"
              alt=""
              fill
              sizes="240px"
              priority
              className="object-contain drop-shadow-[0_22px_45px_rgba(217,70,239,0.2)]"
            />
          </div>
          <div className="gift-hero-copy relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-fuchsia-100">
              <Gift className="h-3.5 w-3.5" />
              Hədiyyəni aç
            </div>
            <h1 className="mt-5 text-3xl font-black text-white sm:text-4xl">
              Dostunuzdan hədiyyə var?
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-zinc-200 sm:text-base">
              Sizə verilən 11 simvollu kodu daxil edin. Oyun hədiyyələrində öz PlayStation / Epic
              hesabınızı seçəcəksiniz və hədiyyə birbaşa həmin hesaba çatdırılacaq.
            </p>
            <div className="mt-6 grid max-w-lg grid-cols-3 gap-2 text-xs text-zinc-300">
              <span className="gift-hero-step">Kod</span>
              <span className="gift-hero-step">Mesaj</span>
              <span className="gift-hero-step">Çatdırılma</span>
            </div>
          </div>
        </header>

        {user ? (
          <ClaimGiftFormLoader userId={user.id} initialCode={initialCode} />
        ) : (
          <div className="gift-login-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-500/15">
              <LogIn className="h-7 w-7 text-fuchsia-300" />
            </div>
            <h2 className="text-lg font-semibold text-white">Hədiyyəni açmaq üçün daxil olun</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
              Hədiyyəni hesabınıza almaq üçün Honsell hesabınıza daxil olun və ya yeni hesab açın.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/login?next=${encodeURIComponent(`/hediyye-ac${initialCode ? `?code=${initialCode}` : ""}`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
              >
                Daxil ol
              </Link>
              <Link
                href={`/register?next=${encodeURIComponent(`/hediyye-ac${initialCode ? `?code=${initialCode}` : ""}`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Qeydiyyatdan keç
              </Link>
            </div>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}

async function ClaimGiftFormLoader({
  userId,
  initialCode,
}: {
  userId: string;
  initialCode: string;
}) {
  const [psnAccounts, epicAccounts] = await Promise.all([
    prisma.psnAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, label: true, psnEmail: true, isDefault: true },
    }),
    prisma.epicAccount.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, label: true, epicEmail: true, displayName: true, isDefault: true },
    }),
  ]);

  return (
    <ClaimGiftForm
      initialCode={initialCode}
      psnAccounts={psnAccounts}
      epicAccounts={epicAccounts}
    />
  );
}
