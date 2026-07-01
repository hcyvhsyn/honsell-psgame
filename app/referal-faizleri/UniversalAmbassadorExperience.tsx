"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Copy,
  Film,
  Gamepad2,
  Music2,
  Send,
  Sparkles,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { buildReferralRegisterUrl } from "@/lib/referralPromotion";
import type { PublicRateGroup, PublicRateItem } from "@/lib/publicReferralRates";
import styles from "./universal-ambassador.module.css";

type Props = {
  groups: PublicRateGroup[];
  referralCode: string | null;
};

type FlatRate = PublicRateItem & {
  key: string;
  groupLabel: string;
};

const UNIVERSAL_STEPS = [
  { number: "01", Icon: Users, title: "Auditoriyanı seç", text: "Uyğun məhsulu tap." },
  { number: "02", Icon: Send, title: "Linki paylaş", text: "Kontentinə əlavə et." },
  { number: "03", Icon: WalletCards, title: "Qazancı topla", text: "Komissiyan balansda gör." },
] as const;

function formatNumber(value: number) {
  const rounded = Math.round(Math.max(0, value) * 10) / 10;
  return (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)).replace(".", ",");
}

function groupIcon(groupKey: string) {
  const key = groupKey.toUpperCase();
  if (key.includes("PS") || key.includes("GAME")) return Gamepad2;
  if (key.includes("STREAM") || key.includes("FILM")) return Film;
  if (key.includes("MUSIC")) return Music2;
  if (key.includes("WORK") || key.includes("AI")) return BriefcaseBusiness;
  return WalletCards;
}

