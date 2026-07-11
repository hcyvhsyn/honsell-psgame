"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import AccountCreationOfferModal from "@/components/AccountCreationOfferModal";
import type { HesabAcmaProduct } from "@/components/HesabAcmaHomeCategoryCard";

export default function HesabAcmaPageClient({ product }: { product: HesabAcmaProduct }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Məlumatları daxil et
        <ArrowRight className="h-4 w-4" />
      </button>
      <AccountCreationOfferModal open={open} onClose={() => setOpen(false)} product={product} />
    </>
  );
}
