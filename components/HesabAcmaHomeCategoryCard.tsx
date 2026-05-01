"use client";

import { useCallback, useState } from "react";
import AccountCreationOfferModal from "@/components/AccountCreationOfferModal";
import Link from "next/link";

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
}: {
  product: HesabAcmaProduct | null;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);

  if (!product) {
    return (
      <Link
        href="/hesab-acma"
        className="group relative mt-6 block rounded-[24px] bg-[#150A21] p-6 pt-8 shadow-2xl transition hover:-translate-y-1"
      >
        <div className="absolute -top-8 left-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-4 border-[#0A0A0F] bg-[#150A21]">
          {icon}
        </div>
        <div>
          <h3 className="mt-2 text-lg font-bold text-white">{label}</h3>
          <p className="mt-2 text-sm text-[#9CA3AF]">{sub}</p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
            Keçid et →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="group relative mt-6 w-full rounded-[24px] bg-[#150A21] p-6 pt-8 text-left shadow-2xl transition hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]/60"
      >
        <div className="absolute -top-8 left-6 grid h-16 w-16 place-items-center overflow-hidden rounded-full border-4 border-[#0A0A0F] bg-[#150A21]">
          {icon}
        </div>
        <div>
          <h3 className="mt-2 text-lg font-bold text-white">{label}</h3>
          <p className="mt-2 text-sm text-[#9CA3AF]">{sub}</p>
        </div>
        <div className="mt-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#A78BFA] transition group-hover:text-white">
            Keçid et →
          </span>
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
