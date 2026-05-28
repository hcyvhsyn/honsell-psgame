import type { EpicAccountCreationCartDetails } from "@/lib/cart";

/** Epic (Türkiye) hesab açılışı səbət / forma sahələri üçün vahid yoxlama. */
export function validateEpicAccountDetails(
  d: EpicAccountCreationCartDetails
): string | null {
  if (!d.firstName.trim()) return "Ad daxil edin.";
  if (!d.lastName.trim()) return "Soyad daxil edin.";
  if (!d.birthDate.trim()) return "Doğum tarixi seçin.";
  const mail = d.email.trim();
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))
    return "Etibarlı e-poçt daxil edin.";
  if (d.password.length < 8) return "Şifrə ən azı 8 simvol olmalıdır.";
  if (!d.displayName.trim()) return "Görünən ad daxil edin.";
  return null;
}
