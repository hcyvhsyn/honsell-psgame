import StreamingTitlesAdminClient from "./StreamingTitlesAdminClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingTitlesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Streaming Title-lər</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Hər platforma üçün Azərbaycanda yayımlanan film və serialları idarə et.
        </p>
      </div>
      <StreamingTitlesAdminClient />
    </div>
  );
}
