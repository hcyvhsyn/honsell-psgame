"use client";

import { useState } from "react";
import AccountCreationOfferModal from "@/components/AccountCreationOfferModal";
import type { HesabAcmaProduct } from "@/components/HesabAcmaHomeCategoryCard";

export default function HesabAcmaPageClient({ product }: { product: HesabAcmaProduct }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-400"
      >
        Məlumatları daxil et və səbətə əlavə et
      </button>
      <AccountCreationOfferModal open={open} onClose={() => setOpen(false)} product={product} />
    </>
  );
}
