/**
 * Ad-soyad sahəsinin görünüş (display) formatı və minimal uzunluğu.
 *
 * Qayda: müştəri adı tam BÖYÜK və ya tam kiçik yazıbsa — hər sözün yalnız ilk
 * hərfini böyüdürük, qalanını kiçildirik ("ELVIN MEMMEDOV" / "elvin memmedov"
 * → "Elvin Memmedov"). Qarışıq registr (məs. "McLaren", "İlahə") müştərinin
 * niyyəti sayılır və toxunulmur.
 *
 * Həm qeydiyyat API-də (server, məcburi), həm də formada (frontend) eyni
 * funksiya işlədilir ki, nəticə fərqlənməsin.
 */
export const MIN_NAME_LENGTH = 3;

export function normalizeFullName(raw: string | null | undefined): string {
  const name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return "";

  const hasLower = /\p{Ll}/u.test(name);
  const hasUpper = /\p{Lu}/u.test(name);

  // Yalnız tam BÖYÜK və ya tam kiçik halları normallaşdırırıq.
  if (hasLower && hasUpper) return name;

  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/**
 * Ad və soyadın ayrıca yoxlanışı: ən azı iki söz (ad + soyad) olmalı və hər biri
 * MIN_NAME_LENGTH simvoldan qısa olmamalıdır. Uyğundursa null, əks halda
 * istifadəçiyə göstəriləcək xəta mesajını qaytarır. Həm server, həm form eyni
 * funksiyanı işlədir ki, qaydalar fərqlənməsin.
 */
export function validateFullName(raw: string | null | undefined): string | null {
  const parts = normalizeFullName(raw).split(" ").filter(Boolean);
  if (parts.length < 2) {
    return "Ad və soyadı tam yazın";
  }
  if (parts.some((part) => part.length < MIN_NAME_LENGTH)) {
    return `Ad və soyad ayrı-ayrılıqda ən azı ${MIN_NAME_LENGTH} simvol olmalıdır`;
  }
  return null;
}
