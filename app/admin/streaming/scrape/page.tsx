import StreamingScrapeClient from "./StreamingScrapeClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingScrapePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Streaming Kataloq Yığımı</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Netflix, HBO Max, Prime Video və Gain üçün Azərbaycan kataloqu və dil
          məlumatı. Hər platforma sıra ilə işlədilir, biri xəta verərsə qalanları
          dayanmır.
        </p>
      </div>
      <StreamingScrapeClient />
    </div>
  );
}
