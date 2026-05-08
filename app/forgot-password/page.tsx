"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const search = useSearchParams();
  const initialEmail = search.get("email") ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo href="/" height={36} />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-xl shadow-black/30">
          <ForgotPasswordForm initialEmail={initialEmail} />
        </div>

        <p className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Daxil ol
          </Link>{" "}
          ·{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300">
            Qeydiyyatdan keç
          </Link>
        </p>
      </div>
    </main>
  );
}
