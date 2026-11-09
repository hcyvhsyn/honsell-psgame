import StreamingAdminClient from "./StreamingAdminClient";

export const dynamic = "force-dynamic";

export default function AdminStreamingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <StreamingAdminClient />
    </div>
  );
}
