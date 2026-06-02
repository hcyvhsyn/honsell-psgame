"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  X,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  PhoneForwarded,
  Loader2,
  Crown,
  Trophy,
  Copy,
  KeyRound,
  Gift,
  UserPlus,
  Tv,
  Sparkles,
  Music,
  Briefcase,
} from "lucide-react";
import {
  GAME_ORDER_STAGES,
  GAME_STAGE_LABEL_AZ,
  parseGameOrderMeta,
  type GameOrderStage,
} from "@/lib/gameOrderFulfillment";
import CopyableField from "@/components/CopyableField";
import { useDialog } from "@/lib/dialogs";

type AnyOrder = {
  id: string;
  type: string;
  status: string;
  amountAznCents: number;
  createdAt: string;
  metadata?: string | null;
};

type PsnAccountSummary = {
  id: string;
  label: string;
  psnEmail: string;
  psnPassword: string;
  psModel: string;
};

type EpicAccountSummary = {
  id: string;
  label: string;
  epicEmail: string;
  epicPassword: string;
  displayName: string;
};

type OrdersPayload = {
  gameOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    game: {
      id: string;
      title: string;
      imageUrl: string | null;
      platform: string | null;
      productUrl: string | null;
      store: string | null;
    } | null;
    psnAccount: PsnAccountSummary | null;
    epicAccount: EpicAccountSummary | null;
  })[];
  psPlusOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
    psnAccount: PsnAccountSummary | null;
  })[];
  eaPlayOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
    psnAccount: PsnAccountSummary | null;
  })[];
  giftCardOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string } | null;
    serviceCode: { id: string; code: string } | null;
  })[];
  accountCreationOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string } | null;
  })[];
  epicAccountCreationOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null };
    serviceProduct: { id: string; title: string; type: string } | null;
  })[];
  streamingOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
  })[];
  aiOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
  })[];
  musicOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
  })[];
  workOrders: (AnyOrder & {
    user: { id: string; email: string; name: string | null; phone: string | null };
    serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
  })[];
  honsellOrders: HonsellOrder[];
};

type HonsellOrder = {
  id: string;
  amountAznCents: number;
  purchasedAt: string;
  expiresAt: string;
  purchaseTransactionId: string | null;
  purchasedBy: { id: string; email: string; name: string | null; phone: string | null } | null;
};

type PlatformOrder = OrdersPayload["aiOrders"][number];

function fmtAzn(cents: number) {
  return `${(Math.abs(cents) / 100).toFixed(2)} AZN`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseStreamingMeta(metadata?: string | null): {
  deliveryMode?: "CODE" | "GMAIL";
  gmail?: string;
  reason?: string;
  orderCode?: string;
} {
  if (!metadata) return {};
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    return {
      deliveryMode: m.deliveryMode === "GMAIL" ? "GMAIL" : m.deliveryMode === "CODE" ? "CODE" : undefined,
      gmail: typeof m.gmail === "string" ? m.gmail : undefined,
      reason: typeof m.reason === "string" ? m.reason : undefined,
      orderCode: typeof m.orderCode === "string" ? m.orderCode : undefined,
    };
  } catch {
    return {};
  }
}

type AccountCreationDetails = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  email?: string;
  password?: string;
  displayName?: string;
};

function parseAccountCreationDetails(metadata?: string | null): AccountCreationDetails | null {
  if (!metadata) return null;
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    const pick = (k: string) =>
      typeof m[k] === "string" && (m[k] as string).length > 0 ? (m[k] as string) : undefined;
    const out: AccountCreationDetails = {
      firstName: pick("firstName"),
      lastName: pick("lastName"),
      birthDate: pick("birthDate"),
      email: pick("email"),
      password: pick("password"),
      displayName: pick("displayName"),
    };
    return out.email || out.password || out.firstName || out.lastName || out.birthDate ? out : null;
  } catch {
    return null;
  }
}

