"use client";

import { useSession } from "./SessionProvider";
import HomeReviewModal from "./HomeReviewModal";

/**
 * "Rəy yaz" düyməsi — daxil olmuş HƏR istifadəçiyə görünür. Alışı olmayan da
 * rəy yaza bilər (ümumi rəy), sadəcə cashback qazanmır; ona görə `hasPurchases`
 * yalnız düymə/mətnin cashback vədini idarə edir, girişi bağlamır.
 *
 * User-vəziyyəti `useSession()` (client) ilə gəlir ki, HomeTestimonials server
 * komponenti `getCurrentUser()` (cookies) çağırmasın və ana səhifə statik qalsın.
 */
export default function HomeReviewCta() {
  const { user } = useSession();
  if (!user) return null;

  return (
    <div className="mb-8 flex justify-center">
      <HomeReviewModal defaultName={user.name ?? ""} hasPurchases={user.hasPurchases} />
    </div>
  );
}
