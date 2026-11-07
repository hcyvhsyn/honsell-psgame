import "server-only";
import { prisma } from "@/lib/prisma";
import { NETFLIX_ACCOUNT_SERVICE_CODE, isNetflixProduct } from "@/lib/storeScope";
import { crmSpotifyExternalRef, type CrmPushResult } from "@/lib/crmSpotify";

/**
 * Netflix sifarişləri → CRM (crm.honsell.site).
 *
 * Axın: ödəniş təsdiqlənən kimi (kart: `lib/epointCartCheckout.ts`, cüzdan:
 * `app/api/cart/checkout/route.ts`) sifariş CRM-ə gedir:
 *   - ACCOUNT (öz hesabı: Basic/Standart/Premium) → CRM Netflix Individual, mail/şifrə provayderə;
 *     CRM-də status ACTIVE olanda mağazada sifariş SUCCESS olur.
 *   - CABINET (bizim hesabda otaq: Yanımda/Evimdə/Evimdə VIP) → CRM gözləmə siyahısı; boş slot
 *     təyin olunanda müştəriyə giriş WhatsApp-la gedir və sifariş SUCCESS olur.
 * Hər iki halda CRM `POST /api/partner/netflix-orders/complete`-i çağırır.
 *
 * İdempotentlik Spotify ilə eynidir: `externalRef = "store:tx:<transactionId>"`.
 * Env də eynidir: `CRM_API_URL`, `CRM_PARTNER_API_KEY`.
 */

const CRM_TIMEOUT_MS = 8000;

const CABINET_TIER_BY_CODE: Record<string, "YANIMDA" | "EVIMDE" | "EVIMDE_VIP"> = {
  NETFLIX_YANIMDA: "YANIMDA",
  NETFLIX_EVIMD: "EVIMDE",
  NETFLIX_EVIMD_VIP: "EVIMDE_VIP",
};

const ACCOUNT_PLAN_BY_VARIANT: Record<string, "BASIC" | "STANDARD" | "PREMIUM"> = {
  basic: "BASIC",
  standart: "STANDARD",
  premium: "PREMIUM",
};

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Bu sifariş sətri Netflix-dir? Xidmət kodu sətirdə yoxdur, məhsulun metadata-sından oxunur. */
export function isNetflixOrderRow(row: {
  serviceProduct?: { type: string; metadata: unknown } | null;
}): boolean {
  return isNetflixProduct(row.serviceProduct?.type, row.serviceProduct?.metadata);
}

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

async function mergeMeta(transactionId: string, patch: Record<string, unknown>) {
  const row = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { metadata: true } });
  const meta = parseMeta(row?.metadata ?? null);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete meta[k];
    else meta[k] = v;
  }
  await prisma.transaction.update({ where: { id: transactionId }, data: { metadata: JSON.stringify(meta) } });
}

/** Bir Netflix sifariş sətrini CRM-ə göndərir (idempotent). */
export async function pushNetflixOrderToCrm(transactionId: string): Promise<CrmPushResult> {
  const fail = async (error: string): Promise<CrmPushResult> => {
    await mergeMeta(transactionId, { crmSyncError: error, crmSyncAttemptAt: new Date().toISOString() }).catch(() => {});
    return { transactionId, ok: false, error };
  };

  const base = (process.env.CRM_API_URL?.trim() || "").replace(/\/+$/, "");
  const key = process.env.CRM_PARTNER_API_KEY?.trim();
  if (!base || !key) return fail("CRM inteqrasiyası konfiqurasiya olunmayıb (CRM_API_URL / CRM_PARTNER_API_KEY)");

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      type: true,
      amountAznCents: true,
      createdAt: true,
      orderCode: true,
      metadata: true,
      user: { select: { name: true, phone: true } },
      serviceProduct: { select: { type: true, metadata: true } },
    },
  });
  if (!tx || tx.type !== "SERVICE_PURCHASE") return { transactionId, ok: false, error: "Sifariş tapılmadı" };
  if (!isNetflixOrderRow(tx)) return { transactionId, ok: false, error: "Netflix sifarişi deyil" };

  const meta = parseMeta(tx.metadata);
  const productMeta = (tx.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
  const code = String(productMeta.service ?? "").toUpperCase();
  const phone = String(tx.user.phone ?? "").trim();
  if (!phone) return fail("Müştərinin telefon nömrəsi yoxdur — CRM-ə göndərilmədi");

  const { firstName, lastName } = splitName(tx.user.name);
  const common = {
    externalRef: crmSpotifyExternalRef(tx.id),
    orderCode: tx.orderCode ?? (meta.orderCode ? String(meta.orderCode) : null),
    phone,
    months: Number(productMeta.durationMonths) || 1,
    amountAzn: Math.abs(tx.amountAznCents) / 100,
    paidAt: tx.createdAt.toISOString(),
    paymentSource: String(meta.paymentSource ?? ""),
    firstName,
    lastName,
  };

  let body: Record<string, unknown>;
  if (code === NETFLIX_ACCOUNT_SERVICE_CODE) {
    const email = String(meta.gmail ?? "").trim();
    const password = String(meta.customerPassword ?? "");
    const plan = ACCOUNT_PLAN_BY_VARIANT[String(productMeta.variantSlug ?? "").trim()];
    if (!email || !password) return fail("Sifarişdə Netflix mail/şifrə yoxdur");
    if (!plan) return fail("Məhsulda Netflix planı (variantSlug) düzgün deyil");
    body = {
      ...common,
      mode: "ACCOUNT",
      plan,
      email,
      password,
      hasAccount: typeof meta.hasAccount === "boolean" ? meta.hasAccount : true,
    };
  } else {
    const tier = CABINET_TIER_BY_CODE[code];
    if (!tier) return fail(`Naməlum Netflix paketi: ${code}`);
    body = { ...common, mode: "CABINET", tier, seats: Number(productMeta.seats) || 1 };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/api/partner/netflix-orders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    return fail(`CRM-ə qoşulmaq olmadı: ${e instanceof Error ? e.message : String(e)}`);
  }
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; id?: string; alreadyExists?: boolean; error?: string }
    | null;
  if (!res.ok || !data?.id) return fail(data?.error || `CRM xətası (${res.status})`);

  await mergeMeta(transactionId, {
    crmSubscriptionId: data.id,
    crmSyncedAt: new Date().toISOString(),
    crmSyncError: undefined,
  });
  return { transactionId, ok: true, crmSubscriptionId: data.id, alreadyExists: Boolean(data.alreadyExists) };
}

/**
 * Ödənişdən sonra: verilmiş sifariş sətirlərindən Netflix olanları CRM-ə göndərir.
 * Heç vaxt throw etmir — ödəniş axınını sındırmamalıdır.
 */
export async function pushNetflixOrdersToCrm(transactionIds: string[]): Promise<CrmPushResult[]> {
  const ids = transactionIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const rows = await prisma.transaction.findMany({
      where: { id: { in: ids }, type: "SERVICE_PURCHASE" },
      select: { id: true, serviceProduct: { select: { type: true, metadata: true } } },
    });
    const results: CrmPushResult[] = [];
    for (const row of rows.filter(isNetflixOrderRow)) {
      try {
        results.push(await pushNetflixOrderToCrm(row.id));
      } catch (e) {
        console.error("[crmNetflix] push failed", row.id, e);
        results.push({ transactionId: row.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  } catch (e) {
    console.error("[crmNetflix] pushNetflixOrdersToCrm failed", e);
    return [];
  }
}
