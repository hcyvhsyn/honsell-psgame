import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isR2Configured, putR2Object } from "@/lib/r2";
import { revalidateReels } from "@/lib/revalidate";
import { detectFourccFromBytes } from "@/lib/videoFourcc";
import {
  ingestFromUrl,
  ingestFromBytes,
  checkIngestBinaries,
  type ReelAssets,
} from "@/lib/videoIngest";
import {
  telegramWebhookSecret,
  isTelegramSenderAllowed,
  telegramFetchFileBytes,
  telegramSendMessage,
  telegramAnswerCallback,
  telegramEditMessageText,
  ensureCallbacksAllowed,
  type TgInlineButton,
} from "@/lib/telegram";
import { getStreamingPlatformsByCategory } from "@/lib/streamingPlatforms";
import { findEditionCandidates } from "@/lib/gameEditionLookup";
import { baseGameTitle } from "@/lib/gameEditions";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024; // Telegram getFile endirmə limiti ~20MB

/**
 * Emal olunmuş `update_id`-lər.
 *
 * ⚠️ TELEGRAM CAVAB GECİKƏNDƏ EYNİ UPDATE-İ TƏKRAR GÖNDƏRİR. Əvvəllər webhook
 * endirmə+çevirməni (dəqiqələr) bitirənə qədər 200 qaytarmırdı, ona görə Telegram
 * təkrar-təkrar göndərir və EYNİ video 8 dəfə emal olunurdu (hər dəfə yeni
 * "Video endirilir..." mesajı + paralel ffmpeg-lər bir-birini boğub vaxt aşımına
 * uğrayırdı). İndi cavab dərhal qaytarılır, bu Set isə hər ehtimala qarşı ikinci
 * müdafiə xəttidir.
 *
 * Proses yenidən başlayanda sıfırlanır — problem deyil, çünki əsas müdafiə sürətli
 * cavabdır.
 */
const seenUpdateIds = new Set<number>();
const SEEN_LIMIT = 1000;

/** `true` → bu update ilk dəfə görülür (emal olunmalıdır). */
function markUpdateSeen(updateId: unknown): boolean {
  if (typeof updateId !== "number") return true; // id yoxdursa süzə bilmirik
  if (seenUpdateIds.has(updateId)) return false;
  seenUpdateIds.add(updateId);
  // Set-i qeyri-məhdud böyütmə — ən köhnəni at.
  if (seenUpdateIds.size > SEEN_LIMIT) {
    const oldest = seenUpdateIds.values().next().value;
    if (oldest !== undefined) seenUpdateIds.delete(oldest);
  }
  return true;
}

/** Eyni chat-da paralel ingest-in qarşısını alır (CPU-nu boğmasın). */
const ingestingChats = new Set<number>();

type TgPhoto = { file_id: string };
type TgMedia = {
  file_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnail?: TgPhoto;
  thumb?: TgPhoto;
};
type TgMessage = {
  message_id?: number;
  chat?: { id: number };
  from?: { id: number };
  caption?: string;
  text?: string;
  video?: TgMedia;
  animation?: TgMedia;
  document?: TgMedia;
};
type TgCallbackQuery = {
  id: string;
  from?: { id: number };
  message?: { message_id?: number; chat?: { id: number } };
  data?: string;
};

function firstUrl(s?: string): string | null {
  if (!s) return null;
  const m = s.match(/https?:\/\/[^\s]+/i);
  return m ? m[0] : null;
}

function hostLabel(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("tiktok")) return "TikTok video";
  if (u.includes("instagram")) return "Instagram video";
  if (u.includes("youtube") || u.includes("youtu.be")) return "YouTube video";
  return "Video";
}

// ─── Callback prefiksləri ────────────────────────────────────────────────────
// callback_data limiti 64 BAYTDIR. cuid = 25 simvol, ona görə:
//   rk|<reelId>|G          → 30 bayt
//   rp|<reelId>|<code>     → ~35 bayt
//   rg|<reelId>|<gameId>   → 54 bayt   ← ən uzunu, hələ də limitin altında
const CB_PREFIX = "rp"; // platforma seçimi (film/serial)
const CB_KIND = "rk"; // "oyun, yoxsa film/serial?"
const CB_GAME = "rg"; // oyun seçimi
const CB_SKIP = "-"; // "platformasız yayımla"

