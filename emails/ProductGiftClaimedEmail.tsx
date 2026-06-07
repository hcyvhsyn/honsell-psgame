import ReferralFooter from "./_ReferralFooter";

/**
 * Dost hədiyyə kodunu açdıqda ALAN dosta göndərilir — hədiyyənin qəbul edildiyini
 * və komandanın çatdırılmaya başladığını təsdiqləyir.
 */
export default function ProductGiftClaimedEmail({
  userName,
  productTitle,
  ordersUrl,
  referralCode,
}: {
  userName: string;
  productTitle: string;
  ordersUrl: string;
  referralCode?: string | null;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 18,
            padding: 26,
            background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(15,23,42,0.0))",
            border: "1px solid rgba(16,185,129,0.28)",
          }}
        >
          <div style={{ fontSize: 12, color: "#059669", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            🎁 Hədiyyə açıldı
          </div>
          <h1 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.2 }}>
            Təbriklər, {userName}!
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
            <b>{productTitle}</b> hədiyyəsi uğurla hesabınıza əlavə olundu. Komandamız çatdırılma
            üçün dərhal işə başlayacaq və status dəyişdikcə sizinlə əlaqə saxlanılacaq.
          </p>

          <div style={{ marginTop: 22, textAlign: "center" }}>
            <a
              href={ordersUrl}
              style={{
                display: "inline-block",
                padding: "12px 22px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #059669, #10b981)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Sifarişlərimə bax
            </a>
          </div>

          <ReferralFooter code={referralCode} />
        </div>

        <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 12, textAlign: "center" }}>
          Honsell PS Store
        </p>
      </div>
    </div>
  );
}
