"use client";

import { useMemo, useState, useTransition } from "react";
import { Star, Check, EyeOff, Trash2, Loader2, BadgeCheck, ShoppingBag } from "lucide-react";

export type AdminTestimonial = {
  id: string;
  name: string;
  text: string;
  rating: number;
  platform: string;
  productTitle: string | null;
  isActive: boolean;
  sortOrder: number;
  /** transactionId mövcuddursa — alış sonrası dəvətdən gəlib. */
  fromPurchase: boolean;
  createdAt: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  GAME: "Oyun",
  PS_PLUS: "PS Plus",
  GIFT_CARD: "Gift Card",
  ACCOUNT_CREATION: "Hesab açma",
};

type Tab = "pending" | "active";

export default function TestimonialsAdminClient({ initial }: { initial: AdminTestimonial[] }) {
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>(
    initial.some((t) => !t.isActive) ? "pending" : "active",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pending = useMemo(() => items.filter((t) => !t.isActive), [items]);
  const active = useMemo(() => items.filter((t) => t.isActive), [items]);
  const shown = tab === "pending" ? pending : active;

  function patch(id: string, body: Record<string, unknown>, optimistic: Partial<AdminTestimonial>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/testimonials/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Əməliyyat alınmadı.");
          return;
        }
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...optimistic } : t)));
      } finally {
        setBusyId(null);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Bu rəyi tamamilə silmək istəyirsən?")) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Silmək alınmadı.");
          return;
        }
        setItems((prev) => prev.filter((t) => t.id !== id));
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          Təsdiq gözləyən
          {pending.length > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-500/30">
              {pending.length}
            </span>
          )}
        </TabButton>
        <TabButton active={tab === "active"} onClick={() => setTab("active")}>
          Aktiv (anasayfada)
          <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
            {active.length}
          </span>
        </TabButton>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 py-16 text-center text-sm text-zinc-500">
          {tab === "pending"
            ? "Təsdiq gözləyən rəy yoxdur."
            : "Anasayfada göstərilən rəy yoxdur."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((t) => (
            <li
              key={t.id}
              className="rounded-xl border border-admin-line bg-admin-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900">{t.name}</span>
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < t.rating ? "fill-current" : "text-zinc-300"}`}
                        />
                      ))}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                      {t.productTitle ?? PLATFORM_LABELS[t.platform] ?? t.platform}
                    </span>
                    {t.fromPurchase ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <BadgeCheck className="h-3 w-3" /> Alışdan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200">
                        <ShoppingBag className="h-3 w-3" /> Saytdan
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{t.text}</p>
                  <div className="mt-2 text-[11px] text-zinc-400">
                    {new Date(t.createdAt).toLocaleString("az-AZ")}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {busyId === t.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {t.isActive ? (
                        <button
                          type="button"
                          onClick={() => patch(t.id, { isActive: false }, { isActive: false })}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                        >
                          <EyeOff className="h-3.5 w-3.5" /> Deaktiv et
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => patch(t.id, { isActive: true }, { isActive: true })}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" /> Təsdiqlə
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(t.id)}
                        aria-label="Sil"
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {t.isActive && (
                    <label className="flex items-center gap-1 text-[11px] text-zinc-500">
                      Sıra:
                      <input
                        type="number"
                        defaultValue={t.sortOrder}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== t.sortOrder) patch(t.id, { sortOrder: v }, { sortOrder: v });
                        }}
                        className="w-14 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-right text-xs text-zinc-800"
                      />
                    </label>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/30" : "text-zinc-600 hover:bg-zinc-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
