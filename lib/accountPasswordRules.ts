/**
 * PSN / Epic hesab açılışında müştərinin TƏYİN ETDİYİ şifrə üçün ortaq qaydalar.
 * Həm client validator-larında, həm də server parse funksiyalarında istifadə
 * olunur ki, eyni məntiq və eyni mesaj tətbiq olunsun (PlayStation-un şifrə
 * tələblərinə uyğun).
 */

export const ACCOUNT_PASSWORD_MIN = 8;

/** İstifadəçiyə göstərilən qaydalar (modal-larda siyahı kimi). */
export const ACCOUNT_PASSWORD_RULES_AZ = [
  `Ən azı ${ACCOUNT_PASSWORD_MIN} simvol olmalıdır.`,
  "Hərf, rəqəm və simvol növlərindən ən azı iki fərqlisini ehtiva etməlidir.",
  "Başqa bir xidmət üçün istifadə etdiyiniz şifrə ilə eyni ola bilməz.",
  "Eyni hərf və ya rəqəmi art-arda 3 və ya daha çox dəfə təkrarlaya bilməz (məs.: BBB və ya 222).",
  "Giriş kimliyinizi (e-poçt) və ya online ID-nizi ehtiva edə bilməz.",
];







/**
 * Şifrəni yoxlayır. `identifiers` — şifrənin içində OLMAMALI olan dəyərlər:
 * giriş kimliyi (e-poçt) və online ID (Epic görünən ad). Boş və ya çox qısa
 * olanlar nəzərə alınmır. Xəta yoxdursa `null` qaytarır.
 */
export function validateAccountPassword(
  password: string,
  identifiers: (string | null | undefined)[] = [],
): string | null {
  if (password.length < ACCOUNT_PASSWORD_MIN) {
    return `Şifrə ən azı ${ACCOUNT_PASSWORD_MIN} simvol olmalıdır.`;
  }

  // Qayda 1: hərf, rəqəm və simvol növlərindən ən azı ikisi olmalıdır.
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const typeCount = Number(hasLetter) + Number(hasDigit) + Number(hasSymbol);
  if (typeCount < 2) {
    return "Şifrə hərf, rəqəm və simvol növlərindən ən azı iki fərqlisini ehtiva etməlidir.";
  }

  // Qayda 2: eyni hərf və ya rəqəm art-arda 3+ dəfə təkrarlana bilməz (BBB, 222).
  if (/([a-zA-Z0-9])\1\1/.test(password)) {
    return "Şifrə eyni hərf və ya rəqəmi art-arda 3 və ya daha çox dəfə təkrarlaya bilməz (məs.: BBB və ya 222).";
  }

  // Qayda 3: şifrə giriş kimliyini (e-poçt) və ya online ID-ni ehtiva edə bilməz.
  const lowerPw = password.toLowerCase();
  for (const raw of identifiers) {
    const id = (raw ?? "").trim().toLowerCase();
    if (id.length < 3) continue;
    // E-poçt üçün həm tam ünvanı, həm də @-dən əvvəlki hissəni yoxlayırıq.
    const candidates = id.includes("@") ? [id, id.split("@")[0]] : [id];
    for (const c of candidates) {
      if (c.length >= 3 && lowerPw.includes(c)) {
        return "Şifrə giriş kimliyinizi (e-poçt) və ya online ID-nizi ehtiva edə bilməz.";
      }
    }
  }

  return null;
}
