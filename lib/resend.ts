import { Resend } from "resend";
import WelcomeEmail from "@/emails/WelcomeEmail";
import OtpEmail from "@/emails/OtpEmail";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set in environment variables.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "Honsell PS Store <onboarding@honsell.store>";

export const OTP_TTL_MINUTES = 10;

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendWelcomeEmail(email: string, userName: string) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Honsell PS Store-a xoş gəldin, ${userName}`,
    react: WelcomeEmail({ userName }),
  });

  if (error) {
    throw new Error(`Resend failed to send welcome email: ${error.message}`);
  }

  return data;
}

export async function sendOtpEmail(
  email: string,
  userName: string,
  code: string
) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Honsell PS Store kodun: ${code}`,
    react: OtpEmail({
      userName,
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
    }),
  });

  if (error) {
    throw new Error(`Resend failed to send OTP email: ${error.message}`);
  }

  return data;
}
