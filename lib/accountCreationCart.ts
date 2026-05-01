import type { AccountCreationCartDetails } from "@/lib/cart";

/** PSN hesab açılışı səbət / forma sahələri üçün vahid yoxlama. */
export function validateAccountCreationDetails(d: AccountCreationCartDetails): string | null {
  if (!d.fullName.trim()) return "Ad və soyad daxil edin.";
  if (!d.birthDate.trim()) return "Doğum tarixi seçin.";
  const mail = d.email.trim();
  if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "Etibarlı e-poçt daxil edin.";
  if (d.password.length < 8) return "Şifrə ən azı 8 simvol olmalıdır.";
  return null;
}
