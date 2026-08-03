"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
} from "lucide-react";

import { useDialog } from "@/lib/dialogs";
import {
  formatAzn,
  LOOT_BOX_POOL_STATUS_LABELS,
  LOOT_BOX_OUTCOME_LABELS,
  type PoolEconomics,
  type OddsRow,
} from "@/lib/lootBoxShared";

// ─── Tiplər ───────────────────────────────────────────────────────────────────

/** Sistemin avtomatik seçdiyi resept sətri (yalnız göstərilir, redaktə olunmur). */
type RecipeSpec = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  store: string | null;
  ticketCount: number;
  valueAznCents: number;
  costAznCents: number;
  stars: number;
};

/** Kataloqdan gələn namizəd + büdcə konteksti. */
type Candidate = {
  gameId: string;
  title: string;
  imageUrl: string | null;
  store: string | null;
  valueAznCents: number;
  costAznCents: number;
  stars: number;
  starred: boolean;
  discountEndAt: string | null;
  maxTickets: number;
  wholePoolAffordable: boolean;
  costIfWholePool: number;
  costVsAvgPct: number;
};

type CandidateResponse = {
  candidates: Candidate[];
  total: number;
  avgAffordableCost: number;
};

type DriftRow = {
  gameId: string;
  title: string;
  remainingTickets: number;
  snapValueCents: number;
  liveValueCents: number | null;
  snapCostCents: number;
  liveCostCents: number | null;
  driftPct: number | null;
  missing: boolean;
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
  maxSharePct: number;
  maxTicketsPerGame: number;
  discountGuardDays: number;
  candidateStore: string | null;
  uniquePrizePerUser: boolean;
  lastRefillError: string | null;
  lastRefillErrorAt: string | null;
  recipe: RecipeSpec[];
  recipeNotes: string[];
  candidateCount: number;
  economics: PoolEconomics;
  drift: DriftRow[];
  odds: OddsRow[];
  stats: Stats;
  pools: PoolRow[];
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
  maxSharePct: string;
  maxTicketsPerGame: string;
  discountGuardDays: string;
  candidateStore: string;
  uniquePrizePerUser: boolean;
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
  maxSharePct: "40",
  maxTicketsPerGame: "1",
  discountGuardDays: "7",
  candidateStore: "",
  uniquePrizePerUser: true,
};

const BTN = "rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-50";
const INPUT =
  "w-full rounded-xl border border-admin-line bg-admin-bg px-3 py-2 text-sm text-admin-fg outline-none focus:border-violet-400";

