/**
 * Profil səhifələrinin vahid başlığı (h1 + qısa izah + istəyə görə sağda düymə).
 * Əvvəl hər səhifə öz ölçüsündə idi: h2 text-lg, h2 text-2xl, kicker + h2, kartlı h1… (2026-11).
 */
export default function ProfilePageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
      </div>
      {action}
    </header>
  );
}
