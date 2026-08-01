"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { useDialog } from "@/lib/dialogs";
import {
  formatAzn,
  LOOT_BOX_POOL_STATUS_LABELS,
  type PoolEconomics,
  type OddsRow,
} from "@/lib/lootBoxShared";

// ─── Tiplər ───────────────────────────────────────────────────────────────────

type TemplateSpec = {
  templateId: string;
  gameId: string;
  title: string;
  imageUrl: string | null;
  store: string | null;
  ticketCount: number;
  valueAznCents: number;
  costAznCents: number;
  missing?: boolean;
};

type PoolRow = {
  id: string;
  seq: number;
  status: string;
  totalTickets: number;
  remainingTickets: number;
  plannedCostCents: number;
  plannedValueCents: number;
  budgetCostCents: number;
  createdAt: string;
};

type Stats = {
  openings: number;
  revenueCents: number;
  realizedCostCents: number;
  profitCents: number;
  marginPct: number;
  awardedValueCents: number;
  pendingChoice: number;
  claimedGame: number;
  soldBack: number;
  remainingTickets: number;
};

type LootBox = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceAznCents: number;
  targetMarginPct: number;
  minPrizePct: number;
  maxPrizePct: number;
  poolSize: number;
  sellBackPct: number;
  refillAtRemaining: number;
  dailyLimitPerUser: number;
  isActive: boolean;
  sortOrder: number;
  templates: TemplateSpec[];
  economics: PoolEconomics;
  odds: OddsRow[];
  stats: Stats;
  pools: PoolRow[];
};

type GameOption = {
  id: string;
  title: string;
  imageUrl: string | null;
  finalAzn?: number;
};

type BoxForm = {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  priceAzn: string;
  targetMarginPct: string;
  minPrizePct: string;
  maxPrizePct: string;
  poolSize: string;
  sellBackPct: string;
  refillAtRemaining: string;
  dailyLimitPerUser: string;
  sortOrder: string;
};

const EMPTY_FORM: BoxForm = {
  id: null,
  slug: "",
  title: "",
  description: "",
  imageUrl: "",
  priceAzn: "5",
  targetMarginPct: "26",
  minPrizePct: "60",
  maxPrizePct: "200",
  poolSize: "100",
  sellBackPct: "70",
  refillAtRemaining: "20",
  dailyLimitPerUser: "0",
  sortOrder: "0",
};

const BTN = "rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-50";
const INPUT =
  "w-full rounded-xl border border-admin-line bg-admin-bg px-3 py-2 text-sm text-admin-fg outline-none focus:border-violet-400";

// ─── Əsas komponent ───────────────────────────────────────────────────────────

