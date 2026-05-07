"use client";

import { useCallback, useState } from "react";
import AccountCreationOfferModal from "@/components/AccountCreationOfferModal";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export type HesabAcmaProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
};

export default function HesabAcmaHomeCategoryCard({
  product,
  icon,
  label,
  sub,
  imageUrl,
  accentClass,
}: {
  product: HesabAcmaProduct | null;
  icon: React.ReactNode;
  label: string;
  sub: string;
  imageUrl?: string | null;
  accentClass: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);

  if (!product) {
    return (
      <Link
        href="/hesab-acma"
        className="group relative flex min-h-[210px] overflow-hidden rounded-[24px] border border-white/10 bg-[#150A21] p-5 shadow-2xl transition hover:-translate-y-1 hover:border-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
      >
        <CategoryCardBackdrop imageUrl={imageUrl} />
        <div className="relative z-10 flex flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl border bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
              {icon}
            </span>
            <ArrowRight className="h-5 w-5 text-white/45 transition group-hover:translate-x-1 group-hover:text-white" />
          </div>

          <div>
            <h3 className="text-lg font-black leading-tight text-white">{label}</h3>
            <p className="mt-2 min-h-[42px] text-sm leading-relaxed text-zinc-300">{sub}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
              Keçid et <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="group relative flex min-h-[210px] w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#150A21] p-5 text-left shadow-2xl transition hover:-translate-y-1 hover:border-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
      >
        <CategoryCardBackdrop imageUrl={imageUrl} />
        <div className="relative z-10 flex flex-1 flex-col justify-between">
          <div className="flex items-start justify-between gap-4">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl border bg-gradient-to-br backdrop-blur-sm ${accentClass}`}>
              {icon}
            </span>
            <ArrowRight className="h-5 w-5 text-white/45 transition group-hover:translate-x-1 group-hover:text-white" />
          </div>

          <div>
            <h3 className="text-lg font-black leading-tight text-white">{label}</h3>
            <p className="mt-2 min-h-[42px] text-sm leading-relaxed text-zinc-300">{sub}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
              Keçid et <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </button>
      <AccountCreationOfferModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={product}
      />
    </>
  );
}

function CategoryCardBackdrop({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 16vw"
          className="object-cover opacity-20 saturate-125 transition duration-700 group-hover:scale-105 group-hover:opacity-25"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#201032] via-[#150A21] to-[#0A0A0F]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#150A21] via-[#150A21]/85 to-[#150A21]/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(167,139,250,0.20),transparent_34%)] opacity-80" />
    </>
  );
}
