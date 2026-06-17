import WebsitePricingConfigAdminClient from "./WebsitePricingConfigAdminClient";

export const dynamic = "force-dynamic";

export default function AdminWebsitePricingConfigPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Website Xidməti — AI Qiymət Konfiqurasiyası
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hər sayt növü üçün baza qiymət aralığını və AI üçün əlavə qaydaları
          təyin edin. AI bu aralıqdan kənara çıxa bilmir — yalnız müştərinin
          briefinə görə əmsal tətbiq edir.
        </p>
      </div>
      <WebsitePricingConfigAdminClient />
    </div>
  );
}
