import { SITE_URL } from "@/lib/site";

/**
 * Kiçik referal CTA — email-in altına yapışdırılır.
 * Yalnız referal kodu məlum olduqda göstərilir (yəni qeydiyyatlı istifadəçi üçün).
 */
export default function ReferralFooter({
  code,
}: {
  code?: string | null;
}) {
  if (!code) return null;
  const url = `${SITE_URL}/register?ref=${encodeURIComponent(code)}`;

  return (
    <div
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 14,
        background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(15,23,42,0.0))",
        border: "1px solid rgba(168,85,247,0.25)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#a855f7" }}>
        Referal proqramı
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#0f172a" }}>
        Honsell-də əsas qazanc kanalımızdır. Kodunu paylaş — hər dəvətindən AZN qazan.
      </p>
      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#0f172a",
            background: "rgba(15,23,42,0.06)",
            border: "1px solid rgba(15,23,42,0.08)",
            padding: "4px 10px",
            borderRadius: 8,
          }}
        >
          {code}
        </span>
        <a
          href={url}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#7c3aed",
            textDecoration: "none",
          }}
        >
          Paylaşım linki →
        </a>
      </div>
    </div>
  );
}
