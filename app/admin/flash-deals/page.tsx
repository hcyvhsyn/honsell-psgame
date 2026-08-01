import FlashDealsAdminClient from "./FlashDealsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminFlashDealsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Fürsətləri qaçırma</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ana səhifədəki kampaniya karuselinə əl ilə oyun seç. Qiymət və bitmə tarixi boş qalarsa
          kataloqdakı avtomatik dəyərlər işləyir; yazılan kampaniya qiyməti həm vitrində, həm də
          ödənişdə tətbiq olunur.
        </p>
      </div>
      <FlashDealsAdminClient />
    </div>
  );
}
