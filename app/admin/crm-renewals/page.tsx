import CrmRenewalsAdminClient from "./CrmRenewalsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminCrmRenewalsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">CRM abunəlik yeniləmələri</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Müştərilərin <strong>honsell.site/abunelik</strong>-dən kartla ödəyib yenilədiyi CRM abunəlikləri (Netflix
          kabinetləri, Spotify/YouTube Family, Netflix/Spotify Individual, PS Plus). Ödəniş təsdiqlənən kimi CRM-ə gedir:
          kabinet və Family dərhal uzanır; Individual-lar vendor Done edəndə, PS Plus isə CRM-də uzadılanda avtomatik
          «Tamamlandı» olur.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          «Uğursuz» sifarişdə müştəriyə pul qaytarılmalıdır — «Cüzdana qaytar» CRM qiymətini cüzdana yazır (bir dəfə).
          Kart geri ödənişi lazımdırsa Epoint kabinetindən edin.
        </p>
      </div>
      <CrmRenewalsAdminClient />
    </div>
  );
}
