import { prisma } from "@/lib/prisma";
import { readSessionUserIdFromCookies } from "@/lib/auth";
import { getClientIp } from "@/lib/clientInfo";
import { isCrmPlaceholderEmail } from "@/lib/crmAccountEmail";
import { createBoundPhoneAccount, retireUnusedCrmAccounts } from "@/lib/crmAccounts";

/**
 * Nömrə WhatsApp ilə SÜBUT olunduqdan sonra (CRM-in birbaşa giriş linki və ya WhatsApp kodu) sayt hesabı:
 *
 *   - `attachToSession` (profil → "nömrəni təsdiqlə"): daxil olmuş istifadəçinin öz hesabına bağlanır ("session").
 *   - daxil olmuş istifadəçinin sübut olunmuş nömrəsi elə budursa həmin hesab qalır ("session");
 *     BAŞQA nömrədirsə sessiya nömrənin öz hesabına keçir — paylaşılan cihazda başqasının hesabına nömrə
 *     bağlanmasın (CRM giriş məlumatları o hesabda görünərdi);
 *   - nömrəyə BAĞLI (`verifiedPhone`) tək aktiv, admin olmayan hesab → ona daxil edilir ("linked"); CRM telefon
 *     hesabı ilə yanaşı real hesab da bağlıdırsa real hesab seçilir;
 *   - bağlı hesab yoxdursa telefon hesabı yaradılır və daxil edilir ("created", lib/crmAccounts.ts);
 *   - bir neçə real hesab → "ambiguous" (e-poçt + şifrə ilə giriş, sonra profildə nömrə təsdiqi).
 *
 * ⚠️ Hesab `User.phone`-a görə SEÇİLMİR: o, profil səhifəsindən kodsuz dəyişir — kimsə öz hesabına başqasının
 * nömrəsini yazıb onun girişini (və CRM şifrələrini) öz hesabına yönəldə bilərdi. Yalnız `verifiedPhone`
 * (əvvəlki sübut və ya CRM-in həmin nömrə üçün açdığı hesab) sahiblik sayılır.
 *
 * Seçilən hesabda `verifiedPhone` / `phoneVerifiedAt` yenilənir — profildəki CRM abunəlikləri bununla çəkilir.
 */
export type PhoneLoginAccount = "session" | "linked" | "created" | "ambiguous";
/** `newSession`: çağıran tərəf cavaba `setSessionCookie(res, userId)` yazmalıdır. */
export type PhoneLoginResult = { account: PhoneLoginAccount; userId: string | null; newSession: boolean };

type Phone = { e164: string; phone9: string };

/** Nömrəyə bağlı (sübut olunmuş) aktiv, admin olmayan hesablar; real hesab CRM telefon hesabından üstündür. */
async function boundAccounts(e164: string) {
  const candidates = await prisma.user.findMany({
    where: { verifiedPhone: e164, disabled: false, role: { not: "ADMIN" } },
    select: { id: true, email: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  const real = candidates.filter((u) => !isCrmPlaceholderEmail(u.email));
  return real.length > 0 ? real : candidates;
}

export async function loginByPhone(
  req: Request,
  phone: Phone,
  opts: { attachToSession?: boolean; name?: string | null } = {},
): Promise<PhoneLoginResult> {
  const sessionUid = readSessionUserIdFromCookies();
  const current = sessionUid ? await prisma.user.findUnique({ where: { id: sessionUid } }) : null;
  const now = new Date();

  if (current && !current.disabled && (opts.attachToSession || current.verifiedPhone === phone.e164)) {
    await prisma.user.update({
      where: { id: current.id },
      data: { verifiedPhone: phone.e164, phoneVerifiedAt: now, ...(current.phone ? {} : { phone: phone.e164 }) },
    });
    // Real hesab nömrəni özünə bağladı → həmin nömrənin istifadə olunmamış CRM telefon hesabı bağlanır.
    if (!isCrmPlaceholderEmail(current.email)) {
      await retireUnusedCrmAccounts(phone.e164, current.id).catch((e) =>
        console.error("[abunelik:login] CRM telefon hesabı bağlanmadı", e),
      );
    }
    return { account: "session", userId: current.id, newSession: false };
  }

  let account: PhoneLoginAccount = "linked";
  let userId: string | null = null;
  const pool = await boundAccounts(phone.e164);
  if (pool.length === 1) userId = pool[0].id;
  else if (pool.length > 1) return { account: "ambiguous", userId: null, newSession: false };
  else {
    userId = await createBoundPhoneAccount(phone.e164, opts.name ?? null);
    account = "created";
    if (!userId) return { account: "ambiguous", userId: null, newSession: false };
  }

  const ip = getClientIp(req);
  await prisma.user.update({
    where: { id: userId },
    data: {
      verifiedPhone: phone.e164,
      phoneVerifiedAt: now,
      lastLoginAt: now,
      lastLoginIp: ip === "unknown" ? null : ip,
      lastUserAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
      loginCount: { increment: 1 },
    },
  });
  return { account, userId, newSession: true };
}
