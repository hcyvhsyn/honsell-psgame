import AccountCreationAdminClient from "./AccountCreationAdminClient";

export const dynamic = "force-dynamic";

export default function AdminAccountCreationPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Türkiyə PSN Hesabı Açılışı</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Xidmətin qiyməti və aktivlik statusunu idarə edin. Gözləyən sifarişləri burada icra edin.
        </p>
      </div>
      <AccountCreationAdminClient />
    </div>
  );
}
