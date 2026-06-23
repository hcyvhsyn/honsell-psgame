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
