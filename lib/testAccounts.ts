import { prisma } from "@/lib/prisma";

/**
 * Hesablar ki, sırf test/sınaq məqsədli istifadə olunur — bunların balansı,
 * aldığı abunəliklər və ictimai sıralamadakı (leaderboard) yeri statistikada
 * nəzərə alınmamalıdır.
 *
 * Əlavə hesabları `TEST_ACCOUNT_EMAILS` env dəyişəni ilə (vergüllə ayrılmış)
 * verə bilərsiniz; aşağıdakı siyahıyla birləşdirilir.
 */
const HARDCODED_TEST_EMAILS = ["cpt.huseyn@gmail.com"];

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** Bütün test hesab e-poçtları (hardcoded + env), normallaşdırılmış. */
export function getTestAccountEmails(): string[] {
  const fromEnv = (process.env.TEST_ACCOUNT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const all = [...HARDCODED_TEST_EMAILS, ...fromEnv].map(normalize);
  return Array.from(new Set(all));
}

export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getTestAccountEmails().includes(normalize(email));
}

/**
 * Test hesablarının `User.id`-lərini qaytarır. Statistik/sıralama sorğularında
 * `userId: { notIn: ids }` kimi istisna üçün istifadə olunur. Heç bir test
 * hesabı tapılmazsa boş massiv qaytarır.
 */
export async function getTestAccountUserIds(): Promise<string[]> {
  const emails = getTestAccountEmails();
  if (emails.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
