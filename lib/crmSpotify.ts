import "server-only";
import { prisma } from "@/lib/prisma";
import { SPOTIFY_MUSIC_BRAND } from "@/lib/storeScope";

/**
 * Spotify Premium sifarişləri → CRM (crm.honsell.site) Spotify Individual sistemi.
 *
 * Axın: ödəniş təsdiqlənən kimi (kart: `lib/epointCartCheckout.ts`, cüzdan:
 * `app/api/cart/checkout/route.ts`) sifariş CRM-ə göndərilir → CRM mail/şifrəni vendora
 * (provider) WhatsApp ilə ötürür, müştəriyə "sifarişiniz qeydə alındı" yazır. Vendor premium
 * edəndə CRM-də "Hazırdır" basılır → CRM müştəriyə WhatsApp yazır və bizim
 * `POST /api/partner/spotify-orders/complete`-i çağırır (sifariş SUCCESS olur).
 *
 * İdempotentlik: `externalRef = "store:tx:<transactionId>"` — CRM eyni açarı ikinci dəfə
 * qəbul etmir, ona görə "CRM-ə göndər" düyməsi və təkrar cəhd təhlükəsizdir.
 * Nəticə sifarişin `metadata`-sına yazılır: `crmSubscriptionId` + `crmSyncedAt` və ya `crmSyncError`.
 *
 * Env: `CRM_API_URL` (məs. https://crm.honsell.site), `CRM_PARTNER_API_KEY`
 * (CRM-dəki `STORE_PARTNER_API_KEY` ilə eyni). Yoxdursa göndəriş atlanır, xəta metadata-ya yazılır.
 */

const CRM_TIMEOUT_MS = 8000;

export const crmSpotifyExternalRef = (transactionId: string) => `store:tx:${transactionId}`;

/** `externalRef` → mağaza `Transaction.id` (CRM-in complete çağırışı üçün). */
export function transactionIdFromExternalRef(ref: string): string | null {
  const m = /^store:tx:([A-Za-z0-9_-]+)$/.exec(String(ref || "").trim());
  return m ? m[1] : null;
}

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Bu sifariş sətri Spotify Premium-dur? (sətir metadata-sı, yoxdursa məhsulun metadata-sı) */
export function isSpotifyOrderRow(row: {
  metadata: string | null;
  serviceProduct?: { type: string; metadata: unknown } | null;
}): boolean {
  const meta = parseMeta(row.metadata);
  if (meta.kind !== "PLATFORM") return false;
  if (String(meta.musicBrand ?? "").toUpperCase() === SPOTIFY_MUSIC_BRAND) return true;
  const pm = (row.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
  return row.serviceProduct?.type === "PLATFORM" && String(pm.musicBrand ?? "").toUpperCase() === SPOTIFY_MUSIC_BRAND;
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

export type CrmPushResult =
  | { transactionId: string; ok: true; crmSubscriptionId: string; alreadyExists: boolean }
  | { transactionId: string; ok: false; error: string };

/** Bir Spotify sifariş sətrini CRM-ə göndərir (idempotent). */
export async function pushSpotifyOrderToCrm(transactionId: string): Promise<CrmPushResult> {
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
      user: { select: { email: true, name: true, phone: true } },
      serviceProduct: { select: { type: true, metadata: true } },
    },
  });
  if (!tx || tx.type !== "SERVICE_PURCHASE") return { transactionId, ok: false, error: "Sifariş tapılmadı" };
  if (!isSpotifyOrderRow(tx)) return { transactionId, ok: false, error: "Spotify sifarişi deyil" };

  const meta = parseMeta(tx.metadata);
  const accounts = Array.isArray(meta.accounts) ? (meta.accounts as Array<Record<string, unknown>>) : [];
  const account = accounts[0] ?? {};
  const email = String(account.email ?? meta.gmail ?? "").trim();
  const password = String(account.password ?? meta.customerPassword ?? "");
  const productMeta = (tx.serviceProduct?.metadata as Record<string, unknown> | null) ?? {};
  const months = Number(meta.durationMonths) || Number(productMeta.durationMonths) || 1;
  const phone = String(tx.user.phone ?? "").trim();
  if (!email || !password) return fail("Sifarişdə Spotify mail/şifrə yoxdur");
  if (!phone) return fail("Müştərinin telefon nömrəsi yoxdur — CRM-ə göndərilmədi");

  const { firstName, lastName } = splitName(tx.user.name);
  const body = {
    externalRef: crmSpotifyExternalRef(tx.id),
    orderCode: tx.orderCode ?? (meta.orderCode ? String(meta.orderCode) : null),
    phone,
    email,
    password,
    months,
    amountAzn: Math.abs(tx.amountAznCents) / 100,
    paidAt: tx.createdAt.toISOString(),
    paymentSource: String(meta.paymentSource ?? ""),
    firstName,
    lastName,
    hasAccount: typeof meta.hasAccount === "boolean" ? meta.hasAccount : null,
  };

  let res: Response;
  try {
    res = await fetch(`${base}/api/partner/spotify-orders`, {
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
 * Ödənişdən sonra: verilmiş sifariş sətirlərindən Spotify olanları CRM-ə göndərir.
 * Heç vaxt throw etmir — ödəniş axınını sındırmamalıdır.
 */
export async function pushSpotifyOrdersToCrm(transactionIds: string[]): Promise<CrmPushResult[]> {
  const ids = transactionIds.filter(Boolean);
  if (ids.length === 0) return [];
  try {
    const rows = await prisma.transaction.findMany({
      where: { id: { in: ids }, type: "SERVICE_PURCHASE" },
      select: { id: true, metadata: true, serviceProduct: { select: { type: true, metadata: true } } },
    });
    const spotifyIds = rows.filter(isSpotifyOrderRow).map((r) => r.id);
    const results: CrmPushResult[] = [];
    for (const id of spotifyIds) {
      try {
        results.push(await pushSpotifyOrderToCrm(id));
      } catch (e) {
        console.error("[crmSpotify] push failed", id, e);
        results.push({ transactionId: id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return results;
  } catch (e) {
    console.error("[crmSpotify] pushSpotifyOrdersToCrm failed", e);
    return [];
  }
}
