/**
 * Müştərinin YENİ açılacaq hesabı üçün şifrə qaydası (Spotify, Netflix). Client-safe, saf.
 * Mövcud hesabın şifrəsinə tətbiq olunmur: onu müştəri seçməyib.
 */
export function newPasswordChecks(pw: string) {
  return {
    len: pw.length >= 10,
    letter: /[a-zA-Z]/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
  };
}

export function newPasswordValid(pw: string): boolean {
  const c = newPasswordChecks(pw);
  return c.len && c.letter && c.special;
}
