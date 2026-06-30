"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BadgeDollarSign,
  Banknote,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clapperboard,
  Coins,
  Copy,
  Film,
  Flame,
  Gamepad2,
  Layers3,
  type LucideIcon,
  MessageCircleMore,
  MousePointerClick,
  Music2,
  Percent,
  Rocket,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { buildReferralRegisterUrl } from "@/lib/referralPromotion";
import type { PublicRateGroup, PublicRateItem } from "@/lib/publicReferralRates";
import styles from "./referral-rates.module.css";

type TierView = {
  key: string;
  label: string;
  icon: string | null;
  groups: PublicRateGroup[];
};

type Props = {
  tierViews: TierView[];
  activeTierKey: string;
  referralCode: string | null;
};

type AmbassadorCard = {
  title: string;
  text: string;
  metric: string;
  Icon: LucideIcon;
};

type AmbassadorStep = {
  number: string;
  title: string;
  text: string;
  Icon: LucideIcon;
};

type AmbassadorVariant = {
  kind: "gaming" | "cinema";
  eyebrow: string;
  title: string;
  titleAccent: string;
  lead: string;
  trust: string;
  heroStatLabels: [string, string, string];
  deckKicker: string;
  deckText: string;
  deckChips: string[];
  cards: AmbassadorCard[];
  ticker: string[];
  processKicker: string;
  processTitle: string;
  processSteps: AmbassadorStep[];
  quote: string;
  quoteFooter: string;
  showcaseLabel: string;
  showcaseHeading: string;
  showcaseText: string;
  finalKickerLoggedIn: string;
  finalKickerGuest: string;
  finalTitleLoggedIn: string;
  finalTitleGuest: string;
  finalTextLoggedIn: string;
  finalTextGuest: string;
  disclaimer: string;
};

type GroupBrandAsset = {
  brandKey: "NETFLIX" | "PRIME_VIDEO" | "HBO_MAX" | "GAIN" | "SPOTIFY";
  src: string;
  alt: string;
  width: number;
  height: number;
};

function tierHref(key: string) {
  return key === "default" ? "/referal-faizleri" : `/referal-faizleri/${key}`;
}

function tierViewIcon(view: TierView): LucideIcon {
  const source = `${view.key} ${view.label} ${view.icon ?? ""}`.toLocaleLowerCase("az-AZ");
  if (source.includes("gaming")) return Gamepad2;
  if (source.includes("cinema")) return Clapperboard;
  if (source.includes("film")) return Clapperboard;
  if (source.includes("default") || source.includes("standart")) return Percent;
  return Sparkles;
}

type FlatRate = PublicRateItem & { groupKey: string; groupLabel: string };

function formatMoney(value: number) {
  const normalized = Math.round(Math.max(0, value) * 100) / 100;
  const [integer, decimals = ""] = normalized.toFixed(2).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const trimmedDecimals = decimals.replace(/0+$/, "");
  return trimmedDecimals ? `${grouped},${trimmedDecimals}` : grouped;
}

