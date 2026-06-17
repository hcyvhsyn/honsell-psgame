"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2, PackageSearch, RefreshCw, Trash2 } from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import {
  LANDING_SERVICE_TYPE_LABELS,
  isHiddenFromLanding,
} from "@/lib/landingServices";

type LandingProduct = {
  id: string;
  type: string;
  title: string;
  imageUrl: string | null;
  priceAznCents: number;
  isActive: boolean;
  sortOrder: number;
  metadata: unknown;
};

export default function SubscriptionPackagesClient() {
  const dialog = useDialog();
  const [products, setProducts] = useState<LandingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/subscription-packages");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLanding(p: LandingProduct) {
    const hidden = !isHiddenFromLanding(p.metadata);
    setBusyId(p.id);
    const res = await fetch("/api/admin/subscription-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "TOGGLE_LANDING", id: p.id, hidden }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Alınmadı", message: data.error ?? "Xəta baş verdi", tone: "danger" });
      return;
    }
    await load();
  }

  async function deleteProduct(p: LandingProduct) {
    if (
      !(await dialog.confirm({
        title: "Məhsulu sil?",
        message: (
          <p>
            «{p.title}» tamamilə silinsin? Bu, məhsulu öz səhifəsindən və satışdan da silir.
          </p>
        ),
        confirmLabel: "Sil",
        tone: "danger",
      }))
    )
      return;
    setBusyId(p.id);
    const res = await fetch("/api/admin/subscription-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PRODUCT", id: p.id }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await dialog.alert({ title: "Silinmədi", message: data.error ?? "Xəta baş verdi", tone: "warning" });
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Yüklənir…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
        Vitrin tipinə aid heç bir məhsul yoxdur.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Yenilə
        </button>
      </div>

      <ul className="space-y-2">
        {products.map((p) => {
          const hidden = isHiddenFromLanding(p.metadata);
          const busy = busyId === p.id;
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt={p.title} fill sizes="56px" className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-zinc-400">
                    <PackageSearch className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                    {LANDING_SERVICE_TYPE_LABELS[p.type] ?? p.type}
                  </span>
                  {!p.isActive ? (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                      Deaktiv
                    </span>
                  ) : hidden ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      Vitrində gizli
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Vitrində
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-zinc-900">{p.title}</p>
                <p className="text-xs font-medium text-zinc-500">{(p.priceAznCents / 100).toFixed(2)}₼</p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleLanding(p)}
                  disabled={busy || !p.isActive}
                  title={
                    !p.isActive
                      ? "Deaktiv məhsul vitrində görünmür"
                      : hidden
                        ? "Vitrində göstər"
                        : "Vitrindən gizlə"
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-40 ${
                    hidden
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : hidden ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                  {hidden ? "Göstər" : "Gizlə"}
                </button>

                <button
                  type="button"
                  onClick={() => deleteProduct(p)}
                  disabled={busy}
                  title="Tamamilə sil"
                  className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-2 text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