/** `tgStage` dəyəri: bot bu qaralama üçün MƏTNLƏ oyun adı gözləyir. */
const STAGE_GAME_NAME = "GAME_NAME";

/**
 * R2-yə yükləyir + reel-i QARALAMA (isPublished:false) kimi yaradır, sonra
 * "oyun, yoxsa film/serial?" sualını verir. Reel-in özü söhbət state-idir —
 * callback gələndə həmin reel-ə seçim yazılıb yayımlanır.
 */
async function createDraftAndAskKind(
  chatId: number,
  assets: ReelAssets,
  fallbackTitle: string,
  caption: string,
) {
  const rand = Math.random().toString(36).slice(2, 8);
  const videoKey = `reels/${Date.now()}-${rand}.mp4`;
  const videoUrl = await putR2Object(videoKey, assets.videoBuffer, "video/mp4");

  let posterUrl = "";
  if (assets.posterBuffer) {
    const posterKey = `reels/posters/${Date.now()}-${rand}.jpg`;
    posterUrl = await putR2Object(posterKey, assets.posterBuffer, "image/jpeg");
  }

  const firstLine = caption.split("\n")[0]?.trim() ?? "";
  const title = (firstLine || fallbackTitle).slice(0, 120);
  const body = caption.length > firstLine.length ? caption.slice(firstLine.length).trim() : "";

  // Yeni video gəldi → bu chat-da oyun adı gözləyən köhnə qaralama varsa onu
  // sərbəst burax, yoxsa növbəti mətn cavabı hansı reel-ə aid olduğu qeyri-müəyyən olar.
  await clearPendingStage(chatId);

  const reel = await prisma.reel.create({
    data: {
      title,
      caption: body || null,
      videoUrl,
      posterUrl,
      width: assets.width > 0 ? assets.width : 720,
      height: assets.height > 0 ? assets.height : 1280,
      durationMs: assets.durationMs,
      ctaType: "URL",
      isPublished: false, // seçim tamamlanana qədər qaralama
      tgChatId: String(chatId),
    },
    select: { id: true },
  });

  await telegramSendMessage(chatId, "✅ Video hazırdır. Bu nədir?", {
    keyboard: [
      [
        { text: "🎮 Oyun", callback_data: `${CB_KIND}|${reel.id}|G` },
        { text: "🎬 Film / Serial", callback_data: `${CB_KIND}|${reel.id}|S` },
      ],
    ],
  });
}

/** Bu chat-da mətn gözləyən qaralamaları sərbəst buraxır. */
async function clearPendingStage(chatId: number) {
  await prisma.reel
    .updateMany({
      where: { tgChatId: String(chatId), tgStage: STAGE_GAME_NAME },
      data: { tgStage: null },
    })
    .catch(() => {});
}

/** Reel üçün platforma soruşan inline düymələri göndərir. */
async function askPlatform(chatId: number, reelId: string) {
  let platforms: { code: string; label: string }[] = [];
  try {
    const metas = await getStreamingPlatformsByCategory("STREAMING");
    platforms = metas.map((m) => ({ code: m.code, label: m.label }));
  } catch {
    platforms = [];
  }

  const rows: TgInlineButton[][] = [];
  for (let i = 0; i < platforms.length; i += 2) {
    rows.push(
      platforms.slice(i, i + 2).map((p) => ({
        text: p.label,
        callback_data: `${CB_PREFIX}|${reelId}|${p.code}`,
      })),
    );
  }
  rows.push([{ text: "⏭️ Platformasız yayımla", callback_data: `${CB_PREFIX}|${reelId}|${CB_SKIP}` }]);

  await telegramSendMessage(
    chatId,
    "🎬 Bu film/serial hansı platformadadır?",
    { keyboard: rows },
  );
}

