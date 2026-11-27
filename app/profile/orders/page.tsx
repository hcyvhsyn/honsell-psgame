import Image from "next/image";
import Link from "next/link";
import { Receipt, Gamepad2, Star, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/pricing";
import { getUserReviewablePurchases } from "@/lib/userPurchasedProducts";
import {
  parseGameOrderMeta,
} from "@/lib/gameOrderFulfillment";
import { formatHonsellGiftCardCode } from "@/lib/honsellGiftCard";
import { formatProductGiftCode } from "@/lib/productGiftShared";
import CopyableField from "@/components/CopyableField";
import OrderReviewButton from "@/components/OrderReviewButton";
import ProfilePageHeader from "@/components/profile/ProfilePageHeader";
import { displayGameTitle } from "@/lib/gameTitle";

/** Xam status enum-u ("SUCCESS") müştəriyə göstərilirdi — azərbaycanca ad + rəng. */
const ORDER_STATUS: Record<string, { label: string; className: string }> = {
  SUCCESS: { label: "Tamamlandı", className: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300" },
  PENDING: { label: "Gözləyir", className: "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300" },
  FAILED: { label: "Ləğv edildi", className: "bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300" },
};

function OrderStatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status, className: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/30 dark:text-zinc-300" };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${s.className}`}>{s.label}</span>
  );
}

