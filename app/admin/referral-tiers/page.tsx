import { prisma } from "@/lib/prisma";
import ReferralTiersAdminClient from "./ReferralTiersAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminReferralTiersPage() {
  const tiers = await prisma.referralTier.findMany({
    orderBy: [{ position: "asc" }, { thresholdPoints: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pilləli mükafatlar</h1>
        <p className="text-sm text-zinc-400">
          Hər ay sıfırlanan referal yarışındakı pillələri buradan idarə et. Bal sistemi:{" "}
          <strong>1 dəvət = 10 bal</strong>, <strong>1 AZN xərc = 1 bal</strong>. Pilləyə
          çatdıqda bonus avtomatik referal balansına yazılır.
        </p>
      </div>

      <ReferralTiersAdminClient initialTiers={tiers} />
    </div>
  );
}
