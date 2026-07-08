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
} from "@/lib/telegram";

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
  chat?: { id: number };
  from?: { id: number };
  caption?: string;
  text?: string;
  video?: TgMedia;
  animation?: TgMedia;
  document?: TgMedia;
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

/** R2-yə yükləyir + reel yaradır + Telegram-a cavab yazır. */
async function publishReel(
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

  await prisma.reel.create({
    data: {
      title,
      caption: body || null,
      videoUrl,
      posterUrl,
      width: assets.width > 0 ? assets.width : 720,
      height: assets.height > 0 ? assets.height : 1280,
      durationMs: assets.durationMs,
      ctaType: "URL",
      isPublished: true,
    },
  });
  revalidateReels();
  await telegramSendMessage(chatId, `✅ Reel yayımlandı: “${title}”.`);
}

export async function POST(req: Request) {
  const secret = telegramWebhookSecret();
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) return NextResponse.json({ ok: true });
  }

  const update = await req.json().catch(() => null);
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
      await publishReel(chatId, assets, hostLabel(url), (msg.caption ?? "").trim());
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
      await publishReel(chatId, assets, "Reels video", (msg.caption ?? "").trim());
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
    await publishReel(
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
