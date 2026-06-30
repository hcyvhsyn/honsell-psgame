import FavoritesClient from "./FavoritesClient";

/**
 * Əvvəl burada `getCurrentUser()` (cookies) çağırılırdı → ROOT LAYOUT dinamik
 * olub BÜTÜN səhifələri `no-store` edirdi (saytın ən böyük yavaşlıq səbəbi).
 * İndi favorit vəziyyəti tamamilə client-dədir: auth `useSession()`-dan, id-lər
 * isə FavoritesProvider-in mount-da etdiyi `/api/favorites` fetch-indən gəlir.
 * Beləcə layout (və bütün səhifələr) statik/edge-keşlənən qala bilir.
 */
export default function FavoritesBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FavoritesClient>{children}</FavoritesClient>;
}
