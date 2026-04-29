import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  userName: string;
  code: string;
  expiresInMinutes: number;
}

export default function ResetPasswordEmail({
  userName,
  code,
  expiresInMinutes,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Honsell PS Store şifrə yeniləmə kodun: {code}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brandMark}>HONSELL</Text>
            <Text style={brandSub}>PLAYSTATION • RƏQƏMSAL MAĞAZA</Text>
          </Section>

          <Section style={hero}>
            <Heading style={heading}>
              Şifrəni yenilə, <span style={accentPurple}>{userName}</span>.
            </Heading>
            <Text style={lede}>
              Yeni şifrə təyin etmək üçün aşağıdakı kodu daxil et. Kodun
              müddəti {expiresInMinutes} dəqiqəyə bitir.
            </Text>
          </Section>

          <Section style={codeWrap}>
            <Text style={codeText}>{code}</Text>
          </Section>

          <Hr style={divider} />

          <Section style={footer}>
            <Text style={footerText}>
              Bu sorğunu sən etməmisənsə bu emailə əhəmiyyət vermə — şifrən
              dəyişməyəcək.
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
const codeWrap: React.CSSProperties = {
  margin: "32px 0 16px 0",
  padding: "28px",
  borderRadius: "12px",
  backgroundColor: "#13131c",
  border: "1px solid #262635",
  textAlign: "center" as const,
};
const codeText: React.CSSProperties = {
  margin: 0,
  fontSize: "38px",
  letterSpacing: "14px",
  fontWeight: 700,
  color: "#34d399",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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
