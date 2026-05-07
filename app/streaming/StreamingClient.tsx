"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Tv, Plus, Check, Users, AlertTriangle, Info, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { STREAMING_SERVICE_LABELS, validateStreamingDetails } from "@/lib/streamingCart";

type Product = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  availableStock: number;
};

type Meta = {
  service: string;
  durationMonths: number;
  seats: number;
  deliveryMode: "CODE" | "GMAIL";
  originalPriceAznCents: number | null;
  inStock: boolean;
};

function readMeta(p: Product): Meta {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  return {
    service: String(m.service ?? ""),
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    deliveryMode: String(m.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE",
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    inStock: m.inStock === undefined ? true : Boolean(m.inStock),
  };
}

function isProductInStock(p: Product, meta: Meta): boolean {
  if (!meta.inStock) return false;
  if (meta.deliveryMode === "CODE") return p.availableStock > 0;
  return true;
}

const SERVICE_ORDER = ["HBO_MAX", "GAIN", "YOUTUBE_PREMIUM"] as const;

const SERVICE_THEME: Record<
  string,
  { gradient: string; ring: string; accent: string; chip: string }
> = {
  HBO_MAX: {
    gradient: "from-purple-600/15 via-fuchsia-600/8 to-zinc-950/60",
    ring: "border-purple-500/25",
    accent: "text-purple-200",
    chip: "bg-purple-500/15 text-purple-200 border-purple-500/30",
  },
  GAIN: {
    gradient: "from-rose-600/15 via-orange-500/8 to-zinc-950/60",
    ring: "border-rose-500/25",
    accent: "text-rose-200",
    chip: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  },
  YOUTUBE_PREMIUM: {
    gradient: "from-red-600/15 via-rose-500/8 to-zinc-950/60",
    ring: "border-red-500/25",
    accent: "text-red-200",
    chip: "bg-red-500/15 text-red-200 border-red-500/30",
  },
};

const SEAT_INFO: Record<number, { title: string; body: string }> = {
  1: {
    title: "1 nəfərlik nə deməkdir?",
    body: "Abunəlik yalnız bir istifadəçi üçündür — eyni anda yalnız bir cihazda istifadə oluna bilər və hesab paylaşılmır.",
  },
  2: {
    title: "2 nəfərlik nə deməkdir?",
    body: "Abunəlik iki nəfər arasında paylaşılır — eyni anda iki ayrı cihazda baxış mümkündür. İki ayrı profil/slot ayrılır.",
  },
};

export default function StreamingClient({
  products,
  flat = false,
}: {
  products: Product[];
  /** flat=true → servisə görə qruplaşdırma yox, bütün planlar tək grid-də (ana səhifə üçün). */
  flat?: boolean;
}) {
  const grouped = useMemo(() => {
    const byService = new Map<string, Product[]>();
    for (const p of products) {
      const m = readMeta(p);
      if (!m.service) continue;
      if (!byService.has(m.service)) byService.set(m.service, []);
      byService.get(m.service)!.push(p);
    }
    return SERVICE_ORDER.filter((s) => byService.has(s)).map((s) => ({
      service: s,
      items: byService
        .get(s)!
        .slice()
        .sort((a, b) => {
          const ma = readMeta(a);
          const mb = readMeta(b);
          if (ma.seats !== mb.seats) return ma.seats - mb.seats;
          return ma.durationMonths - mb.durationMonths;
        }),
    }));
  }, [products]);

  if (grouped.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
        <Tv className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">Hazırda aktiv streaming məhsul yoxdur.</p>
      </div>
    );
  }

  if (flat) {
    const flatItems = grouped.flatMap((g) => g.items.map((p) => ({ p, service: g.service })));
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {flatItems.map(({ p, service }) => (
          <PlanCard
            key={p.id}
            product={p}
            theme={SERVICE_THEME[service] ?? SERVICE_THEME.HBO_MAX}
            showServiceLabel
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {grouped.map(({ service, items }) => (
        <ServiceSection key={service} service={service} items={items} />
      ))}
    </div>
  );
}

function ServiceSection({ service, items }: { service: string; items: Product[] }) {
  const theme = SERVICE_THEME[service] ?? SERVICE_THEME.HBO_MAX;
  return (
    <section>
      <header className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.accent}`}>
            Streaming
          </p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl">
            {STREAMING_SERVICE_LABELS[service] ?? service}
          </h2>
          {service === "YOUTUBE_PREMIUM" ? (
            <p className="mt-1 text-xs text-zinc-400">
              Sifariş zamanı Gmail ünvanını qeyd etməlisən — abunəlik həmin hesaba qoşulacaq.
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-400">
              Ödənişdən sonra giriş məlumatları sənə email ilə göndəriləcək.
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((p) => (
          <PlanCard key={p.id} product={p} theme={theme} />
        ))}
      </div>
    </section>
  );
}

function PlanCard({
  product,
  theme,
  showServiceLabel = false,
}: {
  product: Product;
  theme: (typeof SERVICE_THEME)[string];
  showServiceLabel?: boolean;
}) {
  const meta = readMeta(product);
  const { add, has, hydrated, updateStreaming } = useCart();
  const inCart = hydrated && has(product.id);
  const inStock = isProductInStock(product, meta);
  const [showGmail, setShowGmail] = useState(false);
  const [showSeatInfo, setShowSeatInfo] = useState(false);
  const [gmail, setGmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const finalAzn = product.priceAznCents / 100;
  const originalAzn =
    meta.originalPriceAznCents != null ? meta.originalPriceAznCents / 100 : null;
  const discountPct =
    originalAzn != null && originalAzn > finalAzn
      ? Math.round(((originalAzn - finalAzn) / originalAzn) * 100)
      : null;

  function handleClick() {
    if (inCart || !inStock) return;
    if (meta.deliveryMode === "GMAIL") {
      setShowGmail(true);
      return;
    }
    addToCart();
  }

  function addToCart(extraGmail?: string) {
    add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      finalAzn,
      productType: "STREAMING",
      ...(extraGmail ? { streaming: { gmail: extraGmail } } : {}),
    });
    if (extraGmail) updateStreaming(product.id, { gmail: extraGmail });
    setShowGmail(false);
    setGmail("");
    setErr(null);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  function submitGmail(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = gmail.trim().toLowerCase();
    const v = validateStreamingDetails({ gmail: trimmed });
    if (v) {
      setErr(v);
      return;
    }
    addToCart(trimmed);
  }

  return (
    <>
      <article
        className={`group relative flex flex-col overflow-hidden rounded-2xl border ${theme.ring} bg-gradient-to-br ${theme.gradient} transition hover:-translate-y-0.5 hover:border-white/20 ${
          !inStock ? "opacity-80" : ""
        }`}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-950">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className={`object-cover transition-transform duration-700 ${
                inStock ? "group-hover:scale-105" : "grayscale"
              }`}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-700">
              <Tv className="h-12 w-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-transparent" />

          <div className="absolute left-3 top-3 flex flex-col gap-1.5">
            {discountPct != null && (
              <span className="inline-flex items-center rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-black tracking-wide text-zinc-950 shadow-lg">
                −{discountPct}%
              </span>
            )}
          </div>

          <div className="absolute right-3 top-3">
            {inStock ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Stokda var
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-300 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                Stokda yoxdur
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          {showServiceLabel && (
            <p className={`text-xs font-bold uppercase tracking-[0.2em] ${theme.accent}`}>
              {STREAMING_SERVICE_LABELS[meta.service] ?? meta.service}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-bold ${theme.chip}`}>
              {meta.durationMonths} ay
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm font-semibold text-zinc-200">
              <Users className="h-3.5 w-3.5" />
              {meta.seats} nəfərlik
              <button
                type="button"
                onClick={() => setShowSeatInfo(true)}
                className="ml-0.5 rounded-full p-0.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label={`${meta.seats} nəfərlik nədir?`}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>

          <div className="flex items-end gap-2">
            <span className="text-3xl font-black tracking-tighter text-white tabular-nums">
              {finalAzn.toFixed(2)}
            </span>
            <span className="pb-1 text-sm font-semibold text-zinc-400">AZN</span>
            {originalAzn != null && originalAzn > finalAzn && (
              <span className="ml-auto pb-1 text-sm font-semibold text-zinc-500 line-through tabular-nums">
                {originalAzn.toFixed(2)} AZN
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleClick}
            disabled={inCart || !inStock}
            className={`mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              !inStock
                ? "cursor-not-allowed bg-zinc-900 text-zinc-500"
                : inCart || justAdded
                  ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "bg-white text-zinc-950 hover:bg-zinc-100"
            }`}
          >
            {!inStock ? (
              "Stokda yoxdur"
            ) : inCart || justAdded ? (
              <>
                <Check className="h-4 w-4" /> Səbətdə
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Səbətə əlavə et
              </>
            )}
          </button>
        </div>
      </article>

      {showGmail && (
        <div
          role="presentation"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setShowGmail(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Gmail ünvanın</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {product.title} — abunəlik bu Gmail hesabına qoşulacaq.
            </p>
            <form onSubmit={submitGmail} className="mt-4 space-y-3">
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                placeholder="ad@gmail.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-white focus:border-fuchsia-500 focus:outline-none"
              />
              {err && (
                <p className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {err}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGmail(false)}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
                >
                  İmtina
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
                >
                  Səbətə əlavə et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSeatInfo && (
        <SeatInfoModal seats={meta.seats} onClose={() => setShowSeatInfo(false)} />
      )}
    </>
  );
}

function SeatInfoModal({ seats, onClose }: { seats: number; onClose: () => void }) {
  const info = SEAT_INFO[seats] ?? {
    title: `${seats} nəfərlik nə deməkdir?`,
    body: "Bu paket göstərilən sayda istifadəçi üçün nəzərdə tutulub.",
  };
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500/15 text-indigo-300">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{info.title}</h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Bağla"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300">{info.body}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
}
