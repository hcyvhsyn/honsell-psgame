import StreamingReviewsAdminClient from "./StreamingReviewsAdminClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingReviewsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Streaming İcmalları</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Müştərilərin yazdığı film və serial icmallarını yoxla, etibarlı icmalçılara birbaşa yayım icazəsi ver.
        </p>
      </div>
      <StreamingReviewsAdminClient />
    </div>
  );
}
