import { prisma } from "@/lib/prisma";
import FaqAdminClient from "./FaqAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  const faqs = await prisma.faqItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">FAQ</h1>
        <p className="text-sm text-zinc-400">
          “Tez-tez verilən suallar” bölməsini buradan yenilə.
        </p>
      </div>

      <FaqAdminClient initialFaqs={faqs} />
    </div>
  );
}

