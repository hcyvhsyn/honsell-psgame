"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Plus,
  Users,
  Info,
  X,
  Tv as TvIcon,
  AlertTriangle,
  Monitor,
  Smartphone,
  Tablet,
  ShieldAlert,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { validateStreamingDetails } from "@/lib/streamingCart";

const DEVICE_META: Record<string, { label: string; Icon: typeof Monitor }> = {
  computer: { label: "Kompüter", Icon: Monitor },
  tv: { label: "Televizor", Icon: TvIcon },
  phone: { label: "Telefon", Icon: Smartphone },
  tablet: { label: "Planşet", Icon: Tablet },
};

/**
 * Per-service streaming plan picker. PS Store / Apple One stilində təmiz seqment-
 * tab interfeysi: əvvəlcə nəfər sayı, sonra müddət (1/3/6/12 ay), aşağıda böyük
 * qiymət kartı + Səbətə əlavə düyməsi. Müştəri 1/3/6/12 arasında çaşmasın deyə
 * üç sahədəki məlumat dərhal görünür.
 */

export type PlanProduct = {
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
  devices: string[];
  vpnRequired: boolean;
};

function readMeta(p: PlanProduct): Meta {
  const m = p.metadata ?? {};
  const opc = Number(m.originalPriceAznCents);
  const rawDevices = Array.isArray(m.devices) ? (m.devices as unknown[]) : [];
  return {
    service: String(m.service ?? ""),
    durationMonths: Number(m.durationMonths ?? 0),
    seats: Number(m.seats ?? 1),
    deliveryMode: String(m.deliveryMode ?? "CODE") === "GMAIL" ? "GMAIL" : "CODE",
    originalPriceAznCents: Number.isFinite(opc) && opc > 0 ? opc : null,
    inStock: m.inStock === undefined ? true : Boolean(m.inStock),
    devices: rawDevices.filter((x): x is string => typeof x === "string"),
    vpnRequired: Boolean(m.vpnRequired),
  };
}

function inStock(_p: PlanProduct, _m: Meta) {
  // Stok sistemi ləğv edildi — sifariş PENDING yaranır, admin təsdiq edir.
  return true;
}

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

