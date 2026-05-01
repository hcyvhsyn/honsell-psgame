import BannersAdminClient from "./BannersAdminClient";

export const dynamic = "force-dynamic";

export default function AdminBannersPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Bannerlər</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ana səhifənin hero bölməsindəki bannerleri idarə edin. Şəkillər avtomatik sürüşür.
        </p>
      </div>
      <BannersAdminClient />
    </div>
  );
}
