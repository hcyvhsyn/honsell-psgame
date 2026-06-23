import { prisma } from "@/lib/prisma";

/**
 * Dəvət bonusu fırıldaq (spam) qiymətləndirməsi.
 *
 * Məqsəd: eyni adla və ya təsadüfi/cəfəng adlarla kütləvi qeydiyyatdan keçən
 * saxta dəvətləri aşkarlamaq. Heuristik bal toplayır; bal eşiyi keçərsə bonus
 * dərhal ödənmir — `status = HELD` saxlanır və admin paneldə yoxlanır.
 *
 * Heç bir signal qeydiyyatı bloklamır — yalnız bonusu gözlədir.
 */

export type InviteFraudResult = {
  suspicious: boolean;
  score: number;
  reasons: string[];
};

// Bal bu eşiyə çatarsa dəvət şübhəli sayılır. Tək zəif signal (məs. soyadsız ad)
// kifayət etmir; güclü signal (təkrar ad / eyni IP / cəfəng ad) tək başına tutur.
const SUSPICION_THRESHOLD = 3;

// Dəvət edənin son 1 saatda təsdiqlənmiş dəvət sayı bu həddi keçərsə — sürət şübhəsi.
const VELOCITY_WINDOW_MS = 60 * 60 * 1000;
const VELOCITY_MAX_PER_HOUR = 5;

// Azərbaycan + Latın saitləri.
const VOWELS = new Set("aeiouəıöüAEIOUƏIÖÜ".split(""));

// Klaviatura sıraları — cəfəng ad markerləri.
const KEYBOARD_RUNS = [
  "qwert", "werty", "ertyu", "asdf", "sdfg", "dfgh", "zxcv", "xcvb",
  "qaz", "wsx", "edc", "1234", "2345", "12345", "qwe", "asd", "zxc",
];

/** Adı müqayisə üçün normallaşdırır: kiçik hərf, diakritika sadələşdirilir, boşluqlar yığılır. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // diakritik işarələr
    .replace(/ə/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[öø]/g, "o")
    .replace(/[üğ]/g, (m) => (m === "ü" ? "u" : "g"))
    .replace(/[şs]/g, "s")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Tək sözün (token) cəfəng/təsadüfi görünüb-görünmədiyini yoxlayır. */
function looksLikeGibberish(token: string): boolean {
  const t = token.replace(/[^a-zəıöüçşğ]/gi, "");
  if (t.length < 4) return false; // qısa sözlər üçün etibarlı qərar vermək olmur

  // Eyni hərfin 4+ təkrarı: "aaaa", "llll".
  if (/(.)\1{3,}/i.test(t)) return true;

  // Klaviatura sırası.
  const low = t.toLowerCase();
  if (KEYBOARD_RUNS.some((run) => low.includes(run))) return true;

  // Sait nisbəti çox aşağıdır (samit yığını).
  let vowels = 0;
  let maxConsonantRun = 0;
  let run = 0;
  for (const ch of t) {
    if (VOWELS.has(ch)) {
      vowels++;
      run = 0;
    } else {
      run++;
      if (run > maxConsonantRun) maxConsonantRun = run;
    }
  }
  const vowelRatio = vowels / t.length;
  if (vowelRatio < 0.2) return true; // demək olar saitsiz
  if (maxConsonantRun >= 5) return true; // "bcdfg" kimi uzun samit zənciri

  return false;
}

/**
 * Dəvət olunan istifadəçi üçün fırıldaq balını hesablayır.
 *
 * @param refereeName     dəvət olunanın adı (qeydiyyatdakı)
 * @param refereeId       dəvət olunanın id-si
 * @param referrerId      dəvət edənin id-si
 * @param referrerLastIp  dəvət edənin son login IP-si (özünə-dəvət yoxlanışı)
 * @param requestIp       dəvət olunanın təsdiq sorğusunun IP-si
 */
export async function assessInviteFraud(args: {
  refereeName: string | null | undefined;
  refereeId: string;
  referrerId: string;
  referrerLastIp: string | null | undefined;
  requestIp: string | null | undefined;
}): Promise<InviteFraudResult> {
  const reasons: string[] = [];
  let score = 0;

  const normalized = normalizeName(args.refereeName);
  const tokens = normalized ? normalized.split(" ") : [];

  // 1) Boş və ya çox qısa ad.
  if (normalized.replace(/\s/g, "").length < 3) {
    score += 2;
    reasons.push("Ad çox qısa və ya boşdur");
  }

  // 2) Adda rəqəm var.
  if (/\d/.test(args.refereeName ?? "")) {
    score += 1;
    reasons.push("Adda rəqəm var");
  }

  // 3) Soyadsız (tək söz) ad — zəif signal.
  if (tokens.length === 1 && normalized.length >= 3) {
    score += 1;
    reasons.push("Yalnız bir söz (soyad yoxdur)");
  }

  // 4) Cəfəng / təsadüfi ad — güclü signal.
  if (tokens.some((tok) => looksLikeGibberish(tok))) {
    score += 2;
    reasons.push("Ad təsadüfi/cəfəng görünür");
  }

  // 5) Eyni dəvət edənin başqa dəvətlisi ilə eyni ad — güclü signal.
  if (normalized) {
    const siblings = await prisma.user.findMany({
      where: { referredById: args.referrerId, id: { not: args.refereeId } },
      select: { name: true },
      take: 500,
    });
    const dup = siblings.some((s) => normalizeName(s.name) === normalized);
    if (dup) {
      score += 3;
      reasons.push("Eyni dəvət edənin başqa dəvətlisi ilə eyni ad");
    }
  }

  // 6) Dəvət olunanın təsdiq IP-si dəvət edənin son login IP-si ilə eynidir
  //    (özünə-dəvət əlaməti) — güclü signal.
  const ip = (args.requestIp ?? "").trim();
  const refIp = (args.referrerLastIp ?? "").trim();
  if (ip && refIp && ip !== "unknown" && ip === refIp) {
    score += 3;
    reasons.push("Dəvət edən ilə eyni IP-dən təsdiq");
  }

  // 7) Sürət: dəvət edən son 1 saatda çox dəvət təsdiqlədib.
  const since = new Date(Date.now() - VELOCITY_WINDOW_MS);
  const recent = await prisma.referralInviteBonus.count({
    where: { referrerId: args.referrerId, createdAt: { gte: since } },
  });
  if (recent >= VELOCITY_MAX_PER_HOUR) {
    score += 2;
    reasons.push(`Son 1 saatda ${recent} dəvət (sürət şübhəsi)`);
  }

  return { suspicious: score >= SUSPICION_THRESHOLD, score, reasons };
}
