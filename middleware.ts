import { NextResponse, type NextRequest } from "next/server";
import { REVIEW_AFFILIATE_COOKIE } from "@/lib/reviewAffiliateConstants";
import { PLAYSTATION_ONLY, SPOTIFY_STORE_PATH, isOpenStorePath } from "@/lib/storeScope";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün

/**
 * Satılmayan kateqoriyaların səhifələri (lib/storeScope.ts → `CLOSED_PATH_PREFIXES`).
 * Naviqasiyadan keçid yoxdur, amma Google-dan/köhnə linkdən gələn müştəri məhsulu səbətə
 * atırdı və səbət onu səssizcə silirdi. İndi bu yollar oxşar açıq səhifəyə gedir.
 *
 * ⚠️ `/streaming/<xidmət>` burada DEYİL — açıq olub-olmaması DB-dən (admin "Saytda satılır")
 * asılıdır, onu səhifənin özü yoxlayır (`isStreamingSlugOpen`). Film kataloqu
 * (`/streaming/katalog`, `filmler`, `seriallar`) satış səhifəsi deyil — İcmallar ona keçid verir.
 *
 * 307 (müvəqqəti): əhatə `NEXT_PUBLIC_STORE_SCOPE=ALL` ilə geri açıla bilər, brauzer
 * daimi yönləndirməni keşləyib saxlamasın.
 */
const CLOSED_PAGE_TARGETS: Array<{ prefix: string; target: string }> = [
  { prefix: "/music", target: SPOTIFY_STORE_PATH },
  { prefix: "/hediyye-kartlari/honsell", target: "/hediyye-kartlari" },
  { prefix: "/work", target: "/" },
  { prefix: "/is-platformalari", target: "/" },
  { prefix: "/pubg-uc", target: "/" },
  { prefix: "/point-blank", target: "/" },
];

function closedPageTarget(pathname: string): string | null {
  if (!PLAYSTATION_ONLY) return null;
  // `/streaming` indeksi bağlıdır; alt yolları səhifələr özü həll edir (yuxarıdakı qeyd).
  if (pathname === "/streaming" || pathname === "/streaming/") return "/streaming/netflix";
  if (pathname.startsWith("/streaming/")) return null;
  if (pathname === "/is-platformalari") return "/";
  if (isOpenStorePath(pathname)) return null;
  const hit = CLOSED_PAGE_TARGETS.find(
    (c) => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`),
  );
  return hit?.target ?? null;
}

/**
 * `/oyunlar/...?via=<reviewId>` URL-i ilə açılan istəklərdə rəy affiliate
 * ID-sini HTTP-only cookie-yə yazır. Cookie sonradan checkout-da oxunur və
 * SUCCESS olan alış üçün rəy müəllifinə komissiya yazılır (lib/reviewAffiliate.ts).
 *
 * `revalidate` ilə cache olunan səhifə cookie-ləri özü qura bilmir; ona görə
 * bu işi middleware görür. Eyni request-də Server Component köhnə cookie-ni
 * görəcək (problem deyil — komissiya növbəti checkout-dan baxılır).
 */
export function middleware(req: NextRequest) {
  const closedTarget = closedPageTarget(req.nextUrl.pathname);
  if (closedTarget) {
    const url = req.nextUrl.clone();
    url.pathname = closedTarget;
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  const via = req.nextUrl.searchParams.get("via");
  if (!via) return NextResponse.next();

  const trimmed = via.trim();
  if (
    trimmed.length < 8 ||
    trimmed.length > 64 ||
    !/^[a-z0-9]+$/i.test(trimmed)
  ) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  res.cookies.set(REVIEW_AFFILIATE_COOKIE, trimmed, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

export const config = {
  matcher: [
    "/oyunlar/:path*",
    "/music",
    "/music/:path*",
    "/work",
    "/work/:path*",
    "/is-platformalari",
    "/pubg-uc",
    "/point-blank",
    "/hediyye-kartlari/honsell",
    "/streaming",
  ],
};
