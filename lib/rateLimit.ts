import { prisma } from "@/lib/prisma";

/**
 * Sürüşən pəncərə (sliding window) tipli sadə rate-limit. Hər cəhdi DB-yə
 * yazır və son `windowSeconds` ərzindəki cəhdləri sayır.
 *
 * Niyə DB: Vercel serverless funksiyaları arası state paylaşmır → in-memory
 * Map işləmir. Prisma postgres-ə yazmaq sürətlidir və index-li sorğu sürətli
 * sayım verir. Sonra Redis/Upstash-a köçmək asan olsun deyə interfeys generic
 * saxlanılır.
 */

export type RateLimitCheck =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number; retryAfterMinutes: number };

/**
 * Verilən `key` üçün son `windowSeconds` ərzində baş verən cəhdlərin sayını
 * yoxlayır. Limitə çatmayıbsa cəhdi `RateLimitEvent`-ə yazır və ok=true
 * qaytarır. Limitə çatıbsa ok=false + növbəti cəhdə qədər saniyə.
 *
 * `identifier` doldurulsa, distinct-count yoxlamasında istifadə oluna bilər
 * (məs: eyni IP-dən 5 dəqiqədə neçə fərqli telefon nömrəsi).
 */
export async function consumeRateLimit(params: {
  key: string;
  scope: string;
  windowSeconds: number;
  max: number;
  identifier?: string | null;
  /** Cəhdi qeyd etmə (yalnız oxu/yoxla). Default: true. */
  record?: boolean;
}): Promise<RateLimitCheck> {
  const { key, scope, windowSeconds, max, identifier, record = true } = params;
  const since = new Date(Date.now() - windowSeconds * 1000);

  const recent = await prisma.rateLimitEvent.findMany({
    where: { key, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (recent.length >= max) {
    const oldest = recent[0]!.createdAt;
    const retryAfterMs = Math.max(
      0,
      oldest.getTime() + windowSeconds * 1000 - Date.now()
    );
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return {
      ok: false,
      retryAfterSeconds,
      retryAfterMinutes: Math.ceil(retryAfterSeconds / 60),
    };
  }

  if (record) {
    await prisma.rateLimitEvent.create({
      data: { key, scope, identifier: identifier ?? null },
    });
  }

  return { ok: true, remaining: max - recent.length - 1 };
}

/**
 * Son `windowSeconds` ərzində eyni `key`-dən baş verən cəhdlərin **fərqli**
 * `identifier` dəyərlərinin sayını yoxlayır. Cari identifier siyahıda yoxsa
 * və siyahıdakı say limitə çatıbsa bloklanır.
 *
 * Məs: "5 dəqiqədə eyni IP-dən 2 fərqli telefonla qeydiyyat" qaydası üçün:
 *   consumeDistinctRateLimit({
 *     key: `register:ip:${ip}`,
 *     identifier: phone,
 *     scope: "register",
 *     windowSeconds: 300,
 *     maxDistinct: 2,
 *   })
 */
export async function consumeDistinctRateLimit(params: {
  key: string;
  scope: string;
  identifier: string;
  windowSeconds: number;
  maxDistinct: number;
  /** Cəhdi qeyd etmə. Default: true. */
  record?: boolean;
}): Promise<RateLimitCheck> {
  const { key, scope, identifier, windowSeconds, maxDistinct, record = true } = params;
  const since = new Date(Date.now() - windowSeconds * 1000);

  const recent = await prisma.rateLimitEvent.findMany({
    where: { key, createdAt: { gte: since } },
    select: { identifier: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const distinct = new Set(
    recent
      .map((r) => r.identifier)
      .filter((v): v is string => typeof v === "string" && v.length > 0)
  );

  // Cari identifier artıq siyahıdadırsa — bu eyni telefon üçün təkrar cəhddir,
  // distinct-limit deyil; sadəcə qeyd edirik və ok qaytarırıq.
  if (distinct.has(identifier)) {
    if (record) {
      await prisma.rateLimitEvent.create({
        data: { key, scope, identifier },
      });
    }
    return { ok: true, remaining: 0 };
  }

  if (distinct.size >= maxDistinct) {
    const oldest = recent[0]!.createdAt;
    const retryAfterMs = Math.max(
      0,
      oldest.getTime() + windowSeconds * 1000 - Date.now()
    );
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return {
      ok: false,
      retryAfterSeconds,
      retryAfterMinutes: Math.ceil(retryAfterSeconds / 60),
    };
  }

  if (record) {
    await prisma.rateLimitEvent.create({
      data: { key, scope, identifier },
    });
  }

  return { ok: true, remaining: maxDistinct - distinct.size - 1 };
}

/**
 * Konkret istifadəçi-yönlü cooldown — son `cooldownSeconds` ərzində eyni
 * key üçün cəhd olubsa, bloklanır. Resend-OTP üçün uyğundur ki, istifadəçi
 * 60 saniyədə bir dəfədən artıq tələb göndərə bilməsin.
 */
export async function checkCooldown(params: {
  key: string;
  cooldownSeconds: number;
}): Promise<RateLimitCheck> {
  const { key, cooldownSeconds } = params;
  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const last = await prisma.rateLimitEvent.findFirst({
    where: { key, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return { ok: true, remaining: 1 };

  const retryAfterMs = Math.max(
    0,
    last.createdAt.getTime() + cooldownSeconds * 1000 - Date.now()
  );
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return {
    ok: false,
    retryAfterSeconds,
    retryAfterMinutes: Math.ceil(retryAfterSeconds / 60),
  };
}

/**
 * Standart "çox cəhd, X dəqiqə sonra" mesajını formatlayır.
 */
export function rateLimitMessage(retryAfterMinutes: number, retryAfterSeconds: number): string {
  if (retryAfterMinutes <= 1) {
    return `Çox cəhd. ${Math.max(retryAfterSeconds, 1)} saniyə sonra yenidən sınayın.`;
  }
  return `Çox cəhd. ${retryAfterMinutes} dəqiqə sonra yenidən sınayın.`;
}
