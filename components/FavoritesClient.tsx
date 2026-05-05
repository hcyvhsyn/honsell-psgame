"use client";

import { FavoritesProvider } from "@/lib/favorites";
import { useModals } from "@/lib/modals";

export default function FavoritesClient({
  isAuthed,
  initialIds,
  children,
}: {
  isAuthed: boolean;
  initialIds: string[];
  children: React.ReactNode;
}) {
  const { open } = useModals();
  return (
    <FavoritesProvider
      initialAuthed={isAuthed}
      initialIds={initialIds}
      onUnauthorized={() => open("login")}
    >
      {children}
    </FavoritesProvider>
  );
}
