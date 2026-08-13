/**
 * Qiymət güdmə — server qatı (DB + göndəriş).
 *
 * ⚠️ Bu fayl `lib/prisma`-ya toxunur → `"use client"` komponentdən İMPORT
 * ETMƏ. Client tərəf yalnız [lib/priceWatchShared.ts](./priceWatchShared.ts)-dən oxuyur.
 *
 * Trigger: oyun **endirimsiz haldan endirimli hala** keçəndə. Bu qərar mövcud
 * favorit bildirişləri ilə eynidir və eyni yerdən (scrape axını, Phase 4)
 * tetiklənir — ayrıca cron YOXDUR, çünki qiymət yalnız scrape-də dəyişir.
 */

import { prisma } from "@/lib/prisma";
import { sendPriceWatchWhatsApp } from "@/lib/orderNotifications";
import { normalizeToE164 } from "@/lib/wasender";

/**
 * Bir endirim dalğasının dedup möhürü.
 *
 * `discountEndAt` varsa onu işlədirik: gələcəkdə YENİ bir endirim fərqli bitmə
 * tarixi ilə gələcək, yəni açar dəyişəcək və müştəri yeni mesaj alacaq. Eyni
 * dalğada təkrar scrape isə eyni açara düşür və unique constraint mesajı kəsir.
 *
 * ⚠️ `discountEndAt` boş olanda `now` işlədilir — bu halda TƏKRAR MESAJ RİSKİ var
 * (hər scrape yeni açar yaradır), amma yalnız oyun hər dəfə "endirimsiz →
 * endirimli" keçidi kimi görünsə. Praktikada belə sətirlər azdır və mövcud
 * `FavoriteNotification` da eyni fərziyyə ilə işləyir.
 */
export function discountWaveKey(discountEndAt: Date | null | undefined, now: Date): Date {
  return discountEndAt ?? now;
}

type WatchGame = {
  id: string;
  productId: string;
  title: string;
  discountEndAt: Date | null;
};

/**
 * Verilmiş oyunu güdən AKTİV müştərilərə endirim mesajı göndərir.
 *
 * Best-effort: heç bir xəta atmır (scrape axını bunun üstündə dayanmamalıdır),
 * yalnız statistika qaytarır.
 */
export async function notifyPriceWatchersForGame(params: {
  game: WatchGame;
  finalAzn: number;
  discountPct: number | null;
  /** Dedup möhürü — `discountWaveKey()` ilə hesablanmalıdır. */
  discountStartedAt: Date;
}): Promise<{ notified: number; failed: number; skipped: number }> {
  const { game, finalAzn, discountPct, discountStartedAt } = params;
  let notified = 0;
  let failed = 0;
  let skipped = 0;

  let watches: {
    id: string;
    phone: string;
    name: string | null;
    basePriceAznCents: number | null;
  }[];
  try {
    watches = await prisma.gamePriceWatch.findMany({
      where: { gameId: game.id, isActive: true },
      select: { id: true, phone: true, name: true, basePriceAznCents: true },
    });
  } catch (e) {
    console.error("price-watch: findMany failed", e);
    return { notified, failed, skipped };
  }

  for (const watch of watches) {
    // Dedup sətri MESAJDAN ƏVVƏL yaradılır. Tərsi olsa (əvvəl göndər, sonra
    // yaz) göndəriş uğurlu, yazma uğursuz olanda müştəri hər scrape-də təkrar
    // mesaj alardı — spam riski uğursuz göndərişdən betərdir.
    try {
      await prisma.gamePriceWatchNotification.create({
        data: {
          watchId: watch.id,
          discountStartedAt,
          priceAznCents: Math.round(finalAzn * 100),
        },
      });
    } catch {
      // Unique constraint → bu dalğa üçün artıq xəbər verilib.
      skipped++;
      continue;
    }

    const res = await sendPriceWatchWhatsApp({
      phone: watch.phone,
      customerName: watch.name,
      productTitle: game.title,
      productId: game.productId,
      finalAzn,
      basePriceAzn:
        watch.basePriceAznCents != null ? watch.basePriceAznCents / 100 : null,
      discountPct,
      discountEndAt: game.discountEndAt,
    });

    if (res.ok) {
      notified++;
      try {
        await prisma.gamePriceWatch.update({
          where: { id: watch.id },
          data: { lastNotifiedAt: new Date(), notifyCount: { increment: 1 } },
        });
      } catch (e) {
        console.error("price-watch: counter update failed", e);
      }
    } else {
      failed++;
      // Göndəriş alınmadı → dedup sətrini geri al ki, növbəti scrape yenidən
      // cəhd etsin. WaSender müvəqqəti sıradan çıxanda qeyd əbədi susmasın.
      try {
        await prisma.gamePriceWatchNotification.deleteMany({
          where: { watchId: watch.id, discountStartedAt },
        });
      } catch (e) {
        console.error("price-watch: dedup rollback failed", e);
      }
    }
  }

  return { notified, failed, skipped };
}

/**
 * Admin panelindən "indi göndər" — endirim onsuz da aktiv olanda (məsələn qeyd
 * endirim başladıqdan SONRA yazılıb, yəni keçid anını qaçırmışıq) admin mesajı
 * əl ilə tetikləyir.
 *
 * Avtomatik yoldan fərqi: dedup sətri `upsert` ilə yazılır, yəni mövcud olsa da
 * mesaj gedir (admin qərarı dedup-dan üstündür), amma sətir yenilənir ki,
 * növbəti scrape eyni dalğa üçün TƏKRAR göndərməsin.
 */
export async function sendPriceWatchNow(params: {
  watchId: string;
  game: WatchGame;
  finalAzn: number;
  discountPct: number | null;
  discountStartedAt: Date;
}): Promise<{ ok: boolean; reason?: string }> {
  const watch = await prisma.gamePriceWatch.findUnique({
    where: { id: params.watchId },
    select: { id: true, phone: true, name: true, basePriceAznCents: true },
  });
  if (!watch) return { ok: false, reason: "NOT_FOUND" };
  if (!normalizeToE164(watch.phone)) return { ok: false, reason: "PHONE_INVALID" };

  const res = await sendPriceWatchWhatsApp({
    phone: watch.phone,
    customerName: watch.name,
    productTitle: params.game.title,
    productId: params.game.productId,
    finalAzn: params.finalAzn,
    basePriceAzn:
      watch.basePriceAznCents != null ? watch.basePriceAznCents / 100 : null,
    discountPct: params.discountPct,
    discountEndAt: params.game.discountEndAt,
  });
  if (!res.ok) return res;

  const priceAznCents = Math.round(params.finalAzn * 100);
  try {
    await prisma.gamePriceWatchNotification.upsert({
      where: {
        watchId_discountStartedAt: {
          watchId: watch.id,
          discountStartedAt: params.discountStartedAt,
        },
      },
      create: {
        watchId: watch.id,
        discountStartedAt: params.discountStartedAt,
        priceAznCents,
      },
      update: { sentAt: new Date(), priceAznCents },
    });
    await prisma.gamePriceWatch.update({
      where: { id: watch.id },
      data: { lastNotifiedAt: new Date(), notifyCount: { increment: 1 } },
    });
  } catch (e) {
    // Mesaj GETDİ — qeyd yazılmasa da uğur qaytarılır, yoxsa admin təkrar basıb
    // müştəriyə ikinci mesaj göndərər.
    console.error("price-watch: manual send bookkeeping failed", e);
  }

  return { ok: true };
}
