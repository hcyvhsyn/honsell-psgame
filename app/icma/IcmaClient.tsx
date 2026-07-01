"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  CircleHelp,
  Coins,
  Gift,
  Crown,
  Flame,
  Gamepad2,
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
  TicketPercent,
  Trophy,
  Trash2,
  TrendingUp,
  type LucideIcon,
  Users,
} from "lucide-react";
import { useModals } from "@/lib/modals";
import { useDialog } from "@/lib/dialogs";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import TierBadge, { type TierBadgeData } from "@/components/TierBadge";
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
  author: { id: string; name: string; avatarUrl: string | null; tier?: TierBadgeData | null };
  likes: number;
  dislikes: number;
  myReaction: number;
  commentCount: number;
  isMine: boolean;
};

type StreamingData = {
  isLoggedIn: boolean;
  isTrusted: boolean;
  myUser: { id: string; name: string; avatarUrl: string | null; tier?: TierBadgeData | null } | null;
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
  tier?: TierBadgeData | null;
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

const CATEGORY_ICONS: Record<CommunityCategory, LucideIcon> = {
  GENERAL: Sparkles,
  SERIAL: Clapperboard,
  OYUN: Gamepad2,
  ENDIRIM: TicketPercent,
  SUAL: CircleHelp,
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

  const postCount = useMemo(
    () => new Set([...initialFeed, ...myPosts].map((post) => post.id)).size,
    [initialFeed, myPosts],
  );
  const reviewCount = useMemo(
    () => new Set([...streaming.feed, ...streaming.mine].map((review) => review.id)).size,
    [streaming.feed, streaming.mine],
  );
  const interactionCount = useMemo(
    () =>
      initialFeed.reduce(
        (total, post) => total + post.likes + post.dislikes + post.commentCount,
        0,
      ) +
      [...streaming.feed, ...streaming.mine].reduce(
        (total, review) => total + review.likes + review.dislikes,
        0,
      ),
    [initialFeed, streaming.feed, streaming.mine],
  );

  // Köhnə /streaming/icmallar linkləri (?tab=icmallar və #r-<id> paylaşımları)
  // birbaşa icmallar tabını açsın.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "icmallar" || window.location.hash.startsWith("#r-")) setTab("icmallar");
    else if (t === "referal") setTab("referal");
  }, []);

  const tabs: { key: TabKey; label: string; hint: string; count?: number; Icon: LucideIcon }[] = [
    { key: "fikirler", label: "Söhbət", hint: "Fikir və suallar", count: postCount, Icon: MessagesSquare },
    { key: "icmallar", label: "İcmallar", hint: "Film və seriallar", count: reviewCount, Icon: Clapperboard },
    { key: "referal", label: "Referal", hint: "Paylaş və qazan", Icon: Coins },
  ];

  function selectTab(nextTab: TabKey) {
    setTab(nextTab);
    const url = new URL(window.location.href);
    if (nextTab === "fikirler") url.searchParams.delete("tab");
    else url.searchParams.set("tab", nextTab);
    if (nextTab !== "icmallar") url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <section className="relative mx-auto w-full max-w-[1360px] px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
      <header className="relative mb-5 overflow-hidden rounded-[30px] border border-zinc-200/90 bg-white shadow-[0_35px_100px_-65px_rgba(2,8,23,0.72)] dark:border-white/10 dark:bg-[#0b0f18]">
        <div aria-hidden className="pointer-events-none absolute -left-20 -top-28 h-80 w-80 rounded-full bg-cyan-400/20 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute -right-20 top-0 h-80 w-80 rounded-full bg-violet-500/20 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute bottom-[-45%] left-[38%] h-72 w-72 rounded-full bg-amber-300/15 blur-[85px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-amber-300" />

        <div className="relative grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-10 lg:p-10 xl:p-12">
          <div className="flex min-w-0 flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-900 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Honsell İcması · açıq efir
            </span>
            <h1 className="mt-5 max-w-3xl text-balance text-[2.7rem] font-black leading-[0.94] tracking-[-0.055em] text-zinc-950 dark:text-white sm:text-6xl lg:text-7xl">
              Oyun bitər. <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 dark:from-cyan-300 dark:via-violet-300 dark:to-fuchsia-300">Söhbət qalır.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] font-medium leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
              Oynadığını, izlədiyini və tapdığın fürsəti paylaş. Burada fikir yalnız oxunmur — cavab, reaksiya və yeni söhbətə çevrilir.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => selectTab("fikirler")}
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-black text-white shadow-[0_20px_45px_-24px_rgba(6,182,212,0.85)] transition hover:-translate-y-0.5 hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-cyan-100"
              >
                Söhbətə qoşul <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => selectTab("icmallar")}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-zinc-200 bg-white/70 px-5 text-sm font-black text-zinc-800 backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:hover:border-violet-300/40"
              >
                <Clapperboard className="h-4 w-4 text-violet-500 dark:text-violet-300" /> İcmalları kəşf et
              </button>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 border-t border-zinc-200/80 pt-5 dark:border-white/10 sm:max-w-xl sm:gap-5">
              <HeroMetric value={postCount} label="söhbət" />
              <HeroMetric value={reviewCount} label="icmal" />
              <HeroMetric value={interactionCount} label="reaksiya" />
            </div>
          </div>

          <ActivityDeck
            latestPost={initialFeed[0] ?? myPosts[0] ?? null}
            latestReview={streaming.mine[0] ?? streaming.feed[0] ?? null}
            onSelectTab={selectTab}
          />
        </div>
      </header>

      <nav
        aria-label="İcma bölmələri"
        className="mb-5 grid gap-2 rounded-[24px] border border-zinc-200 bg-white/90 p-2 shadow-[0_22px_60px_-50px_rgba(15,23,42,0.65)] backdrop-blur dark:border-white/10 dark:bg-[#0d111b]/90 sm:grid-cols-3"
      >
        {tabs.map(({ key, label, hint, count, Icon }) => (
          <button
            key={key}
            type="button"
            aria-current={tab === key ? "page" : undefined}
            onClick={() => selectTab(key)}
            className={`group flex min-h-[68px] items-center gap-3 rounded-[18px] border px-4 text-left transition duration-200 ${
              tab === key
                ? TAB_STYLES[key].active
                : "border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-950 dark:text-zinc-400 dark:hover:border-white/10 dark:hover:bg-white/[0.05] dark:hover:text-white"
            }`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-sm dark:bg-white/10 ${tab === key ? TAB_STYLES[key].icon : ""}`}>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-black">
                {label}
                {typeof count === "number" && (
                  <span className="rounded-full bg-zinc-950/8 px-2 py-0.5 text-[10px] tabular-nums dark:bg-white/10">
                    {count}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-70">{hint}</span>
            </span>
            <ArrowRight className={`h-4 w-4 transition ${tab === key ? "opacity-100" : "opacity-0 group-hover:opacity-70"}`} />
          </button>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0 space-y-5">
          {tab === "fikirler" && (
            <CommunityWall
              viewer={viewer}
              initialFeed={initialFeed}
              myPosts={myPosts}
              pageSize={pageSize}
            />
          )}
          {tab === "icmallar" && (
            <div className="overflow-hidden rounded-[28px] border border-violet-200 bg-[linear-gradient(145deg,#ffffff_0%,#faf5ff_50%,#fff7ed_100%)] p-4 text-zinc-950 shadow-[0_30px_90px_-65px_rgba(109,40,217,0.55)] dark:border-violet-300/20 dark:bg-[linear-gradient(145deg,#10131d_0%,#141020_52%,#17120d_100%)] dark:text-zinc-100 sm:p-5">
              <div className="mb-5 flex flex-col gap-3 border-b border-zinc-200/80 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">
                    <Clapperboard className="h-3.5 w-3.5" /> Ekran sonrası
                  </span>
                  <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Baxdıq, indi danışaq.</h2>
                  <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Spoilersiz fikir, dürüst bal və növbəti izləmə seçimin.</p>
                </div>
                <Link href="/streaming/katalog" className="inline-flex items-center gap-2 text-xs font-black text-violet-600 hover:text-violet-500 dark:text-violet-300">
                  Kataloqa bax <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <StreamingReviewsClient {...streaming} />
            </div>
          )}
          {tab === "referal" && <ReferralTab viewer={viewer} />}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <CommunityPulse viewer={viewer} onSelectTab={selectTab} />
          <LeaderboardPanel entries={leaderboard} viewer={viewer} />
        </aside>
      </div>
    </section>
  );
}

function HeroMetric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-black tabular-nums text-zinc-950 dark:text-white sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{label}</p>
    </div>
  );
}

function ActivityDeck({
  latestPost,
  latestReview,
  onSelectTab,
}: {
  latestPost: CommunityPostItem | null;
  latestReview: ReviewItem | null;
  onSelectTab: (tab: TabKey) => void;
}) {
  return (
    <div className="relative min-h-[360px] rounded-[28px] border border-zinc-200 bg-zinc-950 p-4 text-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.6)] dark:border-white/10 sm:p-5">
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-14 h-52 w-52 rounded-full bg-cyan-400/20 blur-3xl" />
      </div>
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
          <Radio className="h-3.5 w-3.5 text-emerald-400" /> İndi icmada
        </span>
        <Flame className="h-5 w-5 text-orange-300" />
      </div>

      <div className="relative mt-5 space-y-3">
        <button
          type="button"
          onClick={() => onSelectTab("fikirler")}
          className="group block w-[94%] rounded-[22px] border border-white/10 bg-white/[0.07] p-4 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-white/[0.10]"
        >
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">
            <MessagesSquare className="h-3.5 w-3.5" /> Son söhbət
          </span>
          <p className="mt-3 line-clamp-1 text-base font-black text-white">
            {latestPost?.title || latestPost?.body || "İlk mövzunu sən aç"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">
            {latestPost ? `${latestPost.author.name} · ${timeAgo(latestPost.createdAt)}` : "Sualını, tapdığın oyunu və ya fikrini paylaş."}
          </p>
          <ArrowRight className="ml-auto mt-3 h-4 w-4 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
        </button>

        <button
          type="button"
          onClick={() => onSelectTab("icmallar")}
          className="group ml-auto block w-[94%] rounded-[22px] border border-violet-300/15 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 p-4 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300/35"
        >
          <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-violet-300">
            <Clapperboard className="h-3.5 w-3.5" /> Son icmal
          </span>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-base font-black text-white">{latestReview?.titleSnap ?? "Nə izləməyə dəyər?"}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {latestReview ? `${latestReview.author.name} · ${latestReview.rating}/10` : "İzlədiyini qiymətləndir, icmaya yol göstər."}
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300 text-sm font-black text-amber-950">
              {latestReview ? latestReview.rating : "?"}
            </span>
          </div>
        </button>
      </div>

      <p className="relative mt-5 flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> AI dəstəyi ilə təmiz və təhlükəsiz söhbət
      </p>
    </div>
  );
}

function CommunityPulse({ viewer, onSelectTab }: { viewer: Viewer | null; onSelectTab: (tab: TabKey) => void }) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-cyan-200 bg-white shadow-[0_24px_70px_-56px_rgba(8,47,73,0.75)] dark:border-cyan-300/15 dark:bg-[#0e141d]">
      <div className="relative overflow-hidden border-b border-cyan-200/70 px-5 py-5 dark:border-white/10">
        <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
        <p className="relative text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Sənin icman</p>
        <p className="relative mt-2 text-xl font-black tracking-tight text-zinc-950 dark:text-white">
          {viewer ? `Salam, ${viewer.name.split(" ")[0]} 👋` : "Bir yerin hazırdır."}
        </p>
        <p className="relative mt-1 text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">
          {viewer ? "Söhbətə fikir əlavə et, icmanın ritmini dəyiş." : "Hesabını aç, ilk reaksiyanı və fikrini paylaş."}
        </p>
        <button
          type="button"
          onClick={() => onSelectTab("fikirler")}
          className="relative mt-4 inline-flex items-center gap-2 text-xs font-black text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
        >
          {viewer ? "Yeni fikir paylaş" : "İcmaya göz at"} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 divide-x divide-cyan-200/70 dark:divide-white/10">
        <PulseItem Icon={MessagesSquare} label="Söhbət" />
        <PulseItem Icon={ShieldCheck} label="Təhlükəsiz" />
        <PulseItem Icon={TrendingUp} label="Aktiv" />
      </div>
      <Link href="/referal-faizleri" className="flex items-center justify-between border-t border-cyan-200/70 px-5 py-4 text-xs font-black text-zinc-700 transition hover:bg-cyan-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/[0.04]">
        Referal faizlərini öyrən <ArrowRight className="h-3.5 w-3.5 text-amber-500" />
      </Link>
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
  const categoryCounts = useMemo(() => {
    const counts = new Map<CommunityCategory, number>();
    for (const category of COMMUNITY_CATEGORIES) counts.set(category.key, 0);
    for (const post of feed) {
      const key = post.category as CommunityCategory;
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [feed]);

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

      <div className="rounded-[26px] border border-zinc-200 bg-white/85 p-3 shadow-[0_16px_44px_-42px_rgba(15,23,42,0.55)] backdrop-blur dark:border-white/10 dark:bg-[#0d111a]/85 sm:p-4">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.17em] text-cyan-700 dark:text-cyan-300">Kəşf et</p>
            <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-950 dark:text-white">İcma lenti</h2>
          </div>
          <p className="text-[11px] font-semibold text-zinc-400">{visibleFeed.length} mövzu</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterPill active={filter === "ALL"} onClick={() => setFilter("ALL")} label="Hamısı" count={feed.length} Icon={Flame} />
          {COMMUNITY_CATEGORIES.map((c) => (
            <FilterPill
              key={c.key}
              active={filter === c.key}
              onClick={() => setFilter(c.key)}
              label={c.label}
              count={categoryCounts.get(c.key) ?? 0}
              Icon={CATEGORY_ICONS[c.key]}
            />
          ))}
        </div>
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

function FilterPill({
  active,
  onClick,
  label,
  count,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  Icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-black transition ${
        active
          ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${active ? "bg-white/15 dark:bg-zinc-950/10" : "bg-zinc-200/70 dark:bg-white/10"}`}>
        {count}
      </span>
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
        author: { id: viewer.id, name: viewer.name, avatarUrl: viewer.avatarUrl, tier: viewer.tier ?? null },
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
    <div className="relative overflow-hidden rounded-[28px] border border-cyan-200 bg-white shadow-[0_28px_80px_-58px_rgba(8,145,178,0.7)] dark:border-cyan-300/20 dark:bg-[#0c131c] sm:p-0">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-400" />
      <div className="relative p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <Avatar name={viewer.name} url={viewer.avatarUrl} size={42} />
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">
            {viewer.name}
          </p>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Nə haqqında danışmaq istəyirsən?
          </p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200 sm:inline-flex">
          <ShieldCheck className="h-3 w-3" /> İcma qaydaları aktivdir
        </span>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {COMMUNITY_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c.key];
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-black transition ${
                category === c.key
                  ? ACCENT_BADGE[c.accent]
                  : "border-white/70 bg-white/65 text-zinc-500 hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {c.label}
            </button>
          );
        })}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={COMMUNITY_POST_TITLE_MAX}
        placeholder="Mövzuya qısa başlıq ver (istəyə bağlı)"
        className="mt-3 h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 text-sm font-bold outline-none placeholder:text-zinc-400 focus:border-cyan-300 focus:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:focus:border-cyan-300/40 dark:focus:bg-white/[0.08]"
      />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMUNITY_POST_BODY_MAX}
        rows={4}
        placeholder="Son oynadığın oyun, izlədiyin film və ya icmaya vermək istədiyin sual..."
        className="mt-2 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm leading-6 outline-none placeholder:text-zinc-400 focus:border-cyan-300 focus:bg-white dark:border-white/10 dark:bg-white/[0.045] dark:text-white dark:focus:border-cyan-300/40 dark:focus:bg-white/[0.08]"
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

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-400">
          {tooShort ? `Ən az ${COMMUNITY_POST_BODY_MIN} simvol` : `${body.trim().length}/${COMMUNITY_POST_BODY_MAX}`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={tooShort || submitting}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 px-5 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(124,58,237,0.72)] transition hover:-translate-y-0.5 hover:saturate-125 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
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
  const CategoryIcon = CATEGORY_ICONS[cat.key];
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
    <article className={`group relative overflow-hidden rounded-[28px] border p-4 shadow-[0_22px_60px_-52px_rgba(24,24,27,0.55)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-50px_rgba(76,29,149,0.35)] dark:shadow-none sm:p-5 ${ACCENT_PANEL[cat.accent] ?? ACCENT_PANEL.violet}`}>
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${ACCENT_BAR[cat.accent] ?? ACCENT_BAR.violet}`} />
      <div className="flex items-start gap-3.5 pl-1">
        <div className="relative shrink-0">
          <Avatar name={post.author.name} url={post.author.avatarUrl} size={44} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400 dark:border-[#11151f]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black text-zinc-950 dark:text-white">{post.author.name}</span>
            {post.author.tier && <TierBadge tier={post.author.tier} />}
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${ACCENT_BADGE[cat.accent]}`}>
              <CategoryIcon className="h-3 w-3" />
              {cat.label}
            </span>
            <StatusBadge status={post.status} />
            <span className="text-xs text-zinc-400">· {timeAgo(post.createdAt)}</span>
          </div>
          {post.title && <h3 className="mt-3 text-xl font-black tracking-tight text-zinc-950 dark:text-white">{post.title}</h3>}
          <p className="mt-2 whitespace-pre-line text-[15px] font-medium leading-7 text-zinc-700 dark:text-zinc-200">
            {post.body}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/70 pt-3 dark:border-white/10">
        <ReactionButton
          active={post.myReaction === 1}
          count={post.likes}
          Icon={ThumbsUp}
          label="Bəyəndim"
          onClick={() => react(1)}
          disabled={reacting || post.status !== "APPROVED"}
        />
        <ReactionButton
          active={post.myReaction === -1}
          count={post.dislikes}
          Icon={ThumbsDown}
          label="Bəyənmədim"
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
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  count: number;
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label}${count > 0 ? `, ${count}` : ""}`}
      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black transition disabled:opacity-50 ${
        active
          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 ? <span className="tabular-nums">{count}</span> : ""}
    </button>
  );
}

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; tier?: TierBadgeData | null };
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
              {c.author.tier && <TierBadge tier={c.author.tier} />}
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
    <div className="relative overflow-hidden rounded-[28px] border border-violet-200 bg-white px-5 py-6 shadow-[0_26px_70px_-56px_rgba(109,40,217,0.7)] dark:border-violet-300/20 dark:bg-[#10121b] sm:px-6">
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-violet-300/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 text-white shadow-[0_15px_35px_-20px_rgba(124,58,237,0.9)]">
          <MessagesSquare className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-black text-zinc-950 dark:text-white">Sənin səsin də çatmır.</p>
          <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">{text}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-cyan-100"
          >
            Daxil ol
          </button>
          <Link href="/register?next=/icma" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-200">
            Qoşul <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
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
      <div className="relative overflow-hidden rounded-[28px] border border-amber-300/70 bg-[linear-gradient(135deg,#09131e_0%,#132d38_42%,#503313_100%)] p-6 text-white shadow-[0_30px_80px_-54px_rgba(14,116,144,0.9)] dark:border-amber-300/20 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-300" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/75">Sənin dəvət keçidin</p>
            <p className="mt-2 font-mono text-3xl font-black tracking-[0.18em] sm:text-5xl">{viewer.referralCode}</p>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/60">Kodu paylaş, dostun Honsell-ə qoşulsun, siz birlikdə qazanın.</p>
          </div>
          <div>
            <ReferralShareButtons code={viewer.referralCode} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard Icon={Users} label="Dəvət etdiklərin" value={String(viewer.referralCount)} accent="violet" />
        <StatCard Icon={Coins} label="Qazandığın komissiya" value={`${earned} ₼`} accent="emerald" />
        <StatCard Icon={Gift} label="Referal balansı" value={`${balance} ₼`} accent="amber" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/referal-faizleri"
          className="group flex min-h-[86px] items-center gap-3 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-amber-950 transition hover:-translate-y-0.5 hover:border-amber-300 dark:border-amber-300/20 dark:bg-amber-300/[0.08] dark:text-amber-100"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300 text-amber-950"><TicketPercent className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 text-sm font-black">Referal faizləri</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
        <Link
          href="/qazan"
          className="group flex min-h-[86px] items-center gap-3 rounded-[22px] border border-zinc-200 bg-white p-4 text-zinc-800 transition hover:-translate-y-0.5 hover:border-cyan-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-200"><Coins className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 text-sm font-black">Qazanc hesablayıcısı</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
        <Link
          href="/profile/referrals"
          className="group flex min-h-[86px] items-center gap-3 rounded-[22px] border border-zinc-200 bg-white p-4 text-zinc-800 transition hover:-translate-y-0.5 hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100 dark:hover:bg-white/[0.07]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-300/10 dark:text-violet-200"><Users className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 text-sm font-black">Dəvətlərimin detalı</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
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
