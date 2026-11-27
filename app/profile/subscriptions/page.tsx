import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * "Aktiv abunəliklər" və "Netflix / Spotify abunəliklərim" bir səhifədə birləşdi (2026-11):
 * /profile/abunelikler. Bu ünvan köhnə e-poçt linkləri (lib/resend.ts) üçün saxlanılır.
 */
export default function LegacySubscriptionsRedirect() {
  redirect("/profile/abunelikler");
}
