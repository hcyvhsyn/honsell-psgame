/** Oyun sifarişi admin tərəfindən manual çatdırılana qədər `Transaction.status=PENDING`; mərhələlər metadata-da. */

export const GAME_ORDER_STAGES = ["NEW", "CONTACTED", "ACCOUNT_ACCESS"] as const;
export type GameOrderStage = (typeof GAME_ORDER_STAGES)[number];

export const GAME_STAGE_LABEL_AZ: Record<GameOrderStage, string> = {
  NEW: "Yeni — gözləyir",
  CONTACTED: "Müştəri ilə əlaqə saxlanılıb",
  ACCOUNT_ACCESS: "Hesaba giriş üçün hazır / giriş alınıb",
};

export function parseGameOrderMeta(raw: string | null): {
  fulfillmentStage?: GameOrderStage;
  manualDelivery?: boolean;
  paymentSource?: string;
  fromCart?: boolean;
  /** Səbət / birbaşa alışda verilən qısa kod (məs. HON-ABC123). */
  orderCode?: string;
} {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const stageRaw = typeof o.fulfillmentStage === "string" ? o.fulfillmentStage : undefined;
    const fulfillmentStage =
      stageRaw &&
      GAME_ORDER_STAGES.includes(stageRaw as GameOrderStage)
        ? (stageRaw as GameOrderStage)
        : undefined;
    return {
      fulfillmentStage,
      manualDelivery: o.manualDelivery === true,
      paymentSource: typeof o.paymentSource === "string" ? o.paymentSource : undefined,
      fromCart: o.fromCart === true,
      orderCode: typeof o.orderCode === "string" ? o.orderCode : undefined,
    };
  } catch {
    return {};
  }
}

export function mergeGameOrderStageMetadata(
  existingJson: string | null,
  stage: GameOrderStage
): string {
  let base: Record<string, unknown> = {};
  try {
    if (existingJson) base = JSON.parse(existingJson) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  base.fulfillmentStage = stage;
  base.manualDelivery = true;
  return JSON.stringify(base);
}