/**
 * "🎮 Oyun / 🎬 Film" düyməsi: film seçilsə köhnə platforma axını, oyun seçilsə
 * qaralamanı MƏTN gözləyən hala salıb istifadəçidən oyun adını istəyir.
 */
async function handleKindCallback(cb: TgCallbackQuery) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const parts = (cb.data ?? "").split("|");
  if (parts.length < 3 || chatId == null) {
    await telegramAnswerCallback(cb.id);
    return;
  }
  await telegramAnswerCallback(cb.id); // spinner-i dərhal söndür

  const reelId = parts[1];
  const kind = parts[2];

  if (kind === "S") {
    // Kateqoriya elə burada təyin olunur — bu düymə onsuz da məhz feed ayrımıdır.
    try {
      await prisma.reel.update({ where: { id: reelId }, data: { category: "STREAMING" } });
    } catch {
      if (messageId != null) await telegramEditMessageText(chatId, messageId, "⚠️ Reel tapılmadı.");
      return;
    }
    if (messageId != null) await telegramEditMessageText(chatId, messageId, "🎬 Film / Serial");
    await askPlatform(chatId, reelId);
    return;
  }

  // Oyun: kateqoriyanı yaz + mətn cavabını bu qaralamaya bağla.
  try {
    await prisma.reel.update({
      where: { id: reelId },
      data: { category: "GAME", tgChatId: String(chatId), tgStage: STAGE_GAME_NAME },
    });
  } catch {
    if (messageId != null) await telegramEditMessageText(chatId, messageId, "⚠️ Reel tapılmadı.");
    return;
  }

  if (messageId != null) await telegramEditMessageText(chatId, messageId, "🎮 Oyun");
  await telegramSendMessage(chatId, "🔎 Oyunun adını yaz (məs. “God of War Ragnarök”):");
}

/**
 * Gözləyən qaralama varkən gələn MƏTN — oyun axtarışı.
 *
 * Nəticələr baza başlığa görə təkrarsızlaşdırılır: eyni oyunun 5 sürümü 5 ayrı
 * düymə kimi görünsəydi seçim mənasız olardı — sürümlər onsuz da seçimdən sonra
 * avtomatik əlavə olunur.
 *
 * `true` qaytarsa mesaj bu axımda udulub (video/link kimi emal olunmamalıdır).
 */
