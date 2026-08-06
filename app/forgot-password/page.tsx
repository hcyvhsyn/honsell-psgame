"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AuthPageShell from "@/components/auth/AuthPageShell";
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

  // Login/register ilə EYNİ qabıq: fon, logo, tab-lar və başlıq buradan gəlir.
  // `mode="forgot"` heç bir tab-ı aktiv etmir, tab-lar geri keçid rolundadır.
  return (
    <AuthPageShell
      mode="forgot"
      title="Şifrəni bərpa et"
      // Kanalı müştəri seçir, ona görə alt-başlıq neytraldır — əvvəl «e-poçtuna
      // göndərək» yazırdı, kod isə praktikada WhatsApp-a düşürdü.
      subtitle="Kodu e-poçt və ya WhatsApp ilə al, sonra yeni şifrəni təyin et"
    >
      <ForgotPasswordForm initialEmail={initialEmail} variant="page" />
    </AuthPageShell>
  );
}
