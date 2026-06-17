"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Coins,
  Gift,
  Crown,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Radio,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Trash2,
  TrendingUp,
  type LucideIcon,
  Users,
} from "lucide-react";
import { useModals } from "@/lib/modals";
import { useDialog } from "@/lib/dialogs";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import StreamingReviewsClient, { type ReviewItem } from "./StreamingReviewsClient";
import type { LeaderboardEntry } from "@/lib/referralLeaderboard";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_POST_BODY_MAX,
  COMMUNITY_POST_BODY_MIN,
  COMMUNITY_POST_TITLE_MAX,
  communityBlockReasonText,
  communityCategoryDef,
  type CommunityCategory,
} from "@/lib/community";

export type CommunityPostItem = {
  id: string;
  category: string;
  title: string | null;
  body: string;
  status: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  likes: number;
  dislikes: number;
  myReaction: number;
  commentCount: number;
  isMine: boolean;
};

type StreamingData = {
  isLoggedIn: boolean;
  isTrusted: boolean;
  myUser: { id: string; name: string; avatarUrl: string | null } | null;
  mine: ReviewItem[];
  feed: ReviewItem[];
};

type Viewer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  referralCode: string;
  referralBalanceCents: number;
  referralCount: number;
  commissionEarnedCents: number;
};

type TabKey = "fikirler" | "icmallar" | "referal";
const POST_DELETE_WINDOW_MS = 5 * 60 * 1000;

const ACCENT_BADGE: Record<string, string> = {
  violet: "border-violet-300/50 bg-violet-50 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-200",
  fuchsia: "border-fuchsia-300/50 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-400/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-200",
  emerald: "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  amber: "border-amber-300/50 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200",
  sky: "border-sky-300/50 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-200",
};

const ACCENT_PANEL: Record<string, string> = {
  violet: "border-violet-300/60 bg-violet-50/80 dark:border-violet-400/25 dark:bg-violet-500/[0.08]",
  fuchsia: "border-fuchsia-300/60 bg-fuchsia-50/80 dark:border-fuchsia-400/25 dark:bg-fuchsia-500/[0.08]",
  emerald: "border-emerald-300/60 bg-emerald-50/80 dark:border-emerald-400/25 dark:bg-emerald-500/[0.08]",
  amber: "border-amber-300/70 bg-amber-50/90 dark:border-amber-400/25 dark:bg-amber-500/[0.08]",
  sky: "border-sky-300/60 bg-sky-50/80 dark:border-sky-400/25 dark:bg-sky-500/[0.08]",
};

const ACCENT_BAR: Record<string, string> = {
  violet: "from-violet-500 to-indigo-500",
  fuchsia: "from-fuchsia-500 to-rose-500",
  emerald: "from-emerald-500 to-teal-500",
  amber: "from-amber-400 to-orange-500",
  sky: "from-sky-500 to-cyan-400",
};

const TAB_STYLES: Record<TabKey, { active: string; icon: string }> = {
  fikirler: {
    active:
      "border-cyan-300/70 bg-cyan-50 text-cyan-950 shadow-[0_16px_34px_-26px_rgba(6,182,212,0.9)] dark:border-cyan-300/25 dark:bg-cyan-400/[0.14] dark:text-cyan-100",
    icon: "text-cyan-600 dark:text-cyan-200",
  },
  icmallar: {
    active:
      "border-rose-300/70 bg-rose-50 text-rose-950 shadow-[0_16px_34px_-26px_rgba(244,63,94,0.9)] dark:border-rose-300/25 dark:bg-rose-400/[0.14] dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-200",
  },
  referal: {
    active:
      "border-amber-300/80 bg-amber-50 text-amber-950 shadow-[0_16px_34px_-26px_rgba(245,158,11,0.95)] dark:border-amber-300/25 dark:bg-amber-400/[0.14] dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-200",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "indicə";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dəq əvvəl`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} saat əvvəl`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} gün əvvəl`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} ay əvvəl`;
  return `${Math.floor(mon / 12)} il əvvəl`;
}

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toLocaleUpperCase("az")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") return null;
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Moderasiyada", cls: "border-amber-300/50 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200" },
    REJECTED: { label: "Rədd edilib", cls: "border-rose-300/50 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200" },
    HIDDEN: { label: "Gizlədilib", cls: "border-zinc-300/50 bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300" },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}