const fmtOrderDate = (d: Date) =>
  new Date(d).toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  type OrderRow = {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    amountAznCents: number;
    metadata: string | null;
    gameId: string | null;
    game: { id: string; title: string; imageUrl: string | null; platform: string | null; productType: string } | null;
    serviceProduct?: { title: string; type: string } | null;
    serviceCode?: { code: string } | null;
    psnAccount: { id: string; label: string; psnEmail: string } | null;
  };

  let rows: OrderRow[] = [];
  try {
    rows = (await prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ["PURCHASE", "SERVICE_PURCHASE"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        game: {
          select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
        },
        serviceProduct: {
          select: { title: true, type: true },
        },
        serviceCode: {
          select: { code: true },
        },
        psnAccount: { select: { id: true, label: true, psnEmail: true } },
      },
    })) as unknown as OrderRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Transaction.serviceProductId") || msg.includes("serviceProductId")) {
      rows = (await prisma.transaction.findMany({
        where: { userId: user.id, type: "PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          game: {
            select: { id: true, title: true, imageUrl: true, platform: true, productType: true },
          },
          psnAccount: { select: { id: true, label: true, psnEmail: true } },
        },
      })) as unknown as OrderRow[];
    } else {
      throw err;
    }
  }

  // Rəy təşviqi: hələ rəy yazılmamış uğurlu alışlar (Testimonial-da olmayanlar)
  // və rəy üçün verilən cashback faizi. Düymə yalnız bu alışlarda görünür ki,
  // /api/reviews validasiyası ilə üst-üstə düşsün.
  const [settings, reviewable] = await Promise.all([
    getSettings(),
    getUserReviewablePurchases(user.id),
  ]);
  const reviewCashbackPct = settings.reviewCashbackRatePct ?? 1;
  const reviewableIds = new Set(reviewable.map((p) => p.transactionId));

  // Artıq rəy yazılmış alışlar — "Rəy yazılıb" nişanı üçün.
  const reviewedRows = rows.length
    ? await prisma.testimonial
        .findMany({
          where: { transactionId: { in: rows.map((r) => r.id) } },
          select: { transactionId: true },
        })
        .catch(() => [] as { transactionId: string | null }[])
    : [];
  const reviewedIds = new Set(
    reviewedRows.map((t) => t.transactionId).filter(Boolean) as string[],
  );

  return (
    <section className="space-y-4">
      <ProfilePageHeader
        title="Sifarişlər"
        description="Bütün alışların, statusları, kodları və hansı PSN hesabına getdiyi."
      />

      {reviewableIds.size > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-4 py-3">
          <Star className="mt-0.5 h-5 w-5 shrink-0 fill-amber-400 text-amber-400 dark:fill-amber-300 dark:text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Rəy yaz, cashback qazan
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
              Rəy yazılmamış <b>{reviewableIds.size}</b> sifarişin var. Hər rəyə həmin sifarişin{" "}
              <b>{reviewCashbackPct}%</b>-i qədər cashback verilir.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
          <Receipt className="mx-auto h-10 w-10 text-zinc-400 dark:text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Hələ sifariş yoxdur.</p>
          <Link
            href="/oyunlar"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const rowMeta = parseGameOrderMeta(r.metadata ?? null);
            let cancelReason: string | null = null;
            if (r.status === "FAILED" && r.metadata) {
              try {
                const m = JSON.parse(r.metadata) as { cancelReason?: unknown };
                if (typeof m.cancelReason === "string" && m.cancelReason.trim()) {
                  cancelReason = m.cancelReason.trim();
                }
              } catch {
                /* ignore */
              }
            }
            // Oyun hədiyyəsində alıcının ödəniş qeydi SERVICE_PURCHASE-dir, amma
            // gameId qoyulub — başlıq həm xidmət, həm oyun adına fallback etsin.
            const displayTitle = r.game?.title
              ? displayGameTitle(r.game.title)
              : r.serviceProduct?.title ?? "Silinmiş məhsul";
            return (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                  {r.game?.imageUrl ? (
                    <Image src={r.game.imageUrl} alt={r.game.title} fill sizes="56px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      <Gamepad2 className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 sm:hidden">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{displayTitle}</p>
                  <div className="mt-1"><OrderStatusBadge status={r.status} /></div>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="hidden truncate text-sm font-medium text-zinc-900 dark:text-white sm:block">
                  {displayTitle}
                </p>
                {(() => {
                  const isGamePurchase =
                    r.type === "PURCHASE" && r.gameId != null;

                  return isGamePurchase && r.status === "PENDING" ? (
                    <p className="mt-1 text-xs leading-snug text-amber-800 dark:text-amber-200/95">
                      Sifarişin qəbul edildi. Tezliklə səninlə əlaqə saxlayacağıq — PSN hesab məlumatlarını hazır saxla.
                    </p>
                  ) : isGamePurchase && r.status === "SUCCESS" ? (
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400/90">
                      Oyun hesabına yükləndi.
                    </p>
                  ) : isGamePurchase && r.status === "FAILED" ? (
                    <div className="mt-1 space-y-1 text-[11px] leading-snug text-rose-700 dark:text-rose-400/95">
                      <p>
                        Sifariş tamamlanmadı — məbləğ cüzdanına və ya referal balansına qaytarıldı.
                      </p>
                      {cancelReason && (
                        <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-rose-800 dark:text-rose-200/95">
                          <span className="font-semibold">Ləğv səbəbi:</span> {cancelReason}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}
                <div className="text-xs text-zinc-500">
                  {fmtOrderDate(r.createdAt)}
                  {r.psnAccount && (
                    <>
                      {" "}· <span className="text-zinc-700 dark:text-zinc-300">{r.psnAccount.label}</span> ({r.psnAccount.psnEmail})
                    </>
                  )}
                </div>
                {rowMeta.orderCode ? (
                  <p className="text-[11px] font-mono text-indigo-700/90 dark:text-indigo-300/90">
                    Sifariş kodu:{" "}
                    <span className="font-semibold tracking-wide text-indigo-800 dark:text-indigo-200">{rowMeta.orderCode}</span>
                  </p>
                ) : null}
                {r.serviceCode && (
                  <div className="mt-2 rounded bg-emerald-500/10 p-2 text-sm">
                    <span className="mr-2 text-xs text-emerald-700/70 dark:text-emerald-500/60">Kod:</span>
                    <span className="select-all font-mono font-bold tracking-widest text-emerald-700 dark:text-emerald-400">{r.serviceCode.code}</span>
                  </div>
                )}
                {(() => {
                  if (r.type !== "SERVICE_PURCHASE") return null;
                  let rawMeta: Record<string, unknown> | null = null;
                  try {
                    rawMeta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null;
                  } catch {
                    rawMeta = null;
                  }
                  const isYoutube =
                    rawMeta?.kind === "PLATFORM" &&
                    String(rawMeta?.musicBrand ?? "") === "YOUTUBE_PREMIUM";
                  const gmail = typeof rawMeta?.gmail === "string" ? rawMeta.gmail : null;
                  const customerPassword =
                    typeof rawMeta?.customerPassword === "string"
                      ? rawMeta.customerPassword
                      : null;
                  if (!isYoutube || (!gmail && !customerPassword)) return null;
                  return (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-red-300">
                        YouTube hesabı (admin abunəlik qoşacaq)
                      </div>
                      {gmail && <CopyableField label="Gmail" value={gmail} />}
                      {customerPassword && (
                        <CopyableField label="Şifrə" value={customerPassword} masked mono />
                      )}
                    </div>
                  );
                })()}
                {(() => {
                  if (r.type !== "SERVICE_PURCHASE") return null;
                  let rawMeta: Record<string, unknown> | null = null;
                  try {
                    rawMeta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null;
                  } catch {
                    rawMeta = null;
                  }
                  if (rawMeta?.kind !== "PLATFORM" || !Array.isArray(rawMeta?.accounts)) return null;
                  const accounts = (rawMeta.accounts as unknown[])
                    .map((a) => {
                      const o = a && typeof a === "object" ? (a as Record<string, unknown>) : null;
                      return {
                        email: o && typeof o.email === "string" ? o.email : "",
                        password: o && typeof o.password === "string" ? o.password : "",
                      };
                    })
                    .filter((a) => a.email);
                  if (accounts.length === 0) return null;
                  return (
                    <div className="mt-2 space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                        Hesablar (admin abunəlik qoşacaq)
                      </div>
                      {accounts.map((acc, idx) => (
                        <div key={idx} className="space-y-1 border-l-2 border-emerald-500/40 pl-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
                            Hesab {idx + 1}
                          </div>
                          <CopyableField label="Email" value={acc.email} />
                          {acc.password && (
                            <CopyableField label="Şifrə" value={acc.password} masked mono />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {(() => {
                  if (r.type !== "SERVICE_PURCHASE") return null;
                  let rawMeta: Record<string, unknown> | null = null;
                  try {
                    rawMeta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null;
                  } catch {
                    rawMeta = null;
                  }
                  const code = typeof rawMeta?.honsellGiftCardCode === "string"
                    ? (rawMeta.honsellGiftCardCode as string)
                    : null;
                  if (!code) return null;
                  return (
                    <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-violet-300/80">
                          Honsell hədiyyə kart kodu
                        </span>
                        <Link
                          href="/profile/wallet#hediyye-kart"
                          className="text-[11px] text-violet-200 hover:underline"
                        >
                          Aktivləşdir →
                        </Link>
                      </div>
                      <div className="mt-1 select-all font-mono text-lg font-bold tracking-widest text-violet-200">
                        {formatHonsellGiftCardCode(code)}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  // Dostuna hədiyyə — alıcının ödəniş qeydində kodu göstər ki, unutmasın.
                  if (r.type !== "SERVICE_PURCHASE") return null;
                  let rawMeta: Record<string, unknown> | null = null;
                  try {
                    rawMeta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null;
                  } catch {
                    rawMeta = null;
                  }
                  if (rawMeta?.kind !== "PRODUCT_GIFT") return null;
                  const giftCode =
                    typeof rawMeta?.giftCode === "string" ? (rawMeta.giftCode as string) : null;
                  if (!giftCode) return null;
                  return (
                    <div className="mt-2 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-fuchsia-300/80">
                          🎁 Hədiyyə kodu
                        </span>
                        <Link
                          href={`/hediyye-ac?code=${giftCode}`}
                          className="text-[11px] text-fuchsia-200 hover:underline"
                        >
                          Açma səhifəsi →
                        </Link>
                      </div>
                      <div className="mt-1 select-all font-mono text-lg font-bold tracking-widest text-fuchsia-200">
                        {formatProductGiftCode(giftCode)}
                      </div>
                      <p className="mt-1 text-[11px] text-fuchsia-200/70">
                        Bu kodu dostuna göndər — o, açma səhifəsində hədiyyəni öz hesabına ala bilər.
                      </p>
                    </div>
                  );
                })()}
                {r.type === "SERVICE_PURCHASE" && !r.serviceCode && (() => {
                  let rawMeta: Record<string, unknown> | null = null;
                  try {
                    rawMeta = r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null;
                  } catch {
                    rawMeta = null;
                  }
                  const isHonsellGift = rawMeta?.kind === "HONSELL_GIFT_CARD";
                  const hasCode = typeof rawMeta?.honsellGiftCardCode === "string";
                  if (isHonsellGift && hasCode) return null;
                  // Hədiyyə qeydləri öz blokunda göstərilir — generik statusu təkrar etmə.
                  if (rawMeta?.kind === "PRODUCT_GIFT") return null;
                  return (
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {r.status === "PENDING" && (
                        isHonsellGift
                          ? "Hədiyyə kart kodu admin tərəfindən hazırlanır — kod hazır olduqda email ilə göndəriləcək."
                          : "Hazırlanır…"
                      )}
                      {r.status === "SUCCESS" && !isHonsellGift && "Sifariş tamamlandı."}
                      {r.status === "FAILED" && (
                        <span className="block space-y-1">
                          <span className="block text-rose-700 dark:text-rose-400">Sifariş ləğv edildi — məbləğ balansına qaytarıldı.</span>
                          {cancelReason && (
                            <span className="block rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200/95">
                              <span className="font-semibold">Ləğv səbəbi:</span> {cancelReason}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {reviewableIds.has(r.id) ? (
                  <div className="pt-1.5">
                    <OrderReviewButton
                      transactionId={r.id}
                      productTitle={displayTitle}
                      cashbackPct={reviewCashbackPct}
                    />
                  </div>
                ) : reviewedIds.has(r.id) ? (
                  <div className="pt-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400/90">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Rəy yazılıb
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="text-right sm:ml-auto">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {(Math.abs(r.amountAznCents) / 100).toFixed(2)} ₼
                </p>
                <div className="mt-1 hidden sm:block">
                  <OrderStatusBadge status={r.status} />
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
