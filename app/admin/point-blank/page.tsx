import InGameCreditAdminClient from "@/components/admin/InGameCreditAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPointBlankPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Point Blank TG</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Point Blank TG (turqid/coin) denominasiyalarını idarə edin. Gözləyən sifarişlər aşağıda görünür və kod təyini Phase 2-də əlavə ediləcək.
        </p>
      </div>
      <InGameCreditAdminClient
        type="POINT_BLANK_TG"
        currencyLabel="TG"
        productNoun="TG paketi"
        recommendedImageSize="1200×600 px (2:1)"
      />
    </div>
  );
}
