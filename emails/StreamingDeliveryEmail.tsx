import ReferralFooter from "./_ReferralFooter";

export default function StreamingDeliveryEmail({
  userName,
  providerLabel,
  accountEmail,
  accountPassword,
  slotName,
  pinCode,
  startDate,
  endDate,
  months,
  paymentAznFormatted,
  referralCode,
}: {
  userName: string;
  providerLabel: string;
  accountEmail: string;
  accountPassword: string;
  slotName: string;
  pinCode: string;
  startDate: string;
  endDate: string;
  months: number;
  paymentAznFormatted: string;
  referralCode?: string | null;
}) {
  const labelStyle = { fontSize: 12, color: "#0f172a", opacity: 0.7 } as const;
  const valueStyle = {
    marginTop: 4,
    fontSize: 16,
    fontWeight: 600,
    color: "#0f172a",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    wordBreak: "break-all" as const,
  };

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            background:
              "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(15,23,42,0.0))",
            border: "1px solid rgba(168,85,247,0.25)",
          }}
        >
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.2 }}>
            Salam, {userName}
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
            <b>{providerLabel}</b> abunəliyiniz aktivləşdirildi.
          </p>

          <div
            style={{
              marginTop: 18,
              borderRadius: 14,
              padding: "14px 16px",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <div>
              <div style={labelStyle}>📧 Email</div>
              <div style={valueStyle}>{accountEmail}</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>🔑 Şifrə</div>
              <div style={valueStyle}>{accountPassword}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              borderRadius: 14,
              padding: "14px 16px",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <div>
              <div style={labelStyle}>📺 Profil</div>
              <div style={valueStyle}>{slotName}</div>
            </div>
            {pinCode ? (
              <div style={{ marginTop: 12 }}>
                <div style={labelStyle}>🔢 PIN</div>
                <div style={valueStyle}>{pinCode}</div>
              </div>
            ) : null}
          </div>

          <table cellPadding={6} style={{ marginTop: 16, borderCollapse: "collapse", color: "#0f172a", fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ opacity: 0.7 }}>📅 Başlanğıc</td>
                <td style={{ fontWeight: 600 }}>{startDate}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.7 }}>📅 Bitmə</td>
                <td style={{ fontWeight: 600 }}>{endDate}</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.7 }}>⏰ Müddət</td>
                <td style={{ fontWeight: 600 }}>{months} ay</td>
              </tr>
              <tr>
                <td style={{ opacity: 0.7 }}>💰 Ödəniş</td>
                <td style={{ fontWeight: 600 }}>{paymentAznFormatted} AZN</td>
              </tr>
            </tbody>
          </table>

          <p style={{ margin: "16px 0 0", color: "#0f172a", opacity: 0.7, fontSize: 12, lineHeight: 1.6 }}>
            Bu məlumat həmçinin hesabınızda <b>Sifarişlər</b> bölməsində görünür.
          </p>

          <ReferralFooter code={referralCode} />
        </div>

        <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 12, textAlign: "center" }}>
          Honsell PS Store
        </p>
      </div>
    </div>
  );
}
