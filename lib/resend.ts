import { Resend } from "resend";
import WelcomeEmail from "@/emails/WelcomeEmail";
import OtpEmail from "@/emails/OtpEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import GiftCardEmail from "@/emails/GiftCardEmail";
import ReviewInviteEmail from "@/emails/ReviewInviteEmail";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set in environment variables.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "Honsell PS Store <onboarding@honsell.store>";
const ADMIN_NOTIFY_EMAIL = "huseynhajiyev0@gmail.com";
const ADMIN_BASE_URL = "https://honsell.store";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtAzn(value: number): string {
  return `${value.toFixed(2)} AZN`;
}

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

export async function sendResetPasswordEmail(
  email: string,
  userName: string,
  code: string
) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Şifrə yeniləmə kodun: ${code}`,
    react: ResetPasswordEmail({
      userName,
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
    }),
  });

  if (error) {
    throw new Error(
      `Resend failed to send reset-password email: ${error.message}`
    );
  }

  return data;
}

export async function sendReviewInviteEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  reviewUrl: string;
}) {
  const { email, userName, productTitle, reviewUrl } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `${productTitle} — təcrübəni bölüş`,
    react: ReviewInviteEmail({ userName, productTitle, reviewUrl }),
  });

  if (error) {
    throw new Error(`Resend failed to send review-invite email: ${error.message}`);
  }

  return data;
}

export async function sendAdminNewUserNotification(params: {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
}) {
  const { userId, email, name, phone } = params;
  const html = `
    <h2>Yeni qeydiyyat</h2>
    <p>Yeni müştəri qeydiyyatdan keçdi və e-poçtu təsdiqlədi.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Ad Soyad</b></td><td>${escapeHtml(name ?? "—")}</td></tr>
      <tr><td><b>E-poçt</b></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><b>Telefon</b></td><td>${escapeHtml(phone ?? "—")}</td></tr>
      <tr><td><b>User ID</b></td><td>${escapeHtml(userId)}</td></tr>
    </table>
    <p><a href="${ADMIN_BASE_URL}/admin/users">Adminə keç</a></p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `Yeni qeydiyyat: ${name ?? email}`,
    html,
  });
  if (error) {
    throw new Error(`Resend admin new-user notify failed: ${error.message}`);
  }
}

export async function sendAdminDepositNotification(params: {
  depositId: string;
  userEmail: string;
  userName: string | null;
  amountAzn: number;
}) {
  const { depositId, userEmail, userName, amountAzn } = params;
  const approveUrl = `${ADMIN_BASE_URL}/admin/deposits`;

  const html = `
    <h2>Yeni depozit sorğusu</h2>
    <p>Bir müştəri balans yükləmə sorğusu göndərdi və təsdiq gözləyir.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Müştəri</b></td><td>${escapeHtml(userName ?? "—")}</td></tr>
      <tr><td><b>E-poçt</b></td><td>${escapeHtml(userEmail)}</td></tr>
      <tr><td><b>Məbləğ</b></td><td>${fmtAzn(amountAzn)}</td></tr>
      <tr><td><b>Deposit ID</b></td><td>${escapeHtml(depositId)}</td></tr>
    </table>
    <p>
      <a href="${approveUrl}" style="display:inline-block;background:#0070f3;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
        Admin paneldə təsdiqlə
      </a>
    </p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `Yeni depozit: ${fmtAzn(amountAzn)} — ${userEmail}`,
    html,
  });
  if (error) {
    throw new Error(`Resend admin deposit notify failed: ${error.message}`);
  }
}

export async function sendAdminOrderNotification(params: {
  orderCode: string;
  userEmail: string;
  userName: string | null;
  totalAzn: number;
  paymentSource: "wallet" | "referral";
  items: Array<{ kind: string; title: string; qty: number; lineAzn: number }>;
}) {
  const { orderCode, userEmail, userName, totalAzn, paymentSource, items } = params;

  const rows = items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.kind)}</td>
        <td>${escapeHtml(i.title)}</td>
        <td>${i.qty}</td>
        <td>${fmtAzn(i.lineAzn)}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h2>Yeni sifariş — ${escapeHtml(orderCode)}</h2>
    <p>Müştəri sifariş tamamladı.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Müştəri</b></td><td>${escapeHtml(userName ?? "—")}</td></tr>
      <tr><td><b>E-poçt</b></td><td>${escapeHtml(userEmail)}</td></tr>
      <tr><td><b>Ödəniş mənbəyi</b></td><td>${paymentSource === "referral" ? "Referal balansı" : "Cüzdan"}</td></tr>
      <tr><td><b>Cəm</b></td><td><b>${fmtAzn(totalAzn)}</b></td></tr>
    </table>
    <h3>Sətirlər</h3>
    <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd">
      <thead>
        <tr style="background:#f4f4f4">
          <th align="left">Növ</th>
          <th align="left">Ad</th>
          <th align="left">Say</th>
          <th align="left">Məbləğ</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${ADMIN_BASE_URL}/admin/orders">Admin sifarişlər</a></p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `Yeni sifariş ${orderCode} — ${fmtAzn(totalAzn)}`,
    html,
  });
  if (error) {
    throw new Error(`Resend admin order notify failed: ${error.message}`);
  }
}

export async function sendGiftCardCodeEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  code: string;
}) {
  const { email, userName, productTitle, code } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Hədiyyə kart kodunuz hazırdır`,
    react: GiftCardEmail({ userName, productTitle, code }),
  });

  if (error) {
    throw new Error(`Resend failed to send gift-card email: ${error.message}`);
  }

  return data;
}