export default function IcmaClient({
  viewer,
  initialFeed,
  myPosts,
  streaming,
  leaderboard,
  pageSize,
}: {
  viewer: Viewer | null;
  initialFeed: CommunityPostItem[];
  myPosts: CommunityPostItem[];
  streaming: StreamingData;
  leaderboard: LeaderboardEntry[];
  pageSize: number;
}) {
  const [tab, setTab] = useState<TabKey>("fikirler");

  // Köhnə /streaming/icmallar linkləri (?tab=icmallar və #r-<id> paylaşımları)
  // birbaşa icmallar tabını açsın.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "icmallar" || window.location.hash.startsWith("#r-")) setTab("icmallar");
    else if (t === "referal") setTab("referal");
  }, []);

  const tabs: { key: TabKey; label: string; Icon: LucideIcon }[] = [
    { key: "fikirler", label: "Söhbət", Icon: MessagesSquare },
    { key: "icmallar", label: "İcmallar", Icon: Clapperboard },
    { key: "referal", label: "Referal", Icon: Coins },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:pt-8">
      <header className="mb-6 overflow-hidden rounded-[28px] border border-zinc-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_42%,#fff7ed_100%)] shadow-[0_28px_80px_-62px_rgba(15,23,42,0.65)] dark:border-white/10 dark:bg-[linear-gradient(135deg,#121522_0%,#09131f_50%,#1a1119_100%)]">
        <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-amber-300 to-rose-400" />

          <div className="min-w-0">
            <span className="inline-flex h-9 items-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-800 dark:border-cyan-300/25 dark:bg-cyan-400/[0.12] dark:text-cyan-100">
              <Radio className="h-3.5 w-3.5" /> Honsell İcması
            </span>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-6xl">
              Söhbət canlıdır.
            </h1>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <MiniMetric tone="cyan" label="Paylaşım" value={initialFeed.length + myPosts.length} />
              <MiniMetric tone="rose" label="İcmal" value={streaming.feed.length + streaming.mine.length} />
              <MiniMetric tone="amber" label="Top bal" value={leaderboard[0]?.points ?? 0} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SignalTile Icon={MessagesSquare} label="Söhbət" value="Açıq" tone="cyan" />
            <SignalTile Icon={Sparkles} label="AI düzəliş" value="Aktiv" tone="violet" />
            <SignalTile Icon={Trophy} label="Aylıq yarış" value={leaderboard[0] ? `#1 ${leaderboard[0].points}` : "Start"} tone="amber" />
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-w-0 space-y-5">
          <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-zinc-200 bg-white/85 p-1.5 shadow-[0_18px_55px_-46px_rgba(24,24,27,0.35)] backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
            {tabs.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-3 text-sm font-black transition ${
                  tab === key
                    ? TAB_STYLES[key].active
                    : "border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-300 dark:hover:border-white/10 dark:hover:bg-white/[0.065] dark:hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${tab === key ? TAB_STYLES[key].icon : ""}`} />
                {label}
              </button>
            ))}
          </div>

          {tab === "fikirler" && (
            <CommunityWall
              viewer={viewer}
              initialFeed={initialFeed}
              myPosts={myPosts}
              pageSize={pageSize}
            />
          )}
          {tab === "icmallar" && (
            <div className="overflow-hidden rounded-[26px] border border-rose-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_48%,#eef2ff_100%)] p-4 text-zinc-950 shadow-[0_24px_70px_-56px_rgba(190,18,60,0.45)] dark:border-rose-300/20 dark:bg-[linear-gradient(135deg,rgba(159,18,57,0.20),rgba(15,23,42,0.86)_52%,rgba(49,46,129,0.24)_100%)] dark:text-zinc-100 sm:p-5">
              <StreamingReviewsClient {...streaming} />
            </div>
          )}
          {tab === "referal" && <ReferralTab viewer={viewer} />}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          <CommunityPulse viewer={viewer} />
          <LeaderboardPanel entries={leaderboard} viewer={viewer} />
        </aside>
      </div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "cyan" | "rose" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-300/20 dark:bg-cyan-400/[0.10] dark:text-cyan-100",
    rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-300/20 dark:bg-rose-400/[0.10] dark:text-rose-100",
    amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/[0.10] dark:text-amber-100",
  }[tone];

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] font-black">{label}</p>
    </div>
  );
}

