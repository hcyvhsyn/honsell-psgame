"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, PackageSearch, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export type HomeProductMatrixItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageUrl: string | null;
  finalAzn: number;
  productType: string;
  badge: string;
  store?: string | null;
  /// Checkout-da email/şifrə tələb edən paketlər (Spotify çoxhesablı, YouTube,
  /// LinkedIn, GMAIL-çatdırılma streaming) birbaşa səbətə atıla bilməz — düymə
  /// məhsulun səhifəsinə yönləndirir ki, müştəri məlumatı orada daxil etsin.
  requiresAccount?: boolean;
};

const ACCENTS = [
  "border-amber-300/20 hover:border-amber-300/45",
  "border-sky-300/20 hover:border-sky-300/45",
  "border-violet-300/20 hover:border-violet-300/45",
  "border-emerald-300/20 hover:border-emerald-300/45",
  "border-rose-300/20 hover:border-rose-300/45",
  "border-zinc-300/15 hover:border-zinc-300/35",
];

export default function HomeProductMatrix({
  products,
}: {
  products: HomeProductMatrixItem[];
}) {
  const { add, has, hydrated } = useCart();

  if (products.length === 0) return null;

  function addProduct(product: HomeProductMatrixItem) {
    add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      finalAzn: product.finalAzn,
      productType: product.productType,
      ...(product.store ? { store: product.store } : {}),
    });
  }

  return (
    <section id="mehsullar" className="border-b border-white/10 bg-zinc-950 py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
	        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
	          <div>
	            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
	              Abunəliklər
	            </p>
	            <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
	              Abunəlik paketləri
	            </h2>
	          </div>
	          <Link
	            href="#platformalar"
	            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
	          >
	            Kateqoriyalar
	          </Link>
	        </div>

        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {products.map((product, index) => {
            const inCart = hydrated && has(product.id);
            return (
              <article
                key={product.id}
                className={`group flex min-h-[218px] min-w-0 flex-col rounded-2xl border bg-white/[0.035] p-2.5 transition hover:-translate-y-0.5 hover:bg-white/[0.055] ${ACCENTS[index % ACCENTS.length]}`}
              >
                <Link
                  href={product.href}
                  className="block min-w-0"
                  aria-label={`${product.title} səhifəsinə keç`}
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-zinc-900">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="grid h-full place-items-center bg-[linear-gradient(135deg,rgba(124,58,237,0.22),rgba(14,165,233,0.14),rgba(16,185,129,0.12))] text-zinc-300">
                        <PackageSearch className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full border border-white/10 bg-zinc-950/80 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                      {product.badge}
                    </div>
                  </div>

                  <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm font-black leading-tight text-white">
                    {product.title}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-xs font-semibold text-zinc-500">
                    {product.subtitle}
                  </p>
                </Link>

                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Qiymət
                    </p>
                    <p className="truncate text-lg font-black text-white">
                      {product.finalAzn.toFixed(2)}₼
                    </p>
                  </div>
                  {product.requiresAccount ? (
                    // Bu paket email/şifrə tələb edir — birbaşa səbətə atmaq əvəzinə
                    // məhsulun səhifəsinə yönləndiririk ki, müştəri hesab məlumatını
                    // orada daxil etsin (əks halda checkout xəta verir).
                    <Link
                      href={product.href}
                      aria-label={`${product.title} — hesab məlumatı daxil et`}
                      title="Hesab məlumatı tələb olunur"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-950 transition hover:bg-violet-200"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addProduct(product)}
                      disabled={inCart}
                      aria-label={inCart ? "Səbətdədir" : `${product.title} səbətə əlavə et`}
                      title={inCart ? "Səbətdədir" : "Səbətə əlavə et"}
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition ${
                        inCart
                          ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/30"
                          : "bg-white text-zinc-950 hover:bg-violet-200"
                      }`}
                    >
                      {inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
