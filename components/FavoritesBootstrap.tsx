import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FavoritesClient from "./FavoritesClient";

export default async function FavoritesBootstrap({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  let ids: string[] = [];
  if (user) {
    const rows = await prisma.favorite.findMany({
      where: { userId: user.id },
      select: { gameId: true },
    });
    ids = rows.map((r) => r.gameId);
  }
  return (
    <FavoritesClient isAuthed={Boolean(user)} initialIds={ids}>
      {children}
    </FavoritesClient>
  );
}
