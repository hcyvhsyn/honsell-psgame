import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Hədiyyə kart kodunun aktivləşdirilməsi Balans səhifəsinə köçüb (2026-11) — kod cüzdana köçür,
 * ayrıca menyu bəndinə ehtiyac yox idi. Ünvan admin çatdırılma e-poçtları üçün saxlanılır.
 */
export default function LegacyGiftCardRedeemRedirect() {
  redirect("/profile/wallet#hediyye-kart");
}
