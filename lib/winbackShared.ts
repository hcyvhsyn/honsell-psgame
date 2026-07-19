/**
 * "Niyə davam etmədin?" (win-back / churn) sorğusunun hazır səbəbləri.
 *
 * DİQQƏT: Bu fayl həm server, həm də "use client" komponentlərdən import olunur —
 * ona görə heç vaxt lib/prisma-ya çatan heç nə import etməməlidir.
 * (bax: client-import-prisma-build-trap)
 */

export type WinbackReasonCode =
  | "TOO_EXPENSIVE"
  | "NOT_USED"
  | "TECHNICAL"
  | "SWITCHED"
  | "SERVICE_ISSUE"
  | "OTHER";

export const WINBACK_REASONS: { code: WinbackReasonCode; label: string }[] = [
  { code: "TOO_EXPENSIVE", label: "Qiymət baha idi" },
  { code: "NOT_USED", label: "İstifadə etmədim / ehtiyac qalmadı" },
  { code: "TECHNICAL", label: "Texniki problem yaşadım" },
  { code: "SWITCHED", label: "Başqa xidmətə keçdim" },
  { code: "SERVICE_ISSUE", label: "Xidmətdən razı qalmadım" },
  { code: "OTHER", label: "Digər səbəb" },
];

const REASON_LABEL = new Map(WINBACK_REASONS.map((r) => [r.code, r.label]));

export function isWinbackReason(v: unknown): v is WinbackReasonCode {
  return typeof v === "string" && REASON_LABEL.has(v as WinbackReasonCode);
}

export function winbackReasonLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return REASON_LABEL.get(code as WinbackReasonCode) ?? code;
}
