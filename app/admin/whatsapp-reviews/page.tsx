import { getStreamingPlatforms } from "@/lib/streamingPlatforms";
import WhatsappReviewsAdminClient from "./WhatsappReviewsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminWhatsappReviewsPage() {
  const platforms = await getStreamingPlatforms();
  const options = platforms.map((p) => ({
    code: p.code,
    label: p.label,
    category: p.category,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp Rəy Dəvəti</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Abunəliyini WhatsApp-dan alan müştərilər üçün. Müştərinin aldığı xidməti və
          müddəti seçin, telefon nömrəsini yazın — sistem WhatsApp-a rəy linki göndərir.
          Müştəri linkdə addım-addım ad, email və rəyini yazır, WhatsApp OTP ilə təsdiqləyir;
          nəticədə həm rəyi dərc olunur, həm də honsell.store hesabı yaranır.
        </p>
      </div>
      <WhatsappReviewsAdminClient platforms={options} />
    </div>
  );
}
