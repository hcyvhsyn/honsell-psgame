import { OTP_TTL_MINUTES, sendOtpEmail, sendResetPasswordEmail } from "@/lib/resend";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * WhatsApp birinci, e-poçt ehtiyat kanaldır. WHATSAPP_PROVIDER=wasender olduqda
 * və istifadəçinin telefonu E.164 formatına gətirilə bilsə, OTP WhatsApp-dan
 * göndərilir. WhatsApp uğursuz olduqda və ya konfiqurasiya yoxdursa, e-poçtla
 * göndərilir ki, istifadəçi bloklanmasın.
 */

type DeliveryChannel = "whatsapp" | "email";

function whatsappEnabled(): boolean {
  return (
    process.env.WHATSAPP_PROVIDER?.trim().toLowerCase() === "wasender" &&
    isWasenderConfigured()
  );
}

function signupOtpText(userName: string, code: string): string {
  return [
    `Salam ${userName},`,
    ``,
    `Honsell PS Store təsdiq kodun: *${code}*`,
    ``,
    `Kodun müddəti ${OTP_TTL_MINUTES} dəqiqəyə bitir.`,
    `Bu kodu kimsə ilə paylaşma.`,
  ].join("\n");
}

function resetPasswordOtpText(userName: string, code: string): string {
  return [
    `Salam ${userName},`,
    ``,
    `Honsell PS Store şifrə yeniləmə kodun: *${code}*`,
    ``,
    `Kodun müddəti ${OTP_TTL_MINUTES} dəqiqəyə bitir.`,
    `Əgər şifrəni sən yeniləməmisənsə, bu mesajı nəzərə alma.`,
  ].join("\n");
}

export async function deliverSignupOtp(params: {
  email: string;
  phone: string | null;
  userName: string;
  code: string;
}): Promise<DeliveryChannel> {
  const phoneE164 = normalizeToE164(params.phone);
  if (whatsappEnabled() && phoneE164) {
    const result = await sendWasenderText({
      to: phoneE164,
      text: signupOtpText(params.userName, params.code),
    });
    if (result.ok) return "whatsapp";
    console.error("[otp] wasender signup send failed, falling back to email:", result.error);
  }

  await sendOtpEmail(params.email, params.userName, params.code);
  return "email";
}

export async function deliverResetPasswordOtp(params: {
  email: string;
  phone: string | null;
  userName: string;
  code: string;
}): Promise<DeliveryChannel> {
  const phoneE164 = normalizeToE164(params.phone);
  if (whatsappEnabled() && phoneE164) {
    const result = await sendWasenderText({
      to: phoneE164,
      text: resetPasswordOtpText(params.userName, params.code),
    });
    if (result.ok) return "whatsapp";
    console.error("[otp] wasender reset send failed, falling back to email:", result.error);
  }

  await sendResetPasswordEmail(params.email, params.userName, params.code);
  return "email";
}
