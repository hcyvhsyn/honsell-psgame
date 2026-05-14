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
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.22),transparent_34%),linear-gradient(180deg,#050612,#090913)] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo href="/" height={36} />
        </div>

        <ForgotPasswordForm initialEmail={initialEmail} />

        <p className="mt-6 text-center text-sm text-zinc-400">
          <Link href="/login" className="font-bold text-violet-300 hover:text-violet-200">
            Daxil ol
          </Link>{" "}
          ·{" "}
          <Link href="/register" className="font-bold text-violet-300 hover:text-violet-200">
            Qeydiyyatdan keç
          </Link>
        </p>
      </div>
    </main>
  );
}
