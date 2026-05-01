"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Edit2, Check, X as XIcon, RefreshCw, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";

type ServiceProduct = {
  id: string;
  title: string;
  description: string | null;
  priceAznCents: number;
  isActive: boolean;
};

type PendingOrder = {
  id: string;
  amountAznCents: number;
  createdAt: string;
  metadata: string | null;
  user: { id: string; email: string; name: string | null };
  serviceProduct: { id: string; title: string } | null;
};

type AccountFormData = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  gender?: string;
  email?: string;
  password?: string;
};

export default function AccountCreationAdminClient() {
  const [product, setProduct] = useState<ServiceProduct | null>(null);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ priceAzn: "3.00", description: "", isActive: true });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const router = useRouter();

  const loadProduct = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/account-creation");
    if (res.ok) {
      const data: ServiceProduct[] = await res.json();
      setProduct(data[0] ?? null);
    }
    setLoading(false);
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    const res = await fetch("/api/admin/account-creation?mode=orders");
    if (res.ok) setOrders(await res.json());
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    loadProduct();
    loadOrders();
  }, [loadProduct, loadOrders]);

  function openEdit() {
    setSaveError(null);
    setEditForm({
      priceAzn: product ? (product.priceAznCents / 100).toFixed(2) : "3.00",
      description: product?.description ?? "",
      isActive: product?.isActive ?? true,
    });
    setEditOpen(true);
  }

  async function saveProduct() {
    const price = Number(editForm.priceAzn);
    if (!Number.isFinite(price) || price <= 0) {
      setSaveError("Qiymət düzgün deyil!");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await fetch("/api/admin/account-creation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "UPSERT_PRODUCT",
        id: product?.id,
        priceAznCents: Math.round(price * 100),
        description: editForm.description,
        isActive: editForm.isActive,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Yadda saxlanmadı");
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditOpen(false);
    loadProduct();
  }

  async function processOrder(id: string, action: "SUCCESS" | "FAILED") {
    if (!confirm(action === "SUCCESS" ? "Hesab açıldı? Sifarişi tamamla?" : "Sifarişi rədd et?")) return;
    await fetch(`/api/admin/service-orders/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadOrders();
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function parseMetadata(raw: string | null): AccountFormData {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as AccountFormData;
    } catch {
      return {};
    }
  }

  return (
    <div className="space-y-10">
      {/* Product Settings */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20">
              <Settings2 className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-200">Türkiyə PSN Hesabının Açılması</h2>
              {loading ? (
                <p className="mt-0.5 text-sm text-zinc-500">Yüklənir...</p>
              ) : product ? (
                <p className="mt-0.5 text-sm text-zinc-400">
                  Qiymət:{" "}
                  <span className="font-bold text-white">{(product.priceAznCents / 100).toFixed(2)} AZN</span>
                  {!product.isActive && (
                    <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-400">
                      Passiv
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-amber-400">Məhsul hələ yaradılmayıb — qiyməti qeyd edib aktivləşdirin.</p>
              )}
            </div>
          </div>
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <Edit2 className="h-4 w-4" />
            {product ? "Redaktə et" : "Yarat"}
          </button>
        </div>

        {product?.description && (
          <p className="mt-4 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-zinc-400">{product.description}</p>
        )}
      </div>

      {/* Pending Orders */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            Gözləyən sifarişlər
            {orders.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/30">
                {orders.length}
              </span>
            )}
          </h2>
          <button
            onClick={loadOrders}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenilə
          </button>
        </div>

        {ordersLoading ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-zinc-500">
            Gözləyən hesab açılışı sifarişi yoxdur.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const meta = parseMetadata(o.metadata);
              const expanded = expandedOrders.has(o.id);
              return (
                <div
                  key={o.id}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50"
                >
                  <div className="flex items-center justify-between gap-4 px-5 py-4">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200">{o.user.name || "İsimsiz"}</p>
                        <p className="text-xs text-zinc-500">{o.user.email}</p>
                      </div>
                      <div className="hidden sm:block text-sm text-zinc-400">
                        {(Math.abs(o.amountAznCents) / 100).toFixed(2)} AZN
                      </div>
                      <div className="hidden md:block text-xs text-zinc-500">
                        {new Date(o.createdAt).toLocaleDateString("az-AZ", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(o.id)}
                        className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                        title="Müştəri məlumatlarına bax"
                      >
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => processOrder(o.id, "SUCCESS")}
                        title="Tamamla (Hesab açıldı)"
                        className="rounded bg-emerald-500/20 p-1.5 text-emerald-400 hover:bg-emerald-500/30"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => processOrder(o.id, "FAILED")}
                        title="Rədd et (Geri qaytar)"
                        className="rounded bg-rose-500/20 p-1.5 text-rose-400 hover:bg-rose-500/30"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-zinc-800 bg-zinc-950/60 px-5 py-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Müştəri məlumatları
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                        <Field label="Ad" value={meta.firstName} />
                        <Field label="Soyad" value={meta.lastName} />
                        <Field label="Doğum tarixi" value={meta.birthDate} />
                        <Field
                          label="Cinsiyyət"
                          value={meta.gender === "MALE" ? "Kişi" : meta.gender === "FEMALE" ? "Qadın" : meta.gender}
                        />
                        <Field label="E-poçt (hesab üçün)" value={meta.email} className="sm:col-span-2" />
                        <Field label="İstənilən şifrə" value={meta.password} mono />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-6 text-lg font-bold">Hesab Açılışı — Ayarlar</h3>
            <div className="space-y-4">
              <label className="block text-sm text-zinc-300">
                Qiymət (AZN)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  value={editForm.priceAzn}
                  onChange={(e) => setEditForm({ ...editForm, priceAzn: e.target.value })}
                  placeholder="3.00"
                />
              </label>
              <label className="block text-sm text-zinc-300">
                Qısa izah (müştəriyə görünür)
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Sizin məlumatlarınızla tam şəxsi hesab açılır..."
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                />
                Aktivdir (müştərilərə görünür)
              </label>
            </div>
            {saveError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {saveError}
              </div>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => {
                  setEditOpen(false);
                  setSaveError(null);
                }}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                İmtina
              </button>
              <button
                onClick={saveProduct}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 break-all text-zinc-200 ${mono ? "font-mono text-sm" : ""}`}>
        {value || <span className="text-zinc-600">—</span>}
      </p>
    </div>
  );
}
