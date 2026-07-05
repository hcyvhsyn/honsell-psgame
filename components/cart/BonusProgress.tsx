"use client";

import { Gift } from "lucide-react";
import BonusMilestoneItem, { type BonusMilestone } from "./BonusMilestoneItem";
import {
  BONUS_WALLET_MIN_CENTS,
  BONUS_WALLET_CREDIT_CENTS,
  BONUS_COUPON_MIN_CENTS,
  BONUS_COUPON_PERCENT,
  BONUS_COMMUNITY_MIN_ITEMS,
} from "@/lib/bonusThresholds";

const WALLET_MIN = BONUS_WALLET_MIN_CENTS / 100;
const WALLET_REWARD = BONUS_WALLET_CREDIT_CENTS / 100;
const COUPON_MIN = BONUS_COUPON_MIN_CENTS / 100;

/**
 * Səbət məbləği + məhsul sayına görə bonus mərhələlərini hesablayır. checkout-dakı
 * eyni hədlərdən (lib/checkoutBonuses) istifadə edir — göstərilən bonus faktiki
 * verilənlə üst-üstə düşür.
 */
export function buildBonusMilestones(totalAzn: number, itemCount: number): BonusMilestone[] {
  const walletDone = totalAzn >= WALLET_MIN;
  const couponDone = totalAzn >= COUPON_MIN;
  const communityDone = itemCount >= BONUS_COMMUNITY_MIN_ITEMS;

  // İlk tamamlanmamış AZN mərhələsi = "active", sonrakı = "locked".
  const walletStatus = walletDone ? "done" : "active";
  const couponStatus = couponDone ? "done" : walletDone ? "active" : "locked";

  const remWallet = Math.max(0, WALLET_MIN - totalAzn);
  const remCoupon = Math.max(0, COUPON_MIN - totalAzn);
  const remItems = Math.max(0, BONUS_COMMUNITY_MIN_ITEMS - itemCount);

  return [
    {
      id: "wallet",
      title: "Bonus balans",
      reward: `${WALLET_REWARD.toFixed(0)} AZN`,
      status: walletStatus,
      progress: Math.min(1, totalAzn / WALLET_MIN),
      message: walletDone
        ? `${WALLET_REWARD.toFixed(0)} AZN bonus qazandınız 🎉`
        : `Daha ${remWallet.toFixed(2)} AZN əlavə et, ${WALLET_REWARD.toFixed(0)} AZN bonus qazan.`,
    },
    {
      id: "coupon",
      title: "Növbəti alış kuponu",
      reward: `${BONUS_COUPON_PERCENT}%`,
      status: couponStatus,
      progress: Math.min(1, totalAzn / COUPON_MIN),
      message: couponDone
        ? `Növbəti alışa ${BONUS_COUPON_PERCENT}% kupon qazandınız 🎉`
        : `Daha ${remCoupon.toFixed(2)} AZN əlavə et, növbəti alışa ${BONUS_COUPON_PERCENT}% kupon qazan.`,
    },
    {
      id: "community",
      title: "Community kampaniyası",
      reward: "Giriş",
      status: communityDone ? "done" : "active",
      progress: Math.min(1, itemCount / BONUS_COMMUNITY_MIN_ITEMS),
      message: communityDone
        ? "Community kampaniyasına giriş qazandınız 🎉"
        : `Daha ${remItems} məhsul əlavə et, community kampaniyasına giriş qazan.`,
    },
  ];
}

/** CartSummary üçün ən yaxın təşviq mesajı (növbəti tamamlanmamış AZN mərhələsi). */
export function nextBonusHint(totalAzn: number, itemCount: number): string | null {
  const ms = buildBonusMilestones(totalAzn, itemCount);
  const active = ms.find((m) => m.id !== "community" && m.status !== "done");
  if (active) return active.message;
  const community = ms.find((m) => m.id === "community" && m.status !== "done");
  return community ? community.message : null;
}

export default function BonusProgress({
  totalAzn,
  itemCount,
}: {
  totalAzn: number;
  itemCount: number;
}) {
  const milestones = buildBonusMilestones(totalAzn, itemCount);

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gift className="h-4 w-4 text-fuchsia-400" />
        <h3 className="text-sm font-semibold tracking-tight text-zinc-200">Bonuslar</h3>
      </div>
      <div className="space-y-2">
        {milestones.map((m) => (
          <BonusMilestoneItem key={m.id} m={m} />
        ))}
      </div>
    </div>
  );
}
