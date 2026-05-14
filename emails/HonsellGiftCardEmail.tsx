import ReferralFooter from "./_ReferralFooter";

/**
 * Müştəri Honsell hədiyyə kartı satın aldıqda göndərilir. Kart 11 simvollu
 * unikal kod və 1 illik etibarlılıq müddəti ilə birlikdə təqdim olunur.
 */
export default function HonsellGiftCardEmail({
  userName,
  amountAznFormatted,
  code,
  formattedCode,
  expiresAtFormatted,
  redeemUrl,
  referralCode,
}: {
  userName: string;
  amountAznFormatted: string;
  code: string;
  formattedCode: string;
  expiresAtFormatted: string;
  redeemUrl: string;
  referralCode?: string | null;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 18,
            padding: 26,
            background: "linear-gradient(135deg, rgba(124,58,237,0.22), rgba(15,23,42,0.0))",
            border: "1px solid rgba(124,58,237,0.28)",
          }}
        >
          <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            Honsell Hədiyyə Kartı
          </div>
          <h1 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.2 }}>
            Salam, {userName}
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
            <b>{amountAznFormatted}</b> dəyərində Honsell hədiyyə kartı sifarişiniz tamamlandı.
            Aşağıdakı unikal kodu istənilən Honsell istifadəçisi sayta daxil edərək
            balansına köçürə bilər.
          </p>

          <div
            style={{
              marginTop: 20,
              borderRadius: 14,
              padding: "16px 18px",
              background: "rgba(15,23,42,0.06)",
              border: "1px dashed rgba(124,58,237,0.35)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#0f172a", opacity: 0.7, marginBottom: 6 }}>
              Hədiyyə kart kodu
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: 3,
                color: "#0f172a",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {formattedCode}
            </div>
            <div style={{ fontSize: 11, color: "#0f172a", opacity: 0.55, marginTop: 8 }}>
              Bu kod {expiresAtFormatted} tarixinə kimi etibarlıdır.
            </div>
          </div>

          <div style={{ marginTop: 22, textAlign: "center" }}>
            <a
              href={redeemUrl}
              style={{
                display: "inline-block",
                padding: "12px 22px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Kodu aktivləşdir
            </a>
          </div>

          <p style={{ margin: "20px 0 0", color: "#0f172a", opacity: 0.7, fontSize: 12, lineHeight: 1.6 }}>
            <b>Necə işləyir:</b> Kodu istənilən Honsell istifadəçisi
            <b> Profil → Hədiyyə kart </b> bölməsinə daxil edib təsdiqləyəndə,
            {" "}<b>{amountAznFormatted}</b> onun cüzdan balansına köçürülür.
            Bir kod yalnız bir dəfə istifadə oluna bilər. Kodu da hesabınızdan
            <b> Sifarişlər </b> bölməsində istənilən vaxt görmək mümkündür.
          </p>

          <div style={{ marginTop: 14, fontSize: 11, color: "#0f172a", opacity: 0.55 }}>
            Daxili istinad: {code}
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