/**
 * Cavabı təhlükəsiz JSON kimi oxuyur.
 *
 * Birbaşa `res.json()` çağırmaq TƏHLÜKƏLİDİR: server 500 qaytarıb boş gövdə
 * göndərəndə (və ya `next dev` yenidən kompilyasiya edərkən) brauzer
 * "Unexpected end of JSON input" atır və ƏSL səbəb tamamilə gizlənir. Burada
 * gövdə əvvəlcə mətn kimi oxunur və parse alınmasa HTTP statusu ilə birlikdə
 * oxunaqlı xəta verilir.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Server boş cavab qaytardı. Səhifəni yeniləyin."
        : `Server xətası (HTTP ${res.status}). Server jurnalına baxın.`
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Cavab JSON deyil (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

// ─── Əsas komponent ───────────────────────────────────────────────────────────

export default function LootBoxesAdminClient() {
  const dialog = useDialog();
  const [boxes, setBoxes] = useState<LootBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<BoxForm | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const autoExpandedRef = useRef(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/loot-boxes", { cache: "no-store" });
        const data = await readJson(res);
        if (!res.ok) throw new Error((data.error as string) ?? "Siyahı yüklənmədi.");
        const list: LootBox[] = (data.boxes as LootBox[]) ?? [];
        setBoxes(list);
        setError(null);

        // Resepti boş olan qutunu bir dəfə avtomatik açırıq — əks halda admin
        // yalnız sönük "Hovuz yarat" düyməsini görür və oyun əlavə edəcəyi
        // bölmənin bağlı akkordeonun içində olduğunu bilmir.
        if (!autoExpandedRef.current) {
          const needsRecipe = list.find((b) => !b.economics.ok);
          if (needsRecipe) {
            autoExpandedRef.current = true;
            setExpanded(needsRecipe.id);
          }
        }
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
    let data: Record<string, unknown> = {};
    try {
      data = await readJson(res);
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
    if (!res.ok) {
      setError(
        [data.error, ...(Array.isArray(data.violations) ? data.violations : [])]
          .filter(Boolean)
          .join(" ") || `Əməliyyat alınmadı (HTTP ${res.status}).`
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
              maxSharePct: String(box.maxSharePct),
              maxTicketsPerGame: String(box.maxTicketsPerGame),
              discountGuardDays: String(box.discountGuardDays),
              candidateStore: box.candidateStore ?? "",
              uniquePrizePerUser: box.uniquePrizePerUser,
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

        {/* Hovuzdaki FƏRQLİ oyun sayı bilet sayından çox ola bilməz — bu, ən çox
            səhv anlaşılan parametrdir, ona görə birbaşa yazılır. */}
        <Field
          label="Hovuz ölçüsü (bilet)"
          hint={
            budget > 0
              ? `maya büdcəsi ${budget.toFixed(2)} AZN · maksimum ${form.poolSize || 0} fərqli oyun`
              : "hovuzdaki maksimum fərqli oyun sayı = bilet sayı"
          }
        >
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
        <Field
          label="Bir oyundan maks bilet"
          hint={
            Number(form.maxTicketsPerGame) === 1
              ? "1 = hər hədiyyə fərqli oyun (ən geniş çeşid)"
              : Number(form.maxTicketsPerGame) > 0
                ? `bir oyun ən çox ${form.maxTicketsPerGame} dəfə çıxa bilər`
                : "0 = limitsiz, yalnız aşağıdaki faiz işləyir"
          }
        >
          <input
            className={INPUT}
            value={form.maxTicketsPerGame}
            onChange={(e) => set("maxTicketsPerGame", e.target.value)}
          />
        </Field>
        <Field label="Bir oyunun maks payı (%)" hint="Ehtiyat limit — biri hovuzun hamısını udmasın">
          <input className={INPUT} value={form.maxSharePct} onChange={(e) => set("maxSharePct", e.target.value)} />
        </Field>
        <Field label="Endirim qoruması (gün)" hint="Endirimi bu müddətdə bitən oyun hovuza salınmır">
          <input className={INPUT} value={form.discountGuardDays} onChange={(e) => set("discountGuardDays", e.target.value)} />
        </Field>
        <Field label="Hədiyyə mənbəyi" hint="Sabitdir — dəyişdirilə bilməz">
          <div className={`${INPUT} cursor-default text-admin-muted`}>PlayStation oyunları (DLC-siz)</div>
        </Field>
        <Field
          label="Təkrar hədiyyə"
          hint="Söndürsəniz eyni oyun bir müştəriyə bir neçə dəfə çıxa bilər"
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-line bg-admin-bg px-3 py-2 text-sm text-admin-fg">
            <input
              type="checkbox"
              checked={form.uniquePrizePerUser}
              onChange={(e) => setForm({ ...form, uniquePrizePerUser: e.target.checked })}
              className="h-4 w-4 accent-violet-500"
            />
            Eyni oyun bir müştəriyə yalnız 1 dəfə
          </label>
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
          <AutoRecipePanel box={box} />
          <CandidatePicker box={box} onPost={onPost} />
          <DriftPanel box={box} />
          <OddsPanel box={box} />
          <PoolsPanel box={box} onRetirePool={onRetirePool} />
          <StatsPanel stats={box.stats} targetMarginPct={box.targetMarginPct} />
          <WinnersPanel box={box} />
        </div>
      )}
    </div>
  );
}

// ─── Canlı kalkulyator ────────────────────────────────────────────────────────

