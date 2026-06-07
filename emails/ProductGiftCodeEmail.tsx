import ReferralFooter from "./_ReferralFooter";

/**
 * Müştəri bir və ya bir neçə məhsulu "dostuna hədiyyə" olaraq aldıqda göndərilir.
 * Hər hədiyyə üçün 11 simvollu unikal kod verilir — alıcı bu kodu dostuna ötürür,
 * dost saytda qeydiyyatdan keçib hədiyyəni açır.
 */
export default function ProductGiftCodeEmail({
  userName,
  claimUrl,
  gifts,
  referralCode,
}: {
  userName: string;
  claimUrl: string;
  gifts: { title: string; formattedCode: string; amountAznFormatted: string }[];
  referralCode?: string | null;
}) {
  const multiple = gifts.length > 1;
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <div style={{ maxWidth: 540, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 18,
            padding: 26,
            background: "linear-gradient(135deg, rgba(236,72,153,0.20), rgba(124,58,237,0.10), rgba(15,23,42,0.0))",
            border: "1px solid rgba(236,72,153,0.28)",
          }}
        >
          <div style={{ fontSize: 12, color: "#db2777", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            🎁 Hədiyyə Kodu
          </div>
          <h1 style={{ margin: "8px 0 0", color: "#0f172a", fontSize: 24, lineHeight: 1.2 }}>
            Salam, {userName}
          </h1>
          <p style={{ margin: "12px 0 0", color: "#0f172a", opacity: 0.8, fontSize: 14, lineHeight: 1.6 }}>
            {multiple ? "Hədiyyə sifarişləriniz" : "Hədiyyə sifarişiniz"} tamamlandı. Aşağıdakı{" "}
            {multiple ? "kodları" : "kodu"} hədiyyə etmək istədiyiniz dost(lar)ınıza göndərin. Onlar
            saytda qeydiyyatdan keçib kodu daxil edərək hədiyyəni öz hesablarına ala biləcəklər.
          </p>

          {gifts.map((g, i) => (
            <div
              key={i}
              style={{
                marginTop: 18,
                borderRadius: 14,
                padding: "14px 18px",
                background: "rgba(15,23,42,0.06)",
                border: "1px dashed rgba(236,72,153,0.35)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, marginBottom: 4 }}>
                {g.title}
              </div>
              <div style={{ fontSize: 11, color: "#0f172a", opacity: 0.6, marginBottom: 6 }}>
                {g.amountAznFormatted}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: "#0f172a",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                }}
              >
                {g.formattedCode}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 22, textAlign: "center" }}>
            <a
              href={claimUrl}
              style={{
                display: "inline-block",
                padding: "12px 22px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #db2777, #a855f7)",
                color: "#fff",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Hədiyyəni açma səhifəsi
            </a>
          </div>

          <p style={{ margin: "20px 0 0", color: "#0f172a", opacity: 0.7, fontSize: 12, lineHeight: 1.6 }}>
            <b>Necə işləyir:</b> Dostunuz <b>{claimUrl}</b> ünvanına daxil olub, hesab açıb (və ya
            login olub) kodu yazır. Oyun hədiyyələrində öz PlayStation / Epic hesabını seçir və
            sifariş bizim komandaya çatdırılma üçün düşür. Hər kod yalnız bir dəfə istifadə oluna bilər.
            Kodları hesabınızdan <b>Sifarişlər</b> bölməsində də görə bilərsiniz.
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
