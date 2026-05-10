"use client";

import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { useCart } from "@/lib/cart";

type Product = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: unknown;
};

type Props = {
  products: Product[];
};

function readMeta(p: Product) {
  const m =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : {};
  const opc = Number(m.originalPriceAznCents);
  return {
    terms: typeof m.terms === "string" ? m.terms : null,
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
  };
}

export default function PlatformsPublicSection({ products }: Props) {
  const cart = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function addToCart(p: Product) {
    cart.add({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      finalAzn: p.priceAznCents / 100,
      productType: "PLATFORM",
    });
    setJustAdded(p.id);
    setTimeout(() => setJustAdded((prev) => (prev === p.id ? null : prev)), 1500);
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-sm text-zinc-500">
        Bu kateqoriyada hələ paket əlavə edilməyib.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => {
        const m = readMeta(p);
        const final = (p.priceAznCents / 100).toFixed(2);
        const original =
          m.originalPriceAznCents != null ? (m.originalPriceAznCents / 100).toFixed(2) : null;
        const added = justAdded === p.id || cart.has(p.id);

        return (
          <li
            key={p.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 transition hover:border-white/20"
          >
            {p.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.imageUrl} alt={p.title} className="h-44 w-full object-cover" />
            ) : (
              <div className="h-44 w-full bg-gradient-to-br from-fuchsia-600/20 via-purple-700/10 to-zinc-900/40" />
            )}
            <div className="flex flex-1 flex-col gap-3 p-5">
              <h3 className="text-lg font-bold text-white">{p.title}</h3>
              {p.description && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-400">
                  {p.description}
                </p>
              )}
              {m.terms && (
                <details className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
                  <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">
                    Şərtlər
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-zinc-300">{m.terms}</p>
                </details>
              )}
              <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                <div>
                  {original && (
                    <p className="text-xs text-zinc-500 line-through">{original} AZN</p>
                  )}
                  <p className="text-2xl font-black text-white">{final} AZN</p>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(p)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
                    added
                      ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "bg-fuchsia-500 text-white hover:bg-fuchsia-400"
                  }`}
                >
                  {added ? (
                    <><Check className="h-4 w-4" /> Səbətdə</>
                  ) : (
                    <><ShoppingBag className="h-4 w-4" /> Səbətə əlavə et</>
                  )}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