export default function StreamingPlanPicker({ products }: { products: PlanProduct[] }) {
  // Bütün məhsulları meta ilə zənginləşdiririk və müddət/oturacaq üzrə qruplaşdırırıq.
  const enriched = useMemo(
    () => products.map((p) => ({ p, m: readMeta(p) })).filter((x) => x.m.durationMonths > 0),
    [products],
  );

  const seatOptions = useMemo(() => {
    const set = new Set<number>();
    for (const x of enriched) set.add(x.m.seats);
    return Array.from(set).sort((a, b) => a - b);
  }, [enriched]);

  const [selectedSeats, setSelectedSeats] = useState<number>(seatOptions[0] ?? 1);
  const [seatInfoOpen, setSeatInfoOpen] = useState<number | null>(null);

  const durationOptions = useMemo(() => {
    return enriched
      .filter((x) => x.m.seats === selectedSeats)
      .sort((a, b) => a.m.durationMonths - b.m.durationMonths);
  }, [enriched, selectedSeats]);

  const cheapestPerMonthId = useMemo(() => {
    if (durationOptions.length === 0) return null;
    let bestId: string | null = null;
    let bestPpm = Infinity;
    for (const x of durationOptions) {
      const ppm = x.p.priceAznCents / x.m.durationMonths;
      if (ppm < bestPpm) {
        bestPpm = ppm;
        bestId = x.p.id;
      }
    }
    return bestId;
  }, [durationOptions]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Default seçim: ən sərfəli (per-month). Müddət dəyişəndə də avtomatik yenilənsin.
  const effectiveSelectedId =
    durationOptions.find((x) => x.p.id === selectedId)?.p.id ??
    cheapestPerMonthId ??
    durationOptions[0]?.p.id ??
    null;

  if (enriched.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center text-sm text-zinc-400">
        Aktiv plan yoxdur.
      </div>
    );
  }

  const selected = durationOptions.find((x) => x.p.id === effectiveSelectedId);

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-5 sm:p-7">
      {/* Seat segment — yalnız çoxlu variant olduqda göstər */}
      {seatOptions.length > 1 && (
        <div className="mb-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Nəfər sayı</p>
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950 p-1">
            {seatOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedSeats(n)}
                className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  selectedSeats === n
                    ? "bg-white text-zinc-900"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                {n} nəfər
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSeatInfoOpen(n);
                  }}
                  className="rounded-full p-0.5 opacity-60 hover:opacity-100"
                  aria-label="Bu nədir?"
                >
                  <Info className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Duration cards */}
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Müddət</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {durationOptions.map((x) => {
          const active = x.p.id === effectiveSelectedId;
          const isBest = x.p.id === cheapestPerMonthId && durationOptions.length > 1;
          const stock = inStock(x.p, x.m);
          const finalAzn = x.p.priceAznCents / 100;
          const orig =
            x.m.originalPriceAznCents != null ? x.m.originalPriceAznCents / 100 : null;
          const discountPct =
            orig != null && orig > finalAzn
              ? Math.round(((orig - finalAzn) / orig) * 100)
              : null;
          const perMonth = finalAzn / x.m.durationMonths;

          return (
            <button
              key={x.p.id}
              type="button"
              onClick={() => setSelectedId(x.p.id)}
              disabled={!stock}
              className={`relative overflow-hidden rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-white/30 bg-white/10 ring-2 ring-indigo-400/50"
                  : "border-white/10 bg-zinc-950 hover:border-white/20"
              } ${!stock ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isBest && (
                <span className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-900 shadow">
                  Ən sərfəli
                </span>
              )}
              {discountPct != null && !isBest && (
                <span className="absolute right-2 top-2 rounded-full bg-cyan-400 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-900 shadow">
                  -%{discountPct}
                </span>
              )}
              <p className="text-2xl font-black text-white">
                {x.m.durationMonths} <span className="text-base font-bold text-zinc-400">ay</span>
              </p>
              <div className="mt-3 flex items-baseline gap-1.5">
                {orig != null && orig > finalAzn && (
                  <span className="text-xs font-medium text-zinc-500 line-through tabular-nums">
                    {orig.toFixed(2)}
                  </span>
                )}
                <span className="text-xl font-extrabold text-white tabular-nums">
                  {finalAzn.toFixed(2)}
                </span>
                <span className="text-xs font-semibold text-zinc-400">AZN</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Aylıq: <span className="font-semibold tabular-nums text-zinc-300">{perMonth.toFixed(2)} ₼</span>
              </p>
              {!stock && (
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> Stokda yoxdur
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected summary + buy CTA */}
      {selected && (
        <SelectedSummary
          product={selected.p}
          meta={selected.m}
        />
      )}

      {/* Seat info modal */}
      {seatInfoOpen != null && SEAT_INFO[seatInfoOpen] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSeatInfoOpen(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">{SEAT_INFO[seatInfoOpen].title}</h3>
              <button onClick={() => setSeatInfoOpen(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-zinc-300">{SEAT_INFO[seatInfoOpen].body}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bottom selected card ─────────────────────────────────────────────────────

function SelectedSummary({ product, meta }: { product: PlanProduct; meta: Meta }) {
  const cart = useCart();
  const stock = inStock(product, meta);
  const inCart = cart.hydrated && cart.has(product.id);
  const finalAzn = product.priceAznCents / 100;
  const orig = meta.originalPriceAznCents != null ? meta.originalPriceAznCents / 100 : null;

  const [showGmail, setShowGmail] = useState(false);
  const [gmail, setGmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  function addToCart(extraGmail?: string) {
    cart.add({
      id: product.id,
      title: product.title,
      imageUrl: product.imageUrl,
      finalAzn,
      productType: "STREAMING",
      ...(extraGmail ? { streaming: { gmail: extraGmail } } : {}),
    });
    if (extraGmail) cart.updateStreaming(product.id, { gmail: extraGmail });
    setShowGmail(false);
    setGmail("");
    setErr(null);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  function handleClick() {
    if (inCart || !stock) return;
    if (meta.deliveryMode === "GMAIL") {
      setShowGmail(true);
      return;
    }
    addToCart();
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
    <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:p-5">
      <div className="relative aspect-[16/10] w-32 overflow-hidden rounded-xl bg-zinc-900 sm:w-full">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover ${stock ? "" : "grayscale"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <TvIcon className="h-8 w-8 text-zinc-700" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Seçilmiş plan</p>
        <p className="mt-1 text-base font-bold text-white">{product.title}</p>
        <p className="text-xs text-zinc-500">
          {meta.durationMonths} ay · {meta.seats} nəfər
          {meta.deliveryMode === "GMAIL" && " · Gmail-ə qoşulma"}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-2">
          {orig != null && orig > finalAzn && (
            <span className="text-sm text-zinc-500 line-through tabular-nums">
              {orig.toFixed(2)} ₼
            </span>
          )}
          <span className="text-3xl font-black text-white tabular-nums">
            {finalAzn.toFixed(2)}
          </span>
          <span className="text-sm font-semibold text-zinc-400">AZN</span>
        </div>

        {(meta.devices.length > 0 || meta.vpnRequired) && (
          <div className="mt-3 space-y-2">
            {meta.devices.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  İzlənilə bilən cihazlar
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {meta.devices.map((d) => {
                    const dm = DEVICE_META[d];
                    if (!dm) return null;
                    const Icon = dm.Icon;
                    return (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-200"
                      >
                        <Icon className="h-3 w-3 text-zinc-400" /> {dm.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {meta.vpnRequired && (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                <ShieldAlert className="h-3 w-3" /> VPN tələb olunur
              </p>
            )}
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={handleClick}
            disabled={inCart || !stock}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition ${
              !stock
                ? "cursor-not-allowed bg-zinc-800 text-zinc-500"
                : inCart || justAdded
                  ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  : "bg-white text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            {!stock ? (
              "Stokda yoxdur"
            ) : inCart || justAdded ? (
              <>
                <Check className="h-4 w-4" /> Səbətdədir
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Səbətə əlavə et
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gmail capture for YouTube-like products */}
      {showGmail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitGmail}
            className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Gmail ünvanı</h3>
              <button type="button" onClick={() => setShowGmail(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-400">
              Abunəlik bu Gmail hesabına qoşulacaq. Sifariş zamanı dəqiqləşdir.
            </p>
            <input
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              type="email"
              placeholder="ad@gmail.com"
              autoFocus
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowGmail(false)}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                type="submit"
                className="rounded bg-white px-4 py-2 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
              >
                Səbətə əlavə et
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
