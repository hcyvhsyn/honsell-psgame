import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * /abunelik — CRM (crm.honsell.site) müştəri abunəlikləri və saytdan yeniləmə.
 *
 *   GET  {CRM}/api/partner/customer-subscriptions?phone=  → abunəliklər + hesab məlumatı + yeniləmə seçimləri
 *   POST {CRM}/api/partner/renewals/quote                 → ödənişdən ƏVVƏL qiymətin server tərəfdə təsdiqi
 *   POST {CRM}/api/partner/renewals                        → ödəniş təsdiqləndi, CRM uzatsın (idempotent)
 *   CRM → POST /api/partner/crm-renewals/complete           → async növlərin nəticəsi (vendor / admin)
 *
 * Env: CRM_API_URL, CRM_PARTNER_API_KEY (Netflix/Spotify ilə eyni). Qiymət YALNIZ CRM-dən gəlir — klientin
 * göndərdiyi məbləğə heç vaxt güvənilmir.
 */

const CRM_TIMEOUT_MS = 8000;

export type CrmRenewalOption = { months: number; priceAzn: number; newEndDate: string };
export type CrmSubscriptionItem = {
  ref: string;
  kind: "SLOT" | "FAMILY" | "SI" | "NI" | "PS" | "STREAMING" | "LINKEDIN";
  category: "streaming" | "music" | "ps" | "linkedin";
  title: string;
  subtitle: string | null;
  status: "ACTIVE" | "EXPIRING" | "EXPIRED" | "PENDING";
  endDate: string | null;
  daysLeft: number | null;
  credentials: { email?: string; password?: string; profile?: string; pin?: string; plan?: string } | null;
  renewal: { mode: "INSTANT" | "ASYNC" | "MANUAL"; options: CrmRenewalOption[] } | null;
  blockedReason: string | null;
};
export type CrmSubscriptionsResponse = {
  phone9: string;
  customerName: string | null;
  firstName: string | null;
  items: CrmSubscriptionItem[];
};
export type CrmQuote = {
  ok: true;
  ref: string;
  kind: string;
  title: string;
  months: number;
  priceAzn: number;
  newEndDate: string;
  mode: string | null;
};

export class CrmRenewalError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

function crmConfig(): { base: string; key: string } | null {
  const base = (process.env.CRM_API_URL || "").trim().replace(/\/+$/, "");
  const key = (process.env.CRM_PARTNER_API_KEY || "").trim();
  return base && key ? { base, key } : null;
}

export function isCrmConfigured(): boolean {
  return crmConfig() != null;
}

async function crmFetch<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const cfg = crmConfig();
  if (!cfg) throw new CrmRenewalError("CRM inteqrasiyası qurulmayıb", 503);
  let res: Response;
  try {
    res = await fetch(`${cfg.base}${path}`, {
      method: init?.method ?? "GET",
      headers: { "x-api-key": cfg.key, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    });
  } catch (e) {
    throw new CrmRenewalError(e instanceof Error ? `CRM-ə qoşulmaq olmadı: ${e.message}` : "Şəbəkə xətası", 502);
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!res.ok) {
    throw new CrmRenewalError(data?.error || `CRM xətası (${res.status})`, res.status, data?.code);
  }
  if (data == null) throw new CrmRenewalError("CRM boş cavab qaytardı", 502);
  return data;
}

export function fetchCrmSubscriptions(phoneE164: string) {
  return crmFetch<CrmSubscriptionsResponse>(
    `/api/partner/customer-subscriptions?phone=${encodeURIComponent(phoneE164)}`,
  );
}

export function quoteCrmRenewal(input: { phone: string; ref: string; months: number }) {
  return crmFetch<CrmQuote>("/api/partner/renewals/quote", { method: "POST", body: input });
}

export const CRM_RENEWAL_REF_PREFIX = "store:renewal:";
export const crmRenewalExternalRef = (paymentTxId: string) => `${CRM_RENEWAL_REF_PREFIX}${paymentTxId}`;

/** CRM statusu → mağaza statusu. */
export function storeStatusFromCrm(crmStatus: string): "SUCCESS" | "FAILED" | "PENDING" {
  if (crmStatus === "COMPLETED") return "SUCCESS";
  if (crmStatus === "FAILED") return "FAILED";
  return "PENDING";
}

/**
 * Ödənilmiş yeniləməni CRM-ə ötür. Heç vaxt throw etmir — xəta `crmSyncError`-a yazılır, admin
 * "CRM-ə yenidən göndər" ilə təkrarlayır (CRM eyni externalRef-i ikinci dəfə emal etmir).
 */
export async function pushCrmRenewalToCrm(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const order = await prisma.crmRenewalOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Sifariş tapılmadı" };
  if (order.status !== "PENDING") return { ok: true };
  try {
    const r = await crmFetch<{ ok: boolean; id: string; status: string; resultEndDate: string | null }>(
      "/api/partner/renewals",
      {
        method: "POST",
        body: {
          externalRef: order.externalRef,
          orderCode: order.orderCode,
          phone: order.phone,
          ref: order.ref,
          months: order.months,
          amountAzn: order.amountAznCents / 100,
          // CrmRenewalOrder ödəniş təsdiqlənən anda yaranır (finalizeCrmRenewalPayment)
          paidAt: order.createdAt.toISOString(),
          paymentSource: "EPOINT",
        },
      },
    );
    const status = storeStatusFromCrm(r.status);
    const now = new Date();
    await prisma.crmRenewalOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        crmStatus: r.status,
        crmOrderId: r.id,
        crmSyncedAt: now,
        crmSyncError: null,
        crmSyncAttemptAt: now,
        ...(r.resultEndDate ? { resultEndDate: new Date(r.resultEndDate) } : {}),
        ...(status !== "PENDING" ? { status, completedAt: now } : {}),
        ...(status === "FAILED" ? { failReason: "CRM uzada bilmədi — geri ödəniş lazımdır" } : {}),
      },
    });
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await prisma.crmRenewalOrder.update({
      where: { id: order.id },
      data: { crmSyncError: error.slice(0, 500), crmSyncAttemptAt: new Date() },
    });
    return { ok: false, error };
  }
}
