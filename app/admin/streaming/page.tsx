import StreamingAdminClient from "./StreamingAdminClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Streaming Xidmətləri</h1>
        <p className="mt-1 text-sm text-zinc-400">
          HBO Max, Gain və YouTube Premium üçün abunəlik paketləri və stok kodları.
        </p>
      </div>
      <StreamingAdminClient />
    </div>
  );
}