function SignalTile({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  tone: "cyan" | "violet" | "amber";
}) {
  const toneClass = {
    cyan: "border-cyan-200 bg-white/75 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/[0.08] dark:text-cyan-100",
    violet: "border-violet-200 bg-white/75 text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/[0.08] dark:text-violet-100",
    amber: "border-amber-200 bg-white/75 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/[0.08] dark:text-amber-100",
  }[tone];

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur ${toneClass}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-sm dark:bg-white/10">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{value}</p>
        <p className="text-[11px] font-black opacity-80">{label}</p>
      </div>
    </div>
  );
}

function CommunityPulse({ viewer }: { viewer: Viewer | null }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-cyan-200 bg-[linear-gradient(145deg,#ecfeff_0%,#ffffff_46%,#fff7ed_100%)] shadow-[0_24px_70px_-56px_rgba(8,47,73,0.75)] dark:border-cyan-300/20 dark:bg-[linear-gradient(145deg,rgba(8,47,73,0.36),rgba(15,23,42,0.82)_48%,rgba(120,53,15,0.24)_100%)]">
      <div className="border-b border-cyan-200/70 px-5 py-4 dark:border-white/10">
        <p className="text-base font-black text-zinc-950 dark:text-white">
          {viewer ? `Salam, ${viewer.name.split(" ")[0]}` : "İcmaya qoşul"}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70 ring-1 ring-cyan-200 dark:bg-white/10 dark:ring-white/10">
          <div className="h-full w-2/3 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-cyan-200/70 dark:divide-white/10">
        <PulseItem Icon={MessagesSquare} label="Söhbət" />
        <PulseItem Icon={ShieldCheck} label="Etik" />
        <PulseItem Icon={TrendingUp} label="Rəqabət" />
      </div>
    </div>
  );
}

function PulseItem({ Icon, label }: { Icon: LucideIcon; label: string }) {
  return (
    <div className="grid min-h-[78px] place-items-center px-2 py-3 text-center">
      <Icon className="h-5 w-5 text-cyan-800 dark:text-cyan-100" />
      <span className="mt-2 text-[11px] font-black text-zinc-700 dark:text-zinc-300">
        {label}
      </span>
    </div>
  );
}

function LeaderboardPanel({
  entries,
  viewer,
}: {
  entries: LeaderboardEntry[];
  viewer: Viewer | null;
}) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-amber-200 bg-white shadow-[0_24px_70px_-56px_rgba(146,64,14,0.55)] dark:border-amber-300/20 dark:bg-[#11151f]">
      <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50/70 px-5 py-4 dark:border-white/10 dark:bg-amber-400/[0.08]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-300 text-amber-950 shadow-[0_14px_30px_-18px_rgba(245,158,11,0.9)]">
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-zinc-950 dark:text-white">Bu ay liderlər</h2>
          <p className="text-xs font-black text-amber-700 dark:text-amber-200">Anonim yarış lövhəsi</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-300">
            <Crown className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-bold text-zinc-600 dark:text-zinc-300">
            Bu ay lider hələ yoxdur.
          </p>
        </div>
      ) : (
        <ol className="py-1">
          {entries.map((entry) => (
            <LeaderboardRow key={entry.userId} entry={entry} isViewer={viewer?.id === entry.userId} />
          ))}
        </ol>
      )}
    </section>
  );
}

