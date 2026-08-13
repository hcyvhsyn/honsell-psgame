import PriceWatchAdminClient from "./PriceWatchAdminClient";

export const dynamic = "force-dynamic";

export default function AdminPriceWatchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Qiymət güdmə</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Oyunla maraqlanan, amma qiyməti baha görüb almayan müştərilər üçün. Nömrəsini
          və istədiyi oyunu qeyd et — oyun <strong>endirimə düşən kimi</strong> ona
          avtomatik WhatsApp mesajı gedir. Yoxlama hər scrape işində (qiymət yenilənməsi)
          aparılır; ayrıca bir şey etmək lazım deyil.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Oyun tam qiymətə qayıdıb yenidən endirimə düşsə müştəri yeni mesaj alır. Eyni
          endirim dalğasında təkrar mesaj getmir. Müştərinin hesabı olmasına ehtiyac
          yoxdur — yalnız nömrə kifayətdir.
        </p>
      </div>
      <PriceWatchAdminClient />
    </div>
  );
}
