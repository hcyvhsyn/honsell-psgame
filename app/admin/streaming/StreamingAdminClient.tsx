"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { useDialog } from "@/lib/dialogs";
import { ACCESS_MODE_META, type StreamingAccessMode } from "@/lib/streamingAccess";
import PriceGrid from "./PriceGrid";
import StockPanel from "./StockPanel";
import { DEVICES, PackageModal, ServiceModal, TierModal, uploadStreamingImage } from "./StreamingAdminModals";
import { Switch, btn, postStreaming } from "./adminUi";
import {
  buildServiceViews,
  type AdminPlatform,
  type AdminProduct,
  type AdminStock,
  type ServiceView,
  type TierView,
} from "./streamingAdminModel";

const SELECTED_KEY = "admin-streaming-service";
const DEVICE_LABEL = new Map(DEVICES.map((d) => [d.value, d.label]));

type TierModalState = { service: ServiceView; mode: StreamingAccessMode; tier?: TierView } | null;

/**
 * Streaming abunəlikləri: xidmət → (Şəxsi hesab | Paylaşımlı hesab) → plan → qiymət cədvəli + stok.
 * Quruluşun izahı: lib/streamingAccess.ts.
 */
export default function StreamingAdminClient() {
  const [platforms, setPlatforms] = useState<AdminPlatform[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stock, setStock] = useState<AdminStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const [serviceModal, setServiceModal] = useState<null | { platform?: AdminPlatform }>(null);
  const [tierModal, setTierModal] = useState<TierModalState>(null);
  const [packageModal, setPackageModal] = useState<AdminProduct | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/streaming", { cache: "no-store" });
      if (!res.ok) throw new Error(`Yüklənmədi (${res.status})`);
      const data = await res.json();
      setPlatforms(Array.isArray(data?.platforms) ? data.platforms : []);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setStock(Array.isArray(data?.stock) ? data.stock : []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Yüklənmədi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    try {
      setSelectedCode(window.localStorage.getItem(SELECTED_KEY));
    } catch {
      /* gizli pəncərə — default seçim */
    }
  }, [load]);

  const services = useMemo(() => buildServiceViews(platforms, products, stock), [platforms, products, stock]);
  const selected = services.find((s) => s.code === selectedCode) ?? services[0] ?? null;

  function select(code: string) {
    setSelectedCode(code);
    try {
      window.localStorage.setItem(SELECTED_KEY, code);
    } catch {
      /* yox */
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const nextServiceSort = services.reduce((max, s) => Math.max(max, s.platform.sortOrder), -1) + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Streaming abunəlikləri</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Xidməti seç → <b>Şəxsi hesab</b> və ya <b>Paylaşımlı hesab</b> planı əlavə et → qiyməti cədvələ yaz → saytda
            satışa aç. Boş xana satılmır.
          </p>
        </div>
        <button type="button" onClick={() => setServiceModal({})} className={btn.primary}>
          <Plus className="h-4 w-4" /> Yeni xidmət
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">
          {loadError}{" "}
          <button type="button" onClick={load} className="font-semibold underline">
            Yenidən yüklə
          </button>
        </div>
      )}

      {/* Xidmət seçimi */}
      <nav aria-label="Xidmətlər" className="flex flex-wrap gap-2">
        {services.map((s) => {
          const active = s.code === selected?.code;
          const live = s.sellable && s.activeCount > 0 && s.platform.isActive;
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => select(s.code)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-admin-line bg-admin-card text-zinc-700 hover:border-violet-400"
              } ${s.platform.isActive ? "" : "opacity-60"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : active ? "bg-white/50" : "bg-zinc-400"}`}
                title={live ? "Saytda satılır" : "Saytda satılmır"}
              />
              {s.label}
              <span className={`text-xs font-medium ${active ? "text-white/80" : "text-zinc-500"}`}>{s.activeCount}</span>
            </button>
          );
        })}
      </nav>

      {selected ? (
        <ServiceWorkspace
          key={selected.code}
          service={selected}
          reload={load}
          onEditService={() => setServiceModal({ platform: selected.platform })}
          onDeleted={() => select(services.find((s) => s.code !== selected.code)?.code ?? "")}
          onAddTier={(mode) => setTierModal({ service: selected, mode })}
          onEditTier={(tier) => setTierModal({ service: selected, mode: tier.mode, tier })}
          onOpenPackage={setPackageModal}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-admin-line bg-admin-card px-5 py-12 text-center text-sm text-zinc-500">
          Hələ xidmət yoxdur. «Yeni xidmət» ilə başla.
        </div>
      )}

      {serviceModal && (
        <ServiceModal
          platform={serviceModal.platform}
          nextSortOrder={nextServiceSort}
          onClose={() => setServiceModal(null)}
          onSaved={async (code) => {
            await load();
            select(code);
          }}
        />
      )}
      {tierModal && (
        <TierModal
          service={tierModal.service}
          accessMode={tierModal.mode}
          tier={tierModal.tier}
          nextSortOrder={
            [...tierModal.service.personal, ...tierModal.service.shared].reduce(
              (max, t) => Math.max(max, t.platform.sortOrder),
              tierModal.service.platform.sortOrder,
            ) + 1
          }
          onClose={() => setTierModal(null)}
          onSaved={load}
        />
      )}
      {packageModal && (
        <PackageModal product={packageModal} onClose={() => setPackageModal(null)} onSaved={load} />
      )}
    </div>
  );
}

// ─── Seçilmiş xidmət ──────────────────────────────────────────────────────

function ServiceWorkspace({
  service,
  reload,
  onEditService,
  onDeleted,
  onAddTier,
  onEditTier,
  onOpenPackage,
}: {
  service: ServiceView;
  reload: () => Promise<void>;
  onEditService: () => void;
  onDeleted: () => void;
  onAddTier: (mode: StreamingAccessMode) => void;
  onEditTier: (tier: TierView) => void;
  onOpenPackage: (p: AdminProduct) => void;
}) {
  const dialog = useDialog();
  const [busy, setBusy] = useState<null | "sellable" | "image" | "delete">(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const tiers = [...service.personal, ...service.shared];
  const hasTiers = tiers.length > 0;
  const pricedTiers = tiers.filter((t) => t.activeCount > 0).length;

  async function toggleSellable(next: boolean) {
    if (next) {
      const ok = await dialog.confirm({
        title: `${service.label} saytda satışa açılsın?`,
        message: (
          <div className="space-y-2">
            <p>Müştərilər {service.storePath} səhifəsindən ala biləcək, ana səhifədə də kart görünəcək.</p>
            <p>Sifarişlər «Sifarişlər» bölməsinə düşür və əl ilə təsdiqlənir — CRM-ə avtomatik getmir.</p>
          </div>
        ),
        confirmLabel: "Satışa aç",
      });
      if (!ok) return;
    }
    setBusy("sellable");
    const res = await postStreaming({ action: "SET_SERVICE_SELLABLE", code: service.code, storeSellable: next });
    setBusy(null);
    if (!res.ok) return void dialog.alert({ title: "Dəyişmədi", message: res.error, tone: "danger" });
    await reload();
  }

  async function changeImage(file: File | null) {
    setBusy("image");
    let url = "";
    if (file) {
      const up = await uploadStreamingImage(file);
      if ("error" in up) {
        setBusy(null);
        return void dialog.alert({ title: "Şəkil yüklənmədi", message: up.error, tone: "warning" });
      }
      url = up.url;
    }
    const res = await postStreaming({ action: "SET_SERVICE_PLATFORM_IMAGE", service: service.code, imageUrl: url });
    setBusy(null);
    if (!res.ok) return void dialog.alert({ title: "Şəkil yadda saxlanmadı", message: res.error, tone: "danger" });
    await reload();
  }

  async function removeService() {
    const ok = await dialog.confirm({
      title: `${service.label} silinsin?`,
      message: <p>Planı və ya paketi olan xidmət silinmir — əvvəlcə onları sil və ya xidməti gizlət.</p>,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    const res = await postStreaming({ action: "DELETE_PLATFORM", code: service.code });
    setBusy(null);
    if (!res.ok) return void dialog.alert({ title: "Silinmədi", message: res.error, tone: "danger" });
    onDeleted();
    await reload();
  }

  return (
    <div className="space-y-4">
      {/* Başlıq */}
      <section className="rounded-xl border border-admin-line bg-admin-card p-4">
        <div className="flex flex-wrap items-start gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="group relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-admin-line bg-admin-chip"
            title="Xidmət şəkli — bütün paketlərə tətbiq olunur"
          >
            {service.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={service.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-zinc-500">Şəkil yoxdur</span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition group-hover:opacity-100">
              {busy === "image" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) changeImage(f);
            }}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-900">{service.label}</h2>
              {!service.platform.isActive && (
                <span className="rounded bg-admin-chip2 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">GİZLİ</span>
              )}
              {service.locked && (
                <span className="inline-flex items-center gap-1 rounded bg-admin-chip px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                  <Lock className="h-3 w-3" /> CRM
                </span>
              )}
            </div>
            <a
              href={service.storePath}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-zinc-500 hover:text-violet-700"
            >
              {service.storePath} <ExternalLink className="h-3 w-3" />
            </a>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={onEditService} className={btn.ghost}>
                <Pencil className="h-3.5 w-3.5" /> Ad, təsvir, ünvan
              </button>
              {service.imageUrl && (
                <button type="button" onClick={() => changeImage(null)} disabled={busy !== null} className={btn.ghost}>
                  Şəkli sil
                </button>
              )}
              {!service.locked && (
                <button type="button" onClick={removeService} disabled={busy !== null} className={btn.ghost}>
                  <Trash2 className="h-3.5 w-3.5" /> Xidməti sil
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-admin-line px-3 py-2">
            <div className="text-right">
              <p className="text-sm font-semibold text-zinc-900">Saytda satılır</p>
              <p className="text-[11px] text-zinc-500">{service.locked ? "Həmişə açıq · CRM" : service.sellable ? "Açıqdır" : "Bağlıdır"}</p>
            </div>
            {busy === "sellable" ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            ) : (
              <Switch
                label="Saytda satılır"
                checked={service.sellable}
                disabled={service.locked}
                onChange={toggleSellable}
              />
            )}
          </div>
        </div>

        {/* Hazırlıq addımları */}
        {!service.locked && (
          <ol className="mt-4 grid gap-2 border-t border-admin-line pt-3 text-xs sm:grid-cols-3">
            <Step done={hasTiers} n={1} text={hasTiers ? `${tiers.length} plan` : "Plan əlavə et"} />
            <Step done={pricedTiers > 0} n={2} text={pricedTiers > 0 ? `${service.activeCount} paket satışda` : "Qiymət yaz"} />
            <Step done={service.sellable} n={3} text={service.sellable ? "Saytda açıqdır" : "Satışa aç"} />
          </ol>
        )}
        <ServiceHint service={service} />
      </section>

      {(["PERSONAL", "SHARED"] as const).map((mode) => (
        <ModeSection
          key={mode}
          mode={mode}
          service={service}
          tiers={mode === "PERSONAL" ? service.personal : service.shared}
          reload={reload}
          onAdd={() => onAddTier(mode)}
          onEditTier={onEditTier}
          onOpenPackage={onOpenPackage}
        />
      ))}

      {service.legacy && (
        <section className="rounded-xl border border-dashed border-admin-line2 bg-admin-card p-4">
          <h3 className="text-sm font-bold text-zinc-900">Rejimsiz paketlər (köhnə quruluş)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {hasTiers
              ? "Bu xidmətdə plan qurulduğu üçün bu paketlər saytda göstərilmir. Lazım deyilsə xanaları boşaldıb satışdan çıxar."
              : "Planı olmayan xidmət saytda bu paketlərlə satılır. Şəxsi/paylaşımlı plan əlavə etsən, sayt planları göstərəcək."}
          </p>
          <div className="mt-3">
            <PriceGrid tier={service.legacy} onSaved={reload} onOpenPackage={onOpenPackage} />
          </div>
          <div className="mt-4 border-t border-admin-line pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Stok</p>
            <StockPanel platformCode={service.code} entries={service.legacy.stock} onChanged={reload} />
          </div>
        </section>
      )}
    </div>
  );
}

function Step({ done, n, text }: { done: boolean; n: number; text: string }) {
  return (
    <li className={`flex items-center gap-2 font-semibold ${done ? "text-emerald-700" : "text-zinc-500"}`}>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
          done ? "bg-emerald-500 text-white" : "bg-admin-chip2 text-zinc-600"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : n}
      </span>
      {text}
    </li>
  );
}

function ServiceHint({ service }: { service: ServiceView }) {
  let tone: "info" | "warn" = "info";
  let text: string | null = null;
  if (service.locked) {
    text = "Netflix sifarişləri ödənişdən sonra CRM-ə avtomatik gedir. Plan quruluşu CRM ilə bağlıdır — burada qiymət, cihaz və stok dəyişir.";
  } else if (service.sellable && service.activeCount === 0) {
    tone = "warn";
    text = "Saytda açıqdır, amma satışda paket yoxdur — müştəri boş səhifə görür.";
  } else if (service.sellable && !service.platform.isActive) {
    tone = "warn";
    text = "Xidmət gizlidir — satış açıq olsa da səhifə görünmür.";
  } else if (service.sellable) {
    text = "Sifarişlər «Sifarişlər» bölməsinə düşür və əl ilə təsdiqlənir (CRM-ə getmir). Şəxsi hesab sifarişində müştərinin e-poçtu və şifrəsi orada görünür.";
  } else if (service.activeCount > 0) {
    text = "Paketlər hazırdır. Müştərilər görsün deyə «Saytda satılır»-ı yandır.";
  }
  if (!text) return null;
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-xs leading-relaxed ${
        tone === "warn" ? "bg-amber-500/10 text-amber-800" : "bg-admin-chip/60 text-zinc-600"
      }`}
    >
      {text}
    </p>
  );
}

