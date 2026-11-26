import { NextResponse } from "next/server";
import { requirePartnerKey } from "@/lib/partnerAuth";
import { SITE_URL } from "@/lib/site";
import { normalizeAzPhone } from "@/lib/abunelik/phoneFormat";
import { ABUNELIK_LINK_TTL_SECONDS, createLinkToken } from "@/lib/abunelik/token";
import { isAbunelikConfigured, isAbunelikEnabled } from "@/lib/abunelik/session";
import { ensureCrmAccounts } from "@/lib/crmAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CRM → mağaza: WhatsApp-da yazan müştəriyə göndəriləcək /abunelik birbaşa giriş linki (24 saat).
 * Body: { phone, name? }. /abunelik söndürülübsə 409 DISABLED — CRM mesaj göndərmir (və cooldown yazmır).
 */
export async function POST(req: Request) {
  const denied = requirePartnerKey(req);
  if (denied) return denied;
  if (!isAbunelikEnabled() || !isAbunelikConfigured()) {
    return NextResponse.json({ error: "/abunelik söndürülüb", code: "DISABLED" }, { status: 409 });
  }
  const body = (await req.json().catch(() => null)) as { phone?: string; name?: string } | null;
  const phone = normalizeAzPhone(body?.phone);
  if (!phone) return NextResponse.json({ error: "Telefon düzgün deyil" }, { status: 400 });
  // Nömrənin sayt hesabı yoxdursa indi yaranır (CRM telefon hesabı) — link açılanda müştəri birbaşa
  // öz hesabına daxil olur, ödənişdə ad/e-poçt soruşulmur. Alınmasa link yenə verilir (köhnə axın).
  try {
    await ensureCrmAccounts([{ phone: phone.e164, name: body?.name ?? null }]);
  } catch (e) {
    console.error("[partner/abunelik-link] hesab yaradılmadı", e);
  }
  const token = createLinkToken(phone);
  return NextResponse.json(
    {
      ok: true,
      url: `${SITE_URL}/abunelik/giris?t=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + ABUNELIK_LINK_TTL_SECONDS * 1000).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