function fmtPct(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function normalizeBrandSource(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function getGroupBrandAsset(groupKey: string, groupLabel: string): GroupBrandAsset | null {
  const source = `${normalizeBrandSource(groupKey)} ${normalizeBrandSource(groupLabel)}`;

  if (source.includes("NETFLIX")) {
    return {
      brandKey: "NETFLIX",
      src: "/netflix-honsell.png",
      alt: "Netflix",
      width: 72,
      height: 20,
    };
  }
  if (source.includes("PRIME_VIDEO") || source.includes("PRIME")) {
    return {
      brandKey: "PRIME_VIDEO",
      src: "/prime-honsell.png",
      alt: "Prime Video",
      width: 72,
      height: 20,
    };
  }
  if (source.includes("HBO_MAX") || source.includes("HBOMAX")) {
    return {
      brandKey: "HBO_MAX",
      src: "/hbomax-honsell.png",
      alt: "HBO Max",
      width: 72,
      height: 20,
    };
  }
  if (source.includes("GAIN")) {
    return {
      brandKey: "GAIN",
      src: "/gain-honsell.png",
      alt: "Gain",
      width: 58,
      height: 22,
    };
  }
  if (source.includes("SPOTIFY")) {
    return {
      brandKey: "SPOTIFY",
      src: "/spotify-honsell.png",
      alt: "Spotify",
      width: 68,
      height: 22,
    };
  }

  return null;
}

function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    const duration = 560;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}

const CARD_ACCENTS = ["Green", "Gold", "Mint", "Lime"] as const;

const DEFAULT_TICKER = [
  "Bir link paylaş",
  "Dost çevrən qazanc şəbəkəndir",
  "Bu gün dəvət et, sabah balansını böyüt",
];

const DEFAULT_PROCESS_STEPS: AmbassadorStep[] = [
  {
    number: "01",
    Icon: Share2,
    title: "Linkini paylaş",
    text: "Şəxsi referal linkini WhatsApp, Telegram və ya sosial mediada dostlarına göndər.",
  },
  {
    number: "02",
    Icon: MousePointerClick,
    title: "Dostun qoşulsun",
    text: "Dostun sənin linkinlə qeydiyyatdan keçsin və bəyəndiyi məhsulu alsın.",
  },
  {
    number: "03",
    Icon: Coins,
    title: "Balansın artsın",
    text: "Uyğun alış təsdiqlənən kimi komissiya avtomatik referal balansına əlavə olunsun.",
  },
];

const AMBASSADOR_VARIANTS: Record<string, AmbassadorVariant> = {
  "gaming-ambassador": {
    kind: "gaming",
    eyebrow: "Gaming Ambassador əməkdaşlıq təqdimatı",
    title: "İcmanı oyuna çağır,",
    titleAccent: "satışa çevirən kampaniya səhifəsi qur.",
    lead:
      "Bu səhifə oyun kontenti yaradıcısı, icma lideri və ya e-idman tərəfdaşı üçün hazırlanıb. Məqsəd yalnız faiz göstərmək deyil, canlı kampaniyanın enerjisini, paylaşım ritmini və qazanc potensialını bir baxışda hiss etdirməkdir.",
    trust: "Oyun tərəfdaşlığı üçün hazırlanmış, yaradıcılara hazır təqdimat səhifəsi.",
    heroStatLabels: ["yaradıcı artımı", "aktiv qazanc ssenarisi", "yayımdan satışa axın"],
    deckKicker: "Niyə bu səhifə işləyir",
    deckText:
      "Neon arena estetikası, qısa çağırış axını və kampaniyaya hazır bloklar səhifəni yaradıcı təqdimatı kimi göstərir.",
    deckChips: ["Discord aktivliyi", "TikTok-a hazır", "Hədiyyə aksiyaları", "Canlı kampaniya enerjisi"],
    cards: [
      {
        title: "Yaradıcı odaqlı satış axını",
        text: "Yayım, hekayə və profil linkindən gələn trafiki bir baxışda satış məntiqinə bağlayır.",
        metric: "kampaniyadan satışa hazır",
        Icon: Rocket,
      },
      {
        title: "İcma fəaliyyəti",
        text: "Hədiyyə aksiyası, komanda kampaniyaları və referal missiyaları üçün təbii kampaniya dili qurur.",
        metric: "paylaşıma uyğun mesajlar",
        Icon: Trophy,
      },
      {
        title: "Oyun etibarı",
        text: "PlayStation və rəqəmsal məhsul ritmini yaradıcı əməkdaşlığına uyğun təqdim edir.",
        metric: "oyunçu auditoriyasına yaxın",
        Icon: Gamepad2,
      },
    ],
    ticker: [
      "Birgə kampaniya ritmi",
      "Yayımdan səbətə daha qısa yol",
      "İcma marağı satışa işləsin",
    ],
    processKicker: "Oyun əməkdaşlığı axını",
    processTitle: "Yaradıcı trafiki necə referal qazanca çevrilir?",
    processSteps: [
      {
        number: "01",
        Icon: Rocket,
        title: "Kampaniyanı elan et",
        text: "Hekayə, canlı yayım və ya Discord elanı ilə kampaniyanı güclü başlat.",
      },
      {
        number: "02",
        Icon: Target,
        title: "Uyğun təklifə yönləndir",
        text: "Auditoriyanı oyun, PS Plus və ya rəqəmsal hədiyyə kartı kimi uyğun məhsula apar.",
      },
      {
        number: "03",
        Icon: Trophy,
        title: "İcmanı yenidən cəlb et",
        text: "Qazancı yeni kampaniyalar, komanda çağırışları və yaradıcı təkrar paylaşımları ilə böyüt.",
      },
    ],
    quote:
      "“Yaxşı oyun əməkdaşlığı sadəcə afişa deyil, icmanı hərəkətə keçirən canlı kampaniya hissidir.”",
    quoteFooter: "Bu səhifə həmin hissi ilk baxışdan ötürmək üçün qurulub.",
    showcaseLabel: "Ən güclü əməkdaşlıq bucağı",
    showcaseHeading: "Yaradıcı auditoriyasına uyğun hansı məhsullar daha yaxşı işləyir?",
    showcaseText:
      "Oyun yaradıcısı üçün sürətli qərar verdirən tərəf odur ki, burada həm kampaniya hissi, həm də konkret qazanc faizi eyni anda görünür.",
    finalKickerLoggedIn: "Yaradıcı linkin artıq hazırdır",
    finalKickerGuest: "Oyun tərəfdaşlığı axınına başla",
    finalTitleLoggedIn: "İndi paylaş və icmanı ilk kampaniyaya gətir.",
    finalTitleGuest: "Gaming Ambassador kimi qoşul və ilk yaradıcı səhifəni aktivləşdir.",
    finalTextLoggedIn:
      "Referal linkin artıq hazırdır. Onu yaradıcı təqdimatında, profil linkində və ya icma elanlarında istifadə edib ilk trafik dalğasını başlada bilərsən.",
    finalTextGuest:
      "Qeydiyyatdan keç, öz referal kodunu al və oyun yönümlü əməkdaşlıq səhifənlə tərəfdaşlıqları daha güclü təqdim et.",
    disclaimer:
      "Faizlər Gaming Ambassador seqmenti üçün canlı sistem məlumatlarıdır; nümunə hesablamalar təqdimat məqsədlidir.",
  },
  "cinema-ambassador": {
    kind: "cinema",
    eyebrow: "Cinema Ambassador əməkdaşlıq təqdimatı",
    title: "Premyera ab-havası yarat,",
    titleAccent: "hekayəni satışa bağlayan səhifə aç.",
    lead:
      "Bu səhifə film, serial və kino yönümlü yaradıcı əməkdaşlıqları üçün xüsusi hazırlanıb. Məqsəd statistikadan çox atmosfer qurmaq, kontent tərəfdaşına kampaniyanın vizual və kommersiya gücünü eyni anda göstərməkdir.",
    trust: "Kino tərəfdaşlığı üçün hazırlanmış, ovqat öncəlikli təqdimat səhifəsi.",
    heroStatLabels: ["hekayə əsaslı qazanc", "kontent bucağı", "izləyicidən satışa axın"],
    deckKicker: "Ovqat lövhəsi kimi işləyən səhifə",
    deckText:
      "İşıq, səhnə və film kadrı detalları səhifəni sırf referal cədvəlindən çıxarıb təqdimat səhnəsinə çevirir.",
    deckChips: ["Premyera enerjisi", "Rəy öncəlikli təqdimat", "Treyler ovqatı", "İzləmə siyahısı cəlbi"],
    cards: [
      {
        title: "Hekayə əsaslı təqdimat",
        text: "Filmi danışan yaradıcı üçün səhifə quru satış dili yox, əhval və ritm verir.",
        metric: "ovqat təsiri",
        Icon: Film,
      },
      {
        title: "Premyera təqdimatı",
        text: "Əməkdaşlıq linkini sadə çağırış yox, təqdimat anı kimi göstərmək üçün vizual səhnə yaradır.",
        metric: "səhnə hissi",
        Icon: Clapperboard,
      },
      {
        title: "Rəydən satışa körpü",
        text: "Treyler, rəy və tövsiyə kontentindən gələn marağı daha təbii axınla təklifə keçirir.",
        metric: "izləmədən təklifə axın",
        Icon: Sparkles,
      },
    ],
    ticker: [
      "Premyera enerjisi ilə təqdim et",
      "Hekayə qur, marağı təklifə yönəlt",
      "İzləmə siyahısı hissi referal satışına işləsin",
    ],
    processKicker: "Kino əməkdaşlığı axını",
    processTitle: "Kino auditoriyası üçün referal təcrübəsi necə işləyir?",
    processSteps: [
      {
        number: "01",
        Icon: Clapperboard,
        title: "Maraq oyat",
        text: "Treyler kəsimi, rəy cəlbi və ya ovqat paylaşımı ilə kampaniyanın tonunu qur.",
      },
      {
        number: "02",
        Icon: Film,
        title: "Uyğun platformaya apar",
        text: "Auditoriyanı yayım seçimləri və uyğun paketlərlə birbaşa uyğun təklifə yönləndir.",
      },
      {
        number: "03",
        Icon: Sparkles,
        title: "Təəssüratı qazanca çevir",
        text: "Hekayəçilik gücünü referal axını ilə birləşdirib daha yadda qalan əməkdaşlıq hissi yarat.",
      },
    ],
    quote:
      "“Güclü kino əməkdaşlığı məhsulu göstərmir, əvvəlcə səhnəni qurur və insanı həmin səhnəyə daxil edir.”",
    quoteFooter: "Bu səhifə əvvəlcə hiss, sonra təklif prinsipiylə qurulub.",
    showcaseLabel: "Ən güclü hekayəçilik bucağı",
    showcaseHeading: "Kino yaradıcısı üçün hansı təkliflər daha təbii görünür?",
    showcaseText:
      "Film və serial auditoriyası üçün ən böyük üstünlük odur ki, burada məhsullar sərt satış dili ilə yox, tövsiyə estetikası ilə təqdim olunur.",
    finalKickerLoggedIn: "Sənin kino təqdimat linkin hazırdır",
    finalKickerGuest: "Kino tərəfdaşlığı axınına başla",
    finalTitleLoggedIn: "İndi paylaş və əməkdaşlığı premyera kimi təqdim et.",
    finalTitleGuest: "Cinema Ambassador kimi qoşul və ovqat öncəlikli referal səhifəni aç.",
    finalTextLoggedIn:
      "Linkini yaradıcı təqdimatı, rəy paylaşımı və ya serial/film tövsiyə kontenti ilə birlikdə istifadə edib daha yüksək səviyyəli ilk təəssürat yarada bilərsən.",
    finalTextGuest:
      "Qeydiyyatdan keç, referal kodunu al və kino yönümlü əməkdaşlıq səhifənlə tərəfdaşlarına daha güclü təqdimat göstər.",
    disclaimer:
      "Faizlər Cinema Ambassador seqmenti üçün canlı sistem məlumatlarıdır; nümunə hesablamalar təqdimat məqsədlidir.",
  },
};

function groupArtwork(groupKey: string) {
  if (groupKey === "PS_STORE") return <Gamepad2 />;
  if (groupKey.includes("MUSIC")) return <Music2 />;
  if (groupKey.includes("WORK")) return <BriefcaseBusiness />;
  if (groupKey.startsWith("STREAMING")) return <Zap />;
  return <WalletCards />;
}

const RateCard = memo(function RateCard({
  group,
  index,
  globalMaxRate,
}: {
  group: PublicRateGroup;
  index: number;
  globalMaxRate: number;
}) {
  const [open, setOpen] = useState(index < 2);
  const maxRate = Math.max(0, ...group.items.map((item) => item.pct));
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const progress = globalMaxRate > 0 ? (maxRate / globalMaxRate) * 100 : 0;
  const brandAsset = getGroupBrandAsset(group.key, group.label);

  return (
    <article className={`${styles.rateCard} ${styles[`accent${accent}`]}`}>
      <span className={styles.cardAmbient} aria-hidden />
      <button
        type="button"
        className={styles.rateCardHeader}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={`${styles.groupIcon} ${brandAsset ? styles.groupIconBrand : ""}`} aria-hidden>
          {brandAsset ? (
            <Image
              src={brandAsset.src}
              alt=""
              width={brandAsset.width}
              height={brandAsset.height}
              className={styles.groupBrandImage}
            />
          ) : (
            groupArtwork(group.key)
          )}
        </span>
        <span className={styles.groupTitleWrap}>
          <span className={styles.groupTitle}>{group.label}</span>
          <span className={styles.groupMeta}>
            {group.items.length} seçim · {maxRate > 0 ? `${fmtPct(maxRate)}%-dək` : "hazırda 0%"}
          </span>
        </span>
        <span className={styles.cardMaxRate}>
          <small>maks.</small>
          {fmtPct(maxRate)}%
        </span>
        <ChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </button>

      <span className={styles.cardProgress} aria-hidden>
        <i style={{ width: `${progress}%` }} />
      </span>

      <div className={`${styles.rateRows} ${open ? styles.rateRowsOpen : ""}`}>
        <div>
          {group.items.map((item) => (
            <div className={styles.rateRow} key={item.id}>
              <div className={styles.rateName}>
                <strong><i />{item.label}</strong>
                <span>{item.sub || `${group.label} məhsulu`}</span>
              </div>
              <div className={styles.rateExample}>
                {item.pct > 0 ? (
                  <>
                    <span>100 AZN alışdan</span>
                    <strong>+{formatMoney(item.pct)} AZN</strong>
                  </>
                ) : (
                  <span>Komissiya aktiv deyil</span>
                )}
              </div>
              <span className={`${styles.ratePill} ${item.pct <= 0 ? styles.ratePillZero : ""}`}>
                {fmtPct(item.pct)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
});

function QuoteVisual({
  ambassador,
  maxRate,
  positiveRateCount,
}: {
  ambassador: AmbassadorVariant | null;
  maxRate: number;
  positiveRateCount: number;
}) {
  if (ambassador?.kind === "gaming") {
    return (
      <div className={styles.gamingQuoteVisual}>
        <span className={styles.gamingArenaRing} />
        <span className={styles.gamingArenaRingSmall} />
        <div className={styles.gamingArenaCore}>
          <Gamepad2 />
          <strong>CANLI KAMPANİYA</strong>
          <span>{fmtPct(maxRate)}%-dək yaradıcı üstünlüyü</span>
        </div>
        {["Yayıma hazır", "Komanda çağırışı", `${positiveRateCount}+ təklif`].map((label) => (
          <span className={styles.gamingArenaChip} key={label}>
            {label}
          </span>
        ))}
      </div>
    );
  }

  if (ambassador?.kind === "cinema") {
    return (
      <div className={styles.cinemaQuoteVisual}>
        <span className={styles.cinemaSpotlight} />
        <div className={styles.cinemaReel}>
          <Clapperboard />
          <span>PREMYERA REJİMİ</span>
        </div>
        <div className={styles.cinemaFrames}>
          <article>
            <small>Səhnə 01</small>
            <strong>Əvvəlcə ovqat</strong>
          </article>
          <article>
            <small>Səhnə 02</small>
            <strong>Təklifin açılışı</strong>
          </article>
          <article>
            <small>Səhnə 03</small>
            <strong>{fmtPct(maxRate)}%-dək təqdimat</strong>
          </article>
        </div>
      </div>
    );
  }

  return (
    <>
      {[30, 46, 61, 82, 100].map((height, index) => (
        <span
          key={height}
          style={{ "--bar-height": `${height}%`, "--bar-delay": `${index * 120}ms` } as React.CSSProperties}
        >
          <i>₼</i>
        </span>
      ))}
      <TrendingUp />
    </>
  );
}

export default function ReferralRatesExperience({ tierViews, activeTierKey, referralCode }: Props) {
  const activeView = tierViews.find((v) => v.key === activeTierKey) ?? tierViews[0];
  const ambassador = activeView ? AMBASSADOR_VARIANTS[activeView.key] ?? null : null;
  const groups = useMemo(() => activeView?.groups ?? [], [activeView]);
  const hasTierSwitch = tierViews.length > 1;

  const rates = useMemo<FlatRate[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupKey: group.key,
          groupLabel: group.label,
        })),
      ),
    [groups],
  );
  const positiveRates = useMemo(() => rates.filter((rate) => rate.pct > 0), [rates]);
  const selectableRates = positiveRates.length > 0 ? positiveRates : rates;
  const firstRate = selectableRates[0];
  const [selectedId, setSelectedId] = useState(firstRate?.id ?? "");
  const [friends, setFriends] = useState(12);
  const [spend, setSpend] = useState(60);
  const [activeGroup, setActiveGroup] = useState("ALL");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productTriggerRef = useRef<HTMLButtonElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);

  const selected = rates.find((rate) => rate.id === selectedId) ?? firstRate;
  const monthly = friends * spend * ((selected?.pct ?? 0) / 100);
  const animatedMonthly = useAnimatedNumber(monthly);
  const maxRate = Math.max(0, ...rates.map((rate) => rate.pct));
  const topRate = positiveRates.reduce<FlatRate | undefined>(
    (top, rate) => (!top || rate.pct > top.pct ? rate : top),
    undefined,
  );
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase("az-AZ");
    return selectableRates.filter(
      (rate) =>
        !query ||
        `${rate.groupLabel} ${rate.label} ${rate.sub}`
          .toLocaleLowerCase("az-AZ")
          .includes(query),
    );
  }, [productSearch, selectableRates]);
  const visibleGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("az-AZ");
    return groups
      .filter((group) => activeGroup === "ALL" || group.key === activeGroup)
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !query ||
            `${item.label} ${item.sub} ${group.label}`
              .toLocaleLowerCase("az-AZ")
              .includes(query),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeGroup, groups, search]);
  const logoFilters = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .map((group) => {
        const asset = getGroupBrandAsset(group.key, group.label);
        if (!asset || seen.has(asset.brandKey)) return null;
        seen.add(asset.brandKey);
        return { groupKey: group.key, groupLabel: group.label, asset };
      })
      .filter((entry): entry is { groupKey: string; groupLabel: string; asset: GroupBrandAsset } => Boolean(entry));
  }, [groups]);

  const whatsAppLink = useMemo(() => {
    if (!referralCode) return "#";
    const inviteUrl = buildReferralRegisterUrl(referralCode);
    const message = `Honsell-də mənim dəvət linkimlə qeydiyyatdan keç. Məhsuldan asılı olaraq referal qazancı ${fmtPct(maxRate)}%-dəkdir:\n${inviteUrl}\n\nKod: ${referralCode}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [maxRate, referralCode]);

  const heroStats = ambassador
    ? [
        { value: maxRate > 0 ? `${fmtPct(maxRate)}%-dək` : "Canlı", label: ambassador.heroStatLabels[0] },
        { value: `${positiveRates.length}+`, label: ambassador.heroStatLabels[1] },
        { value: ambassador.kind === "gaming" ? "yaradıcıya hazır" : "təqdimata hazır", label: ambassador.heroStatLabels[2] },
      ]
    : [
        { value: maxRate > 0 ? `${fmtPct(maxRate)}%-dək` : "Real", label: "məhsul üzrə qazanc" },
        { value: `${positiveRates.length}+`, label: "qazanc imkanı" },
        { value: "1 link", label: "başlamaq üçün kifayətdir" },
      ];
  const tickerMessages = ambassador?.ticker ?? DEFAULT_TICKER;
  const processSteps = ambassador?.processSteps ?? DEFAULT_PROCESS_STEPS;
  const showcaseHeading = ambassador?.showcaseHeading ?? "Hansı məhsul nə qədər qazandırır?";
  const showcaseLabel = ambassador?.showcaseLabel ?? "Bu günün qazanc fürsəti";
  const showcaseText =
    ambassador?.showcaseText ??
    "Faizi seç, potensialını hesabla, ən uyğun auditoriyanı dəvət et.";
  const disclaimer =
    ambassador?.disclaimer ??
    "Faizlər standart müştəri seqmenti üçündür və zamanla dəyişə bilər. 100 AZN nümunəsi alış məbləği üzərindən sadə izahdır.";
  const tierSwitchBlock = hasTierSwitch ? (
    <div className={`${styles.tierSwitch} ${styles.heroTierSwitch}`} role="tablist" aria-label="Müştəri statusu üzrə faizlər">
      <span className={styles.tierSwitchLabel}>Statusa görə faizlər:</span>
      <div className={styles.tierSwitchButtons}>
        {tierViews.map((view) => {
          const active = view.key === activeTierKey;
          const Icon = tierViewIcon(view);
          return (
            <Link
              key={view.key}
              href={tierHref(view.key)}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={`${styles.tierSwitchButton} ${active ? styles.tierSwitchActive : ""}`}
            >
              <span className={styles.tierSwitchIcon} aria-hidden>
                <Icon />
              </span>
              {view.label}
            </Link>
          );
        })}
      </div>
    </div>
  ) : null;

  useEffect(() => {
    if (!rates.some((rate) => rate.id === selectedId)) {
      setSelectedId(firstRate?.id ?? "");
    }
  }, [firstRate?.id, rates, selectedId]);

  useEffect(() => {
    if (!productOpen) return;

    const frame = requestAnimationFrame(() => productSearchRef.current?.focus());
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!productDropdownRef.current?.contains(event.target as Node)) {
        setProductOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductOpen(false);
        productTriggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [productOpen]);

  function chooseProduct(id: string) {
    setSelectedId(id);
    setProductOpen(false);
    setProductSearch("");
    requestAnimationFrame(() => productTriggerRef.current?.focus());
  }

  async function copyInvite() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(buildReferralRegisterUrl(referralCode));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className={[
        styles.page,
        ambassador ? styles.pageAmbassador : "",
        ambassador?.kind === "gaming" ? styles.pageGaming : "",
        ambassador?.kind === "cinema" ? styles.pageCinema : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden />
        <div className={styles.auroraOne} aria-hidden />
        <div className={styles.auroraTwo} aria-hidden />
        {ambassador && (
          <div className={styles.heroAmbience} aria-hidden>
            <span />
            <span />
            <span />
          </div>
        )}

        <div className={styles.moneyCloud} aria-hidden>
          <span className={`${styles.floatingCoin} ${styles.coinOne}`}>₼</span>
          <span className={`${styles.floatingCoin} ${styles.coinTwo}`}>%</span>
          <span className={`${styles.floatingCoin} ${styles.coinThree}`}>₼</span>
          <span className={`${styles.floatingBill} ${styles.billOne}`}><Banknote /></span>
          <span className={`${styles.floatingBill} ${styles.billTwo}`}><Banknote /></span>
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <Link href="/qazan" className={styles.eyebrow}>
              <span><Sparkles /></span>
              {ambassador?.eyebrow ?? "Honsell referal proqramı"}
              <ArrowRight />
            </Link>

            <h1>
              {ambassador?.title ?? "Dostların alış edir."}
              <span>{ambassador?.titleAccent ?? "Sənin qazancın böyüyür."}</span>
            </h1>
            <p className={styles.heroLead}>
              {ambassador?.lead ??
                "Bir dəfə dəvət et, dostlarının uyğun Honsell alışlarından davamlı referal qazancı əldə et. Çevrən böyüdükcə potensial qazancın da böyüyür."}
            </p>

            {tierSwitchBlock}

            {ambassador && (
              <div className={styles.ambassadorDeck}>
                <div className={styles.ambassadorDeckHead}>
                  <span>{ambassador.deckKicker}</span>
                  <p>{ambassador.deckText}</p>
                </div>
                <div className={styles.ambassadorChipRow}>
                  {ambassador.deckChips.map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                  {topRate ? <span className={styles.ambassadorChipAccent}>{topRate.groupLabel}</span> : null}
                </div>
                <div className={styles.ambassadorCardGrid}>
                  {ambassador.cards.map(({ title, text, metric, Icon }) => (
                    <article className={styles.ambassadorCard} key={title}>
                      <span className={styles.ambassadorCardIcon}>
                        <Icon />
                      </span>
                      <strong>{title}</strong>
                      <p>{text}</p>
                      <small>{metric}</small>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.heroStats}>
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>

            <div className={styles.heroActions}>
              <a href="#hesabla" className={styles.primaryButton}>
                Qazancımı hesabla <TrendingUp />
              </a>
              <a href="#faizler" className={styles.secondaryButton}>
                Bütün faizlər <Percent />
              </a>
            </div>

            <p className={styles.trustLine}>
              <ShieldCheck /> {ambassador?.trust ?? "Faizlər canlı sistem məlumatlarıdır — gizli hesab yoxdur."}
            </p>
          </div>

          <div className={styles.calculatorWrap} id="hesabla">
            <div className={styles.calculatorGlow} aria-hidden />
            <div className={styles.calculatorCard}>
              <div className={styles.calculatorTopline}>
                <span><BadgeDollarSign /> {activeView.label} üçün canlı qazanc simulyatoru</span>
                <span className={styles.live}><i /> CANLI</span>
              </div>

              <div className={styles.earningsDisplay} aria-live="polite">
                <span>Təxmini aylıq qazancın</span>
                <strong>{formatMoney(animatedMonthly)} <small>AZN</small></strong>
                <p>İldə təxminən <b>{formatMoney(monthly * 12)} AZN</b> referal balansı</p>
              </div>

              <label className={styles.fieldLabel} id="rate-product-label">Məhsul / xidmət</label>
              <div className={styles.selectWrap} ref={productDropdownRef}>
                <button
                  ref={productTriggerRef}
                  type="button"
                  id="rate-product"
                  className={`${styles.productTrigger} ${productOpen ? styles.productTriggerOpen : ""}`}
                  aria-labelledby="rate-product-label rate-product-value"
                  aria-haspopup="listbox"
                  aria-controls="rate-product-list"
                  aria-expanded={productOpen}
                  onClick={() => setProductOpen((value) => !value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setProductOpen(true);
                    }
                  }}
                >
                  <span className={styles.productTriggerIcon} aria-hidden>
                    {selected ? (
                      (() => {
                        const asset = getGroupBrandAsset(selected.groupKey, selected.groupLabel);
                        if (asset) {
                          return (
                            <Image
                              src={asset.src}
                              alt=""
                              width={asset.width}
                              height={asset.height}
                              className={styles.selectBrandImage}
                            />
                          );
                        }
                        return groupArtwork(selected.groupKey);
                      })()
                    ) : (
                      <Layers3 />
                    )}
                  </span>
                  <span className={styles.productTriggerCopy} id="rate-product-value">
                    <small>{selected?.groupLabel ?? "Məhsul seç"}</small>
                    <strong>{selected?.label ?? "Seçim yoxdur"}</strong>
                  </span>
                  <span className={styles.productTriggerRate}>{fmtPct(selected?.pct ?? 0)}%</span>
                  <ChevronDown className={productOpen ? styles.productChevronOpen : ""} aria-hidden />
                </button>

                <div className={`${styles.productMenu} ${productOpen ? styles.productMenuOpen : ""}`}>
                  <div className={styles.productMenuHead}>
                    <div className={styles.productMenuSearch}>
                      <Search aria-hidden />
                      <input
                        ref={productSearchRef}
                        type="search"
                        value={productSearch}
                        onChange={(event) => setProductSearch(event.target.value)}
                        placeholder="Məhsul və ya platforma axtar..."
                        aria-label="Kalkulyator məhsulu axtar"
                      />
                      {productSearch && (
                        <button type="button" onClick={() => setProductSearch("")} aria-label="Axtarışı təmizlə">
                          <X />
                        </button>
                      )}
                    </div>
                    <span>{filteredProducts.length} qazanc seçimi</span>
                  </div>
                  <div className={styles.productOptions} id="rate-product-list" role="listbox" aria-labelledby="rate-product-label">
                    {filteredProducts.map((rate) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={rate.id === selectedId}
                        className={rate.id === selectedId ? styles.productOptionSelected : ""}
                        onClick={() => chooseProduct(rate.id)}
                        key={`${rate.groupKey}:${rate.id}`}
                      >
                        <span className={styles.productOptionIcon} aria-hidden>
                          {(() => {
                            const asset = getGroupBrandAsset(rate.groupKey, rate.groupLabel);
                            if (asset) {
                              return (
                                <Image
                                  src={asset.src}
                                  alt=""
                                  width={asset.width}
                                  height={asset.height}
                                  className={styles.optionBrandImage}
                                />
                              );
                            }
                            return groupArtwork(rate.groupKey);
                          })()}
                        </span>
                        <span className={styles.productOptionCopy}>
                          <small>{rate.groupLabel}</small>
                          <strong>{rate.label}</strong>
                        </span>
                        <span className={styles.productOptionRate}>+{fmtPct(rate.pct)}%</span>
                        <Check className={styles.productOptionCheck} aria-hidden />
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div className={styles.productMenuEmpty}>
                        <Search />
                        <span>Uyğun məhsul tapılmadı</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.sliderBlock}>
                <div className={styles.sliderHeading}>
                  <label htmlFor="friends">Dəvət etdiyin dost</label>
                  <output>{friends} nəfər</output>
                </div>
                <input
                  id="friends"
                  type="range"
                  min="1"
                  max="50"
                  value={friends}
                  onChange={(event) => setFriends(Number(event.target.value))}
                  style={{ "--range-progress": `${((friends - 1) / 49) * 100}%` } as React.CSSProperties}
                />
                <div className={styles.rangeEnds}><span>1</span><span>50</span></div>
              </div>

              <div className={styles.sliderBlock}>
                <div className={styles.sliderHeading}>
                  <label htmlFor="spend">Bir dostun aylıq alış məbləği</label>
                  <output>{spend} AZN</output>
                </div>
                <input
                  id="spend"
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={spend}
                  onChange={(event) => setSpend(Number(event.target.value))}
                  style={{ "--range-progress": `${((spend - 10) / 290) * 100}%` } as React.CSSProperties}
                />
                <div className={styles.rangeEnds}><span>10 AZN</span><span>300 AZN</span></div>
              </div>

              <div className={styles.formula}>
                <span><Users /> {friends} dost</span>
                <b>×</b>
                <span><Coins /> {spend} AZN</span>
                <b>×</b>
                <span><Percent /> {fmtPct(selected?.pct ?? 0)}%</span>
              </div>
              <p className={styles.calculatorNote}>
                Nəticə təxminidir; real qazanc dostlarının faktiki alışlarına görə dəyişir.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.ticker} aria-label="Referal motivasiyası">
        <div className={styles.tickerTrack}>
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1}>
              <span>{tickerMessages[0]}</span><Sparkles />
              <span>{tickerMessages[1]}</span><CircleDollarSign />
              <span>{tickerMessages[2]}</span><Rocket />
            </div>
          ))}
        </div>
      </div>

      <section className={styles.processSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>{ambassador?.processKicker ?? "Sadə mexanika, real qazanc"}</span>
          <h2>{ambassador?.processTitle ?? <>Paylaşdığın hər link<br />yeni qazanc qapısıdır.</>}</h2>
        </div>
        <div className={styles.steps}>
          {processSteps.map((step) => (
            <article className={styles.stepCard} key={step.number}>
              <span className={styles.stepNumber}>{step.number}</span>
              <span className={styles.stepIcon}><step.Icon /></span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.quoteSection}>
        <div className={styles.quoteVisual} aria-hidden>
          <QuoteVisual ambassador={ambassador} maxRate={maxRate} positiveRateCount={positiveRates.length} />
        </div>
        <blockquote>
          <Sparkles />
          <p>{ambassador?.quote ?? "“Qazanc böyük addımla deyil, paylaşdığın ilk linklə başlayır.”"}</p>
          <footer>{ambassador?.quoteFooter ?? "Bu gün 3 dostuna göndər. Qalanını sistem işləsin."}</footer>
        </blockquote>
      </section>

      <section className={styles.ratesSection} id="faizler">
        <div className={styles.ratesAtmosphere} aria-hidden>
          <i /><i /><i />
        </div>
        <div className={styles.ratesHeading}>
          <div>
            <span className={styles.sectionKicker}>Canlı referal faizləri</span>
            <h2>{showcaseHeading}</h2>
            <p>{showcaseText}</p>
          </div>
        </div>

        <div className={styles.rateShowcase}>
          <div className={styles.rateRadar} aria-hidden>
            <span className={styles.radarRingOne} />
            <span className={styles.radarRingTwo} />
            <span className={styles.radarSweep} />
            <span className={styles.radarChipOne}>+AZN</span>
            <span className={styles.radarChipTwo}>CANLI</span>
            <div className={styles.radarCore}>
              <small>ən yüksək</small>
              <strong>{fmtPct(maxRate)}%</strong>
              <span>qazanc</span>
            </div>
          </div>

          <div className={styles.showcaseContent}>
            <span className={styles.showcaseLabel}><Flame /> {showcaseLabel}</span>
            <h3>{topRate ? `${topRate.groupLabel} · ${topRate.label}` : "Yeni fürsətlər tezliklə"}</h3>
            <p>
              {ambassador?.showcaseText ?? "10 dost ayda 100 AZN-lik uyğun alış etsə, bu faizlə aylıq təxmini"}
              {!ambassador && <strong> {formatMoney(maxRate * 10)} AZN</strong>}
              {ambassador && (
                <>
                  {" "}
                  Ən güclü ssenari isə <strong>{formatMoney(maxRate * 10)} AZN</strong> aylıq təxmini qazanc potensialını bir baxışda göstərməsidir.
                </>
              )}
            </p>
            <div className={styles.showcaseStats}>
              <span><Layers3 /><b>{groups.length}</b> kateqoriya</span>
              <span><BarChart3 /><b>{positiveRates.length}</b> aktiv seçim</span>
              <span><Zap /><b>Canlı</b> faizlər</span>
            </div>
            <div className={styles.searchBox}>
              <Search aria-hidden />
              <input
                type="search"
                placeholder="Məhsul və ya platforma axtar..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Referal məhsulu axtar"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Axtarışı təmizlə"><X /></button>
              )}
            </div>
          </div>
        </div>

        <div className={styles.groupFilters}>
          <button
            type="button"
            className={activeGroup === "ALL" ? styles.filterActive : ""}
            onClick={() => setActiveGroup("ALL")}
          >
            Hamısı
          </button>
          {groups.map((group) => (
            <button
              type="button"
              key={group.key}
              className={activeGroup === group.key ? styles.filterActive : ""}
              onClick={() => setActiveGroup(group.key)}
            >
              {group.label}
            </button>
          ))}
        </div>

        {logoFilters.length > 0 && (
          <div className={styles.logoFilters} aria-label="Logo ilə platforma seçimi">
            {logoFilters.map(({ groupKey, groupLabel, asset }) => (
              <button
                type="button"
                key={groupKey}
                className={`${styles.logoFilterButton} ${activeGroup === groupKey ? styles.logoFilterActive : ""}`}
                onClick={() => setActiveGroup((current) => (current === groupKey ? "ALL" : groupKey))}
                aria-pressed={activeGroup === groupKey}
                title={groupLabel}
              >
                <Image
                  src={asset.src}
                  alt={asset.alt}
                  width={asset.width}
                  height={asset.height}
                  className={styles.logoFilterImage}
                />
              </button>
            ))}
          </div>
        )}

        <div className={styles.rateGrid}>
          {visibleGroups.map((group, index) => (
            <RateCard group={group} index={index} globalMaxRate={maxRate} key={group.key} />
          ))}
        </div>
        {visibleGroups.length === 0 && (
          <div className={styles.emptyState}>
            <Search />
            <strong>Bu adda məhsul tapılmadı</strong>
            <span>Axtarışı dəyişib yenidən yoxla.</span>
          </div>
        )}
        <p className={styles.ratesDisclaimer}>
          <ShieldCheck /> {disclaimer}
        </p>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.ctaCoinOne} aria-hidden>₼</div>
        <div className={styles.ctaCoinTwo} aria-hidden>%</div>
        <div className={styles.ctaCopy}>
          <span className={styles.sectionKicker}>
            {referralCode
              ? ambassador?.finalKickerLoggedIn ?? "Sənin linkin hazırdır"
              : ambassador?.finalKickerGuest ?? "İlk qazancına bir addım"}
          </span>
          <h2>
            {referralCode
              ? ambassador?.finalTitleLoggedIn ?? "İndi paylaş. Qazanc şəbəkəni böyüt."
              : ambassador?.finalTitleGuest ?? "Dostlarını dəvət et. Balansını böyüt."}
          </h2>
          <p>
            {referralCode
              ? ambassador?.finalTextLoggedIn ??
                "Kodun səndədir. Onu dostlarına göndər və uyğun alışlardan referal qazancı toplamağa başla."
              : ambassador?.finalTextGuest ??
                "Pulsuz qeydiyyatdan keç, şəxsi referal kodunu al və bu gün paylaşmağa başla."}
          </p>
        </div>

        {referralCode ? (
          <div className={styles.sharePanel}>
            <div className={styles.codeBox}>
              <span>Sənin kodun</span>
              <strong>{referralCode}</strong>
            </div>
            <button type="button" className={styles.copyButton} onClick={copyInvite}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Link kopyalandı" : "Dəvət linkini kopyala"}
            </button>
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.whatsappButton}
            >
              <MessageCircleMore /> WhatsApp-da paylaş
            </a>
          </div>
        ) : (
          <div className={styles.ctaActions}>
            <Link href="/register" className={styles.primaryButton}>
              Qeydiyyatdan keç və qazan <UserPlus />
            </Link>
            <Link href="/login" className={styles.ctaLogin}>
              Hesabım var <Send />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
