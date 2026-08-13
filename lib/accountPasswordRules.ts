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







/** Tək-tək yoxlanan şifrə qaydası. `key` UI-də sabit identifikatordur. */
export type AccountPasswordCheck = {
  key: "length" | "variety" | "noRepeat" | "noIdentifier";
  /** Canlı çip üçün qısa etiket (formada yazılanla birlikdə görünür). */
  label: string;
  /** Pozulanda göstərilən tam mesaj (validator həmin mətni qaytarır). */
  error: string;
  ok: boolean;
};

/**
 * Hər qaydanın vəziyyətini AYRI-AYRI qaytarır — forma canlı çipləri buradan
 * qurur, `validateAccountPassword` isə ilk pozulanın mesajını götürür.
 *
 * ⚠️ İki qat (canlı çip + submit yoxlaması) EYNİ funksiyadan oxumalıdır: əvvəl
 * çiplər ayrıca regexlərlə yazılsaydı, qayda dəyişəndə biri yaşıl qalıb digəri
 * xəta verərdi — istifadəçi "hər şey yaşıldır, amma göndərmir" halına düşərdi.
 */
export function accountPasswordChecks(
  password: string,
  identifiers: (string | null | undefined)[] = [],
): AccountPasswordCheck[] {
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const typeCount = Number(hasLetter) + Number(hasDigit) + Number(hasSymbol);

  // Şifrə giriş kimliyini (e-poçt) və ya online ID-ni ehtiva edə bilməz.
  const lowerPw = password.toLowerCase();
  let containsIdentifier = false;
  for (const raw of identifiers) {
    const id = (raw ?? "").trim().toLowerCase();
    if (id.length < 3) continue;
    // E-poçt üçün həm tam ünvanı, həm də @-dən əvvəlki hissəni yoxlayırıq.
    const candidates = id.includes("@") ? [id, id.split("@")[0]] : [id];
    for (const c of candidates) {
      if (c.length >= 3 && lowerPw.includes(c)) containsIdentifier = true;
    }
  }

  return [
    {
      key: "length",
      label: `${ACCOUNT_PASSWORD_MIN}+ simvol`,
      error: `Şifrə ən azı ${ACCOUNT_PASSWORD_MIN} simvol olmalıdır.`,
      ok: password.length >= ACCOUNT_PASSWORD_MIN,
    },
    {
      key: "variety",
      label: "Hərf və rəqəm",
      error: "Şifrə hərf, rəqəm və simvol növlərindən ən azı iki fərqlisini ehtiva etməlidir.",
      ok: typeCount >= 2,
    },
    {
      key: "noRepeat",
      label: "Təkrar yoxdur",
      error:
        "Şifrə eyni hərf və ya rəqəmi art-arda 3 və ya daha çox dəfə təkrarlaya bilməz (məs.: BBB və ya 222).",
      // Eyni hərf və ya rəqəm art-arda 3+ dəfə təkrarlana bilməz (BBB, 222).
      ok: !/([a-zA-Z0-9])\1\1/.test(password),
    },
    {
      key: "noIdentifier",
      label: "E-poçtdan fərqli",
      error: "Şifrə giriş kimliyinizi (e-poçt) və ya online ID-nizi ehtiva edə bilməz.",
      ok: !containsIdentifier,
    },
  ];
}

/**
 * Şifrəni yoxlayır. `identifiers` — şifrənin içində OLMAMALI olan dəyərlər:
 * giriş kimliyi (e-poçt) və online ID (Epic görünən ad). Boş və ya çox qısa
 * olanlar nəzərə alınmır. Xəta yoxdursa `null` qaytarır.
 */
export function validateAccountPassword(
  password: string,
  identifiers: (string | null | undefined)[] = [],
): string | null {
  const failed = accountPasswordChecks(password, identifiers).find((c) => !c.ok);
  return failed ? failed.error : null;
}
