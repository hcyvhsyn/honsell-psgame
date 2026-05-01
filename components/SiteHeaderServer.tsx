import { getCurrentUser } from "@/lib/auth";
import SiteHeader from "./SiteHeader";

export default async function SiteHeaderServer() {
  const user = await getCurrentUser();
  return (
    <SiteHeader
      user={
        user
          ? {
              name: user.name,
              walletBalance: user.walletBalance,
              cashbackBalanceCents: user.cashbackBalanceCents ?? 0,
            }
          : null
      }
    />
  );
}