export default function LootBoxesAdminClient() {
  const dialog = useDialog();
  const [boxes, setBoxes] = useState<LootBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BoxForm | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/loot-boxes", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Siyahı yüklənmədi.");
        setBoxes(data.boxes ?? []);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(refresh, [refresh]);

  async function post(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    const res = await fetch("/api/admin/loot-boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        [data.error, ...(Array.isArray(data.violations) ? data.violations : [])]
          .filter(Boolean)
          .join(" ") || "Əməliyyat alınmadı."
      );
      return false;
    }
    refresh();
    return true;
  }

  async function saveBox() {
    if (!form) return;
    const ok = await post({ action: "UPSERT_BOX", ...form });
    if (ok) setForm(null);
  }

  async function toggleActive(box: LootBox) {
    await post({ action: "TOGGLE_ACTIVE", id: box.id });
  }

  async function deleteBox(box: LootBox) {
    const ok = await dialog.confirm({
      title: "Qutunu sil",
      message: `"${box.title}" silinsin? Bu geri qaytarıla bilməz.`,
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (ok) await post({ action: "DELETE_BOX", id: box.id });
  }

  async function generatePool(box: LootBox) {
    const ok = await dialog.confirm({
      title: "Yeni hovuz yarat",
      message:
        `${box.economics.ticketTotal} bilet yaradılacaq. Maya ${formatAzn(box.economics.totalCostCents)}, ` +
        `gəlir ${formatAzn(box.economics.revenueCents)}, marja ${box.economics.marginPct.toFixed(2)}%. ` +
        `Bu hovuz yaradıldıqdan sonra qiymətlər dondurulur.`,
      confirmLabel: "Hovuz yarat",
    });
    if (ok) await post({ action: "GENERATE_POOL", lootBoxId: box.id });
  }

  async function retirePool(pool: PoolRow) {
    const ok = await dialog.confirm({
      title: "Hovuzu dayandır",
      message: `#${pool.seq} hovuzun qalan ${pool.remainingTickets} bileti artıq çəkilməyəcək.`,
      tone: "warning",
      confirmLabel: "Dayandır",
    });
    if (ok) await post({ action: "RETIRE_POOL", id: pool.id });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl bg-admin-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY_FORM, sortOrder: String(boxes.length) })}
          className={`${BTN} inline-flex items-center gap-2 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300`}
        >
          <Plus className="h-4 w-4" /> Yeni qutu
        </button>
        <button
          type="button"
          onClick={refresh}
          className={`${BTN} inline-flex items-center gap-2 border border-admin-line text-admin-muted hover:text-admin-fg`}
        >
          <RefreshCw className="h-4 w-4" /> Yenilə
        </button>
      </div>

      {form && (
        <BoxFormCard form={form} setForm={setForm} onSave={saveBox} onCancel={() => setForm(null)} />
      )}

      {boxes.length === 0 && !form && (
        <div className="rounded-3xl border border-dashed border-admin-line px-6 py-12 text-center text-sm text-admin-muted">
          Hələ qutu yoxdur. &quot;Yeni qutu&quot; ilə başlayın.
        </div>
      )}

      {boxes.map((box) => (
        <BoxCard
          key={box.id}
          box={box}
          expanded={expanded === box.id}
          onToggleExpand={() => setExpanded(expanded === box.id ? null : box.id)}
          onEdit={() =>
            setForm({
              id: box.id,
              slug: box.slug,
              title: box.title,
              description: box.description ?? "",
              imageUrl: box.imageUrl ?? "",
              priceAzn: String(box.priceAznCents / 100),
              targetMarginPct: String(box.targetMarginPct),
              minPrizePct: String(box.minPrizePct),
              maxPrizePct: String(box.maxPrizePct),
              poolSize: String(box.poolSize),
              sellBackPct: String(box.sellBackPct),
              refillAtRemaining: String(box.refillAtRemaining),
              dailyLimitPerUser: String(box.dailyLimitPerUser),
              sortOrder: String(box.sortOrder),
            })
          }
          onToggleActive={() => toggleActive(box)}
          onDelete={() => deleteBox(box)}
          onGeneratePool={() => generatePool(box)}
          onRetirePool={retirePool}
          onPost={post}
        />
      ))}
    </div>
  );
}

// ─── Qutu forması ─────────────────────────────────────────────────────────────

