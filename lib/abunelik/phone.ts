import { prisma } from "@/lib/prisma";

export { normalizeAzPhone, formatAzPhone } from "@/lib/abunelik/phoneFormat";

/** Telefonun son 9 rəqəminə uyğun sayt hesabları (User.phone sərbəst formatdadır — SQL-də rəqəmlərə endirilir). */
export async function findUsersByPhone9(phone9: string, limit = 5) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE phone IS NOT NULL
      AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${phone9}
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
  `;
  if (rows.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: { id: true, name: true, email: true, role: true, disabled: true },
    orderBy: { createdAt: "asc" },
  });
}
