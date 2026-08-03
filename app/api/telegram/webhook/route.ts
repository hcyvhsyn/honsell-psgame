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
  type TgInlineButton,
} from "@/lib/telegram";
import { getStreamingPlatformsByCategory } from "@/lib/streamingPlatforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024; // Telegram getFile endirmə limiti ~20MB

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

const CB_PREFIX = "rp"; // reel-platform callback
const CB_SKIP = "-"; // "platformasız yayımla"

/**
 * R2-yə yükləyir + reel-i QARALAMA (isPublished:false) kimi yaradır, sonra
 * platforma soruşan düymələr göndərir. Reel-in özü söhbət state-idir — callback
 * gələndə həmin reel-ə platforma yazılıb yayımlanır.
 */
async function createDraftAndAskPlatform(
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
      isPublished: false, // platforma seçilənə qədər qaralama
    },
    select: { id: true },
  });

  await askPlatform(chatId, reel.id);
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

  // ─── Callback (platforma düyməsi) ─────────────────────────────────────────
  const cb: TgCallbackQuery | undefined = update?.callback_query;
  if (cb) {
    const cbChat = cb.message?.chat?.id;
    if (cbChat != null && isTelegramSenderAllowed(cb.from?.id, cbChat)) {
      // Callback budağının öz try/catch-i var (aşağıdakı böyük try yalnız mesaj
      // axını üçündür) — burada sınsa düymə cavabsız qalmasın.
      try {
        await handlePlatformCallback(cb);
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

  if (!media && !url) {
    await telegramSendMessage(chatId, "Video faylı və ya TikTok/Instagram linki göndər 🎬");
    return NextResponse.json({ ok: true });
  }

  const bins = await checkIngestBinaries();

  try {
    // ─── Link (TikTok/Instagram/...) — yt-dlp + ffmpeg lazımdır ──────────────
    if (url) {
      if (!bins.ytdlp || !bins.ffmpeg) {
        await telegramSendMessage(
          chatId,
          "Link-dən endirmə üçün server hazır deyil (ffmpeg/yt-dlp quraşdırılmalıdır).",
        );
        return NextResponse.json({ ok: true });
      }
      await telegramSendMessage(chatId, "⏳ Video endirilir və emal olunur...");
      const assets = await ingestFromUrl(url);
      await createDraftAndAskPlatform(chatId, assets, hostLabel(url), (msg.caption ?? "").trim());
      return NextResponse.json({ ok: true });
    }

    // ─── Telegram video faylı ───────────────────────────────────────────────
    if (media!.file_size && media!.file_size > MAX_BYTES) {
      await telegramSendMessage(
        chatId,
        `Video çox böyükdür (${(media!.file_size / 1024 / 1024).toFixed(1)}MB). Telegram limiti ~20MB.`,
      );
      return NextResponse.json({ ok: true });
    }
    const bytes = await telegramFetchFileBytes(media!.file_id);
    if (!bytes) {
      await telegramSendMessage(chatId, "Videonu endirə bilmədim (20MB-dan böyük ola bilər).");
      return NextResponse.json({ ok: true });
    }

    if (bins.ffmpeg) {
      // ffmpeg var → faststart + poster (ən yaxşı nəticə).
      const ext = (media!.mime_type ?? "").includes("webm") ? "webm" : "mp4";
      const assets = await ingestFromBytes(bytes, ext);
      await createDraftAndAskPlatform(chatId, assets, "Reels video", (msg.caption ?? "").trim());
      return NextResponse.json({ ok: true });
    }

    // ffmpeg yoxdur → xam yüklə (codec yoxlaması + Telegram thumbnail poster).
    const codec = detectFourccFromBytes(bytes);
    if (codec.isHevc) {
      await telegramSendMessage(
        chatId,
        "Bu video H.265/HEVC formatındadır — brauzerlər oynatmır. H.264 (MP4) göndər.",
      );
      return NextResponse.json({ ok: true });
    }
    let posterBuffer: Buffer | null = null;
    const thumbId = media!.thumbnail?.file_id ?? media!.thumb?.file_id;
    if (thumbId) posterBuffer = await telegramFetchFileBytes(thumbId);
    await createDraftAndAskPlatform(
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    const m = err instanceof Error ? err.message : "naməlum xəta";
    await telegramSendMessage(chatId, `Reel əlavə olunmadı: ${m}`);
    return NextResponse.json({ ok: true });
  }
}
