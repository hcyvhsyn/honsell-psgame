"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-admin-line bg-admin-card px-3 text-xs text-zinc-600 transition hover:bg-admin-chip hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
    >
      <LogOut className="h-3.5 w-3.5" /> Çıxış
    </button>
  );
}
