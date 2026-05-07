import { NextResponse, type NextRequest } from "next/server";
import { REVIEW_AFFILIATE_COOKIE } from "@/lib/reviewAffiliateConstants";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün

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
  matcher: ["/oyunlar/:path*"],
};
