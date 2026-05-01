import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import OrdersAdminClient from "./OrdersAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/orders");
  if (user.role !== "ADMIN") redirect("/");
  return <OrdersAdminClient />;
}

