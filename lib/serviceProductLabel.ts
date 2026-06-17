/**
 * Banner / səbət göstərişləri üçün ServiceProduct etiketi.
 *
 * `ServiceProduct.title` adətən müddəti (1 ay, 12 ay...) ehtiva etmir — o,
 * `metadata.durationMonths`-də saxlanır. Banner-də və admin məhsul seçicisində
 * istifadəçi müddəti görə bilsin deyə adın sonuna " — N ay" əlavə edirik.
 *
 * Müddət yoxdursa (məs. hədiyyə kartı, TL balans) sadəcə başlıq qaytarılır.
 */
export function serviceProductLabel(title: string, metadata: unknown): string {
  const m = (metadata as Record<string, unknown> | null) ?? {};
  const months = Number(m.durationMonths);
  if (Number.isInteger(months) && months > 0) {
    return `${title} — ${months} ay`;
  }
  return title;
}
