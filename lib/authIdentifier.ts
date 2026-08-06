/**
 * Şifrə bərpası üçün istifadəçi tapma: e-poçt VƏ YA WhatsApp nömrəsi ilə.
 *
 * Niyə ayrı fayl: `/api/auth/forgot-password` (kod göndərir) və
 * `/api/auth/reset-password` (kodu yoxlayır) EYNİ məntiqlə eyni hesabı
 * tapmalıdır — ayrı-ayrı yazılsa biri nömrəni tapıb digəri tapmaya bilər.
 */

import { prisma } from "@/lib/prisma";
import { normalizeToE164 } from "@/lib/wasender";

export type ResetChannel = "email" | "whatsapp";

export type ResolvedIdentifier =
  | { ok: true; channel: "email"; email: string }
  | { ok: true; channel: "whatsapp"; phoneE164: string }
  | { ok: false; error: string };

/** Sorğu gövdəsindən kanal + identifikatoru çıxarır və normallaşdırır. */
export function readIdentifier(body: {
  email?: unknown;
  phone?: unknown;
  channel?: unknown;
}): ResolvedIdentifier {
  const channel: ResetChannel = body.channel === "whatsapp" ? "whatsapp" : "email";

  if (channel === "whatsapp") {
    const phoneE164 = normalizeToE164(
      typeof body.phone === "string" ? body.phone : null,
    );
    if (!phoneE164) {
      return { ok: false, error: "Düzgün WhatsApp nömrəsi yaz (məs. +994501234567)" };
    }
    return { ok: true, channel: "whatsapp", phoneE164 };
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "E-poçt tələb olunur" };
  return { ok: true, channel: "email", email };
}

/** Rate-limit açarı üçün sabit sətir (e-poçt və ya E.164 nömrə). */
export function identifierKey(id: Extract<ResolvedIdentifier, { ok: true }>): string {
  return id.channel === "email" ? id.email : id.phoneE164;
}

export type FoundUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

export type UserLookup =
  | { status: "found"; user: FoundUser }
  /** Hesab yoxdur — çağıran tərəf enumeration-a qarşı EYNİ cavabı qaytarmalıdır. */
  | { status: "none" }
  /** Bir nömrəyə bağlı birdən çox hesab — hansını sıfırlayacağımız məlum deyil. */
  | { status: "ambiguous" };

const SELECT = { id: true, email: true, name: true, phone: true } as const;

/**
 * İstifadəçini tapır.
 *
 * ⚠️ `User.phone` sxemdə `@unique` DEYİL və normallaşdırılmış formada saxlanmır.
 * Qeydiyyat E.164 (`+994...`) yazır, lakin köhnə/idxal olunmuş sətirlərdə başqa
 * formatlar ola bilər — ona görə bir neçə ehtimal olunan variant yoxlanılır.
 *
 * Eyni nömrə iki hesabda varsa `ambiguous` qaytarılır və kod GÖNDƏRİLMİR:
 * təsadüfi seçim yanlış hesabın şifrəsini sıfırlaya bilər.
 */
export async function findUserByIdentifier(
  id: Extract<ResolvedIdentifier, { ok: true }>,
): Promise<UserLookup> {
  if (id.channel === "email") {
    const user = await prisma.user.findUnique({ where: { email: id.email }, select: SELECT });
    return user ? { status: "found", user } : { status: "none" };
  }

  const digits = id.phoneE164.slice(1); // "+994501234567" → "994501234567"
  const candidates = Array.from(
    new Set([
      id.phoneE164,
      digits,
      `0${digits.slice(-9)}`, // yerli format: 0501234567
      digits.slice(-9), // prefikssiz: 501234567
    ]),
  );

  const matches = await prisma.user.findMany({
    where: { phone: { in: candidates } },
    select: SELECT,
    take: 2,
  });

  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) return { status: "ambiguous" };
  return { status: "found", user: matches[0] };
}
