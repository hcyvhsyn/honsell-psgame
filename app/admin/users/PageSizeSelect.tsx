"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function PageSizeSelect({ value }: { value: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    params.set("pageSize", e.target.value);
    params.delete("page");
    router.push(`/admin/users?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-zinc-600">
      <span>Səhifədə:</span>
      <select
        value={value}
        onChange={onChange}
        className="rounded-md border border-admin-line bg-admin-card px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
      >
        <option value="25">25</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </div>
  );
}
