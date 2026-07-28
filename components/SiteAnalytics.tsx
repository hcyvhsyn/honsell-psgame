import Script from "next/script";

/**
 * Sayt analitikası — self-host deploy üçün.
 *
 * NƏ ÜÇÜN VERCEL DEYİL:
 * Əvvəl burada `@vercel/analytics` və `@vercel/speed-insights` vardı. Onlar
 * `/_vercel/insights/*` ünvanına beacon göndərir və həmin endpoint-i YALNIZ
 * Vercel-in edge infrastrukturu cavablandırır. Bu layihə isə öz serverində
 * `next start` ilə işləyir (bax: docs/), ona görə hər səhifə yüklənməsində
 * göndərilən beacon 404 alırdı — yəni bir dənə də olsun ziyarət qeyd
 * olunmurdu, üstəlik hər istifadəçiyə əlavə JS yüklənirdi.
 *
 * İNDİKİ MODEL:
 * Provayderdən asılı olmayan, env ilə idarə olunan skript. Umami və Plausible
 * (hər ikisi self-host, cookie-siz, GDPR-uyğun) dəstəklənir. Env dəyişəni
 * qurulmayıbsa HEÇ NƏ render olunmur — yəni lokal development və preview
 * mühitləri statistikanı çirkləndirmir.
 *
 * ENV:
 *   NEXT_PUBLIC_ANALYTICS_PROVIDER  "umami" | "plausible" | boş (söndürülüb)
 *   NEXT_PUBLIC_ANALYTICS_SRC       skriptin tam URL-i
 *   NEXT_PUBLIC_ANALYTICS_SITE_ID   umami: website id | plausible: domen
 */
export default function SiteAnalytics() {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER?.trim();
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC?.trim();
  const siteId = process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID?.trim();

  if (!provider || !src || !siteId) return null;

  if (provider === "umami") {
    return (
      <Script
        src={src}
        data-website-id={siteId}
        // `afterInteractive` kifayətdir: analitika LCP-dən sonra yüklənməlidir,
        // əks halda ölçmək istədiyi metrikanı özü pisləşdirir.
        strategy="afterInteractive"
      />
    );
  }

  if (provider === "plausible") {
    return <Script src={src} data-domain={siteId} strategy="afterInteractive" />;
  }

  return null;
}
