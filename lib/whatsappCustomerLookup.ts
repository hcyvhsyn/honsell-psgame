import { prisma } from "@/lib/prisma";
import { normalizeToE164 } from "@/lib/wasender";

/**
 * Eyni telefonun DB-də saxlanan mümkün formatlarını qaytarır (E.164, ölkə kodsuz,
 * yerli 0-lı). İstifadəçi qeydiyyatda telefonu sərbəst formatda saxlaya bilir.
 */
export function phoneCandidates(e164: string): string[] {
  const digits = e164.replace(/\D/g, ""); // məs. 994501234567
  const set = new Set<string>([e164, digits]);
  // AZ nömrələri: +994 XX XXXXXXX → yerli 0XX XXXXXXX və kodsuz XX XXXXXXX
  if (digits.startsWith("994") && digits.length >= 12) {
    const local = digits.slice(3); // 501234567
    set.add(local);
    set.add(`0${local}`);
  }
  return Array.from(set);
}

/**
 * Telefon nömrəsinə görə mövcud müştərini tapır (bütün formatları yoxlayaraq).
 * WhatsApp rəy dəvəti və "niyə davam etmədi" sorğusu üçün ortaqdır.
 */
export async function findCustomerByPhone(rawPhone: string) {
  const e164 = normalizeToE164(rawPhone);
  if (!e164) return null;
  return prisma.user.findFirst({
    where: { phone: { in: phoneCandidates(e164) } },
    select: { id: true, name: true, email: true, phone: true },
    orderBy: { createdAt: "asc" },
  });
}
