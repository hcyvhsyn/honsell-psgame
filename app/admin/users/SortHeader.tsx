"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export default function SortHeader({
  label,
  field,
  className = "text-left",
}: {
  label: string;
  field: string;
  className?: string;
}) {
  const sp = useSearchParams();
  const currentSort = sp.get("sort") ?? "createdAt";
  const currentDir = sp.get("dir") === "asc" ? "asc" : "desc";
  const isActive = currentSort === field;
  const nextDir = isActive && currentDir === "desc" ? "asc" : "desc";

  const params = new URLSearchParams(sp.toString());
  params.set("sort", field);
  params.set("dir", nextDir);
  params.delete("page");

  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <Link
        href={`/admin/users?${params.toString()}`}
        className={`inline-flex items-center gap-1 transition hover:text-zinc-200 ${
          isActive ? "text-zinc-200" : ""
        }`}
      >
        {label}
        {!isActive && <ArrowUpDown className="h-3 w-3 opacity-50" />}
        {isActive && currentDir === "desc" && <ArrowDown className="h-3 w-3" />}
        {isActive && currentDir === "asc" && <ArrowUp className="h-3 w-3" />}
      </Link>
    </th>
  );
}
