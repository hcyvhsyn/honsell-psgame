import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAbunelikEnabled, resolveVerifiedPhone } from "@/lib/abunelik/session";
import { formatAzPhone } from "@/lib/abunelik/phone";
import { fetchCrmSubscriptions } from "@/lib/crmRenewals";
import { consumeRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/abunelik/subscriptions — daxil olmuş istifadəçinin SÜBUT olunmuş nömrəsinin (`User.verifiedPhone`)
 * CRM abunəlikləri (hesab məlumatları daxil) + son 30 günün saytdan yeniləmələri. Profil → Abunəliklərim.
 */
export async function GET() {
  if (!isAbunelikEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const phone = await resolveVerifiedPhone();
  if (!phone) {
    return NextResponse.json({ error: "Nömrənizi WhatsApp kodu ilə təsdiqləyin.", code: "PHONE_UNVERIFIED" }, { status: 401 });
  }

  const rl = await consumeRateLimit({
    key: `abunelik-list:${phone.e164}`,
    scope: "abunelik-list",
    windowSeconds: 10 * 60,
    max: 60,
  });
  if (!rl.ok) return NextResponse.json({ error: "Çox tez-tez yeniləyirsiniz. Bir az gözləyin." }, { status: 429 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const [crm, renewals] = await Promise.all([
      fetchCrmSubscriptions(phone.e164),
      prisma.crmRenewalOrder.findMany({
        where: { phone: phone.e164, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          paymentTransactionId: true,
          orderCode: true,
          ref: true,
          title: true,
          months: true,
          amountAznCents: true,
          status: true,
          crmStatus: true,
          resultEndDate: true,
          createdAt: true,
        },
      }),
    ]);
    return NextResponse.json(
      {
        phone: formatAzPhone(phone.e164),
        customerName: crm.customerName,
        firstName: crm.firstName,
        items: crm.items,
        renewals,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[abunelik:list]", e);
    return NextResponse.json({ error: "Abunəliklər yüklənmədi. Bir az sonra yenidən cəhd edin." }, { status: 503 });
  }
}