function LeaderboardRow({
  entry,
  isViewer,
}: {
  entry: LeaderboardEntry;
  isViewer: boolean;
}) {
  const top = entry.rank <= 3;
  const topTone =
    entry.rank === 1
      ? "border-amber-300 bg-amber-50 dark:border-amber-300/20 dark:bg-amber-400/[0.08]"
      : entry.rank === 2
        ? "border-cyan-200 bg-cyan-50 dark:border-cyan-300/20 dark:bg-cyan-400/[0.08]"
        : entry.rank === 3
          ? "border-rose-200 bg-rose-50 dark:border-rose-300/20 dark:bg-rose-400/[0.08]"
          : "border-transparent";

  return (
    <li className={`mx-3 my-2 flex items-center gap-3 rounded-2xl border px-3 py-3 ${topTone} ${isViewer ? "ring-2 ring-emerald-300/70 dark:ring-emerald-300/35" : ""}`}>
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black ${
          top
            ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
            : "bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-300"
        }`}
      >
        #{entry.rank}
      </div>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500 via-violet-500 to-rose-500 text-sm font-black text-white shadow-[0_12px_28px_-20px_rgba(14,165,233,0.9)]">
        {entry.avatarLetter}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-zinc-950 dark:text-white">
          {entry.displayName}
        </p>
        <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
          {entry.invites} dəvət · {entry.spendAzn.toFixed(0)} ₼
        </p>
      </div>
      <p className="text-sm font-black tabular-nums text-zinc-950 dark:text-white">
        {entry.points}
      </p>
    </li>
  );
}

// ─── Fikirlər (community wall) ────────────────────────────────────────────────

function CommunityWall({
  viewer,
  initialFeed,
  myPosts,
  pageSize,
}: {
  viewer: Viewer | null;
  initialFeed: CommunityPostItem[];
  myPosts: CommunityPostItem[];
  pageSize: number;
}) {
  const { open } = useModals();
  const [feed, setFeed] = useState<CommunityPostItem[]>(initialFeed);
  const [pending, setPending] = useState<CommunityPostItem[]>(
    myPosts.filter((p) => p.status !== "APPROVED"),
  );
  const [filter, setFilter] = useState<CommunityCategory | "ALL">("ALL");
  const [offset, setOffset] = useState(initialFeed.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialFeed.length >= pageSize);

  const visibleFeed = useMemo(
    () => (filter === "ALL" ? feed : feed.filter((p) => p.category === filter)),
    [feed, filter],
  );

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const qs = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      const res = await fetch(`/api/community/posts?${qs.toString()}`);
      const data = await res.json();
      const more: CommunityPostItem[] = (data.posts ?? []).map(
        (p: Omit<CommunityPostItem, "status"> ) => ({ ...p, status: "APPROVED" }),
      );
      setFeed((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      setOffset((o) => o + more.length);
      setHasMore(more.length >= pageSize);
    } finally {
      setLoadingMore(false);
    }
  }, [offset, pageSize]);

  function handleCreated(post: CommunityPostItem) {
    if (post.status === "APPROVED") {
      setFeed((prev) => [post, ...prev]);
    } else {
      setPending((prev) => [post, ...prev]);
    }
  }

  function updatePost(id: string, patch: Partial<CommunityPostItem>) {
    setFeed((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePost(id: string) {
    setFeed((prev) => prev.filter((p) => p.id !== id));
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-5">
      {viewer ? (
        <Composer viewer={viewer} onCreated={handleCreated} />
      ) : (
        <GuestPrompt
          onLogin={() => open("login")}
          text="Fikrini paylaşmaq üçün hesabına daxil ol."
        />
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              viewer={viewer}
              onChange={updatePost}
              onDeleted={removePost}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-[24px] border border-zinc-200 bg-white/80 p-2 shadow-[0_16px_44px_-42px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
        <FilterPill active={filter === "ALL"} onClick={() => setFilter("ALL")} label="Hamısı" />
        {COMMUNITY_CATEGORIES.map((c) => (
          <FilterPill
            key={c.key}
            active={filter === c.key}
            onClick={() => setFilter(c.key)}
            label={c.label}
          />
        ))}
      </div>

      {visibleFeed.length === 0 ? (
        <div className="grid place-items-center rounded-[26px] border border-dashed border-cyan-300 bg-cyan-50/70 px-6 py-14 text-center dark:border-cyan-300/20 dark:bg-cyan-400/[0.07]">
          <MessagesSquare className="mb-3 h-9 w-9 text-cyan-700 dark:text-cyan-200" />
          <p className="text-sm font-black text-cyan-900 dark:text-cyan-100">
            Bu bölmədə hələ paylaşım yoxdur. İlk fikri sən yaz!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFeed.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              viewer={viewer}
              onChange={updatePost}
              onDeleted={removePost}
            />
          ))}
        </div>
      )}

      {filter === "ALL" && hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-5 text-sm font-black text-cyan-900 transition hover:bg-cyan-50 disabled:opacity-60 dark:border-cyan-300/20 dark:bg-cyan-400/[0.08] dark:text-cyan-100 dark:hover:bg-cyan-400/[0.14]"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Daha çox
          </button>
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3.5 py-2 text-xs font-black transition ${
        active
          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Composer({
  viewer,
  onCreated,
}: {
  viewer: Viewer;
  onCreated: (post: CommunityPostItem) => void;
}) {
  const [category, setCategory] = useState<CommunityCategory>("GENERAL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const tooShort = body.trim().length < COMMUNITY_POST_BODY_MIN;

  async function submit() {
    if (tooShort || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: title.trim() || undefined, body: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Xəta baş verdi.");
        return;
      }
      const created = data.post ?? {};
      onCreated({
        id: String(created.id),
        category,
        title: typeof created.title === "string" ? created.title : title.trim() || null,
        body: typeof created.body === "string" ? created.body : body.trim(),
        status: String(created.status ?? "PENDING"),
        createdAt: new Date().toISOString(),
        author: { id: viewer.id, name: viewer.name, avatarUrl: viewer.avatarUrl },
        likes: 0,
        dislikes: 0,
        myReaction: 0,
        commentCount: 0,
        isMine: true,
      });
      setTitle("");
      setBody("");
      if (created.blocked) {
        setNotice({
          tone: "warn",
          text: `Paylaşıla bilmədi: ${communityBlockReasonText(created.reason)} Mesaj admin yoxlamasına göndərildi.`,
        });
        setTimeout(() => setNotice(null), 7000);
      } else {
        setNotice({
          tone: "ok",
          text: created.changed ? "Paylaşıldı. AI mətni səliqəyə saldı." : "Paylaşıldı.",
        });
        setTimeout(() => setNotice(null), 2800);
      }
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd et.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-cyan-200 bg-[linear-gradient(180deg,#ffffff_0%,#f0fdfa_100%)] shadow-[0_24px_70px_-54px_rgba(15,118,110,0.55)] dark:border-cyan-300/20 dark:bg-[linear-gradient(180deg,rgba(14,116,144,0.14),rgba(15,23,42,0.70))] sm:p-0">
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
      <div className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar name={viewer.name} url={viewer.avatarUrl} size={38} />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">
            {viewer.name}
          </p>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Söhbətə qoşul
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {COMMUNITY_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-2xl border px-3 py-2 text-xs font-black transition ${
              category === c.key
                ? ACCENT_BADGE[c.accent]
                : "border-white/70 bg-white/65 text-zinc-500 hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={COMMUNITY_POST_TITLE_MAX}
        placeholder="Başlıq (opsional)"
        className="mt-3 h-12 w-full rounded-2xl border border-white/80 bg-white/75 px-4 text-sm font-bold outline-none placeholder:text-zinc-400 focus:border-cyan-300 focus:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:border-cyan-300/40 dark:focus:bg-white/[0.08]"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMUNITY_POST_BODY_MAX}
        rows={4}
        placeholder="Fikrini yaz..."
        className="mt-2 w-full resize-y rounded-2xl border border-white/80 bg-white/75 px-4 py-3 text-sm leading-6 outline-none placeholder:text-zinc-400 focus:border-cyan-300 focus:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:focus:border-cyan-300/40 dark:focus:bg-white/[0.08]"
      />

      {error && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
      {notice && (
        notice.tone === "warn" ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/[0.1] dark:text-amber-100">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notice.text}</span>
          </p>
        ) : (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            {notice.text}
          </p>
        )
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          {body.trim().length}/{COMMUNITY_POST_BODY_MAX}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={tooShort || submitting}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-5 text-sm font-black text-white shadow-[0_18px_38px_-26px_rgba(5,150,105,0.95)] transition hover:from-cyan-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Paylaş
        </button>
      </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  viewer,
  onChange,
  onDeleted,
}: {
  post: CommunityPostItem;
  viewer: Viewer | null;
  onChange: (id: string, patch: Partial<CommunityPostItem>) => void;
  onDeleted: (id: string) => void;
}) {
  const { open } = useModals();
  const dialog = useDialog();
  const cat = communityCategoryDef(post.category);
  const [reacting, setReacting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const deleteExpiresAt = new Date(post.createdAt).getTime() + POST_DELETE_WINDOW_MS;
  const canDelete = post.isMine && now <= deleteExpiresAt;
  const deleteMinutesLeft = Math.max(1, Math.ceil((deleteExpiresAt - now) / 60000));

  useEffect(() => {
    if (!post.isMine || Date.now() > deleteExpiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, [deleteExpiresAt, post.isMine]);

  async function react(value: 1 | -1) {
    if (!viewer) {
      open("login");
      return;
    }
    if (reacting || post.status !== "APPROVED") return;
    setReacting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const data = await res.json();
      if (res.ok) {
        onChange(post.id, {
          likes: data.likes,
          dislikes: data.dislikes,
          myReaction: data.myReaction,
        });
      }
    } finally {
      setReacting(false);
    }
  }

  async function deletePost() {
    if (!canDelete || deleting) return;
    const ok = await dialog.confirm({
      title: "Paylaşımı sil?",
      message: "Paylaşımı yalnız ilk 5 dəqiqə ərzində silmək mümkündür.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(post.id);
        return;
      }

      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Silinmədi",
        message: data.error ?? "Yenidən cəhd edin.",
        tone: "danger",
      });
      setNow(Date.now());
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className={`relative overflow-hidden rounded-[26px] border p-4 shadow-[0_18px_50px_-46px_rgba(24,24,27,0.45)] dark:shadow-none sm:p-5 ${ACCENT_PANEL[cat.accent] ?? ACCENT_PANEL.violet}`}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENT_BAR[cat.accent] ?? ACCENT_BAR.violet}`} />
      <div className="flex items-start gap-3.5">
        <Avatar name={post.author.name} url={post.author.avatarUrl} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-zinc-950 dark:text-white">{post.author.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${ACCENT_BADGE[cat.accent]}`}>
              {cat.label}
            </span>
            <StatusBadge status={post.status} />
            <span className="text-xs text-zinc-400">· {timeAgo(post.createdAt)}</span>
          </div>
          {post.title && <h3 className="mt-2 text-lg font-black tracking-tight text-zinc-950 dark:text-white">{post.title}</h3>}
          <p className="mt-1.5 whitespace-pre-line text-[15px] leading-7 text-zinc-700 dark:text-zinc-100">
            {post.body}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/70 pt-3 dark:border-white/10">
        <ReactionButton
          active={post.myReaction === 1}
          count={post.likes}
          Icon={ThumbsUp}
          onClick={() => react(1)}
          disabled={reacting || post.status !== "APPROVED"}
        />
        <ReactionButton
          active={post.myReaction === -1}
          count={post.dislikes}
          Icon={ThumbsDown}
          onClick={() => react(-1)}
          disabled={reacting || post.status !== "APPROVED"}
        />
        <div className="ml-auto flex items-center gap-1.5">
          {canDelete && (
            <button
              type="button"
              onClick={deletePost}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-400/[0.12]"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Sil · {deleteMinutesLeft} dəq
            </button>
          )}
          {post.status === "APPROVED" && (
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {post.commentCount > 0 ? post.commentCount : ""} Şərh
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <CommentThread
          postId={post.id}
          viewer={viewer}
          onCountChange={(n) => onChange(post.id, { commentCount: n })}
        />
      )}
    </article>
  );
}

