"use client";

import { useSession } from "./SessionProvider";
import HomeReviewModal from "./HomeReviewModal";

/**
 * "Rəy yaz" düyməsi — yalnız ən azı bir uğurlu alışı olan istifadəçiyə görünür.
 * User-vəziyyəti `useSession()` (client) ilə gəlir ki, HomeTestimonials server
 * komponenti `getCurrentUser()` (cookies) çağırmasın və ana səhifə statik qalsın.
 */
export default function HomeReviewCta() {
  const { user } = useSession();
  if (!user || !user.hasPurchases) return null;

  return (
    <div className="mb-8 flex justify-center">
      <HomeReviewModal defaultName={user.name ?? ""} />
    </div>
  );
}