function getPaymentSource(metadata?: string | null): "WALLET" | "REFERRAL" | "EPOINT" | "UNKNOWN" {
  if (!metadata) return "UNKNOWN";
  try {
    const m = JSON.parse(metadata) as { paymentSource?: string };
    if (m.paymentSource === "REFERRAL") return "REFERRAL";
    if (m.paymentSource === "WALLET") return "WALLET";
    if (m.paymentSource === "EPOINT") return "EPOINT";
    return "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

const TABS = [
  { id: "game", label: "Oyun çatdırılması" },
  { id: "psplus", label: "PS Plus" },
  { id: "eaplay", label: "EA Play" },
  { id: "gift", label: "Hədiyyə kart (TRY)" },
  { id: "honsell", label: "Honsell Hədiyyə kart" },
  { id: "account", label: "Hesab açma" },
  { id: "epic", label: "Epic hesab açma" },
  { id: "streaming", label: "Streaming" },
  { id: "ai", label: "Süni İntellekt" },
  { id: "music", label: "Musiqi" },
  { id: "work", label: "İş Platformaları" },
  { id: "cancelled", label: "Ləğv edilmiş" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_DESCRIPTIONS: Record<TabId, string> = {
  game: "PSN-ə oyun çatdırılması — mərhələni yeniləyin və ya tamamlayın.",
  psplus: "PS Plus aktivləşdirilməsi gözləyən sifarişlər.",
  eaplay: "EA Play aktivləşdirilməsi gözləyən sifarişlər.",
  gift: "TRY Balance kodu modal-da daxil edilir və müştəriyə göndərilir.",
  honsell: "Honsell Hədiyyə kartları — kod avtomatik yaradılır, müştəriyə email + WhatsApp göndərilir.",
  account: "Yeni PSN hesab açma sorğuları.",
  epic: "Yeni Türkiyə Epic Games hesab açma sorğuları — təsdiqlədikdə hesab yaradılır.",
  streaming: "Netflix, YouTube TV və s. — profil təhvili.",
  ai: "ChatGPT, Claude və digər süni intellekt platformaları.",
  music: "Spotify, YouTube Premium və digər musiqi servisləri.",
  work: "LinkedIn və digər iş platformaları.",
  cancelled: "Son ləğv edilmiş sifarişlər — səbəb, müştəri və geri qaytarmalar.",
};

type CancelledOrder = AnyOrder & {
  user: { id: string; email: string; name: string | null; phone: string | null };
  game: { id: string; title: string; imageUrl: string | null; platform: string | null } | null;
  serviceProduct: { id: string; title: string; type: string; metadata: unknown } | null;
};

type CancelMeta = {
  reason: string | null;
  cancelledAt: string | null;
  fromStatus: string | null;
};

function parseCancelMeta(metadata?: string | null): CancelMeta {
  if (!metadata) return { reason: null, cancelledAt: null, fromStatus: null };
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    return {
      reason: typeof m.cancelReason === "string" ? m.cancelReason : null,
      cancelledAt: typeof m.cancelledAt === "string" ? m.cancelledAt : null,
      fromStatus: typeof m.cancelledFromStatus === "string" ? m.cancelledFromStatus : null,
    };
  } catch {
    return { reason: null, cancelledAt: null, fromStatus: null };
  }
}

function cancelledItemLabel(o: CancelledOrder): string {
  if (o.type === "PURCHASE") return o.game?.title ?? "Oyun";
  return o.serviceProduct?.title ?? "Servis";
}

function cancelledTypeLabel(o: CancelledOrder): string {
  if (o.type === "PURCHASE") return "Oyun çatdırılması";
  const t = o.serviceProduct?.type ?? "";
  switch (t) {
    case "PS_PLUS":
      return "PS Plus";
    case "EA_PLAY":
      return "EA Play";
    case "TRY_BALANCE":
      return "Hədiyyə kart";
    case "ACCOUNT_CREATION":
      return "Hesab açma";
    case "STREAMING":
      return "Streaming";
    case "PLATFORM": {
      const meta = (o.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
      const cat = String(meta.category ?? "").toUpperCase();
      if (cat === "AI") return "Süni İntellekt";
      if (cat === "MUSIC") return "Musiqi";
      if (cat === "WORK") return "İş Platforması";
      return "Platform";
    }
    default:
      return t || "Servis";
  }
}

export default function OrdersAdminClient() {
  const dialog = useDialog();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("game");
  const [data, setData] = useState<OrdersPayload | null>(null);
  const [expandedGame, setExpandedGame] = useState<Set<string>>(new Set());
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [expandedPsPlus, setExpandedPsPlus] = useState<Set<string>>(new Set());

  // TRY_BALANCE hədiyyə kartı təsdiqi — admin modal-da kodu manual daxil edir.
  const [giftCardApprovingId, setGiftCardApprovingId] = useState<string | null>(null);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardFormError, setGiftCardFormError] = useState<string | null>(null);

  const [cancelledOrders, setCancelledOrders] = useState<CancelledOrder[] | null>(null);
  const [cancelledLoading, setCancelledLoading] = useState(false);
  const [cancelledError, setCancelledError] = useState<string | null>(null);

  // Cancel-with-reason modal. Used for both game and service tabs.
  type CancelTarget =
    | { kind: "game"; id: string; title: string }
    | {
        kind: "service";
        id: string;
        title: string;
        listKey:
          | "psPlusOrders"
          | "eaPlayOrders"
          | "giftCardOrders"
          | "accountCreationOrders"
          | "epicAccountCreationOrders"
          | "streamingOrders"
          | "aiOrders"
          | "musicOrders"
          | "workOrders";
      };
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  function openCancelModal(target: CancelTarget) {
    setCancelReason("");
    setCancelError(null);
    setCancelTarget(target);
  }

  function submitCancel() {
    const target = cancelTarget;
    if (!target) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError("Səbəbi yazın.");
      return;
    }
    setCancelError(null);
    startTransition(async () => {
      const url =
        target.kind === "game"
          ? `/api/admin/game-orders/${target.id}`
          : `/api/admin/service-orders/${target.id}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FAILED", reason }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setCancelError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        if (target.kind === "game") {
          return { ...prev, gameOrders: prev.gameOrders.filter((o) => o.id !== target.id) };
        }
        const list = prev[target.listKey].filter((o) => o.id !== target.id);
        return { ...prev, [target.listKey]: list };
      });
      setCancelTarget(null);
      setCancelReason("");
    });
  }

  function openGiftCardApproval(id: string) {
    setGiftCardFormError(null);
    setGiftCardCode("");
    setGiftCardApprovingId(id);
  }

  function submitGiftCardApproval() {
    const id = giftCardApprovingId;
    if (!id) return;
    const code = giftCardCode.trim();
    if (!code) {
      setGiftCardFormError("Kodu daxil edin.");
      return;
    }
    setGiftCardFormError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/service-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SUCCESS", code }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setGiftCardFormError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const list = prev.giftCardOrders.filter((o) => o.id !== id);
        return { ...prev, giftCardOrders: list };
      });
      setGiftCardApprovingId(null);
      setGiftCardCode("");
    });
  }

  function toggleExpandGame(id: string) {
    setExpandedGame((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandPsPlus(id: string) {
    setExpandedPsPlus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchGameOrder(id: string, body: object) {
    setBusyGameId(id);
    try {
      const res = await fetch(`/api/admin/game-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      // For terminal actions remove the row optimistically so the user sees
      // an instant response. For stage updates, do a silent reload to refresh
      // the row's metadata without flashing the whole list.
      const action = (body as { action?: string }).action;
      if (action === "SUCCESS" || action === "FAILED") {
        setData((prev) =>
          prev ? { ...prev, gameOrders: prev.gameOrders.filter((o) => o.id !== id) } : prev
        );
      } else {
        await load({ silent: true });
      }
    } finally {
      setBusyGameId(null);
    }
  }

  const counts = useMemo(() => {
    return {
      game: data?.gameOrders.length ?? 0,
      psplus: data?.psPlusOrders.length ?? 0,
      eaplay: data?.eaPlayOrders?.length ?? 0,
      gift: data?.giftCardOrders.length ?? 0,
      honsell: data?.honsellOrders?.length ?? 0,
      account: data?.accountCreationOrders.length ?? 0,
      epic: data?.epicAccountCreationOrders?.length ?? 0,
      streaming: data?.streamingOrders?.length ?? 0,
      ai: data?.aiOrders?.length ?? 0,
      music: data?.musicOrders?.length ?? 0,
      work: data?.workOrders?.length ?? 0,
      cancelled: cancelledOrders?.length ?? 0,
    };
  }, [data, cancelledOrders]);

  // Order codes that also contain a pending Epic account-creation order. An
  // Epic game order with no account attached but a matching code means the
  // customer ordered account creation in the same purchase — the game should
  // be loaded onto that account once we create it (not an error).
  const epicCreationOrderCodes = useMemo(() => {
    const set = new Set<string>();
    for (const o of data?.epicAccountCreationOrders ?? []) {
      const code = parseGameOrderMeta(o.metadata ?? null).orderCode;
      if (code) set.add(code);
    }
    return set;
  }, [data]);

  async function loadCancelled(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setCancelledLoading(true);
    setCancelledError(null);
    const res = await fetch("/api/admin/orders?status=FAILED", { cache: "no-store" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setCancelledError(j.error ?? "Yükləmə xətası");
      if (!opts.silent) setCancelledLoading(false);
      return;
    }
    const payload = (await res.json()) as { cancelledOrders: CancelledOrder[] };
    setCancelledOrders(payload.cancelledOrders ?? []);
    if (!opts.silent) setCancelledLoading(false);
  }

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Yükləmə xətası");
      if (!opts.silent) setLoading(false);
      return;
    }
    const payload = (await res.json()) as OrdersPayload;
    setData(payload);
    if (!opts.silent) setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab === "cancelled" && cancelledOrders === null && !cancelledLoading) {
      loadCancelled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function actService(
    id: string,
    action: "SUCCESS",
    listKey:
      | "psPlusOrders"
      | "eaPlayOrders"
      | "giftCardOrders"
      | "accountCreationOrders"
      | "epicAccountCreationOrders"
      | "streamingOrders"
      | "aiOrders"
      | "musicOrders"
      | "workOrders"
  ) {
    if (
      !(await dialog.confirm({
        title: "Sifarişi tamamla?",
        confirmLabel: "Tamamla",
      }))
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/service-orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Əməliyyat alınmadı");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const list = prev[listKey].filter((o) => o.id !== id);
        return { ...prev, [listKey]: list };
      });
    });
  }

  async function deliverHonsell(cardId: string) {
    if (
      !(await dialog.confirm({
        title: "Honsell hədiyyə kartını təslim et?",
        message: "Kod avtomatik yaradılacaq.",
        confirmLabel: "Təslim et",
      }))
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/honsell-gift-cards/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Təslim alınmadı");
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        const list = (prev.honsellOrders ?? []).filter((o) => o.id !== cardId);
        return { ...prev, honsellOrders: list };
      });
    });
  }

  function rejectService(
    id: string,
    title: string,
    listKey:
      | "psPlusOrders"
      | "eaPlayOrders"
      | "giftCardOrders"
      | "accountCreationOrders"
      | "epicAccountCreationOrders"
      | "streamingOrders"
      | "aiOrders"
      | "musicOrders"
      | "workOrders"
  ) {
    openCancelModal({ kind: "service", id, title, listKey });
  }

  const activeTabLabel = TABS.find((t) => t.id === tab)?.label ?? "";
  const activeTabCount = counts[tab];
  const totalPending =
    counts.game +
    counts.psplus +
    counts.eaplay +
    counts.gift +
    counts.honsell +
    counts.account +
    counts.streaming +
    counts.ai +
    counts.music +
    counts.work;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800/70 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sifarişlər</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Aktiv işlərinizi soldakı kateqoriyalardan açın və idarə edin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatCard label="Gözləyir" value={totalPending} tone="amber" />
          <StatCard label="Arxiv" value={counts.cancelled} tone="rose" />
          <button
            type="button"
            onClick={() => (tab === "cancelled" ? loadCancelled() : load())}
            disabled={pending || (tab === "cancelled" ? cancelledLoading : loading)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Yenilə
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <nav className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
            <SidebarGroup label="Oyun & PSN">
              <NavItem
                id="game"
                active={tab === "game"}
                icon={<Gamepad2 className="h-4 w-4" />}
                label="Oyun çatdırılması"
                count={counts.game}
                onClick={setTab}
              />
              <NavItem
                id="psplus"
                active={tab === "psplus"}
                icon={<Crown className="h-4 w-4" />}
                label="PS Plus"
                count={counts.psplus}
                onClick={setTab}
              />
              <NavItem
                id="eaplay"
                active={tab === "eaplay"}
                icon={<Trophy className="h-4 w-4" />}
                label="EA Play"
                count={counts.eaplay}
                onClick={setTab}
              />
            </SidebarGroup>
            <SidebarGroup label="Servislər">
              <NavItem
                id="gift"
                active={tab === "gift"}
                icon={<Gift className="h-4 w-4" />}
                label="Hədiyyə kart"
                count={counts.gift}
                onClick={setTab}
              />
              <NavItem
                id="honsell"
                active={tab === "honsell"}
                icon={<Gift className="h-4 w-4" />}
                label="Honsell H. kart"
                count={counts.honsell}
                onClick={setTab}
              />
              <NavItem
                id="account"
                active={tab === "account"}
                icon={<UserPlus className="h-4 w-4" />}
                label="Hesab açma"
                count={counts.account}
                onClick={setTab}
              />
              <NavItem
                id="epic"
                active={tab === "epic"}
                icon={<UserPlus className="h-4 w-4" />}
                label="Epic hesab açma"
                count={counts.epic}
                onClick={setTab}
              />
              <NavItem
                id="streaming"
                active={tab === "streaming"}
                icon={<Tv className="h-4 w-4" />}
                label="Streaming"
                count={counts.streaming}
                onClick={setTab}
              />
            </SidebarGroup>
            <SidebarGroup label="Platforma">
              <NavItem
                id="ai"
                active={tab === "ai"}
                icon={<Sparkles className="h-4 w-4" />}
                label="Süni İntellekt"
                count={counts.ai}
                onClick={setTab}
              />
              <NavItem
                id="music"
                active={tab === "music"}
                icon={<Music className="h-4 w-4" />}
                label="Musiqi"
                count={counts.music}
                onClick={setTab}
              />
              <NavItem
                id="work"
                active={tab === "work"}
                icon={<Briefcase className="h-4 w-4" />}
                label="İş Platformaları"
                count={counts.work}
                onClick={setTab}
              />
            </SidebarGroup>
            <SidebarGroup label="Arxiv">
              <NavItem
                id="cancelled"
                active={tab === "cancelled"}
                icon={<XCircle className="h-4 w-4" />}
                label="Ləğv edilmiş"
                count={counts.cancelled}
                onClick={setTab}
                tone="muted"
              />
            </SidebarGroup>
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/30 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <TabIcon id={tab} />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-zinc-100">
                  {activeTabLabel}
                </h2>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {TAB_DESCRIPTIONS[tab]}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-zinc-950 px-3 py-1 text-xs font-bold tabular-nums text-zinc-200 ring-1 ring-zinc-800">
              {activeTabCount} sifariş
            </span>
          </div>

          {tab === "cancelled" ? (
        <CancelledOrdersView
          orders={cancelledOrders}
          loading={cancelledLoading}
          error={cancelledError}
        />
      ) : loading || !data ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
          Yüklənir…
        </div>
      ) : (
        <>
          {tab === "game" && (
            data.gameOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
                Gözləyən oyun sifarişi yoxdur.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.gameOrders.map((o) => (
                  <GameOrderCard
                    key={o.id}
                    o={o}
                    expanded={expandedGame.has(o.id)}
                    toggleExpand={() => toggleExpandGame(o.id)}
                    busy={busyGameId === o.id}
                    onAction={(body) => patchGameOrder(o.id, body)}
                    onReject={() =>
                      openCancelModal({
                        kind: "game",
                        id: o.id,
                        title: o.game?.title ?? "Oyun sifarişi",
                      })
                    }
                    paymentSource={getPaymentSource(o.metadata)}
                    epicCreationOrderCodes={epicCreationOrderCodes}
                  />
                ))}
              </ul>
            )
          )}

          {tab === "eaplay" && (
            (data.eaPlayOrders ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
                Gözləyən EA Play sifarişi yoxdur.
              </div>
            ) : (
              <ul className="space-y-3">
                {(data.eaPlayOrders ?? []).map((o) => (
                  <PsPlusOrderCard
                    key={o.id}
                    o={o}
                    expanded={expandedPsPlus.has(o.id)}
                    toggleExpand={() => toggleExpandPsPlus(o.id)}
                    busy={pending}
                    onApprove={() => actService(o.id, "SUCCESS", "eaPlayOrders")}
                    onReject={() =>
                      rejectService(o.id, o.serviceProduct?.title ?? "EA Play", "eaPlayOrders")
                    }
                    paymentSource={getPaymentSource(o.metadata)}
                  />
                ))}
              </ul>
            )
          )}

          {tab === "psplus" && (
            data.psPlusOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
                Gözləyən PS Plus sifarişi yoxdur.
              </div>
            ) : (
              <ul className="space-y-3">
                {data.psPlusOrders.map((o) => (
                  <PsPlusOrderCard
                    key={o.id}
                    o={o}
                    expanded={expandedPsPlus.has(o.id)}
                    toggleExpand={() => toggleExpandPsPlus(o.id)}
                    busy={pending}
                    onApprove={() => actService(o.id, "SUCCESS", "psPlusOrders")}
                    onReject={() =>
                      rejectService(o.id, o.serviceProduct?.title ?? "PS Plus", "psPlusOrders")
                    }
                    paymentSource={getPaymentSource(o.metadata)}
                  />
                ))}
              </ul>
            )
          )}

          {tab === "gift" && (
            <OrdersTable
              empty="Gözləyən hədiyyə kart sifarişi yoxdur."
              rows={data.giftCardOrders.map((o) => ({
                id: o.id,
                userId: o.user.id,
                userLabel: o.user.name ?? o.user.email,
                userSub: o.user.email,
                item: o.serviceProduct?.title ?? "TRY Balance",
                itemSub: o.serviceCode ? "Kod ayrılıb" : "Kodu modal-da daxil edin",
                paymentSource: getPaymentSource(o.metadata),
                amount: fmtAzn(o.amountAznCents),
                date: fmtDate(o.createdAt),
                actions: (
                  <RowActions
                    pending={pending}
                    onApprove={() => openGiftCardApproval(o.id)}
                    onReject={() =>
                      rejectService(
                        o.id,
                        o.serviceProduct?.title ?? "Hədiyyə kart",
                        "giftCardOrders"
                      )
                    }
                  />
                ),
              }))}
            />
          )}

          {tab === "honsell" && (
            <OrdersTable
              empty="Gözləyən Honsell hədiyyə kartı yoxdur."
              rows={(data.honsellOrders ?? []).map((c) => ({
                id: c.id,
                userId: c.purchasedBy?.id ?? "",
                userLabel: c.purchasedBy?.name ?? c.purchasedBy?.email ?? "—",
                userSub: c.purchasedBy?.email ?? "—",
                item: `${(c.amountAznCents / 100).toFixed(2)} AZN Honsell Hədiyyə Kartı`,
                itemSub: `Bitir: ${fmtDate(c.expiresAt)}`,
                paymentSource: "—",
                amount: fmtAzn(c.amountAznCents),
                date: fmtDate(c.purchasedAt),
                actions: (
                  <div className="flex flex-col items-stretch gap-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => deliverHonsell(c.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 ring-1 ring-violet-500/30 hover:bg-violet-500/25 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Təslim et
                    </button>
                  </div>
                ),
              }))}
            />
          )}

          {tab === "account" && (
            <OrdersTable
              empty="Gözləyən hesab açma sifarişi yoxdur."
              rows={data.accountCreationOrders.map((o) => {
                const details = parseAccountCreationDetails(o.metadata);
                return {
                  id: o.id,
                  userId: o.user.id,
                  userLabel: o.user.name ?? o.user.email,
                  userSub: o.user.email,
                  item: o.serviceProduct?.title ?? "Hesab açma",
                  itemSub: details ? (
                    <AccountCreationDetailsBlock details={details} />
                  ) : (
                    "Detallar metadata-dadır"
                  ),
                  paymentSource: getPaymentSource(o.metadata),
                  amount: fmtAzn(o.amountAznCents),
                  date: fmtDate(o.createdAt),
                  actions: (
                    <RowActions
                      pending={pending}
                      onApprove={() => actService(o.id, "SUCCESS", "accountCreationOrders")}
                      onReject={() =>
                        rejectService(
                          o.id,
                          o.serviceProduct?.title ?? "Hesab açma",
                          "accountCreationOrders"
                        )
                      }
                    />
                  ),
                };
              })}
            />
          )}

          {tab === "epic" && (
            <OrdersTable
              empty="Gözləyən Epic hesab açma sifarişi yoxdur."
              rows={data.epicAccountCreationOrders.map((o) => {
                const details = parseAccountCreationDetails(o.metadata);
                return {
                  id: o.id,
                  userId: o.user.id,
                  userLabel: o.user.name ?? o.user.email,
                  userSub: o.user.email,
                  item: o.serviceProduct?.title ?? "Epic hesab açma",
                  itemSub: details ? (
                    <AccountCreationDetailsBlock details={details} />
                  ) : (
                    "Detallar metadata-dadır"
                  ),
                  paymentSource: getPaymentSource(o.metadata),
                  amount: fmtAzn(o.amountAznCents),
                  date: fmtDate(o.createdAt),
                  actions: (
                    <RowActions
                      pending={pending}
                      onApprove={() => actService(o.id, "SUCCESS", "epicAccountCreationOrders")}
                      onReject={() =>
                        rejectService(
                          o.id,
                          o.serviceProduct?.title ?? "Epic hesab açma",
                          "epicAccountCreationOrders"
                        )
                      }
                    />
                  ),
                };
              })}
            />
          )}

          {tab === "streaming" && (
            <OrdersTable
              empty="Gözləyən streaming sifarişi yoxdur."
              rows={(data.streamingOrders ?? []).map((o) => {
                const meta = parseStreamingMeta(o.metadata);
                return {
                  id: o.id,
                  userId: o.user.id,
                  userLabel: o.user.name ?? o.user.email,
                  userSub: o.user.email,
                  item: o.serviceProduct?.title ?? "Streaming",
                  itemSub:
                    meta.deliveryMode === "GMAIL"
                      ? meta.gmail
                        ? `Gmail: ${meta.gmail}`
                        : "Gmail (məlumat yoxdur)"
                      : "Manual təsdiq",
                  paymentSource: getPaymentSource(o.metadata),
                  amount: fmtAzn(o.amountAznCents),
                  date: fmtDate(o.createdAt),
                  actions: (
                    <RowActions
                      pending={pending}
                      onApprove={() => actService(o.id, "SUCCESS", "streamingOrders")}
                      onReject={() =>
                        rejectService(
                          o.id,
                          o.serviceProduct?.title ?? "Streaming",
                          "streamingOrders"
                        )
                      }
                    />
                  ),
                };
              })}
            />
          )}

          {tab === "ai" && (
            <PlatformOrdersTable
              orders={data.aiOrders ?? []}
              empty="Gözləyən süni intellekt sifarişi yoxdur."
              pending={pending}
              onApprove={(id) => actService(id, "SUCCESS", "aiOrders")}
              onReject={(id, title) => rejectService(id, title, "aiOrders")}
            />
          )}

          {tab === "music" && (
            <PlatformOrdersTable
              orders={data.musicOrders ?? []}
              empty="Gözləyən musiqi sifarişi yoxdur."
              pending={pending}
              onApprove={(id) => actService(id, "SUCCESS", "musicOrders")}
              onReject={(id, title) => rejectService(id, title, "musicOrders")}
            />
          )}

          {tab === "work" && (
            <PlatformOrdersTable
              orders={data.workOrders ?? []}
              empty="Gözləyən iş platforması sifarişi yoxdur."
              pending={pending}
              onApprove={(id) => actService(id, "SUCCESS", "workOrders")}
              onReject={(id, title) => rejectService(id, title, "workOrders")}
            />
          )}
        </>
      )}

        </section>
      </div>

      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => {
            if (pending) return;
            setCancelTarget(null);
            setCancelReason("");
            setCancelError(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/30">
                <X className="h-5 w-5 text-rose-300" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-zinc-100">Sifarişi ləğv et</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  <span className="text-zinc-200">{cancelTarget.title}</span> sifarişini
                  ləğv edirsiniz. Səbəbi müştərinin sifariş tarixçəsində görünəcək və ödəniş
                  müvafiq balansa geri qaytarılacaq.
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm">
              <span className="text-zinc-300">Ləğv etmə səbəbi</span>
              <textarea
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  if (cancelError) setCancelError(null);
                }}
                autoFocus
                rows={4}
                maxLength={1000}
                placeholder="Məs. Stokda yoxdur, müştəri ilə əlaqə qurula bilmədi, yanlış məlumat..."
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none"
              />
              <div className="mt-1 text-right text-[10px] text-zinc-500">
                {cancelReason.length} / 1000
              </div>
            </label>

            {cancelError && (
              <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {cancelError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                  setCancelError(null);
                }}
                disabled={pending}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={pending || !cancelReason.trim()}
                className="inline-flex items-center gap-2 rounded bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                {pending ? "Ləğv edilir..." : "Ləğv et və geri qaytar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {giftCardApprovingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold">Hədiyyə kart kodunu daxil et</h3>
            <p className="mb-5 text-sm text-zinc-400">
              Bu kod müştərinin email ünvanına göndərilir və profilində görünür. Sifariş tamamlanmış sayılacaq.
            </p>

            <label className="block text-sm">
              <span className="text-zinc-300">E-pin / kod</span>
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => {
                  setGiftCardCode(e.target.value);
                  if (giftCardFormError) setGiftCardFormError(null);
                }}
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
                placeholder="Məs. ABCD-EFG-1234"
                className="mt-1 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm tracking-widest text-emerald-300"
              />
            </label>

            {giftCardFormError && (
              <div className="mt-4 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {giftCardFormError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setGiftCardApprovingId(null);
                  setGiftCardFormError(null);
                  setGiftCardCode("");
                }}
                className="rounded bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
              >
                İmtina
              </button>
              <button
                type="button"
                onClick={submitGiftCardApproval}
                disabled={pending}
                className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {pending ? "Göndərilir..." : "Təsdiq et və göndər"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function GameOrderCard({
  o,
  expanded,
  toggleExpand,
  busy,
  onAction,
  onReject,
  paymentSource,
  epicCreationOrderCodes,
}: {
  o: OrdersPayload["gameOrders"][number];
  expanded: boolean;
  toggleExpand: () => void;
  busy: boolean;
  onAction: (body: object) => void;
  onReject: () => void;
  paymentSource: string;
  epicCreationOrderCodes: Set<string>;
}) {
  const dialog = useDialog();
  const meta = parseGameOrderMeta(o.metadata ?? null);
  const stage = meta.fulfillmentStage ?? ("NEW" as GameOrderStage);
  const amount = Math.abs(o.amountAznCents / 100).toFixed(2);
  // Epic (PC) order → deliver to the customer's Epic account, not a PSN one.
  const isEpic = o.game?.store === "EPIC" || Boolean(o.epicAccount);
  // No account attached, but the same order also created an Epic account →
  // load the game onto that to-be-created account (not a missing-account error).
  const epicPendingCreation =
    isEpic && !o.epicAccount && Boolean(meta.orderCode && epicCreationOrderCodes.has(meta.orderCode));

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
            {o.game?.imageUrl ? (
              <Image src={o.game.imageUrl} alt="" fill className="object-cover" sizes="56px" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <Gamepad2 className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{o.game?.title ?? "—"}</p>
            <Link
              href={`/admin/users/${o.user.id}`}
              className="truncate text-xs text-zinc-500 hover:text-zinc-300"
            >
              {o.user.name || "—"} · {o.user.email}
            </Link>
            {meta.orderCode ? (
              <p className="text-[11px] font-mono text-amber-200/90">Kod: {meta.orderCode}</p>
            ) : null}
            {o.user.phone && <p className="text-[11px] text-zinc-500">Tel: {o.user.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-800">
            {paymentSource}
          </span>
          <span className="text-sm tabular-nums text-zinc-300">{amount} AZN</span>
          <button
            type="button"
            onClick={toggleExpand}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 px-4 py-2 text-[11px] text-zinc-500">
        <StageChip icon={<PhoneForwarded className="h-3 w-3" />} label={GAME_STAGE_LABEL_AZ[stage]} />
        {o.game?.platform && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">Platform: {o.game.platform}</span>
        )}
        {isEpic && o.epicAccount && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            Epic: {o.epicAccount.displayName || o.epicAccount.label} — {o.epicAccount.epicEmail}
          </span>
        )}
        {!isEpic && o.psnAccount && (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            PSN: {o.psnAccount.label} — {o.psnAccount.psnEmail}
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800 bg-zinc-950/50 px-4 py-4">
          {o.game?.productUrl ? (
            <CopyableField
              label={isEpic ? "Epic Store linki" : "PS Store linki"}
              value={o.game.productUrl}
              mono
            />
          ) : null}
          {isEpic ? (
            <EpicDetailsBlock epic={o.epicAccount} pendingCreation={epicPendingCreation} />
          ) : (
            <PsnDetailsBlock psn={o.psnAccount} />
          )}

          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              value={stage}
              onChange={(e) => {
                const v = e.target.value as GameOrderStage;
                if (GAME_ORDER_STAGES.includes(v)) onAction({ action: "SET_STAGE", stage: v });
              }}
              disabled={busy}
            >
              {GAME_ORDER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {GAME_STAGE_LABEL_AZ[s]}
                </option>
              ))}
            </select>
            <span className="self-center text-[10px] text-zinc-500">İcra davamına uyğun mərhələ seçin</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  await dialog.confirm({
                    title: "Sifariş tamamlandı?",
                    message: isEpic
                      ? "Oyun Epic hesabında alındı və ya yükləndi?"
                      : "Oyun PSN-da alındı və ya yükləndi?",
                    confirmLabel: "Tamamla",
                  })
                )
                  onAction({ action: "SUCCESS" });
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tamamla (çatdırıldı)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Rədd · geri qaytarma
            </button>
          </div>
          {busy && (
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Yenilənir…
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function StageChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-medium text-indigo-200">
      {icon}
      {label}
    </span>
  );
}

function PsnDetailsBlock({ psn }: { psn: PsnAccountSummary | null }) {
  if (!psn) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        PSN hesabı seçilməyib. Müştəri hesab seçməyib və ya silib.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-200">
        <KeyRound className="h-3.5 w-3.5" /> PSN hesab məlumatları
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          {psn.label}
        </span>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          {psn.psModel}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <CredField label="Email" value={psn.psnEmail} />
        <CredField label="Şifrə" value={psn.psnPassword} />
      </dl>
    </div>
  );
}

function EpicDetailsBlock({
  epic,
  pendingCreation = false,
}: {
  epic: EpicAccountSummary | null;
  /** Bu sifarişdə Epic hesab açılışı da var → hesab yaradıldıqdan sonra oyunu ora yüklə. */
  pendingCreation?: boolean;
}) {
  if (!epic) {
    if (pendingCreation) {
      return (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-violet-200">
          Müştəri bu sifarişdə Epic hesab açılışını da sifariş edib. Hesabı
          yaratdıqdan sonra oyunu həmin hesaba yükləyin (məlumatlar “Epic hesab
          açma” bölməsindədir).
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        Epic hesabı seçilməyib. Müştəri hesab seçməyib və ya silib.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-violet-200">
        <KeyRound className="h-3.5 w-3.5" /> Epic hesab məlumatları
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          {epic.label}
        </span>
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-normal text-zinc-300 ring-1 ring-zinc-800">
          PC
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        <CredField label="Email" value={epic.epicEmail} />
        <CredField label="Şifrə" value={epic.epicPassword} />
        <CredField label="Display" value={epic.displayName} />
      </dl>
    </div>
  );
}

function CredField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-100">{value}</span>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(value);
          }
        }}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title="Kopyala"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function AccountCreationDetailsBlock({ details }: { details: AccountCreationDetails }) {
  const fullName = [details.firstName, details.lastName]
    .filter((s) => s && s !== "-" && s !== "?")
    .join(" ")
    .trim();
  return (
    <div className="mt-1 grid gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-2.5 sm:grid-cols-2">
      {fullName ? (
        <DetailField label="Ad, soyad" value={fullName} full />
      ) : null}
      {details.birthDate ? (
        <DetailField label="Doğum tarixi" value={details.birthDate} mono full />
      ) : null}
      {details.email ? (
        <DetailField label="Email" value={details.email} mono full />
      ) : null}
      {details.password ? (
        <DetailField label="Şifrə" value={details.password} mono full sensitive />
      ) : null}
      {details.displayName ? (
        <DetailField label="Görünən ad" value={details.displayName} full />
      ) : null}
    </div>
  );
}

function DetailField({
  label,
  value,
  mono = false,
  full = false,
  sensitive = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
  sensitive?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 ${full ? "sm:col-span-2" : ""}`}>
      <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span
        className={`min-w-0 flex-1 text-xs ${
          sensitive ? "text-emerald-300" : "text-zinc-100"
        } ${mono ? "break-all font-mono tracking-wide" : "break-words"}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(value);
          }
        }}
        className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        title="Kopyala"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function PsPlusOrderCard({
  o,
  expanded,
  toggleExpand,
  busy,
  onApprove,
  onReject,
  paymentSource,
}: {
  o: OrdersPayload["psPlusOrders"][number];
  expanded: boolean;
  toggleExpand: () => void;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  paymentSource: string;
}) {
  const tier = (() => {
    const m = o.serviceProduct?.metadata as { tier?: string; durationMonths?: number } | null;
    return m?.tier ?? null;
  })();
  const dur = (() => {
    const m = o.serviceProduct?.metadata as { tier?: string; durationMonths?: number } | null;
    return m?.durationMonths ?? null;
  })();
  const amount = Math.abs(o.amountAznCents / 100).toFixed(2);

  return (
    <li className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30">
            <Crown className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">
              {o.serviceProduct?.title ?? "PS Plus"}
            </p>
            <Link
              href={`/admin/users/${o.user.id}`}
              className="truncate text-xs text-zinc-500 hover:text-zinc-300"
            >
              {o.user.name || "—"} · {o.user.email}
            </Link>
            {o.user.phone && <p className="text-[11px] text-zinc-500">Tel: {o.user.phone}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-400 ring-1 ring-zinc-800">
            {paymentSource}
          </span>
          <span className="text-sm tabular-nums text-zinc-300">{amount} AZN</span>
          <button
            type="button"
            onClick={toggleExpand}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 px-4 py-2 text-[11px] text-zinc-500">
        {tier && (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-amber-200 ring-1 ring-amber-500/30">
            {tier}
          </span>
        )}
        {dur && <span className="rounded bg-zinc-800 px-2 py-0.5">{dur} ay</span>}
        {o.psnAccount ? (
          <span className="rounded bg-zinc-800 px-2 py-0.5">
            PSN: {o.psnAccount.label} — {o.psnAccount.psnEmail}
          </span>
        ) : (
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-200 ring-1 ring-amber-500/30">
            PSN seçilməyib
          </span>
        )}
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800 bg-zinc-950/50 px-4 py-4">
          <PsnDetailsBlock psn={o.psnAccount} />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tamamla
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/85 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" /> Rədd
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function OrdersTable({
  rows,
  empty,
}: {
  rows: {
    id: string;
    userId: string;
    userLabel: string;
    userSub: string;
    item: string;
    itemSub: React.ReactNode;
    paymentSource: string;
    amount: string;
    date: string;
    actions: React.ReactNode;
  }[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Müştəri</Th>
            <Th>Məhsul</Th>
            <Th>Ödəniş</Th>
            <Th>Məbləğ</Th>
            <Th>Tarix</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-900/40">
                <Td>
                  <Link className="block" href={`/admin/users/${r.userId}`}>
                    <div className="truncate text-zinc-100">{r.userLabel}</div>
                    <div className="truncate text-xs text-zinc-500">{r.userSub}</div>
                  </Link>
                </Td>
                <Td>
                  <div className="truncate text-zinc-100">{r.item}</div>
                  <div className="text-xs text-zinc-500">{r.itemSub}</div>
                </Td>
                <Td>
                  <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-800">
                    {r.paymentSource}
                  </span>
                </Td>
                <Td className="font-semibold text-zinc-100">{r.amount}</Td>
                <Td className="text-zinc-400">{r.date}</Td>
                <Td className="text-right">{r.actions}</Td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({
  pending,
  onApprove,
  onReject,
}: {
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={onApprove}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        Təsdiq
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onReject}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 ring-1 ring-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        Rədd
      </button>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-5 py-3 text-left font-medium ${className}`}>{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-5 py-3 align-top ${className}`}>{children}</td>;
}

function platformDurationLabel(o: PlatformOrder): string {
  const meta = (o.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
  const months = Number(meta.durationMonths);
  if (Number.isInteger(months) && months > 0) return `${months} ay`;
  return "Müddət göstərilməyib";
}

/** Order metadata-sından YouTube / LinkedIn müştəri credentials-larını çıxarır. */
function parsePlatformCustomerCreds(metadata?: string | null): {
  gmail?: string;
  password?: string;
  /// Kart altında credentials qutusu göstərilməlidirsə — true.
  hasCredentials: boolean;
  /// LinkedIn üçün email label "Gmail" deyil, "Email" olur.
  emailLabel: string;
  /// Plan etiketləri (məs. "LinkedIn Career · 6 ay") admin sıralamada faydalıdır.
  planLabel?: string;
} {
  if (!metadata) return { hasCredentials: false, emailLabel: "Gmail" };
  try {
    const m = JSON.parse(metadata) as Record<string, unknown>;
    if (m.kind !== "PLATFORM") return { hasCredentials: false, emailLabel: "Gmail" };

    const category = String(m.category ?? "");
    const musicBrand = String(m.musicBrand ?? "");
    const planType = String(m.planType ?? "").toUpperCase();
    const isYoutube = category === "MUSIC" && musicBrand === "YOUTUBE_PREMIUM";
    const isLinkedIn =
      category === "WORK" && (planType === "CAREER" || planType === "BUSINESS");

    const gmail = typeof m.gmail === "string" ? m.gmail : undefined;
    const password = typeof m.customerPassword === "string" ? m.customerPassword : undefined;

    const planLabel = isLinkedIn
      ? `LinkedIn ${planType === "CAREER" ? "Career" : "Business"}`
      : undefined;

    return {
      hasCredentials: isYoutube || isLinkedIn,
      emailLabel: isLinkedIn ? "Email" : "Gmail",
      gmail,
      password,
      planLabel,
    };
  } catch {
    return { hasCredentials: false, emailLabel: "Gmail" };
  }
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "amber" | "rose" | "indigo";
}) {
  const map: Record<string, string> = {
    default: "border-zinc-800 bg-zinc-900/60 text-zinc-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
    indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-200",
  };
  return (
    <div className={`min-w-[88px] rounded-lg border px-3 py-1.5 ${map[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
        {label}
      </div>
      <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
    </div>
  );
}

function SidebarGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-zinc-800/70 p-2 last:border-0">
      <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  id,
  active,
  icon,
  label,
  count,
  onClick,
  tone = "default",
}: {
  id: TabId;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: (id: TabId) => void;
  tone?: "default" | "muted";
}) {
  const hasItems = count > 0 && tone !== "muted";
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition",
        active
          ? "bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-500/30"
          : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100",
      ].join(" ")}
    >
      <span className={active ? "text-indigo-300" : "text-zinc-500"}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={[
          "min-w-[1.75rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ring-1",
          hasItems
            ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
            : "bg-zinc-950 text-zinc-500 ring-zinc-800",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}

function TabIcon({ id }: { id: TabId }) {
  const map: Record<TabId, React.ReactNode> = {
    game: <Gamepad2 className="h-5 w-5 text-indigo-300" />,
    psplus: <Crown className="h-5 w-5 text-amber-300" />,
    eaplay: <Trophy className="h-5 w-5 text-amber-300" />,
    gift: <Gift className="h-5 w-5 text-emerald-300" />,
    honsell: <Gift className="h-5 w-5 text-violet-300" />,
    account: <UserPlus className="h-5 w-5 text-emerald-300" />,
    epic: <UserPlus className="h-5 w-5 text-violet-300" />,
    streaming: <Tv className="h-5 w-5 text-rose-300" />,
    ai: <Sparkles className="h-5 w-5 text-fuchsia-300" />,
    music: <Music className="h-5 w-5 text-pink-300" />,
    work: <Briefcase className="h-5 w-5 text-sky-300" />,
    cancelled: <XCircle className="h-5 w-5 text-zinc-400" />,
  };
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-zinc-900 ring-1 ring-zinc-800">
      {map[id]}
    </div>
  );
}

function CancelledOrdersView({
  orders,
  loading,
  error,
}: {
  orders: CancelledOrder[] | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading && orders === null) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
        Yüklənir…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center text-sm text-zinc-500">
        Ləğv edilmiş sifariş yoxdur.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <Th>Müştəri</Th>
            <Th>Məhsul</Th>
            <Th>Növ</Th>
            <Th>Ləğv səbəbi</Th>
            <Th>Geri qaytarma</Th>
            <Th>Məbləğ</Th>
            <Th>Ləğv tarixi</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {orders.map((o) => {
            const meta = parseCancelMeta(o.metadata);
            const refundSource = getPaymentSource(o.metadata);
            return (
              <tr key={o.id} className="hover:bg-zinc-900/40 align-top">
                <Td>
                  <Link className="block" href={`/admin/users/${o.user.id}`}>
                    <div className="truncate text-zinc-100">
                      {o.user.name ?? o.user.email}
                    </div>
                    <div className="truncate text-xs text-zinc-500">{o.user.email}</div>
                  </Link>
                </Td>
                <Td>
                  <div className="truncate text-zinc-100">{cancelledItemLabel(o)}</div>
                  {meta.fromStatus && meta.fromStatus !== "PENDING" && (
                    <div className="text-[10px] uppercase tracking-wider text-amber-300/80">
                      Əvvəlki status: {meta.fromStatus}
                    </div>
                  )}
                </Td>
                <Td>
                  <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-800">
                    {cancelledTypeLabel(o)}
                  </span>
                </Td>
                <Td className="max-w-[320px]">
                  <div className="whitespace-pre-wrap break-words text-zinc-200">
                    {meta.reason ?? <span className="text-zinc-500">—</span>}
                  </div>
                </Td>
                <Td>
                  <span className="rounded-full bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-800">
                    {refundSource === "REFERRAL"
                      ? "Referral"
                      : refundSource === "WALLET"
                        ? "Cüzdan"
                        : refundSource === "EPOINT"
                          ? "Cüzdan (Epoint)"
                          : "—"}
                  </span>
                </Td>
                <Td className="font-semibold text-zinc-100">
                  {fmtAzn(o.amountAznCents)}
                </Td>
                <Td className="text-zinc-400">
                  {meta.cancelledAt ? fmtDate(meta.cancelledAt) : fmtDate(o.createdAt)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlatformOrdersTable({
  orders,
  empty,
  pending,
  onApprove,
  onReject,
}: {
  orders: PlatformOrder[];
  empty: string;
  pending: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, title: string) => void;
}) {
  return (
    <OrdersTable
      empty={empty}
      rows={orders.map((o) => {
        const creds = parsePlatformCustomerCreds(o.metadata);
        const itemSub = creds.hasCredentials ? (
          <div className="space-y-1.5">
            <div className="text-xs text-zinc-400">
              {creds.planLabel ? `${creds.planLabel} · ` : ""}
              {platformDurationLabel(o)}
            </div>
            <div className="space-y-1">
              {creds.gmail && <CopyableField label={creds.emailLabel} value={creds.gmail} />}
              {creds.password && (
                <CopyableField label="Şifrə" value={creds.password} masked mono />
              )}
            </div>
          </div>
        ) : (
          platformDurationLabel(o)
        );
        return {
          id: o.id,
          userId: o.user.id,
          userLabel: o.user.name ?? o.user.email,
          userSub: o.user.email,
          item: o.serviceProduct?.title ?? "Platform",
          itemSub,
          paymentSource: getPaymentSource(o.metadata),
          amount: fmtAzn(o.amountAznCents),
          date: fmtDate(o.createdAt),
          actions: (
            <RowActions
              pending={pending}
              onApprove={() => onApprove(o.id)}
              onReject={() => onReject(o.id, o.serviceProduct?.title ?? "Platform")}
            />
          ),
        };
      })}
    />
  );
}
