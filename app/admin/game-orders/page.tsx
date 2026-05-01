import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import GameOrdersAdminClient from "./GameOrdersAdminClient";

export const dynamic = "force-dynamic";

export default async function GameOrdersAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/game-orders");
  if (user.role !== "ADMIN") redirect("/");
  return <GameOrdersAdminClient />;
}