function EconomicsPanel({ box, onGeneratePool }: { box: LootBox; onGeneratePool: () => void }) {
  const e = box.economics;
  const ok = e.ok;
  // Resept boş olanda maya 0 olduğu üçün marja 100% kimi hesablanır — bu, "hər
  // şey qaydasındadır" təəssüratı yaradır. Bilet yoxdursa rəqəm göstərmirik.
  const hasTickets = e.ticketTotal > 0;

  return (
    <div className={`px-5 py-4 ${ok ? "bg-emerald-500/[0.04]" : "bg-rose-500/[0.04]"}`}>
      {/* Avtomatik hovuz doldurma uğursuz olubsa admin bunu MÜTLƏQ görməlidir —
          əks halda qutu səssizcə boşalır və satış dayanır. */}
      {box.lastRefillError && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Avtomatik hovuz doldurma alınmadı
          </div>
          <p className="mt-1 text-xs">{box.lastRefillError}</p>
          {box.lastRefillErrorAt && (
            <p className="mt-1 text-[11px] opacity-70">
              {new Date(box.lastRefillErrorAt).toLocaleString("az-AZ")}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Bilet"
          value={`${e.ticketTotal} / ${box.poolSize}`}
          ok={e.ticketTotal === box.poolSize}
        />
        <Metric
          label="Maya / büdcə"
          value={hasTickets ? `${formatAzn(e.totalCostCents)} / ${formatAzn(e.budgetCostCents)}` : `— / ${formatAzn(e.budgetCostCents)}`}
          ok={!hasTickets || e.headroomCents >= 0}
          hint={
            !hasTickets
              ? "resept boşdur"
              : e.headroomCents >= 0
                ? `boşluq ${formatAzn(e.headroomCents)}`
                : `aşım ${formatAzn(-e.headroomCents)}`
          }
        />
        <Metric
          label="Proqnoz marja"
          value={hasTickets ? `${e.marginPct.toFixed(2)}%` : "—"}
          ok={!hasTickets || e.marginPct >= box.targetMarginPct}
          hint={`hədəf ${box.targetMarginPct}%`}
        />
        <Metric
          label="Orta hədiyyə (EV)"
          value={hasTickets ? formatAzn(e.evValueCents) : "—"}
          ok
          hint={hasTickets ? `qiymətin ${e.evValuePctOfPrice.toFixed(1)}%-i` : "hədiyyə əlavə edin"}
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

      {/* Resept tamamilə boşdursa bu, xəta deyil — sadəcə növbəti addımdır. */}
      {!hasTickets ? (
        <div className="mt-3 rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-200">
          <div className="font-bold">Növbəti addım: reseptə oyun əlavə edin</div>
          <p className="mt-1 text-xs">
            Aşağıdakı <strong>Resept</strong> bölməsindən oyun axtarın və hər birinə bilet sayı verin.
            Cəmi <strong>{box.poolSize}</strong> bilet olmalıdır, dəyərləri{" "}
            <strong>{formatAzn(e.minPrizeCents)} – {formatAzn(e.maxPrizeCents)}</strong> aralığında,
            ümumi mayası <strong>{formatAzn(e.budgetCostCents)}</strong>-dən çox olmamalıdır.
          </p>
        </div>
      ) : (
        !ok && (
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
        )
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

// ─── Avtomatik resept (yalnız göstərilir) ─────────────────────────────────────

function AutoRecipePanel({ box }: { box: LootBox }) {
  const e = box.economics;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-admin-fg">Sistemin seçdiyi resept</h3>
          <p className="text-xs text-admin-muted">
            Kataloqdan {box.candidateCount} uyğun oyun tapıldı. Paylanma büdcəyə görə avtomatik
            hesablanır — hovuz yaradılanda bu tərkib dondurulur.
          </p>
        </div>
        <span className={`text-xs font-bold ${e.ticketTotal === box.poolSize ? "text-emerald-600" : "text-amber-600"}`}>
          {e.ticketTotal} / {box.poolSize} bilet
        </span>
      </div>

      {box.recipeNotes.length > 0 && (
        <ul className="list-disc space-y-0.5 rounded-xl bg-admin-chip px-5 py-2 pl-8 text-xs text-admin-muted">
          {box.recipeNotes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      {box.recipe.length === 0 ? (
        <p className="rounded-xl bg-admin-chip px-4 py-6 text-center text-sm text-admin-muted">
          Uyğun oyun tapılmadı. Qiymət aralığını və ya hədəf marjanı dəyişin.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="text-left text-xs uppercase text-admin-muted">
              <tr>
                <th className="pb-2">Oyun</th>
                <th className="pb-2">Ulduz</th>
                <th className="pb-2">Dəyər</th>
                <th className="pb-2">Maya</th>
                <th className="pb-2">Bilet</th>
                <th className="pb-2">Şans</th>
              </tr>
            </thead>
            <tbody>
              {box.recipe.map((t) => (
                <tr key={t.gameId} className="border-t border-admin-line">
                  <td className="max-w-[240px] truncate py-2 pr-3 text-admin-fg">{t.title}</td>
                  <td className="py-2 pr-3 text-amber-500">
                    {t.stars > 1 ? "★".repeat(t.stars) : <span className="text-admin-muted">—</span>}
                  </td>
                  <td className="py-2 pr-3 font-bold text-admin-fg">{formatAzn(t.valueAznCents)}</td>
                  <td className="py-2 pr-3 text-admin-muted">{formatAzn(t.costAznCents)}</td>
                  <td className="py-2 pr-3 text-admin-fg">{t.ticketCount}</td>
                  <td className="py-2 pr-3 text-admin-muted">
                    {((t.ticketCount / Math.max(1, e.ticketTotal)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Ulduz seçicisi (namizəd kataloqu) ────────────────────────────────────────

function CandidatePicker({
  box,
  onPost,
}: {
  box: LootBox;
  onPost: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CandidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/loot-boxes/candidates?boxId=${box.id}&q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        const json = await readJson(res);
        if (!res.ok) throw new Error((json.error as string) ?? `Namizədlər yüklənmədi (HTTP ${res.status}).`);
        setData(json as unknown as CandidateResponse);
        setLoadError(null);
      } catch (err) {
        setLoadError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [box.id],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(query.trim()), 250);
    return () => clearTimeout(t);
  }, [open, query, load]);

  async function setStars(c: Candidate, stars: number) {
    const ok = await onPost({ action: "SET_STARS", lootBoxId: box.id, gameId: c.gameId, stars });
    if (ok) load(query.trim());
  }

  const starredCount = box.recipe.filter((r) => r.stars > 1).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-admin-fg">Ulduzlar</h3>
          <p className="text-xs text-admin-muted">
            Oyun əlavə etmirsiniz — yalnız hansının daha tez-tez çıxacağını deyirsiniz.
            5 ulduzlu oyun 1 ulduzludan 5 dəfə tez-tez düşür.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            if (!open && !data) load("");
          }}
          className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}
        >
          {open ? "Bağla" : `Oyunları göstər${starredCount > 0 ? ` (${starredCount} ulduzlu)` : ""}`}
        </button>
      </div>

      {open && (
        <>
          <div className="relative">
            <input
              className={INPUT}
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Oyun adı ilə süz…"
            />
            {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-admin-muted" />}
          </div>

          {loadError && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
              {loadError}
            </div>
          )}

          {data && (
            <p className="text-xs text-admin-muted">
              {data.total} uyğun oyun · orta bilet büdcəsi{" "}
              <strong className="text-admin-fg">{formatAzn(data.avgAffordableCost)}</strong> maya
            </p>
          )}

          <div className="max-h-96 overflow-y-auto rounded-xl border border-admin-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-admin-card text-left text-xs uppercase text-admin-muted">
                <tr>
                  <th className="px-3 py-2">Oyun</th>
                  <th className="px-3 py-2">Dəyər</th>
                  <th className="px-3 py-2">Maya</th>
                  <th className="px-3 py-2">Büdcə tutumu</th>
                  <th className="px-3 py-2">Ulduz</th>
                </tr>
              </thead>
              <tbody>
                {(data?.candidates ?? []).map((c) => (
                  <tr key={c.gameId} className="border-t border-admin-line">
                    <td className="max-w-[220px] truncate px-3 py-2 text-admin-fg">{c.title}</td>
                    <td className="px-3 py-2 font-bold text-admin-fg">{formatAzn(c.valueAznCents)}</td>
                    <td className="px-3 py-2 text-admin-muted">{formatAzn(c.costAznCents)}</td>
                    <td className="px-3 py-2">
                      {/*
                        Adminin əsas sualı: "bu oyundan neçə ala bilərəm?"
                        wholePoolAffordable=false → hovuzun hamısı bundan olsa ziyan edirik.
                      */}
                      <span className={c.wholePoolAffordable ? "text-emerald-600" : "text-amber-600"}>
                        {c.maxTickets >= box.poolSize
                          ? `bütün ${box.poolSize} bilet`
                          : `maks ${c.maxTickets} bilet`}
                      </span>
                      {!c.wholePoolAffordable && (
                        <div className="text-[11px] text-admin-muted">
                          hamısı bundan olsa {formatAzn(c.costIfWholePool)} maya — büdcədən çox
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {/* 0 = qadağan. Kataloqda keyfiyyətsiz başlıqlar var və
                          avtomatik seçim onları ayırd edə bilmir. */}
                      <button
                        type="button"
                        onClick={() => setStars(c, 0)}
                        title="Bu oyun bu qutuya heç vaxt düşməsin"
                        className={`mr-1.5 rounded px-1.5 py-0.5 text-xs font-bold leading-none ${
                          c.stars === 0
                            ? "bg-rose-500/15 text-rose-600"
                            : "text-admin-muted/50 hover:bg-rose-500/10 hover:text-rose-500"
                        }`}
                      >
                        🚫
                      </button>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStars(c, s)}
                          title={`${s} ulduz`}
                          className={`px-0.5 text-base leading-none ${
                            c.stars > 0 && s <= c.stars
                              ? "text-amber-500"
                              : "text-admin-muted/40 hover:text-amber-400"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
                {data != null && data.candidates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-admin-muted">
                      Uyğun oyun tapılmadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Qiymət drifti ────────────────────────────────────────────────────────────

function DriftPanel({ box }: { box: LootBox }) {
  if (box.drift.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-black text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-4 w-4" /> Qiymət dəyişikliyi
      </h3>
      <p className="mb-2 text-xs text-admin-muted">
        Bu oyunların kataloq qiyməti biletdə dondurulmuş dəyərdən fərqlənir.{" "}
        <strong>Mövcud hovuzun marjası təhlükədə deyil</strong> — maya da dondurulub. Amma dəyəri
        aşağı düşən oyunda müştəriyə vəd etdiyimiz məbləğ şişik qalır və geri satmada real
        dəyərindən çox ödəyirik.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase text-admin-muted">
            <tr>
              <th className="pb-2">Oyun</th>
              <th className="pb-2">Qalan bilet</th>
              <th className="pb-2">Biletdə</th>
              <th className="pb-2">Kataloqda</th>
              <th className="pb-2">Fərq</th>
            </tr>
          </thead>
          <tbody>
            {box.drift.map((d) => (
              <tr key={d.gameId} className="border-t border-admin-line">
                <td className="max-w-[220px] truncate py-2 pr-3 text-admin-fg">{d.title}</td>
                <td className="py-2 pr-3 text-admin-fg">{d.remainingTickets}</td>
                <td className="py-2 pr-3 text-admin-muted">{formatAzn(d.snapValueCents)}</td>
                <td className="py-2 pr-3 text-admin-muted">
                  {d.missing ? "silinib" : formatAzn(d.liveValueCents ?? 0)}
                </td>
                <td
                  className={`py-2 pr-3 font-bold ${
                    d.driftPct != null && d.driftPct < 0 ? "text-rose-500" : "text-emerald-600"
                  }`}
                >
                  {d.driftPct != null ? `${d.driftPct > 0 ? "+" : ""}${d.driftPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-admin-muted">
        Həlli: cari hovuzu <strong>Dayandır</strong> və yeni hovuz yaradın — yeni qiymətlərlə
        tərkib təzələnəcək.
      </p>
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

// ─── Kim nə qazandı ───────────────────────────────────────────────────────────

type OpeningRow = {
  id: string;
  orderCode: string;
  createdAt: string;
  chosenAt: string | null;
  user: { id: string; name: string | null; email: string; phone: string | null };
  title: string;
  imageUrl: string | null;
  store: string | null;
  pricePaidCents: number;
  valueAznCents: number;
  costAznCents: number;
  outcome: string;
  sellBackCents: number | null;
  profitCents: number;
  fulfillmentTransactionId: string | null;
};

const OUTCOME_FILTERS: Array<{ value: string; label: string }> = [
  { value: "", label: "Hamısı" },
  { value: "PENDING_CHOICE", label: "Seçim gözləyir" },
  { value: "CLAIMED_GAME", label: "Oyun götürdü" },
  { value: "SOLD_BACK", label: "Balansa satdı" },
];

const OUTCOME_BADGE: Record<string, string> = {
  PENDING_CHOICE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CLAIMED_GAME: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  SOLD_BACK: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const PAGE_SIZE = 50;

function WinnersPanel({ box }: { box: LootBox }) {
  const [rows, setRows] = useState<OpeningRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [outcome, setOutcome] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        boxId: box.id,
        take: String(PAGE_SIZE),
        skip: String(page * PAGE_SIZE),
      });
      if (outcome) params.set("outcome", outcome);
      if (query.trim()) params.set("q", query.trim());

      const res = await fetch(`/api/admin/loot-boxes/openings?${params}`, { cache: "no-store" });
      const data = await readJson(res);
      if (!res.ok) throw new Error((data.error as string) ?? `Siyahı yüklənmədi (HTTP ${res.status}).`);
      setRows((data.rows as OpeningRow[]) ?? []);
      setTotal((data.total as number) ?? 0);
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [box.id, outcome, page, query]);

  // Süzgəc dəyişəndə 250ms gözləyirik ki, hər hərfdə sorğu getməsin.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Süzgəc dəyişdikdə birinci səhifəyə qayıdırıq.
  useEffect(() => {
    setPage(0);
  }, [outcome, query]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black text-admin-fg">Kim nə qazandı</h3>
          <p className="text-xs text-admin-muted">
            {total} açılış. &quot;Mənfəət&quot; = ödənilən qiymət − faktiki maya (geri satılanda
            ödədiyimiz kredit).
          </p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className={`${INPUT} max-w-xs`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Müştəri, e-poçt, oyun və ya kod…"
        />
        <div className="flex flex-wrap gap-1">
          {OUTCOME_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setOutcome(f.value)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                outcome === f.value
                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                  : "border border-admin-line text-admin-muted hover:text-admin-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300">
          {loadError}
        </div>
      )}

      {rows == null ? (
        <div className="h-24 animate-pulse rounded-xl bg-admin-chip" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-admin-chip px-4 py-6 text-center text-sm text-admin-muted">
          Uyğun açılış tapılmadı.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-admin-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-admin-card text-left text-xs uppercase text-admin-muted">
              <tr>
                <th className="px-3 py-2">Tarix</th>
                <th className="px-3 py-2">Müştəri</th>
                <th className="px-3 py-2">Qazandığı oyun</th>
                <th className="px-3 py-2">Dəyər</th>
                <th className="px-3 py-2">Ödədi</th>
                <th className="px-3 py-2">Mənfəət</th>
                <th className="px-3 py-2">Nəticə</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-admin-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-admin-muted">
                    {new Date(r.createdAt).toLocaleString("az-AZ", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    <div className="font-mono text-[11px] text-amber-600">{r.orderCode}</div>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/admin/users/${r.user.id}`}
                      className="font-bold text-admin-fg hover:underline"
                    >
                      {r.user.name || "—"}
                    </a>
                    <div className="text-[11px] text-admin-muted">{r.user.email}</div>
                    {r.user.phone && <div className="text-[11px] text-admin-muted">{r.user.phone}</div>}
                  </td>
                  <td className="max-w-[220px] px-3 py-2">
                    <div className="truncate text-admin-fg">{r.title}</div>
                    {r.store === "EPIC" && <span className="text-[10px] text-admin-muted">EPIC</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-bold text-amber-600">
                    {formatAzn(r.valueAznCents)}
                    <div className="text-[11px] font-medium text-admin-muted">
                      maya {formatAzn(r.costAznCents)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-admin-fg">
                    {formatAzn(r.pricePaidCents)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 font-black ${
                      r.profitCents >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"
                    }`}
                  >
                    {r.profitCents >= 0 ? "+" : "−"}
                    {formatAzn(Math.abs(r.profitCents))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        OUTCOME_BADGE[r.outcome] ?? "bg-admin-chip text-admin-muted"
                      }`}
                    >
                      {LOOT_BOX_OUTCOME_LABELS[r.outcome as keyof typeof LOOT_BOX_OUTCOME_LABELS] ??
                        r.outcome}
                    </span>
                    {r.outcome === "SOLD_BACK" && r.sellBackCents != null && (
                      <div className="text-[11px] text-admin-muted">
                        {formatAzn(r.sellBackCents)} ödənildi
                      </div>
                    )}
                    {r.outcome === "CLAIMED_GAME" && (
                      <div className="text-[11px]">
                        <a href="/admin/orders" className="text-violet-600 hover:underline">
                          Sifarişə bax
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}
          >
            Əvvəlki
          </button>
          <span className="text-xs text-admin-muted">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={`${BTN} border border-admin-line text-admin-muted hover:text-admin-fg`}
          >
            Sonrakı
          </button>
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