async function handleGameNameText(chatId: number, text: string): Promise<boolean> {
  const pending = await prisma.reel.findFirst({
    where: { tgChatId: String(chatId), tgStage: STAGE_GAME_NAME },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!pending) return false;

  const q = text.trim();
  if (q.length < 2) {
    await telegramSendMessage(chatId, "Ən az 2 hərf yaz 🙂");
    return true;
  }

  const rows = await prisma.game.findMany({
    where: { isActive: true, productType: "GAME", title: { contains: q, mode: "insensitive" } },
    orderBy: [{ isFeatured: "desc" }, { title: "asc" }],
    // Sürümlər təkrarsızlaşdırıldıqdan sonra 8 sətir qalsın deyə geniş götür.
    take: 60,
    select: { id: true, title: true, platform: true },
  });

  const seen = new Set<string>();
  const unique: typeof rows = [];
  for (const g of rows) {
    const key = baseGameTitle(g.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(g);
    if (unique.length >= 8) break;
  }

  if (unique.length === 0) {
    await telegramSendMessage(chatId, `“${q}” üzrə oyun tapılmadı. Başqa ad yaz və ya adın bir hissəsini yoxla.`);
    return true;
  }

  await telegramSendMessage(chatId, "Hansı oyundur?", {
    keyboard: unique.map((g) => [
      {
        // Telegram düymə mətni uzun olanda kəsilir — başlığı özümüz qısaldırıq.
        text: `${g.title.slice(0, 50)}${g.platform ? ` · ${g.platform}` : ""}`,
        callback_data: `${CB_GAME}|${pending.id}|${g.id}`,
      },
    ]),
  });
  return true;
}

/**
 * Oyun seçildi: sürümləri avtomatik aşkarlayıb reel-i GAME CTA-sı ilə yayımlayır.
 *
 * Sürümlər burada admin təsdiqi OLMADAN doldurulur (Telegram-da checkbox yoxdur).
 * Qruplaşdırma `scripts/gameEditions.test.ts` ilə kilidlənib, amma yenə də
 * təsdiq mesajında neçə sürüm əlavə olunduğu yazılır ki, admin paneldən yoxlaya bilsin.
 */
async function handleGameCallback(cb: TgCallbackQuery) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const parts = (cb.data ?? "").split("|");
  if (parts.length < 3 || chatId == null) {
    await telegramAnswerCallback(cb.id);
    return;
  }
  await telegramAnswerCallback(cb.id);

  const reelId = parts[1];
  const gameId = parts[2];

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true, store: true, platform: true },
  });
  if (!game) {
    if (messageId != null) await telegramEditMessageText(chatId, messageId, "⚠️ Oyun tapılmadı.");
    return;
  }

  const found = await findEditionCandidates(gameId).catch(() => null);
  const editions = found?.items ?? [];
  const editionIds = editions.map((e) => e.id);
  const cheapest = editions[0] ?? null;
  const isEpic = game.store === "EPIC" || game.platform === "PC";

  try {
    await prisma.reel.update({
      where: { id: reelId },
      data: {
        ctaType: "GAME",
        ctaTargetId: game.id,
        ctaHref: null,
        ctaLabel: "Səbətə at",
        // Seçilən oyun siyahıda yoxdursa (aşkarlama sıfır qaytarıb) heç olmasa
        // onun özü göstərilsin — yoxsa feed-də qiymət paneli boş qalar.
        editionGameIds: editionIds.length > 0 ? editionIds : [game.id],
        platformCode: isEpic ? "EPIC" : "PS",
        platformLabel: isEpic ? "Epic Games" : "PlayStation",
        platformLogoUrl: null,
        isPublished: true,
        tgStage: null,
      },
    });
  } catch {
    if (messageId != null) await telegramEditMessageText(chatId, messageId, "⚠️ Reel tapılmadı — yayımlanmadı.");
    return;
  }

  revalidateReels();
  const priceLine = cheapest ? `\n💰 Ən ucuz: ${cheapest.finalAzn.toFixed(2)} ₼ (${cheapest.editionName})` : "";
  const editionLine =
    editionIds.length > 1
      ? `\n🎯 ${editionIds.length} sürüm əlavə olundu`
      : "\n🎯 Tək sürüm (başqa sürüm tapılmadı)";
  if (messageId != null) {
    await telegramEditMessageText(
      chatId,
      messageId,
      `✅ Yayımlandı — ${game.title}${editionLine}${priceLine}`,
    );
  }
}

/** Platforma düyməsinə basılanda: reel-ə platforma yazır + yayımlayır. */
async function handlePlatformCallback(cb: TgCallbackQuery) {
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const parts = (cb.data ?? "").split("|");
  if (parts[0] !== CB_PREFIX || parts.length < 3 || chatId == null) {
    await telegramAnswerCallback(cb.id);
    return;
  }
  // Spinner-i DƏRHAL söndür. Qalan iş (platforma axtarışı + DB + revalidate) uzun
  // çəksə və ya sınsa belə düymə "ilişib" qalmasın — nəticə aşağıda editMessageText
  // ilə bildirilir.
  await telegramAnswerCallback(cb.id);

  const reelId = parts[1];
  const code = parts[2];

  let platform: { code: string; label: string; logoUrl: string | null } | null = null;
  if (code !== CB_SKIP) {
    try {
      const metas = await getStreamingPlatformsByCategory("STREAMING");
      const m = metas.find((p) => p.code === code);
      if (m) platform = { code: m.code, label: m.label, logoUrl: m.heroImageUrl ?? null };
    } catch {
      /* platforma tapılmadısa platformasız yayımla */
    }
  }

  try {
    await prisma.reel.update({
      where: { id: reelId },
      data: {
        platformCode: platform?.code ?? null,
        platformLabel: platform?.label ?? null,
        platformLogoUrl: platform?.logoUrl ?? null,
        isPublished: true,
        tgStage: null,
      },
    });
  } catch {
    if (messageId != null) {
      await telegramEditMessageText(chatId, messageId, "⚠️ Reel tapılmadı — yayımlanmadı.");
    }
    return;
  }

  revalidateReels();
  if (messageId != null) {
    await telegramEditMessageText(
      chatId,
      messageId,
      platform ? `✅ Yayımlandı — ${platform.label}` : "✅ Yayımlandı (platformasız)",
    );
  }
}

