import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAbunelikEnabled, isPhoneVerificationFresh } from "@/lib/abunelik/session";
import { formatAzPhone, normalizeAzPhone } from "@/lib/abunelik/phoneFormat";
import AbunelikClient from "@/components/abunelik/AbunelikClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abunəliklərim — Netflix, Spotify, PS Plus | Honsell",
  robots: { index: false, follow: false },
};

/**
 * Profil → Abunəliklərim: CRM-dəki bütün abunəliklər (Netflix kabineti, Spotify/YouTube Family, Netflix/Spotify
 * Individual, PS Plus; aktiv + son 45 gün bitmiş), giriş məlumatları və CRM qiyməti ilə kartla yeniləmə.
 * Müştəri bunları YALNIZ burada, saytda daxil olanda görür. Data istifadəçinin WhatsApp ilə sübut olunmuş
 * nömrəsi (`User.verifiedPhone`) ilə CRM-dən çəkilir — sübut yoxdursa / köhnədirsə səhifə kodla təsdiq istəyir.
 */
export default async function ProfileAbunelikPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile/abunelikler");

  if (!isAbunelikEnabled()) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-white/5 dark:bg-[#111116]">
        <h1 className="text-xl font-bold">Abunəliklərim</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Tezliklə burada abunəliklərinizi görüb onlayn yeniləyə biləcəksiniz.
        </p>
      </div>
    );
  }

  const verified = !!user.verifiedPhone && isPhoneVerificationFresh(user.phoneVerifiedAt);
  const suggested = normalizeAzPhone(user.verifiedPhone ?? user.phone)?.e164;
  return (
    <AbunelikClient
      mode="profile"
      initialVerified={verified}
      defaultPhone={suggested ? formatAzPhone(suggested) : ""}
    />
  );
}
