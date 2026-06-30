"use client";

import { FavoritesProvider } from "@/lib/favorites";
import { useModals } from "@/lib/modals";
import { useSession } from "./SessionProvider";

export default function FavoritesClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { open } = useModals();
  // Auth vəziyyəti client-də sessiyadan gəlir (layout statik qalsın deyə).
  // Sessiya yüklənib `user` təyin olanda FavoritesProvider /api/favorites-i
  // mount-effektində avtomatik çəkir.
  const { user } = useSession();

  return (
    <FavoritesProvider
      initialAuthed={Boolean(user)}
      initialIds={[]}
      onUnauthorized={() => open("login")}
    >
      {children}
    </FavoritesProvider>
  );
}
