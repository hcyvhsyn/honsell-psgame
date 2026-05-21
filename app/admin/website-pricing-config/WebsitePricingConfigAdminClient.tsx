"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const WEBSITE_TYPES: { key: string; label: string }[] = [
  { key: "LANDING", label: "Landing page" },
  { key: "PORTFOLIO", label: "Portfolio / şəxsi brend" },
  { key: "BUSINESS", label: "Biznes / satış saytı" },
  { key: "RESTAURANT", label: "Restaurant / kurs / xidmət" },
  { key: "ECOMMERCE", label: "E-commerce" },
  { key: "OTHER", label: "Digər" },
];

type Range = { minBase: number; maxBase: number; notes?: string };
type BaseRanges = Record<string, Range>;

type Config = {
  id: string;
  baseRanges: BaseRanges;
  aiInstructions: string | null;
  aiModel: string;
  updatedAt: string;
};

type RowState = { minBase: string; maxBase: string; notes: string };
type FormState = {
  rows: Record<string, RowState>;
  aiInstructions: string;
  aiModel: string;
};

function toFormState(cfg: Config | null): FormState {
  const rows: Record<string, RowState> = {};
  for (const t of WEBSITE_TYPES) {
    const r = cfg?.baseRanges?.[t.key];
    rows[t.key] = {
      minBase: r ? String(r.minBase) : "",
      maxBase: r ? String(r.maxBase) : "",
      notes: r?.notes ?? "",
    };
  }
  return {
    rows,
    aiInstructions: cfg?.aiInstructions ?? "",
    aiModel: cfg?.aiModel ?? "gpt-4o-mini",
  };
}

export default function WebsitePricingConfigAdminClient() {
  const [config, setConfig] = useState<Config | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/website-pricing-config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setForm(toFormState(data.config));
      }
    } finally {
      setLoading(false);
    }
  }

  function updateRow(key: string, patch: Partial<RowState>) {
    setForm((prev) => ({
      ...prev,
      rows: { ...prev.rows, [key]: { ...prev.rows[key], ...patch } },
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const baseRanges: BaseRanges = {};
      for (const t of WEBSITE_TYPES) {
        const r = form.rows[t.key];
        const min = Number(r.minBase);
        const max = Number(r.maxBase);
        if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
        baseRanges[t.key] = {
          minBase: min,
          maxBase: max,
          notes: r.notes.trim() || undefined,
        };
      }
      const res = await fetch("/api/admin/website-pricing-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRanges,
          aiInstructions: form.aiInstructions,
          aiModel: form.aiModel,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: String(data.error ?? "Yadda saxlanmadı."),
        });
        return;
      }
      const data = await res.json();
      setConfig(data.config);
      setForm(toFormState(data.config));
      setMessage({ type: "success", text: "Yeniləndi." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-base font-bold text-white">Baza qiymət aralıqları</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Hər sayt növü üçün minimum və maksimum baza qiyməti (AZN). AI yalnız
          bu aralıqdan dəyər qaytara bilər.
        </p>

        <div className="mt-5 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Sayt növü</th>
                <th className="px-4 py-2 font-medium w-28">Min (AZN)</th>
                <th className="px-4 py-2 font-medium w-28">Max (AZN)</th>
                <th className="px-4 py-2 font-medium">Qeyd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {WEBSITE_TYPES.map((t) => {
                const row = form.rows[t.key];
                return (
                  <tr key={t.key}>
                    <td className="px-4 py-2 text-zinc-200">{t.label}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={row.minBase}
                        onChange={(e) =>
                          updateRow(t.key, { minBase: e.target.value })
                        }
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={row.maxBase}
                        onChange={(e) =>
                          updateRow(t.key, { maxBase: e.target.value })
                        }
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(e) =>
                          updateRow(t.key, { notes: e.target.value })
                        }
                        placeholder="opsional"
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-base font-bold text-white">AI parametrləri</h2>
        <p className="mt-1 text-xs text-zinc-500">
          OpenAI modeli və AI üçün əlavə qaydalar.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              OpenAI modeli
            </span>
            <input
              type="text"
              value={form.aiModel}
              onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
              placeholder="gpt-4o-mini"
              className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              AI üçün əlavə qaydalar
            </span>
            <textarea
              rows={6}
              value={form.aiInstructions}
              onChange={(e) =>
                setForm({ ...form, aiInstructions: e.target.value })
              }
              placeholder="Məs: Ecommerce-də məhsul sayı 100-dən çox olarsa əmsalı ən azı 20% artır."
              className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>
        </div>
      </section>

      {message && (
        <div
          className={[
            "rounded-lg border px-3 py-2 text-sm",
            message.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300",
          ].join(" ")}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {config?.updatedAt &&
            `Son yenilənmə: ${new Date(config.updatedAt).toLocaleString("az-AZ")}`}
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Yadda saxla
        </button>
      </div>
    </div>
  );
}
