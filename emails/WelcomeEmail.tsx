import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  userName: string;
  referralCode?: string | null;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.store";

export default function WelcomeEmail({ userName, referralCode }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Honsell PS Store-a xoş gəldin — növbəti macəran burada başlayır.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brandMark}>HONSELL</Text>
            <Text style={brandSub}>PLAYSTATION • RƏQƏMSAL MAĞAZA</Text>
          </Section>

          <Section style={hero}>
            <Heading style={heading}>
              Xoş gəldin, <span style={accentPurple}>{userName}</span>.
            </Heading>
            <Text style={lede}>
              Hesabın aktivdir. Ən son PlayStation oyunları rəfdə hazırdır —
              saniyələr içində yüklə, disk yoxdur, gözləmə yoxdur.
            </Text>
          </Section>

          <Hr style={divider} />

          <Section style={featureBlock}>
            <Text style={featureLabel}>SƏNİ NƏ GÖZLƏYİR</Text>
            <Section style={featureRow}>
              <Text style={featureBullet}>
                <span style={accentGreen}>▸</span> PSN hesabına anında rəqəmsal çatdırılma
              </Text>
              <Text style={featureBullet}>
                <span style={accentGreen}>▸</span> Seçmə yenilənmələr, böyük endirimlər, həftəlik fürsətlər
              </Text>
              <Text style={featureBullet}>
                <span style={accentGreen}>▸</span> Cüzdan doldurma və hədiyyə kartları bir yerdə
              </Text>
            </Section>
          </Section>

          <Section style={ctaWrap}>
            <Button style={ctaButton} href={`${baseUrl}/`}>
              Mağazaya bax
            </Button>
          </Section>

          {referralCode ? (
            <Section style={referralBox}>
              <Text style={referralLabel}>REFERAL PROQRAMI — ANA QAZANC KANALI</Text>
              <Text style={referralBody}>
                Kodunu paylaş — hər dəvətindən AZN qazan. 5/10/25 uğurlu dəvətə bonuslar.
              </Text>
              <Text style={referralCodeStyle}>{referralCode}</Text>
              <Link style={referralLink} href={`${baseUrl}/qazan`}>
                Necə qazanıram? →
              </Link>
            </Section>
          ) : null}

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              Sualın varmı? Bu emailə cavab yaz və ya{" "}
              <Link style={footerLink} href={`${baseUrl}/`}>
                honsell-psstore
              </Link>
              -ə daxil ol.
            </Text>
            <Text style={footerMeta}>
              Honsell Studiodan sevgi ilə göndərildi. © {new Date().getFullYear()} Honsell PS Store.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#0a0a0f",
  fontFamily:
    "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: 0,
  color: "#e5e5ec",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "40px 28px",
  maxWidth: "600px",
  backgroundColor: "#0f0f17",
  border: "1px solid #1f1f2e",
  borderRadius: "14px",
};

const header: React.CSSProperties = {
  paddingBottom: "24px",
};

const brandMark: React.CSSProperties = {
  fontSize: "22px",
  letterSpacing: "8px",
  fontWeight: 700,
  color: "#ffffff",
  margin: 0,
};

const brandSub: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "4px",
  color: "#7c7c91",
  margin: "6px 0 0 0",
};

const hero: React.CSSProperties = {
  paddingTop: "12px",
  paddingBottom: "8px",
};

const heading: React.CSSProperties = {
  fontSize: "30px",
  lineHeight: "38px",
  fontWeight: 600,
  color: "#ffffff",
  margin: "0 0 16px 0",
  letterSpacing: "-0.5px",
};

const lede: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#b4b4c4",
  margin: 0,
};

const accentPurple: React.CSSProperties = {
  color: "#a78bfa",
};

const accentGreen: React.CSSProperties = {
  color: "#34d399",
  marginRight: "8px",
};

const divider: React.CSSProperties = {
  borderColor: "#1f1f2e",
  margin: "28px 0",
};

const featureBlock: React.CSSProperties = {
  paddingBottom: "8px",
};

const featureLabel: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "3px",
  color: "#7c7c91",
  margin: "0 0 14px 0",
};

const featureRow: React.CSSProperties = {
  margin: 0,
};

const featureBullet: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#d4d4e0",
  margin: "0 0 8px 0",
};

const ctaWrap: React.CSSProperties = {
  paddingTop: "16px",
  paddingBottom: "8px",
  textAlign: "center" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.3px",
  textDecoration: "none",
  display: "inline-block",
};

const footer: React.CSSProperties = {
  paddingTop: "8px",
};

const footerText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#9494a8",
  margin: "0 0 12px 0",
};

const footerLink: React.CSSProperties = {
  color: "#a78bfa",
  textDecoration: "none",
};

const footerMeta: React.CSSProperties = {
  fontSize: "11px",
  color: "#5e5e72",
  margin: 0,
};

const referralBox: React.CSSProperties = {
  marginTop: "20px",
  padding: "18px 18px 14px",
  borderRadius: "12px",
  border: "1px solid rgba(168,85,247,0.35)",
  backgroundImage:
    "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(124,58,237,0.05))",
};

const referralLabel: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "3px",
  color: "#d8b4fe",
  margin: "0 0 6px 0",
};

const referralBody: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#e9e5f3",
  margin: "0 0 10px 0",
};

const referralCodeStyle: React.CSSProperties = {
  display: "inline-block",
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "3px",
  color: "#ffffff",
  background: "rgba(255,255,255,0.08)",
  padding: "5px 12px",
  borderRadius: "8px",
  margin: "0 0 6px 0",
};

const referralLink: React.CSSProperties = {
  display: "inline-block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#c4b5fd",
  textDecoration: "none",
  marginTop: "4px",
};
