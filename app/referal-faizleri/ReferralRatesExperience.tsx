"use client";

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
  Coins,
  Copy,
  Flame,
  Gamepad2,
  Layers3,
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
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { buildReferralRegisterUrl } from "@/lib/referralPromotion";
import type { PublicRateGroup, PublicRateItem } from "@/lib/publicReferralRates";
import styles from "./referral-rates.module.css";

type Props = {
  groups: PublicRateGroup[];
  referralCode: string | null;
};

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

  return (
    <article className={`${styles.rateCard} ${styles[`accent${accent}`]}`}>
      <span className={styles.cardAmbient} aria-hidden />
      <button
        type="button"
        className={styles.rateCardHeader}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={styles.groupIcon} aria-hidden>
          {groupArtwork(group.key)}
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

export default function ReferralRatesExperience({ groups, referralCode }: Props) {
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

  const whatsAppLink = useMemo(() => {
    if (!referralCode) return "#";
    const inviteUrl = buildReferralRegisterUrl(referralCode);
    const message = `Honsell-də mənim dəvət linkimlə qeydiyyatdan keç. Məhsuldan asılı olaraq referal qazancı ${fmtPct(maxRate)}%-dəkdir:\n${inviteUrl}\n\nKod: ${referralCode}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [maxRate, referralCode]);

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
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden />
        <div className={styles.auroraOne} aria-hidden />
        <div className={styles.auroraTwo} aria-hidden />

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
              Honsell referal proqramı
              <ArrowRight />
            </Link>

            <h1>
              Dostların alış edir.
              <span>Sənin qazancın böyüyür.</span>
            </h1>
            <p className={styles.heroLead}>
              Bir dəfə dəvət et, dostlarının uyğun Honsell alışlarından davamlı referal
              qazancı əldə et. Çevrən böyüdükcə potensial qazancın da böyüyür.
            </p>

            <div className={styles.heroStats}>
              <div>
                <strong>{maxRate > 0 ? `${fmtPct(maxRate)}%-dək` : "Real"}</strong>
                <span>məhsul üzrə qazanc</span>
              </div>
              <div>
                <strong>{positiveRates.length}+</strong>
                <span>qazanc imkanı</span>
              </div>
              <div>
                <strong>1 link</strong>
                <span>başlamaq üçün kifayətdir</span>
              </div>
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
              <ShieldCheck /> Faizlər canlı sistem məlumatlarıdır — gizli hesab yoxdur.
            </p>
          </div>

          <div className={styles.calculatorWrap} id="hesabla">
            <div className={styles.calculatorGlow} aria-hidden />
            <div className={styles.calculatorCard}>
              <div className={styles.calculatorTopline}>
                <span><BadgeDollarSign /> Canlı qazanc simulyatoru</span>
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
                    {selected ? groupArtwork(selected.groupKey) : <Layers3 />}
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
                        <span className={styles.productOptionIcon} aria-hidden>{groupArtwork(rate.groupKey)}</span>
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
              <span>Bir link paylaş</span><Sparkles />
              <span>Dost çevrən qazanc şəbəkəndir</span><CircleDollarSign />
              <span>Bu gün dəvət et, sabah balansını böyüt</span><Rocket />
            </div>
          ))}
        </div>
      </div>

      <section className={styles.processSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Sadə mexanika, real qazanc</span>
          <h2>Paylaşdığın hər link<br />yeni qazanc qapısıdır.</h2>
        </div>
        <div className={styles.steps}>
          {[
            { number: "01", icon: <Share2 />, title: "Linkini paylaş", text: "Şəxsi referal linkini WhatsApp, Telegram və ya sosial mediada dostlarına göndər." },
            { number: "02", icon: <MousePointerClick />, title: "Dostun qoşulsun", text: "Dostun sənin linkinlə qeydiyyatdan keçsin və bəyəndiyi məhsulu alsın." },
            { number: "03", icon: <Coins />, title: "Balansın artsın", text: "Uyğun alış təsdiqlənən kimi komissiya avtomatik referal balansına əlavə olunsun." },
          ].map((step) => (
            <article className={styles.stepCard} key={step.number}>
              <span className={styles.stepNumber}>{step.number}</span>
              <span className={styles.stepIcon}>{step.icon}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.quoteSection}>
        <div className={styles.quoteVisual} aria-hidden>
          {[30, 46, 61, 82, 100].map((height, index) => (
            <span key={height} style={{ "--bar-height": `${height}%`, "--bar-delay": `${index * 120}ms` } as React.CSSProperties}>
              <i>₼</i>
            </span>
          ))}
          <TrendingUp />
        </div>
        <blockquote>
          <Sparkles />
          <p>“Qazanc böyük addımla deyil, paylaşdığın ilk linklə başlayır.”</p>
          <footer>Bu gün 3 dostuna göndər. Qalanını sistem işləsin.</footer>
        </blockquote>
      </section>

      <section className={styles.ratesSection} id="faizler">
        <div className={styles.ratesAtmosphere} aria-hidden>
          <i /><i /><i />
        </div>
        <div className={styles.ratesHeading}>
          <div>
            <span className={styles.sectionKicker}>Canlı referal faizləri</span>
            <h2>Hansı məhsul nə qədər qazandırır?</h2>
            <p>Faizi seç, potensialını hesabla, ən uyğun auditoriyanı dəvət et.</p>
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
            <span className={styles.showcaseLabel}><Flame /> Bu günün qazanc fürsəti</span>
            <h3>{topRate ? `${topRate.groupLabel} · ${topRate.label}` : "Yeni fürsətlər tezliklə"}</h3>
            <p>
              10 dost ayda 100 AZN-lik uyğun alış etsə, bu faizlə aylıq təxmini
              <strong> {formatMoney(maxRate * 10)} AZN</strong> referal qazancı yarana bilər.
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
          <ShieldCheck /> Faizlər standart müştəri seqmenti üçündür və zamanla dəyişə bilər.
          100 AZN nümunəsi alış məbləği üzərindən sadə izahdır.
        </p>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.ctaCoinOne} aria-hidden>₼</div>
        <div className={styles.ctaCoinTwo} aria-hidden>%</div>
        <div className={styles.ctaCopy}>
          <span className={styles.sectionKicker}>{referralCode ? "Sənin linkin hazırdır" : "İlk qazancına bir addım"}</span>
          <h2>{referralCode ? "İndi paylaş. Qazanc şəbəkəni böyüt." : "Dostlarını dəvət et. Balansını böyüt."}</h2>
          <p>
            {referralCode
              ? "Kodun səndədir. Onu dostlarına göndər və uyğun alışlardan referal qazancı toplamağa başla."
              : "Pulsuz qeydiyyatdan keç, şəxsi referal kodunu al və bu gün paylaşmağa başla."}
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
