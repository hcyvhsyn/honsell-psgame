import InGameCreditAdminClient from "@/components/admin/InGameCreditAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPubgUcPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">PUBG UC</h1>
        <p className="mt-1 text-sm text-zinc-600">
          PUBG Mobile UC denominasiyalarını idarə edin. Gözləyən sifarişlər aşağıda görünür və kod təyini Phase 2-də əlavə ediləcək.
        </p>
      </div>
      <InGameCreditAdminClient
        type="PUBG_UC"
        currencyLabel="UC"
        productNoun="UC paketi"
        recommendedImageSize="1200×600 px (2:1)"
        supportsBynogameImport
      />
    </div>
  );
}
