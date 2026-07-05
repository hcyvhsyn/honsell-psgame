import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isR2Configured, putR2Object } from "@/lib/r2";
import { revalidateReels } from "@/lib/revalidate";
import { detectFourccFromBytes } from "@/lib/videoFourcc";
import {
  telegramWebhookSecret,
  isTelegramSenderAllowed,
  telegramFetchFileBytes,
  telegramSendMessage,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // Telegram getFile endirmə limiti ~20MB

type TgPhoto = { file_id: string };
type TgMedia = {
  file_id: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number; // saniyə
  thumbnail?: TgPhoto;
  thumb?: TgPhoto;
};
type TgMessage = {
  chat?: { id: number };
  from?: { id: number };
  caption?: string;
  video?: TgMedia;
  animation?: TgMedia;
  document?: TgMedia;
  text?: string;
};

/**
 * Telegram → Reels ingest. Bota (və ya icazəli qrupa) video göndərildikdə
 * avtomatik R2-yə yüklənir və /reels-də dərhal yayımlanır (qaralama deyil).
 */
export async function POST(req: Request) {
  // 1) Webhook mənbəyini yoxla (secret token header).
  const secret = telegramWebhookSecret();
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) return NextResponse.json({ ok: true }); // spoof — səssizcə keç
  }

  const update = await req.json().catch(() => null);
  const msg: TgMessage | undefined = update?.message ?? update?.channel_post;
  const chatId = msg?.chat?.id;
  if (!msg || chatId == null) return NextResponse.json({ ok: true });

  // 2) Göndərən icazəlidirmi?
  if (!isTelegramSenderAllowed(msg.from?.id, chatId)) {
    await telegramSendMessage(
      chatId,
      `Bu botla reel əlavə etməyə icazən yoxdur.\nSənin ID: ${msg.from?.id ?? chatId}\n(Admin bunu TELEGRAM_ALLOWED_IDS-ə əlavə etməlidir.)`,
    );
    return NextResponse.json({ ok: true });
  }

  // 3) Media obyektini tap (video / animation / video-document).
  const media: TgMedia | undefined =
    msg.video ??
    msg.animation ??
    (msg.document && (msg.document.mime_type ?? "").startsWith("video/") ? msg.document : undefined);

  if (!media) {
    await telegramSendMessage(chatId, "Reel əlavə etmək üçün bir video göndər 🎬");
    return NextResponse.json({ ok: true });
  }

  if (!isR2Configured()) {
    await telegramSendMessage(chatId, "Server konfiqurasiyası natamamdır (R2 qurulmayıb).");
    return NextResponse.json({ ok: true });
  }

  try {
    if (media.file_size && media.file_size > MAX_BYTES) {
      await telegramSendMessage(
        chatId,
        `Video çox böyükdür (${(media.file_size / 1024 / 1024).toFixed(1)}MB). Telegram limiti ~20MB — sıxıb göndər.`,
      );
      return NextResponse.json({ ok: true });
    }

    const bytes = await telegramFetchFileBytes(media.file_id);
    if (!bytes) {
      await telegramSendMessage(chatId, "Videonu endirə bilmədim. 20MB-dan böyükdürsə, sıxıb göndər.");
      return NextResponse.json({ ok: true });
    }

    // 4) Codec: H.265/HEVC brauzerdə oynamır — blokla.
    const codec = detectFourccFromBytes(bytes);
    if (codec.isHevc) {
      await telegramSendMessage(
        chatId,
        "Bu video H.265/HEVC formatındadır — brauzerlər oynatmır. H.264 (MP4) formatına çevirib göndər.",
      );
      return NextResponse.json({ ok: true });
    }

    const ext = (media.mime_type ?? "").includes("webm") ? "webm" : "mp4";
    const contentType = ext === "webm" ? "video/webm" : "video/mp4";
    const rand = Math.random().toString(36).slice(2, 8);
    const videoKey = `reels/${Date.now()}-${rand}.${ext}`;
    const videoUrl = await putR2Object(videoKey, bytes, contentType);

    // 5) Poster — Telegram videonun thumbnail-indən (ffmpeg-siz).
    let posterUrl = "";
    const thumbId = media.thumbnail?.file_id ?? media.thumb?.file_id;
    if (thumbId) {
      const thumbBytes = await telegramFetchFileBytes(thumbId);
      if (thumbBytes) {
        const posterKey = `reels/posters/${Date.now()}-${rand}.jpg`;
        posterUrl = await putR2Object(posterKey, thumbBytes, "image/jpeg");
      }
    }

    // 6) Başlıq/caption — mesaj caption-ından.
    const caption = (msg.caption ?? "").trim();
    const firstLine = caption.split("\n")[0]?.trim() ?? "";
    const title = (firstLine || "Reels video").slice(0, 120);
    const body = caption.length > firstLine.length ? caption.slice(firstLine.length).trim() : "";

    await prisma.reel.create({
      data: {
        title,
        caption: body || null,
        videoUrl,
        posterUrl,
        width: media.width && media.width > 0 ? media.width : 720,
        height: media.height && media.height > 0 ? media.height : 1280,
        durationMs: media.duration && media.duration > 0 ? Math.round(media.duration * 1000) : 0,
        ctaType: "URL",
        isPublished: true,
      },
    });
    revalidateReels();

    await telegramSendMessage(chatId, `✅ Reel yayımlandı: “${title}”. Admin paneldən CTA/platforma əlavə edə bilərsən.`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const m = err instanceof Error ? err.message : "naməlum xəta";
    await telegramSendMessage(chatId, `Reel əlavə olunmadı: ${m}`);
    return NextResponse.json({ ok: true });
  }
}
