"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuthPageShell from "@/components/auth/AuthPageShell";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const search = useSearchParams();
  const next = search.get("next") || "";

  return (
    <AuthPageShell
      mode="register"
      title="Qeydiyyatdan keç"
      subtitle="Qeydiyyatdan keçmək üçün aşağıdakı xanaları doldurun"
      next={next || undefined}
    >
      <div className="mx-auto w-full max-w-[39rem]">
        <RegisterForm variant="page" />
      </div>
    </AuthPageShell>
  );
}