export async function POST(req: Request) {
  const secret = telegramWebhookSecret();
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) return NextResponse.json({ ok: true });
  }

  const update = await req.json().catch(() => null);

  // Təkrar göndərilən update-i at (eyni videonun bir neçə dəfə emalına qarşı
  // ikinci müdafiə xətti — birincisi ağır işi cavab yolundan çıxarmaqdır).
  if (!markUpdateSeen(update?.update_id)) {
    return NextResponse.json({ ok: true });
  }

  // Webhook `callback_query`-siz qeyd olunubsa düymələr HEÇ VAXT bura çatmır —
  // server özünü bir dəfə yoxlayıb bərpa edir (lib/telegram.ts-dəki izaha bax).
  await ensureCallbacksAllowed(`${SITE_URL}/api/telegram/webhook`);

  // ─── Callback (inline düymələr) ───────────────────────────────────────────
  const cb: TgCallbackQuery | undefined = update?.callback_query;
  if (cb) {
    const cbChat = cb.message?.chat?.id;
    if (cbChat != null && isTelegramSenderAllowed(cb.from?.id, cbChat)) {
      // Callback budağının öz try/catch-i var (aşağıdakı böyük try yalnız mesaj
      // axını üçündür) — burada sınsa düymə cavabsız qalmasın.
      try {
        const kind = (cb.data ?? "").split("|")[0];
        if (kind === CB_KIND) await handleKindCallback(cb);
        else if (kind === CB_GAME) await handleGameCallback(cb);
        else await handlePlatformCallback(cb);
      } catch {
        await telegramAnswerCallback(cb.id, "Xəta baş verdi");
      }
    } else {
      await telegramAnswerCallback(cb.id);
    }
    return NextResponse.json({ ok: true });
  }

  const msg: TgMessage | undefined = update?.message ?? update?.channel_post;
  const chatId = msg?.chat?.id;
  if (!msg || chatId == null) return NextResponse.json({ ok: true });

  if (!isTelegramSenderAllowed(msg.from?.id, chatId)) {
    await telegramSendMessage(
      chatId,
      `Bu botla reel əlavə etməyə icazən yoxdur.\nSənin ID: ${msg.from?.id ?? chatId}`,
    );
    return NextResponse.json({ ok: true });
  }

  if (!isR2Configured()) {
    await telegramSendMessage(chatId, "Server konfiqurasiyası natamamdır (R2 qurulmayıb).");
    return NextResponse.json({ ok: true });
  }

  const media: TgMedia | undefined =
    msg.video ??
    msg.animation ??
    (msg.document && (msg.document.mime_type ?? "").startsWith("video/") ? msg.document : undefined);
  const url = media ? null : firstUrl(msg.text) ?? firstUrl(msg.caption);

  // Sadə mətn (video yox, link yox) — bot oyun adı gözləyirsə axtarış kimi oxu.
  // Sıra vacibdir: video/link həmişə YENİ qaralama başladır, ona görə onlar öndədir.
  if (!media && !url) {
    const text = (msg.text ?? "").trim();
    if (text && (await handleGameNameText(chatId, text))) {
      return NextResponse.json({ ok: true });
    }
    await telegramSendMessage(chatId, "Video faylı və ya TikTok/Instagram linki göndər 🎬");
    return NextResponse.json({ ok: true });
  }

  // ─── Ağır ingest — CAVAB YOLUNDAN KƏNARDA ─────────────────────────────────
  // Endirmə + çevirmə dəqiqələr çəkir. Telegram-a 200 dərhal qaytarılmasa o,
  // eyni update-i təkrar göndərir və video təkrar-təkrar emal olunur.
  if (ingestingChats.has(chatId)) {
    await telegramSendMessage(chatId, "⏳ Əvvəlki video hələ emal olunur, bir az gözlə.");
    return NextResponse.json({ ok: true });
  }
  ingestingChats.add(chatId);
  void runIngest(chatId, msg, media, url).finally(() => ingestingChats.delete(chatId));
  return NextResponse.json({ ok: true });
}

