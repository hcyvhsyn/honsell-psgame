"use client";

import dynamic from "next/dynamic";

/**
 * AskAiFloat (üzən AI köməkçi, ~700 sətir + chat məntiqi) ilkin paint/LCP üçün
 * lazım deyil. `ssr: false` ilə dinamik import → onun JS-i ilkin bundle-dan
 * çıxır və yalnız hidrasiyadan sonra (client-də) yüklənir. Üzən düymə bir az
 * gec görünür — chat widget üçün tam qəbuledilən, mobil ilkin JS-i azaldır.
 *
 * Qeyd: `ssr: false` Server Component-də işləmir, ona görə bu kiçik client
 * wrapper lazımdır (layout Server Component olaraq qalır).
 */
const AskAiFloat = dynamic(() => import("./AskAiFloat"), { ssr: false });

export default function AskAiFloatLazy() {
  return <AskAiFloat />;
}
