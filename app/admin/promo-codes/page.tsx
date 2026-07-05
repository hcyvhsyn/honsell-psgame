import PromoCodesAdminClient from "./PromoCodesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPromoCodesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Endirim kodları</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Səbətdə tətbiq olunan kupon kodları. Faiz (%) və ya sabit (AZN) endirim,
          minimum sifariş, məhsul növü (scope), istifadə limitləri və tarix aralığı
          təyin edə bilərsiniz. Bonus mükafatı kuponları (10%) checkout-da avtomatik
          yaranır — onlar burada da görünür.
        </p>
      </div>
      <PromoCodesAdminClient />
    </div>
  );
}
