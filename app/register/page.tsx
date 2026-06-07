"use client";

import AuthPageShell from "@/components/auth/AuthPageShell";
import RegisterForm from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthPageShell
      mode="register"
      title="Qeydiyyatdan keç"
      subtitle="Qeydiyyatdan keçmək üçün aşağıdakı xanaları doldurun"
    >
      <div className="mx-auto w-full max-w-[39rem]">
        <RegisterForm variant="page" />
      </div>
    </AuthPageShell>
  );
}
