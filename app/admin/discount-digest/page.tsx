import DiscountDigestClient from "./DiscountDigestClient";

export const dynamic = "force-dynamic";

export default function AdminDiscountDigestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Endirim Bülleteni</h1>
        <p className="mt-1 text-sm text-zinc-600">
          PlayStation Store-da son 7 gündə endirimə düşən oyunları aktiv
          müştərilərə həftəlik e-poçt kimi yollayır. Hər həftə avtomatik (cron)
          göndərilir; buradan önizləyə və ya əl ilə indi göndərə bilərsən. Eyni
          həftədə bir müştəriyə təkrar getmir.
        </p>
      </div>
      <DiscountDigestClient />
    </div>
  );
}