/**
 * Videonu endirir/emal edir və qaralama yaradır. Webhook cavabından SONRA, fon
 * rejimində işləyir (`next start` uzunömürlü Node prosesidir, ona görə cavabdan
 * sonra da davam edir).
 */
async function runIngest(
  chatId: number,
  msg: TgMessage,
  media: TgMedia | undefined,
  url: string | null,
) {
  const bins = await checkIngestBinaries();

  try {
    // ─── Link (TikTok/Instagram/...) — yt-dlp + ffmpeg lazımdır ──────────────
    if (url) {
      if (!bins.ytdlp || !bins.ffmpeg) {
        await telegramSendMessage(
          chatId,
          "Link-dən endirmə üçün server hazır deyil (ffmpeg/yt-dlp quraşdırılmalıdır).",
        );
        return;
      }
      await telegramSendMessage(chatId, "⏳ Video endirilir və emal olunur...");
      const assets = await ingestFromUrl(url);
      await createDraftAndAskKind(chatId, assets, hostLabel(url), (msg.caption ?? "").trim());
      return;
    }

    // ─── Telegram video faylı ───────────────────────────────────────────────
    if (media!.file_size && media!.file_size > MAX_BYTES) {
      await telegramSendMessage(
        chatId,
        `Video çox böyükdür (${(media!.file_size / 1024 / 1024).toFixed(1)}MB). Telegram limiti ~20MB.`,
      );
      return;
    }
    const bytes = await telegramFetchFileBytes(media!.file_id);
    if (!bytes) {
      await telegramSendMessage(chatId, "Videonu endirə bilmədim (20MB-dan böyük ola bilər).");
      return;
    }

    if (bins.ffmpeg) {
      // ffmpeg var → faststart + poster (ən yaxşı nəticə).
      const ext = (media!.mime_type ?? "").includes("webm") ? "webm" : "mp4";
      const assets = await ingestFromBytes(bytes, ext);
      await createDraftAndAskKind(chatId, assets, "Reels video", (msg.caption ?? "").trim());
      return;
    }

    // ffmpeg yoxdur → xam yüklə (codec yoxlaması + Telegram thumbnail poster).
    const codec = detectFourccFromBytes(bytes);
    if (codec.isHevc) {
      await telegramSendMessage(
        chatId,
        "Bu video H.265/HEVC formatındadır — brauzerlər oynatmır. H.264 (MP4) göndər.",
      );
      return;
    }
    let posterBuffer: Buffer | null = null;
    const thumbId = media!.thumbnail?.file_id ?? media!.thumb?.file_id;
    if (thumbId) posterBuffer = await telegramFetchFileBytes(thumbId);
    await createDraftAndAskKind(
      chatId,
      {
        videoBuffer: bytes,
        posterBuffer,
        width: media!.width ?? 720,
        height: media!.height ?? 1280,
        durationMs: media!.duration ? Math.round(media!.duration * 1000) : 0,
      },
      "Reels video",
      (msg.caption ?? "").trim(),
    );
  } catch (err) {
    const m = err instanceof Error ? err.message : "naməlum xəta";
    await telegramSendMessage(chatId, `Reel əlavə olunmadı: ${m}`);
  }
}
