import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/auth";
import { normalizeAzPhone } from "@/lib/abunelik/phoneFormat";
import { findUsersByPhone9 } from "@/lib/abunelik/phone";
import { crmPlaceholderEmail, isCrmPlaceholderEmail } from "@/lib/crmAccountEmail";

/**
 * CRM müştərilərinin sayt hesabları ("telefon hesabı", bax lib/crmAccountEmail.ts).
 *
 * Qaydalar:
 *   - Nömrənin son 9 rəqəminə uyğun HƏR HANSI hesab varsa (bloklanmış / admin də) yenisi yaranmır — "exists".
 *   - Yoxdursa: ad CRM-dən, e-poçt çatdırılmayan placeholder, şifrəsiz (`pending:`), `emailVerified: true`
 *     (/abunelik və /rey hesabları ilə eyni semantika — giriş telefonla sübut olunur).
 *   - Heç bir e-poçt / WhatsApp göndərilmir.
 */
export type CrmAccountInput = { ref?: string | null; phone: string; name?: string | null };
export type CrmAccountResult = {
  ref: string | null;
  status: "created" | "exists" | "invalid";
  userId?: string;
};

const P9_SQL_LIMIT = 500;

function cleanName(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return v.length >= 2 ? v : null;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "P2002";
}

async function createPhoneAccount(e164: string, name: string | null): Promise<CrmAccountResult & { ref: null }> {
  const email = crmPlaceholderEmail(e164);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const user = await prisma.user.create({
        data: {
          email,
          name,
          phone: e164,
          // Hesab bu nömrə üçün açılır → nömrəyə bağlıdır (telefonla girişdə seçilir). `phoneVerifiedAt` boş qalır:
          // CRM datası yalnız sahibi linklə / kodla daxil olanda (sübutdan sonra) görünür.
          verifiedPhone: e164,
          passwordHash: `pending:${crypto.randomBytes(16).toString("hex")}`,
          emailVerified: true,
          referralCode: generateReferralCode(),
        },
        select: { id: true },
      });
      return { ref: null, status: "created", userId: user.id };
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Eyni nömrə paralel yaradılıb (e-poçt deterministikdir) → mövcud hesab; yoxsa referal kodu toqquşub → yenidən.
      const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (byEmail) return { ref: null, status: "exists", userId: byEmail.id };
    }
  }
  throw new Error("Referal kodu üçün unikal dəyər tapılmadı");
}

/** Toplu: CRM sinxronizasiyası (POST /api/partner/crm-accounts) və birbaşa giriş linki üçün. */
export async function ensureCrmAccounts(items: CrmAccountInput[]): Promise<CrmAccountResult[]> {
  const parsed = items.map((it) => ({ it, phone: normalizeAzPhone(it.phone) }));
  const keys = Array.from(new Set(parsed.flatMap((p) => (p.phone ? [p.phone.phone9] : [])))).slice(0, P9_SQL_LIMIT);

  // Bir sorğu ilə bütün partiya (User.phone sərbəst formatdadır — SQL-də rəqəmlərə endirilir).
  const existing =
    keys.length > 0
      ? await prisma.$queryRaw<{ id: string; p9: string }[]>`
          SELECT id, right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) AS p9
          FROM "User"
          WHERE phone IS NOT NULL
            AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ANY(${keys}::text[])
          ORDER BY "createdAt" ASC
        `
      : [];
  const byP9 = new Map<string, string>();
  for (const row of existing) if (!byP9.has(row.p9)) byP9.set(row.p9, row.id);

  const results: CrmAccountResult[] = [];
  for (const { it, phone } of parsed) {
    const ref = it.ref ?? null;
    if (!phone || !keys.includes(phone.phone9)) {
      results.push({ ref, status: "invalid" });
      continue;
    }
    const known = byP9.get(phone.phone9);
    if (known) {
      results.push({ ref, status: "exists", userId: known });
      continue;
    }
    const r = await createPhoneAccount(phone.e164, cleanName(it.name));
    if (r.userId) byP9.set(phone.phone9, r.userId);
    results.push({ ...r, ref });
  }
  return results;
}

/**
 * Telefonla giriş üçün: nömrəyə BAĞLI hesab yoxdursa (lib/abunelik/login.ts) telefon hesabı açılır — `User.phone`-u
 * eyni olan köhnə hesab olsa belə (o sahə kodsuz dəyişir, sahiblik sübutu deyil). Bu nömrənin placeholder hesabı
 * artıq varsa və başqa nömrəyə bağlanmayıbsa o istifadə olunur. Alınmasa null.
 */
export async function createBoundPhoneAccount(e164: string, name: string | null): Promise<string | null> {
  const r = await createPhoneAccount(e164, cleanName(name));
  if (r.status === "created") return r.userId ?? null;
  const existing = await prisma.user.findUnique({
    where: { email: crmPlaceholderEmail(e164) },
    select: { id: true, disabled: true, verifiedPhone: true },
  });
  if (!existing || existing.disabled) return null;
  if (existing.verifiedPhone && existing.verifiedPhone !== e164) return null;
  if (!existing.verifiedPhone) {
    await prisma.user.update({ where: { id: existing.id }, data: { verifiedPhone: e164 } });
  }
  return existing.id;
}

/**
 * Real hesab nömrəni WhatsApp kodu ilə özünə bağladı (profil → nömrə təsdiqi, lib/abunelik/login.ts) → həmin
 * nömrənin İSTİFADƏ OLUNMAMIŞ CRM telefon hesabı (əməliyyatı və balansı yoxdur) bloklanır, nömrəsi və bağı
 * silinir ki, telefonla giriş / şifrə bərpası iki hesab arasında qalmasın. Silinmir — admin izi qalsın.
 * İstifadə olunmuş telefon hesabı toxunulmaz qalır (telefonla girişdə real hesab üstün tutulur).
 * ⚠️ Yalnız nömrə SÜBUT olunandan sonra çağır (qeydiyyat/şifrə kodu sübut deyil — e-poçta da gedə bilər).
 */
export async function retireUnusedCrmAccounts(rawPhone: string | null, keepUserId: string): Promise<number> {
  const phone = normalizeAzPhone(rawPhone);
  if (!phone) return 0;
  const byPhone = await findUsersByPhone9(phone.phone9, 10);
  const byBinding = await prisma.user.findMany({
    where: { verifiedPhone: phone.e164 },
    select: { id: true, email: true, disabled: true },
    take: 10,
  });
  const seen = new Set<string>();
  const matches = [...byPhone, ...byBinding].filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return u.id !== keepUserId && isCrmPlaceholderEmail(u.email) && !u.disabled;
  });
  let retired = 0;
  for (const u of matches) {
    const full = await prisma.user.findUnique({
      where: { id: u.id },
      select: {
        walletBalance: true,
        cashbackBalanceCents: true,
        referralBalanceCents: true,
        _count: { select: { transactions: true } },
      },
    });
    if (!full) continue;
    const unused =
      full.walletBalance === 0 &&
      full.cashbackBalanceCents === 0 &&
      full.referralBalanceCents === 0 &&
      full._count.transactions === 0;
    if (!unused) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: {
        phone: null,
        verifiedPhone: null,
        disabled: true,
        disabledAt: new Date(),
        disabledReason: `CRM telefon hesabı — nömrə müştərinin öz hesabına bağlandı (${keepUserId})`,
      },
    });
    retired++;
  }
  return retired;
}
