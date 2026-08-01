import LootBoxesAdminClient from "./LootBoxesAdminClient";

export const dynamic = "force-dynamic";

export default function LootBoxesAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-admin-fg">Qutu açılışı</h1>
        <p className="mt-1 max-w-3xl text-sm text-admin-muted">
          Müştəri sabit qiymətə qutu alır və içindən təsadüfi bir oyun çıxır. Mənfəət təsadüfə
          buraxılmır: hovuz yaradılmadan əvvəl bütün biletlərin mayası yoxlanır və maya büdcəsi
          aşılırsa hovuz <strong>ümumiyyətlə yaradılmır</strong>. Biletlər geri qoyulmadan
          çəkildiyi üçün hovuz bitəndə faktiki maya planlaşdırılanla bərabər olur — yəni marja
          riyazi zəmanətlidir.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-admin-muted">
          İş qaydası: <strong>1)</strong> qutu yarat → <strong>2)</strong> reseptə oyunlar və bilet
          saylarını əlavə et → <strong>3)</strong> kalkulyator yaşıl olanda hovuz yarat →{" "}
          <strong>4)</strong> qutunu aktivləşdir.
        </p>
      </div>
      <LootBoxesAdminClient />
    </div>
  );
}
