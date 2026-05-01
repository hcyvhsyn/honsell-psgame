export default function GiftCardEmail({
  userName,
  productTitle,
  code,
}: {
  userName: string;
  productTitle: string;
  code: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(15,23,42,0.0))",
            border: "1px solid rgba(16,185,129,0.25)",
          }}
        >
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.2 }}>
            Salam, {userName}
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
            Hədiyyə kart sifarişiniz hazırdır. Aşağıdakı kodu PlayStation Store-da istifadə edə bilərsiniz.
          </p>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: "#0f172a", opacity: 0.7 }}>Məhsul</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              {productTitle}
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              borderRadius: 14,
              padding: "14px 16px",
              background: "rgba(15,23,42,0.06)",
              border: "1px solid rgba(15,23,42,0.08)",
            }}
          >
            <div style={{ fontSize: 12, color: "#0f172a", opacity: 0.7 }}>Kodunuz</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#0f172a",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            >
              {code}
            </div>
          </div>

          <p style={{ margin: "16px 0 0", color: "#0f172a", opacity: 0.7, fontSize: 12, lineHeight: 1.6 }}>
            Bu email avtomatik göndərilib. Kod həmçinin hesabınızda <b>Sifarişlər</b> bölməsində görünəcək.
          </p>
        </div>

        <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 12, textAlign: "center" }}>
          Honsell PS Store
        </p>
      </div>
    </div>
  );
}