function ReactionButton({
  active,
  count,
  Icon,
  onClick,
  disabled,
}: {
  active: boolean;
  count: number;
  Icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${
        active
          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {count > 0 ? count : ""}
    </button>
  );
}

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
  isMine: boolean;
};

function CommentThread({
  postId,
  viewer,
  onCountChange,
}: {
  postId: string;
  viewer: Viewer | null;
  onCountChange: (n: number) => void;
}) {
  const { open } = useModals();
  const dialog = useDialog();
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // İlk dəfə açılanda şərhləri yüklə.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/community/posts/${postId}/comments`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (active) setComments(ok ? data.comments ?? [] : []);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  async function send() {
    if (!viewer) {
      open("login");
      return;
    }
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Şərh göndərilmədi. Yenidən cəhd et.");
        setTimeout(() => setMessage(null), 6000);
        return;
      }
      if (data.blocked) {
        setMessage(`Şərh paylaşıla bilmədi: ${communityBlockReasonText(data.reason)}`);
        setTimeout(() => setMessage(null), 6000);
        return;
      }
      setComments((prev) => {
        const next = [...(prev ?? []), data.comment as CommentItem];
        onCountChange(next.length);
        return next;
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(comment: CommentItem) {
    const expiresAt = new Date(comment.createdAt).getTime() + POST_DELETE_WINDOW_MS;
    if (!comment.isMine || Date.now() > expiresAt || deletingCommentId) return;

    const ok = await dialog.confirm({
      title: "Şərhi sil?",
      message: "Şərhi yalnız ilk 5 dəqiqə ərzində silmək mümkündür.",
      confirmLabel: "Sil",
      tone: "danger",
    });
    if (!ok) return;

    setDeletingCommentId(comment.id);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments/${comment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => {
          const next = (prev ?? []).filter((item) => item.id !== comment.id);
          onCountChange(next.length);
          return next;
        });
        return;
      }

      const data = await res.json().catch(() => ({}));
      await dialog.alert({
        title: "Şərh silinmədi",
        message: data.error ?? "Yenidən cəhd edin.",
        tone: "danger",
      });
      setNow(Date.now());
    } finally {
      setDeletingCommentId(null);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4 dark:border-white/10">
      {loading && (
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Yüklənir...
        </div>
      )}
      {comments?.map((c) => (
        <div key={c.id} className="flex items-start gap-2.5">
          <Avatar name={c.author.name} url={c.author.avatarUrl} size={30} />
          <div className="min-w-0 flex-1 rounded-2xl bg-zinc-50 px-3 py-2 dark:bg-white/[0.045]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black">{c.author.name}</span>
              <span className="text-[11px] text-zinc-400">{timeAgo(c.createdAt)}</span>
              {c.isMine && now <= new Date(c.createdAt).getTime() + POST_DELETE_WINDOW_MS && (
                <button
                  type="button"
                  onClick={() => deleteComment(c)}
                  disabled={deletingCommentId === c.id}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-400/[0.12]"
                >
                  {deletingCommentId === c.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Sil
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-200">{c.body}</p>
          </div>
        </div>
      ))}
      {comments && comments.length === 0 && !loading && (
        <p className="text-xs text-zinc-400">İlk şərhi sən yaz.</p>
      )}
      {message && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-300/20 dark:bg-amber-400/[0.08] dark:text-amber-100">
          {message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder={viewer ? "Şərh yaz..." : "Şərh üçün daxil ol"}
          className="h-11 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none placeholder:text-zinc-400 focus:border-violet-400 focus:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:bg-white/[0.06]"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          aria-label="Göndər"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function GuestPrompt({ onLogin, text }: { onLogin: () => void; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[26px] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffffff)] px-6 py-8 text-center shadow-[0_20px_60px_-50px_rgba(146,64,14,0.55)] dark:border-amber-300/20 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.20),rgba(15,23,42,0.70))]">
      <p className="text-sm font-black text-amber-950 dark:text-amber-100">{text}</p>
      <button
        type="button"
        onClick={onLogin}
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-5 text-sm font-black text-amber-950 transition hover:bg-amber-400"
      >
        Daxil ol
      </button>
    </div>
  );
}

// ─── Referal kodun ────────────────────────────────────────────────────────────

function ReferralTab({ viewer }: { viewer: Viewer | null }) {
  const { open } = useModals();

  if (!viewer) {
    return (
      <GuestPrompt
        onLogin={() => open("login")}
        text="Referal kodunu görmək üçün hesabına daxil ol."
      />
    );
  }

  const balance = (viewer.referralBalanceCents / 100).toFixed(2);
  const earned = (viewer.commissionEarnedCents / 100).toFixed(2);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[26px] border border-amber-300 bg-[linear-gradient(135deg,#111827_0%,#164e63_48%,#92400e_100%)] p-6 text-white shadow-[0_30px_80px_-54px_rgba(14,116,144,0.9)] dark:border-amber-300/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">Referal kodun</p>
        <p className="mt-2 font-mono text-4xl font-black tracking-[0.2em]">{viewer.referralCode}</p>
        <div className="mt-4">
          <ReferralShareButtons code={viewer.referralCode} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard Icon={Users} label="Dəvət etdiklərin" value={String(viewer.referralCount)} accent="violet" />
        <StatCard Icon={Coins} label="Qazandığın komissiya" value={`${earned} ₼`} accent="emerald" />
        <StatCard Icon={Gift} label="Referal balansı" value={`${balance} ₼`} accent="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/qazan"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:border-violet-300 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]"
        >
          <Coins className="h-4 w-4" /> Qazanc hesablayıcısı
        </Link>
        <Link
          href="/profile/referrals"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:border-violet-300 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]"
        >
          <Users className="h-4 w-4" /> Dəvətlərimin detalı
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
  accent,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  accent: string;
}) {
  return (
      <div className="rounded-[22px] border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${ACCENT_BADGE[accent]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