export default function UniversalAmbassadorExperience({ groups, referralCode }: Props) {
  const activeGroups = groups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.pct > 0) }))
    .filter((group) => group.items.length > 0);
  const visibleGroups = activeGroups.length > 0 ? activeGroups : groups;
  const rates: FlatRate[] = visibleGroups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      key: `${group.key}:${item.id}`,
      groupLabel: group.label,
    })),
  );
  const firstRate = rates.find((rate) => rate.pct > 0) ?? rates[0];
  const [selectedKey, setSelectedKey] = useState(firstRate?.key ?? "");
  const [friends, setFriends] = useState(12);
  const [spend, setSpend] = useState(60);
  const [copied, setCopied] = useState(false);

  const selected = rates.find((rate) => rate.key === selectedKey) ?? firstRate;
  const maxRate = Math.max(0, ...rates.map((rate) => rate.pct));
  const activeRateCount = rates.filter((rate) => rate.pct > 0).length;
  const monthly = friends * spend * ((selected?.pct ?? 0) / 100);
  const inviteUrl = referralCode ? buildReferralRegisterUrl(referralCode) : "";
  const whatsAppUrl = referralCode
    ? `https://wa.me/?text=${encodeURIComponent(`Honsell dəvət linkimlə qeydiyyatdan keç:\n${inviteUrl}`)}`
    : "#";

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPattern} aria-hidden />
        <span className={styles.orangeOrb} aria-hidden />
        <span className={styles.tealOrb} aria-hidden />

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <Link href="/referal-faizleri" className={styles.backLink}>
              <Sparkles /> Universal Ambassador
            </Link>
            <h1>
              Bir link. Hər auditoriya.
              <span>Qazancın bir yerdə.</span>
            </h1>
            <p>Oyun, film, musiqi və iş məhsullarını paylaş. Uyğun alışdan komissiya qazan.</p>

            <div className={styles.heroActions}>
              <a href="#faizler" className={styles.primaryButton}>
                Faizlərə bax <ArrowRight />
              </a>
              <Link
                href={referralCode ? "/profile/referrals" : "/register"}
                className={styles.secondaryButton}
              >
                {referralCode ? "Referal panelim" : "İndi qoşul"}
              </Link>
            </div>

            <div className={styles.heroStats} aria-label="Referal göstəriciləri">
              <div><strong>{formatNumber(maxRate)}%-dək</strong><span>komissiya</span></div>
              <div><strong>{activeRateCount}</strong><span>aktiv təklif</span></div>
              <div><strong>1 link</strong><span>bütün sahələr</span></div>
            </div>
          </div>

          <aside className={styles.calculator} aria-labelledby="calculator-title">
            <div className={styles.calculatorHead}>
              <span><Zap /> Canlı hesablayıcı</span>
              <i>LIVE</i>
            </div>
            <div className={styles.result}>
              <small>Təxmini aylıq qazanc</small>
              <strong>{formatNumber(monthly)} <span>AZN</span></strong>
            </div>

            <label className={styles.field}>
              <span>Məhsul</span>
              <select value={selected?.key ?? ""} onChange={(event) => setSelectedKey(event.target.value)}>
                {rates.map((rate) => (
                  <option key={rate.key} value={rate.key}>
                    {rate.groupLabel} · {rate.label} · {formatNumber(rate.pct)}%
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.rangeField}>
              <span>Dəvət sayı <output>{friends}</output></span>
              <input
                type="range"
                min="1"
                max="50"
                value={friends}
                onChange={(event) => setFriends(Number(event.target.value))}
              />
            </label>

            <label className={styles.rangeField}>
              <span>Orta alış <output>{spend} AZN</output></span>
              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={spend}
                onChange={(event) => setSpend(Number(event.target.value))}
              />
            </label>

            <p className={styles.formula}>
              {friends} nəfər × {spend} AZN × {formatNumber(selected?.pct ?? 0)}%
            </p>
          </aside>
        </div>
      </section>

      <div className={styles.categoryRail} aria-label="Universal kateqoriyalar">
        <span><Gamepad2 /> Oyun</span>
        <span><Film /> Film və serial</span>
        <span><Music2 /> Musiqi</span>
        <span><BriefcaseBusiness /> İş və AI</span>
      </div>

      <section className={styles.ratesSection} id="faizler">
        <header className={styles.sectionHead}>
          <div>
            <span>Canlı sistem məlumatı</span>
            <h2>Referal faizləri</h2>
          </div>
          <p>100 AZN alışdan qazancı dərhal gör.</p>
        </header>

        <div className={styles.rateGrid}>
          {visibleGroups.map((group, groupIndex) => {
            const Icon = groupIcon(group.key);
            const groupMax = Math.max(0, ...group.items.map((item) => item.pct));
            return (
              <article
                className={styles.rateCard}
                style={{ "--card-index": groupIndex } as React.CSSProperties}
                key={group.key}
              >
                <div className={styles.rateCardHead}>
                  <span className={styles.groupIcon}><Icon /></span>
                  <div><h3>{group.label}</h3><small>{group.items.length} seçim</small></div>
                  <strong>{formatNumber(groupMax)}%</strong>
                </div>
                <div className={styles.rateRows}>
                  {group.items.map((item) => (
                    <div className={styles.rateRow} key={item.id}>
                      <span>{item.label}</span>
                      <small>100 AZN-dən +{formatNumber(item.pct)} AZN</small>
                      <b className={item.pct <= 0 ? styles.zeroRate : ""}>{formatNumber(item.pct)}%</b>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.sectionHead}>
          <div><span>Üç addım</span><h2>Seç. Paylaş. Qazan.</h2></div>
        </div>
        <div className={styles.steps}>
          {UNIVERSAL_STEPS.map(({ number, Icon, title, text }) => (
            <article key={number}>
              <span>{number}</span><Icon /><h3>{title}</h3><p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span className={styles.ctaKicker}>{referralCode ? "Linkin hazırdır" : "Başlamağa hazırsan?"}</span>
          <h2>{referralCode ? "Bir kliklə paylaş." : "Universal Ambassador ol."}</h2>
        </div>

        {referralCode ? (
          <div className={styles.shareBox}>
            <code>{referralCode}</code>
            <button type="button" onClick={copyInvite}>
              {copied ? <Check /> : <Copy />} {copied ? "Kopyalandı" : "Linki kopyala"}
            </button>
            <a href={whatsAppUrl} target="_blank" rel="noreferrer">
              <Send /> WhatsApp
            </a>
          </div>
        ) : (
          <Link href="/register" className={styles.ctaButton}>
            Pulsuz qeydiyyat <ArrowRight />
          </Link>
        )}
      </section>
    </div>
  );
}
