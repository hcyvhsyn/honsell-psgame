import StreamingFeaturedAdminClient from "./StreamingFeaturedAdminClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingFeaturedPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Streaming Banner</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Streaming overview və hər platforma səhifəsində göstəriləcək film/serial seçimləri.
        </p>
      </div>
      <StreamingFeaturedAdminClient />
    </div>
  );
}
