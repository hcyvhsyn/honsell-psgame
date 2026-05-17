import { prisma } from "./prisma";

/**
 * Bir istifadəçi üzərində aparılan admin əməliyyatını AdminAuditLog cədvəlinə
 * yazır. Mümkün qədər çox kontekst saxlamağa çalış (kim, kimə, nə dəyişdi).
 *
 * Xəta verirsə loglayıb səssizcə davam edirik — audit yazısının
 * uğursuz olması əsas əməliyyatı dayandırmamalıdır.
 */
export async function logAdminAction(input: {
  actorId: string | null;
  targetUserId: string;
  action: string;
  details?: Record<string, unknown> | string | null;
}): Promise<void> {
  try {
    const details =
      typeof input.details === "string"
        ? input.details
        : input.details
          ? JSON.stringify(input.details)
          : null;

    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        targetUserId: input.targetUserId,
        action: input.action,
        details: details?.slice(0, 4000) ?? null,
      },
    });
  } catch (err) {
    console.error("[adminAudit] failed to log:", err);
  }
}
