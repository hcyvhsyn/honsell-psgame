import ServicesAdminClient from "./ServicesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminServicesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Xidmətlər & Kodlar</h1>
        <p className="mt-1 text-sm text-zinc-400">
          PS Plus, TRY Balans və Hesab açılışı qiymətlərini / stok kodlarını idarə edin.
        </p>
      </div>
      <ServicesAdminClient />
    </div>
  );
}
