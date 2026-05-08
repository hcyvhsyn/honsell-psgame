import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface SetPasswordEmailProps {
  userName: string;
  setPasswordUrl: string;
  expiresInHours: number;
}

export default function SetPasswordEmail({
  userName,
  setPasswordUrl,
  expiresInHours,
}: SetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Honsell PS Store hesabını aktivləşdir və şifrəni təyin et</Preview>
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
              Honsell PS Store-da sənin üçün hesab yaradıldı. Hesabını
              aktivləşdirmək və şifrəni təyin etmək üçün aşağıdakı düyməyə bas.
              Bu link {expiresInHours} saat sonra etibarsız olacaq.
            </Text>
          </Section>

          <Section style={ctaWrap}>
            <Button href={setPasswordUrl} style={ctaButton}>
              Şifrəni təyin et
            </Button>
          </Section>

          <Section>
            <Text style={fallbackText}>
              Düymə işləmirsə, bu linki brauzerdə aç:
            </Text>
            <Text style={fallbackUrl}>{setPasswordUrl}</Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              Bu emaili gözləmirdinsə, sadəcə nəzərə alma — hesab linkə klik
              etmədən aktivləşməyəcək.
            </Text>
            <Text style={footerMeta}>
              © {new Date().getFullYear()} Honsell PS Store.
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

const header: React.CSSProperties = { paddingBottom: "24px" };
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
const hero: React.CSSProperties = { paddingTop: "12px", paddingBottom: "8px" };
const heading: React.CSSProperties = {
  fontSize: "26px",
  lineHeight: "34px",
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
const accentPurple: React.CSSProperties = { color: "#a78bfa" };

const ctaWrap: React.CSSProperties = {
  margin: "32px 0 16px 0",
  textAlign: "center" as const,
};
const ctaButton: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  color: "#ffffff",
  padding: "14px 28px",
  borderRadius: "10px",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
const fallbackText: React.CSSProperties = {
  fontSize: "13px",
  color: "#9494a8",
  margin: "16px 0 6px 0",
};
const fallbackUrl: React.CSSProperties = {
  fontSize: "12px",
  color: "#a78bfa",
  wordBreak: "break-all" as const,
  margin: 0,
};

const divider: React.CSSProperties = { borderColor: "#1f1f2e", margin: "28px 0" };
const footer: React.CSSProperties = { paddingTop: "8px" };
const footerText: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#9494a8",
  margin: "0 0 12px 0",
};
const footerMeta: React.CSSProperties = {
  fontSize: "11px",
  color: "#5e5e72",
  margin: 0,
};
