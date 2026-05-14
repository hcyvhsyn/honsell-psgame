"use client";

import Logo from "@/components/Logo";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(124,58,237,0.22),transparent_34%),linear-gradient(180deg,#050612,#090913)] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto mb-8 flex max-w-2xl justify-center">
        <Logo href="/" height={36} />
      </div>
      <div className="mx-auto max-w-2xl">
        <RegisterForm />
      </div>
    </main>
  );
}
