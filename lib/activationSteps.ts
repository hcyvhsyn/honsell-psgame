/**
 * Aktivləşdirmə addımlarının SERVER data qatı.
 *
 * ⚠️ Bu fayl `lib/prisma`-ya toxunur — "use client" komponentdən İMPORT ETMƏ
 * (bundle-a prisma düşür və `next build` sınır, tsc keçsə də). Client-safe
 * tiplər `components/ActivationMethodTabs.tsx` içindədir, scope sabitləri isə
 * `lib/contentScopes.ts`-dədir.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ActivationStepItem = {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
};

/** Bir üsul (tab) və onun daxili addımları. */
export type ActivationMethodGroup = {
  /** Üsul adı; `method` boş olan addımlar üçün boş sətir. */
  method: string;
  steps: ActivationStepItem[];
};

export const ACTIVATION_STEPS_TAG = "activation-steps";

async function loadGroups(scope: string): Promise<ActivationMethodGroup[]> {
  // Səhv udulur QƏSDƏN: deploy skripti migrasiya işlətmir, ona görə kod serverə
  // cədvəldən ƏVVƏL çata bilər. Belə halda bölmə sadəcə göstərilmir — bütün
  // hədiyyə kartı səhifəsi 500 verməsin (build-time prerender də sınmasın).
  let rows: Array<ActivationStepItem & { method: string | null }>;
  try {
    rows = await prisma.activationStep.findMany({
      where: { scope, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, body: true, imageUrl: true, method: true },
    });
  } catch {
    return [];
  }

  // Qruplaşdırma sırası = üsulun İLK addımının sortOrder-i. Beləcə tab-ların
  // sırası admin paneldəki sıra ilə üst-üstə düşür, əlifba sırası ilə deyil.
  const groups: ActivationMethodGroup[] = [];
  const index = new Map<string, ActivationMethodGroup>();
  for (const r of rows) {
    const key = (r.method ?? "").trim();
    let g = index.get(key);
    if (!g) {
      g = { method: key, steps: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.steps.push({ id: r.id, title: r.title, body: r.body, imageUrl: r.imageUrl });
  }
  return groups;
}

/**
 * Keşlənmiş oxuma. Səhifələr statik/ISR qalmalıdır, ona görə `cookies()` və ya
 * user konteksti ilə ÇAĞIRILMIR. Admin CRUD `ACTIVATION_STEPS_TAG`-ı sıfırlayır.
 */
export function getActivationMethodsCached(scope: string) {
  return unstable_cache(
    () => loadGroups(scope),
    ["activation-steps", scope],
    { tags: [ACTIVATION_STEPS_TAG], revalidate: 1800 },
  )();
}
