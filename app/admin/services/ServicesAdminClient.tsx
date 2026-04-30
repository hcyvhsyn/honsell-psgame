"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Edit2 } from "lucide-react";

type ServiceProduct = {
  id: string;
  type: string;
  title: string;
  priceAznCents: number;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
  _count: { codes: number };
};

export default function ServicesAdminClient() {
  const [products, setProducts] = useState<ServiceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | "NEW" | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number | boolean>>({});
  
  const [codesId, setCodesId] = useState<string | null>(null);
  const [codesText, setCodesText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/services");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }

  function handleEdit(p: ServiceProduct) {
    setEditingId(p.id);
    setEditForm({
      type: p.type,
      title: p.title,
      priceAznCents: p.priceAznCents,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      metadata: JSON.stringify(p.metadata, null, 2),
    });
  }

  function handleNew() {
    setEditingId("NEW");
    setEditForm({
      type: "TRY_BALANCE",
      title: "Yeni TRY Balans",
      priceAznCents: 1000,
      isActive: true,
      sortOrder: 0,
      metadata: '{"tryAmount": 250}',
    });
  }

  async function saveProduct() {
    setSaving(true);
    try {
      let md = {};
      try {
        md = JSON.parse(String(editForm.metadata));
      } catch {
        alert("Metadata düzgün JSON deyil!");
        setSaving(false);
        return;
      }

      await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT_PRODUCT",
          id: editingId === "NEW" ? undefined : editingId,
          ...editForm,
          metadata: md,
        }),
      });
      setEditingId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function saveCodes() {
    setSaving(true);
    try {
      await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_CODES",
          serviceProductId: codesId,
          codesText,
        }),
      });
      setCodesId(null);
      setCodesText("");
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={handleNew} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400">
          <Plus className="h-4 w-4" /> Yeni Məhsul
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-4 font-medium">Tip</th>
              <th className="px-5 py-4 font-medium">Başlıq</th>
              <th className="px-5 py-4 font-medium">Qiymət</th>
              <th className="px-5 py-4 font-medium">Stok / Kodlar</th>
              <th className="px-5 py-4 font-medium text-right">Əməliyyat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {products.map((p) => (
              <tr key={p.id} className="transition hover:bg-zinc-900">
                <td className="px-5 py-4 font-mono text-xs">{p.type}</td>
                <td className="px-5 py-4 font-medium text-zinc-200">
                  {p.title}
                  {!p.isActive && <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">Passiv</span>}
                </td>
                <td className="px-5 py-4">{(p.priceAznCents / 100).toFixed(2)} AZN</td>
                <td className="px-5 py-4">
                  {p.type === "TRY_BALANCE" ? (
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${p._count.codes > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {p._count.codes} ədəd
                      </span>
                      <button onClick={() => setCodesId(p.id)} className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700">
                        + Kod əlavə et
                      </button>
                    </div>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right">
                  <button onClick={() => handleEdit(p)} className="p-2 text-zinc-500 hover:text-indigo-400">
                    <Edit2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">Məhsul Redaktoru</h3>
            <div className="space-y-4">
              <label className="block text-sm">
                Tip (TRY_BALANCE, PS_PLUS, ACCOUNT_CREATION)
                <input className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.type || "")} onChange={(e) => setEditForm({...editForm, type: e.target.value})} />
              </label>
              <label className="block text-sm">
                Başlıq
                <input className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.title || "")} onChange={(e) => setEditForm({...editForm, title: e.target.value})} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  Qiymət (Qəpiklə: 1AZN = 100)
                  <input type="number" className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.priceAznCents || "0")} onChange={(e) => setEditForm({...editForm, priceAznCents: e.target.value})} />
                </label>
                <label className="block text-sm">
                  Sıralama (0 ən öndə)
                  <input type="number" className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white" value={String(editForm.sortOrder || "0")} onChange={(e) => setEditForm({...editForm, sortOrder: e.target.value})} />
                </label>
              </div>
              <label className="block text-sm">
                Metadata (Mütləq JSON!)
                <textarea rows={4} className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-indigo-200" value={String(editForm.metadata || "")} onChange={(e) => setEditForm({...editForm, metadata: e.target.value})} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(e) => setEditForm({...editForm, isActive: e.target.checked})} /> Aktivdir
              </label>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setEditingId(null)} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveProduct} disabled={saving} className="rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white">Yadda saxla</button>
            </div>
          </div>
        </div>
      )}

      {/* Code Uploader Modal */}
      {codesId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">Kodları yüklə (TRY Balans)</h3>
            <p className="mb-6 text-sm text-zinc-400">Hər sətirə bir kod (e-pin) yazın. Boş sətirlər silinəcək.</p>
            <textarea
              rows={10}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-emerald-300 focus:border-emerald-500 focus:outline-none"
              placeholder="XXXX-YYYY-ZZZZ&#10;AAAA-BBBB-CCCC"
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setCodesId(null)} className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300">İmtina</button>
              <button onClick={saveCodes} disabled={saving || !codesText.trim()} className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Əlavə et</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
