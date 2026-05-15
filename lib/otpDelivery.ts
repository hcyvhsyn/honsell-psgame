import { OTP_TTL_MINUTES, sendResetPasswordEmail } from "@/lib/resend";
import { isWasenderConfigured, normalizeToE164, sendWasenderText } from "@/lib/wasender";

/**
 * Qeydiyyat OTP-si yalnız WhatsApp ilə göndərilir (e-poçt fallback-i yoxdur).
 * Şifrə yeniləmə OTP-si üçün WhatsApp birinci, e-poçt ehtiyat kanaldır.
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
  if (!whatsappEnabled()) {
    throw new Error(
      "WhatsApp OTP konfiqurasiyası tamamlanmayıb. WASENDER_API_KEY və WHATSAPP_PROVIDER təyin olunmalıdır."
    );
  }
  if (!phoneE164) {
    throw new Error("Telefon nömrəsi E.164 formatına gətirilə bilmədi.");
  }

  const result = await sendWasenderText({
    to: phoneE164,
    text: signupOtpText(params.userName, params.code),
  });
  if (!result.ok) {
    console.error("[otp] wasender signup send failed:", result.error);
    throw new Error("WhatsApp təsdiq kodu göndərilə bilmədi. Bir az sonra yenidən cəhd et.");
  }
  return "whatsapp";
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