function BoxFormCard({
  form,
  setForm,
  onSave,
  onCancel,
}: {
  form: BoxForm;
  setForm: (f: BoxForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof BoxForm, v: string) => setForm({ ...form, [k]: v });
  const price = Number(form.priceAzn.replace(",", ".")) || 0;
  const minAzn = (price * (Number(form.minPrizePct) || 0)) / 100;
  const maxAzn = (price * (Number(form.maxPrizePct) || 0)) / 100;
  const budget = (price * (Number(form.poolSize) || 0) * (100 - (Number(form.targetMarginPct) || 0))) / 100;

  return (
    <div className="space-y-4 rounded-3xl border border-admin-line bg-admin-card p-5">
      <h2 className="text-lg font-black text-admin-fg">{form.id ? "Qutunu redaktə et" : "Yeni qutu"}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Başlıq">
          <input className={INPUT} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="5 AZN qutu" />
        </Field>
        <Field label="Slug (URL)" hint="/qutu/<slug>">
          <input className={INPUT} value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="5-azn" />
        </Field>
        <Field label="Qiymət (AZN)">
          <input className={INPUT} value={form.priceAzn} onChange={(e) => set("priceAzn", e.target.value)} />
        </Field>

        <Field label="Hədəf marja (%)" hint="Gəlirə görə — mənfəət / qiymət">
          <input className={INPUT} value={form.targetMarginPct} onChange={(e) => set("targetMarginPct", e.target.value)} />
        </Field>
        <Field label="Min hədiyyə (%)" hint={price > 0 ? `= ${minAzn.toFixed(2)} AZN` : undefined}>
          <input className={INPUT} value={form.minPrizePct} onChange={(e) => set("minPrizePct", e.target.value)} />
        </Field>
        <Field label="Maks hədiyyə (%)" hint={price > 0 ? `= ${maxAzn.toFixed(2)} AZN` : undefined}>
          <input className={INPUT} value={form.maxPrizePct} onChange={(e) => set("maxPrizePct", e.target.value)} />
        </Field>

        <Field label="Hovuz ölçüsü (bilet)" hint={budget > 0 ? `maya büdcəsi ${budget.toFixed(2)} AZN` : undefined}>
          <input className={INPUT} value={form.poolSize} onChange={(e) => set("poolSize", e.target.value)} />
        </Field>
        <Field label="Geri satma (%)" hint="İstənməyən hədiyyənin balansa satış faizi">
          <input className={INPUT} value={form.sellBackPct} onChange={(e) => set("sellBackPct", e.target.value)} />
        </Field>
        <Field label="Yeni hovuz həddi" hint="Bu qədər bilet qalanda avtomatik yeni hovuz">
          <input className={INPUT} value={form.refillAtRemaining} onChange={(e) => set("refillAtRemaining", e.target.value)} />
        </Field>

        <Field label="Günlük limit / istifadəçi" hint="0 = limitsiz">
          <input className={INPUT} value={form.dailyLimitPerUser} onChange={(e) => set("dailyLimitPerUser", e.target.value)} />
        </Field>
        <Field label="Sıra">
          <input className={INPUT} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
        </Field>
        <Field label="Şəkil URL">
          <input className={INPUT} value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
        </Field>
      </div>

      <Field label="Açıqlama">
        <textarea
          className={`${INPUT} min-h-[70px]`}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Hər qutudan ən azı 3 AZN, ən çoxu 10 AZN dəyərində oyun çıxır."
        />
      </Field>

      <div className="flex gap-2">
        <button type="button" onClick={onSave} className={`${BTN} inline-flex items-center gap-2 bg-violet-600 text-white hover:bg-violet-700`}>
          <Check className="h-4 w-4" /> Yadda saxla
        </button>
        <button type="button" onClick={onCancel} className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}>
          Ləğv et
        </button>
      </div>
    </div>
  );
}

// ─── Qutu kartı ───────────────────────────────────────────────────────────────

