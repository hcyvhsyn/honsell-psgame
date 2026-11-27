import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAbunelikEnabled, isPhoneVerificationFresh } from "@/lib/abunelik/session";
import { formatAzPhone, normalizeAzPhone } from "@/lib/abunelik/phoneFormat";
import AbunelikClient from "@/components/abunelik/AbunelikClient";
import { PastSubscriptions, PsPlusPromo, SiteActiveSubscriptions, loadSiteSubscriptions } from "./SiteSubscriptions";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abunəliklərim",
  robots: { index: false, follow: false },
};

/**
 * Profil → Abunəliklərim (2026-11: "Aktiv abunəliklər" ilə birləşdi). Yuxarıda saytdan alınanlar
 * (`SiteSubscriptions` — PS Plus/EA Play avtomatik yeniləmə ilə), aşağıda WhatsApp ilə alınanlar:
 * CRM-dəki bütün abunəliklər (Netflix kabineti, Spotify/YouTube Family, Netflix/Spotify
 * Individual, PS Plus; aktiv + son 45 gün bitmiş), giriş məlumatları və CRM qiyməti ilə kartla yeniləmə.
 * Müştəri bunları YALNIZ burada, saytda daxil olanda görür. Data istifadəçinin WhatsApp ilə sübut olunmuş
 * nömrəsi (`User.verifiedPhone`) ilə CRM-dən çəkilir — sübut yoxdursa / köhnədirsə səhifə kodla təsdiq istəyir.
 */
export default async function ProfileAbunelikPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile/abunelikler");

  const crmEnabled = isAbunelikEnabled();
  const verified = !!user.verifiedPhone && isPhoneVerificationFresh(user.phoneVerifiedAt);
  const suggested = normalizeAzPhone(user.verifiedPhone ?? user.phone)?.e164;
  const site = await loadSiteSubscriptions(user);
  // Sıra (2026-11 redizayn): aktivlər → WhatsApp ilə alınanlar → bitmişlər → PS Plus təklifi.
  // Əvvəl boş "PS Plus" bloku ən yuxarıda idi və əsas (CRM) abunəlikləri aşağı itələyirdi.
  return (
    <div className="space-y-5">
      <ProfilePageHeader title="Abunəliklərim" />

      <SiteActiveSubscriptions data={site} />

      {crmEnabled && (
        <section id="whatsapp" className="scroll-mt-28">
          <AbunelikClient
            mode="profile"
            initialVerified={verified}
            defaultPhone={suggested ? formatAzPhone(suggested) : ""}
          />
        </section>
      )}

      <PastSubscriptions rows={site.past} />
      {!site.hasActivePsPlus && <PsPlusPromo />}
    </div>
  );
}
