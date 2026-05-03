export default function ReviewInviteEmail({
  userName,
  productTitle,
  reviewUrl,
}: {
  userName: string;
  productTitle: string;
  reviewUrl: string;
}) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(15,23,42,0.0))",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: 22, lineHeight: 1.2 }}>
            Salam, {userName}
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.85, fontSize: 14, lineHeight: 1.6 }}>
            Sifarişin tamamlandı. Təcrübəni bizimlə bölüşməyə bir dəqiqə ayırarsanmı? Rəyin başqa müştərilərə yardım edir.
          </p>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: "#0f172a", opacity: 0.7 }}>Məhsul</div>
            <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              {productTitle}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <a
              href={reviewUrl}
              style={{
                display: "inline-block",
                padding: "12px 22px",
                background: "#6366f1",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                borderRadius: 12,
              }}
            >
              Rəyini yaz
            </a>
          </div>

          <p style={{ margin: "18px 0 0", color: "#0f172a", opacity: 0.65, fontSize: 12, lineHeight: 1.6 }}>
            Bu link sənə özəldir və 30 gün ərzində aktivdir. Linki açmaqda problem yaşayırsansa, birbaşa kopyala:
            <br />
            <span style={{ wordBreak: "break-all", color: "#475569" }}>{reviewUrl}</span>
          </p>
        </div>

        <p style={{ margin: "14px 0 0", color: "#64748b", fontSize: 12, textAlign: "center" }}>
          Honsell PS Store
        </p>
      </div>
    </div>
  );
}