function BoxCard({
  box,
  expanded,
  onToggleExpand,
  onEdit,
  onToggleActive,
  onDelete,
  onGeneratePool,
  onRetirePool,
  onPost,
}: {
  box: LootBox;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onGeneratePool: () => void;
  onRetirePool: (p: PoolRow) => void;
  onPost: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-admin-line bg-admin-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-admin-line px-5 py-4">
        <button type="button" onClick={onToggleExpand} className="text-admin-muted hover:text-admin-fg">
          {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <Package className="h-5 w-5 text-violet-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-black text-admin-fg">{box.title}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                box.isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-admin-chip text-admin-muted"
              }`}
            >
              {box.isActive ? "Aktiv" : "Deaktiv"}
            </span>
          </div>
          <div className="text-xs text-admin-muted">
            {formatAzn(box.priceAznCents)} · /qutu/{box.slug} · qalan bilet: {box.stats.remainingTickets}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onToggleActive} className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}>
            {box.isActive ? "Deaktiv et" : "Aktivləşdir"}
          </button>
          <button type="button" onClick={onEdit} className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}>
            <Edit2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={onDelete} className={`${BTN} border border-admin-line text-rose-600 hover:bg-rose-500/10 dark:text-rose-400`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canlı marja kalkulyatoru — həmişə görünür */}
      <EconomicsPanel box={box} onGeneratePool={onGeneratePool} />

      {expanded && (
        <div className="space-y-5 border-t border-admin-line px-5 py-5">
          <RecipeEditor box={box} onPost={onPost} />
          <OddsPanel box={box} />
          <PoolsPanel box={box} onRetirePool={onRetirePool} />
          <StatsPanel stats={box.stats} targetMarginPct={box.targetMarginPct} />
        </div>
      )}
    </div>
  );
}

// ─── Canlı kalkulyator ────────────────────────────────────────────────────────

function EconomicsPanel({ box, onGeneratePool }: { box: LootBox; onGeneratePool: () => void }) {
  const e = box.economics;
  const ok = e.ok;

  return (
    <div className={`px-5 py-4 ${ok ? "bg-emerald-500/[0.04]" : "bg-rose-500/[0.04]"}`}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Bilet"
          value={`${e.ticketTotal} / ${box.poolSize}`}
          ok={e.ticketTotal === box.poolSize}
        />
        <Metric
          label="Maya / büdcə"
          value={`${formatAzn(e.totalCostCents)} / ${formatAzn(e.budgetCostCents)}`}
          ok={e.headroomCents >= 0}
          hint={e.headroomCents >= 0 ? `boşluq ${formatAzn(e.headroomCents)}` : `aşım ${formatAzn(-e.headroomCents)}`}
        />
        <Metric
          label="Proqnoz marja"
          value={`${e.marginPct.toFixed(2)}%`}
          ok={e.marginPct >= box.targetMarginPct}
          hint={`hədəf ${box.targetMarginPct}%`}
        />
        <Metric
          label="Orta hədiyyə (EV)"
          value={formatAzn(e.evValueCents)}
          ok
          hint={`qiymətin ${e.evValuePctOfPrice.toFixed(1)}%-i`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-admin-muted">
        <span>Gəlir (tam hovuz): <strong className="text-admin-fg">{formatAzn(e.revenueCents)}</strong></span>
        <span>·</span>
        <span>Dəyər cəmi: <strong className="text-admin-fg">{formatAzn(e.totalValueCents)}</strong></span>
        <span>·</span>
        <span>
          İcazəli aralıq: <strong className="text-admin-fg">{formatAzn(e.minPrizeCents)} – {formatAzn(e.maxPrizeCents)}</strong>
        </span>
        {e.lowestPrizeCents != null && (
          <>
            <span>·</span>
            <span>
              Faktiki: <strong className="text-admin-fg">{formatAzn(e.lowestPrizeCents)} – {formatAzn(e.highestPrizeCents ?? 0)}</strong>
            </span>
          </>
        )}
      </div>

      {!ok && (
        <div className="mt-3 space-y-1 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Hovuz yaradıla bilməz:</span>
          </div>
          <ul className="list-disc pl-9 text-xs font-medium">
            {e.violations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onGeneratePool}
        disabled={!ok}
        className={`${BTN} mt-3 inline-flex items-center gap-2 ${
          ok ? "bg-emerald-600 text-white hover:bg-emerald-700" : "cursor-not-allowed bg-admin-chip text-admin-muted"
        }`}
      >
        <Plus className="h-4 w-4" /> Yeni hovuz yarat
      </button>
    </div>
  );
}

// ─── Resept redaktoru ─────────────────────────────────────────────────────────

function RecipeEditor({ box, onPost }: { box: LootBox; onPost: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<GameOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/banners/product-search?kind=GAME&q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setOptions((data.results ?? []) as GameOption[]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const remaining = box.poolSize - box.economics.ticketTotal;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-admin-fg">Resept</h3>
        <span className={`text-xs font-bold ${remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
          {remaining === 0 ? "Bilet sayı tam" : remaining > 0 ? `${remaining} bilet çatmır` : `${-remaining} bilet artıqdır`}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-admin-muted">
            <tr>
              <th className="pb-2">Oyun</th>
              <th className="pb-2">Dəyər</th>
              <th className="pb-2">Maya</th>
              <th className="pb-2">Bilet</th>
              <th className="pb-2">Şans</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {box.templates.map((t) => {
              const outOfRange =
                !t.missing &&
                (t.valueAznCents < box.economics.minPrizeCents || t.valueAznCents > box.economics.maxPrizeCents);
              return (
                <tr key={t.templateId} className="border-t border-admin-line">
                  <td className="py-2 pr-3">
                    <span className={t.missing ? "text-rose-500" : "text-admin-fg"}>{t.title}</span>
                    {t.store === "EPIC" && <span className="ml-2 text-[10px] text-admin-muted">EPIC</span>}
                  </td>
                  <td className={`py-2 pr-3 ${outOfRange ? "font-bold text-rose-500" : "text-admin-fg"}`}>
                    {formatAzn(t.valueAznCents)}
                  </td>
                  <td className="py-2 pr-3 text-admin-muted">{formatAzn(t.costAznCents)}</td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-20 rounded-lg border border-admin-line bg-admin-bg px-2 py-1 text-sm text-admin-fg"
                      defaultValue={t.ticketCount}
                      onBlur={(ev) => {
                        const next = Number(ev.target.value);
                        if (next !== t.ticketCount && next >= 1) {
                          onPost({ action: "UPSERT_TEMPLATE", lootBoxId: box.id, gameId: t.gameId, ticketCount: next });
                        }
                      }}
                    />
                  </td>
                  <td className="py-2 pr-3 text-admin-muted">
                    {box.economics.ticketTotal > 0
                      ? `${((t.ticketCount / box.economics.ticketTotal) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => onPost({ action: "DELETE_TEMPLATE", id: t.templateId })}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {box.templates.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-admin-muted">
                  Reseptə hələ oyun əlavə edilməyib.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="relative">
        <input
          className={INPUT}
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="Oyun axtar və reseptə əlavə et…"
        />
        {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-admin-muted" />}
        {options.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-admin-line bg-admin-card shadow-lg">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={async () => {
                  const ok = await onPost({
                    action: "UPSERT_TEMPLATE",
                    lootBoxId: box.id,
                    gameId: o.id,
                    ticketCount: 1,
                  });
                  if (ok) {
                    setQuery("");
                    setOptions([]);
                  }
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-admin-chip"
              >
                <span className="truncate text-admin-fg">{o.title}</span>
                {o.finalAzn != null && (
                  <span className="shrink-0 text-xs text-admin-muted">{o.finalAzn.toFixed(2)} AZN</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ehtimal cədvəli / hovuzlar / statistika ──────────────────────────────────

function OddsPanel({ box }: { box: LootBox }) {
  if (box.odds.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-black text-admin-fg">Müştəriyə göstərilən şanslar</h3>
      <div className="flex flex-wrap gap-2">
        {box.odds.map((row) => (
          <span key={row.valueAznCents} className="rounded-full bg-admin-chip px-3 py-1 text-xs font-bold text-admin-fg">
            {formatAzn(row.valueAznCents)} — {row.pct.toFixed(1)}%
            <span className="ml-1 font-medium text-admin-muted">({row.count} bilet)</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-admin-muted">
        Müştəri yalnız faizləri görür — bilet sayları публик deyil (əks halda qalan hədiyyələri hesablamaq olardı).
      </p>
    </div>
  );
}

function PoolsPanel({ box, onRetirePool }: { box: LootBox; onRetirePool: (p: PoolRow) => void }) {
  return (
    <div>
      <h3 className="mb-2 font-black text-admin-fg">Hovuzlar</h3>
      {box.pools.length === 0 ? (
        <p className="text-sm text-admin-muted">Hələ hovuz yaradılmayıb.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs uppercase text-admin-muted">
              <tr>
                <th className="pb-2">#</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Qalan / cəm</th>
                <th className="pb-2">Plan maya / büdcə</th>
                <th className="pb-2">Marja</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {box.pools.map((p) => {
                const revenue = p.totalTickets * box.priceAznCents;
                const margin = revenue > 0 ? ((revenue - p.plannedCostCents) / revenue) * 100 : 0;
                return (
                  <tr key={p.id} className="border-t border-admin-line">
                    <td className="py-2 pr-3 font-bold text-admin-fg">{p.seq}</td>
                    <td className="py-2 pr-3 text-admin-muted">
                      {LOOT_BOX_POOL_STATUS_LABELS[p.status as keyof typeof LOOT_BOX_POOL_STATUS_LABELS] ?? p.status}
                    </td>
                    <td className="py-2 pr-3 text-admin-fg">
                      {p.remainingTickets} / {p.totalTickets}
                    </td>
                    <td className="py-2 pr-3 text-admin-muted">
                      {formatAzn(p.plannedCostCents)} / {formatAzn(p.budgetCostCents)}
                    </td>
                    <td className="py-2 pr-3 font-bold text-emerald-600 dark:text-emerald-400">{margin.toFixed(2)}%</td>
                    <td className="py-2">
                      {p.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => onRetirePool(p)}
                          className="text-xs font-bold text-amber-600 hover:underline"
                        >
                          Dayandır
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatsPanel({ stats, targetMarginPct }: { stats: Stats; targetMarginPct: number }) {
  return (
    <div>
      <h3 className="mb-2 font-black text-admin-fg">Faktiki nəticə</h3>
      {stats.openings === 0 ? (
        <p className="text-sm text-admin-muted">Hələ açılış olmayıb.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Açılış" value={String(stats.openings)} ok />
          <Metric label="Gəlir" value={formatAzn(stats.revenueCents)} ok />
          <Metric label="Realizə maya" value={formatAzn(stats.realizedCostCents)} ok />
          <Metric
            label="Realizə marja"
            value={`${stats.marginPct.toFixed(2)}%`}
            ok={stats.marginPct >= targetMarginPct}
            hint={`mənfəət ${formatAzn(stats.profitCents)}`}
          />
          <Metric label="Seçim gözləyir" value={String(stats.pendingChoice)} ok />
          <Metric label="Oyun götürdü" value={String(stats.claimedGame)} ok />
          <Metric label="Balansa satdı" value={String(stats.soldBack)} ok />
          <Metric label="Qalan bilet" value={String(stats.remainingTickets)} ok={stats.remainingTickets > 0} />
        </div>
      )}
    </div>
  );
}

// ─── Kiçik köməkçi komponentlər ───────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-admin-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-admin-muted">{hint}</span>}
    </label>
  );
}

function Metric({ label, value, ok, hint }: { label: string; value: string; ok: boolean; hint?: string }) {
  return (
    <div className="rounded-2xl border border-admin-line bg-admin-bg px-3 py-2">
      <div className="text-[11px] font-bold uppercase tracking-wide text-admin-muted">{label}</div>
      <div
        className={`text-lg font-black ${
          ok ? "text-admin-fg" : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {value} {!ok && <AlertTriangle className="inline h-4 w-4" />}
      </div>
      {hint && <div className="text-[11px] text-admin-muted">{hint}</div>}
    </div>
  );
}
