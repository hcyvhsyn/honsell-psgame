import FaqAdminClient from "./FaqAdminClient";

export const dynamic = "force-dynamic";

export default function AdminFaqPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">FAQ</h1>
        <p className="text-sm text-zinc-600">
          Hər səhifə üçün ayrıca FAQ idarəsi — Ana səhifə, PlayStation, Streaming və hər platforma.
        </p>
      </div>

      <FaqAdminClient />
    </div>
  );
}
