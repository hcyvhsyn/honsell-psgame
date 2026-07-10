import GiveawaysAdminClient from "./GiveawaysAdminClient";

export const dynamic = "force-dynamic";

export default function AdminGiveawaysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Çəkilişlər</h1>
        <p className="text-sm text-zinc-600">
          Ana səhifə hədiyyə çəkilişləri. Yarat → aktivləşdir → bitiş tarixindən sonra qalibləri
          random çək → qaliblərin WhatsApp-ına bildiriş göndər. Qaliblər ana səhifədə ictimai görünür.
        </p>
      </div>
      <GiveawaysAdminClient />
    </div>
  );
}
