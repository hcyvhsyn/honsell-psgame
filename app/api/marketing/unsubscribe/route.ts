import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/marketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endirim bülleteni unsubscribe — e-poçt footer-indəki linkdən gəlir.
 * Login tələb etmir: imzalı token (HMAC(userId)) yoxlanılır, sonra
 * marketingUnsubscribedAt qeyd olunur. Əməliyyat e-poçtları təsirlənmir.
 */
function page(title: string, message: string, ok: boolean): Response {
  const accent = ok ? "#10b981" : "#e11d48";
  const html = `<!doctype html><html lang="az"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7">
  <div style="max-width:480px;margin:64px auto;padding:0 20px;text-align:center">
    <div style="background:#111114;border:1px solid #27272a;border-radius:16px;padding:32px">
      <div style="font-size:40px;margin-bottom:12px">${ok ? "✅" : "⚠️"}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:${accent}">${title}</h1>
      <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6">${message}</p>
      <a href="https://honsell.store" style="display:inline-block;margin-top:24px;color:#a1a1aa;font-size:13px">honsell.store</a>
    </div>
  </div>
</body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";

  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return page(
      "Keçərsiz link",
      "Bu abunəlikdən çıxma linki etibarsızdır və ya müddəti bitib.",
      false
    );
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { marketingUnsubscribedAt: new Date() },
    });
  } catch {
    return page(
      "Xəta baş verdi",
      "Sorğunuz emal edilə bilmədi. Zəhmət olmasa sonra yenidən cəhd edin.",
      false
    );
  }

  return page(
    "Abunəlikdən çıxdınız",
    "Artıq endirim bültenləri almayacaqsınız. Sifariş və hesab bildirişləri davam edəcək.",
    true
  );
}