// ─── Rejim bölməsi ────────────────────────────────────────────────────────

function ModeSection({
  mode,
  service,
  tiers,
  reload,
  onAdd,
  onEditTier,
  onOpenPackage,
}: {
  mode: StreamingAccessMode;
  service: ServiceView;
  tiers: TierView[];
  reload: () => Promise<void>;
  onAdd: () => void;
  onEditTier: (tier: TierView) => void;
  onOpenPackage: (p: AdminProduct) => void;
}) {
  const meta = ACCESS_MODE_META[mode];
  const Icon = mode === "PERSONAL" ? UserRound : KeyRound;
  return (
    <section className="rounded-xl border border-admin-line bg-admin-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-admin-line px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-zinc-900">{meta.label}</h3>
            <p className="text-xs text-zinc-500">{meta.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={service.locked}
          title={service.locked ? "Netflix planları CRM ilə bağlıdır — yeni plan koddan əlavə olunur." : undefined}
          className={btn.secondary}
        >
          <Plus className="h-4 w-4" /> Plan əlavə et
        </button>
      </header>

      {tiers.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-zinc-500">
            {mode === "PERSONAL"
              ? "Şəxsi hesab planı yoxdur. Məs: «Standart», «Premium» — müştəri öz hesabını yazır."
              : "Paylaşımlı plan yoxdur. Məs: «Standart» — bizim hesabdan otaq veririk."}
          </p>
          {!service.locked && (
            <button type="button" onClick={onAdd} className={`${btn.primary} mt-3`}>
              <Plus className="h-4 w-4" /> İlk planı əlavə et
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-admin-line">
          {tiers.map((tier) => (
            <TierCard
              key={tier.key}
              tier={tier}
              reload={reload}
              onEdit={() => onEditTier(tier)}
              onOpenPackage={onOpenPackage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function TierCard({
  tier,
  reload,
  onEdit,
  onOpenPackage,
}: {
  tier: TierView;
  reload: () => Promise<void>;
  onEdit: () => void;
  onOpenPackage: (p: AdminProduct) => void;
}) {
  const dialog = useDialog();
  const [stockOpen, setStockOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const free = tier.stock.filter((s) => !s.isUsed).length;
  const hidden = !tier.platform.isActive;

  async function remove() {
    const ok = await dialog.confirm({
      title: `«${tier.name}» planı silinsin?`,
      message: <p>Paketi və ya stoku olan plan silinmir — əvvəlcə xanaları boşalt və ya planı gizlət.</p>,
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    const res = await postStreaming({ action: "DELETE_PLATFORM", code: tier.code });
    setDeleting(false);
    if (!res.ok) return void dialog.alert({ title: "Silinmədi", message: res.error, tone: "danger" });
    await reload();
  }

  return (
    <div className={`px-4 py-4 ${hidden ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-bold text-zinc-900">{tier.name}</h4>
            {hidden && <span className="rounded bg-admin-chip2 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">GİZLİ</span>}
            <span className="text-xs text-zinc-500">{tier.activeCount} paket satışda</span>
          </div>
          {tier.features.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
              {tier.features.slice(0, 4).map((f, i) => (
                <li
                  key={i}
                  className={f.tone === "good" ? "text-emerald-700" : f.tone === "bad" ? "text-rose-600" : f.tone === "warn" ? "text-amber-700" : ""}
                >
                  • {f.text}
                </li>
              ))}
            </ul>
          )}
          {!tier.isCodeVariant && (
            <p className="mt-1 text-[11px] text-zinc-500">
              {tier.devices.length ? tier.devices.map((d) => DEVICE_LABEL.get(d) ?? d).join(", ") : "Cihaz seçilməyib"}
              {tier.vpnRequired ? " · VPN lazımdır" : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {tier.isCodeVariant ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500" title="Plan məlumatı lib/streamingVariants.ts-dədir">
              <Lock className="h-3 w-3" /> koddan
            </span>
          ) : (
            <>
              <button type="button" onClick={onEdit} className={btn.ghost}>
                <Pencil className="h-3.5 w-3.5" /> Redaktə
              </button>
              {!tier.locked && (
                <button type="button" onClick={remove} disabled={deleting} className={btn.ghost} aria-label="Planı sil">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <PriceGrid tier={tier} onSaved={reload} onOpenPackage={onOpenPackage} />
      </div>

      {tier.mode === "SHARED" && (
        <div className="mt-3 rounded-lg border border-admin-line">
          <button
            type="button"
            onClick={() => setStockOpen((v) => !v)}
            aria-expanded={stockOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-700"
          >
            <span>
              Stok — hesablar{" "}
              <span className={free > 0 ? "text-emerald-700" : "text-amber-700"}>({free} boşda)</span>
            </span>
            <ChevronDown className={`h-4 w-4 transition ${stockOpen ? "rotate-180" : ""}`} />
          </button>
          {stockOpen && (
            <div className="border-t border-admin-line p-3">
              <StockPanel platformCode={tier.code} entries={tier.stock} onChanged={reload} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
