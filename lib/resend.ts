import { Resend } from "resend";
import WelcomeEmail from "@/emails/WelcomeEmail";
import OtpEmail from "@/emails/OtpEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import GiftCardEmail from "@/emails/GiftCardEmail";
import StreamingDeliveryEmail from "@/emails/StreamingDeliveryEmail";
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

export async function sendWelcomeEmail(
  email: string,
  userName: string,
  referralCode?: string | null
) {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Honsell PS Store-a xoş gəldin, ${userName}`,
    react: WelcomeEmail({ userName, referralCode }),
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

// ─── PS Plus subscription notifications ──────────────────────────────────────

function fmtDateAz(d: Date): string {
  return new Date(d).toLocaleDateString("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function subscriptionEmailShell(params: {
  greeting: string;
  heading: string;
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
  accent?: "amber" | "rose" | "emerald";
}): string {
  const accentColor =
    params.accent === "rose"
      ? "#e11d48"
      : params.accent === "emerald"
        ? "#10b981"
        : "#f59e0b";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <div style="background:${accentColor};padding:20px 24px">
          <h1 style="margin:0;font-size:20px;color:#0a0a0a">${escapeHtml(params.heading)}</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8">${escapeHtml(params.greeting)}</p>
          ${params.bodyHtml}
          <div style="margin-top:24px;text-align:center">
            <a href="${params.ctaHref}" style="display:inline-block;background:${accentColor};color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              ${escapeHtml(params.ctaLabel)}
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;text-align:center">
            Honsell PS Store — <a href="${ADMIN_BASE_URL}" style="color:#a1a1aa;text-decoration:none">honsell.store</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

export async function sendSubscriptionExpiringIn3DaysEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  expiresAt: Date;
  autoRenew: boolean;
  priceAznCents: number;
  walletBalanceCents: number;
}) {
  const balanceOk = params.walletBalanceCents >= params.priceAznCents;
  const ctaHref = balanceOk
    ? `${ADMIN_BASE_URL}/profile/subscriptions`
    : `${ADMIN_BASE_URL}/profile/wallet`;
  const ctaLabel = balanceOk ? "Abunəlikləri gör" : "Balansı artır";

  const renewBlock = params.autoRenew
    ? balanceOk
      ? `<p style="margin:0 0 12px;color:#86efac">Avtomatik yenilənmə <b>aktivdir</b> — bitiş günü cüzdandan ${fmtAzn(params.priceAznCents / 100)} qopadılaraq abunəlik uzadılacaq.</p>`
      : `<p style="margin:0 0 12px;color:#fda4af"><b>Diqqət:</b> avtomatik yenilənmə aktivdir, lakin balansda kifayət qədər vəsait yoxdur. Cari balans <b>${fmtAzn(params.walletBalanceCents / 100)}</b>, lazım olan: <b>${fmtAzn(params.priceAznCents / 100)}</b>. Yenilənməsi üçün balansı artırın.</p>`
    : `<p style="margin:0 0 12px;color:#d4d4d8">Avtomatik yenilənmə bağlıdır. İstəyirsənsə hesab səhifəndən aktivləşdirə bilərsən.</p>`;

  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;color:#fff">${escapeHtml(params.productTitle)} 3 gün sonra bitir</h2>
    <p style="margin:0 0 12px;color:#d4d4d8">Bitiş tarixi: <b>${fmtDateAz(params.expiresAt)}</b></p>
    ${renewBlock}
  `;

  const subject = balanceOk
    ? `Abunəlik 3 gün sonra bitir — ${params.productTitle}`
    : `Balansını artır — abunəlik 3 gün sonra bitir`;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject,
    html: subscriptionEmailShell({
      greeting: `Salam ${params.userName},`,
      heading: balanceOk ? "Abunəliyə 3 gün qaldı" : "Balansını artır",
      bodyHtml: body,
      ctaHref,
      ctaLabel,
      accent: balanceOk ? "amber" : "rose",
    }),
  });
  if (error) {
    throw new Error(`Resend subscription-3d email failed: ${error.message}`);
  }
}

export async function sendSubscriptionExpiringTomorrowEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  expiresAt: Date;
  autoRenew: boolean;
  priceAznCents: number;
  walletBalanceCents: number;
}) {
  const balanceOk = params.walletBalanceCents >= params.priceAznCents;
  const ctaHref = balanceOk
    ? `${ADMIN_BASE_URL}/profile/subscriptions`
    : `${ADMIN_BASE_URL}/profile/wallet`;
  const ctaLabel = balanceOk ? "Abunəliyə bax" : "Balansı artır";

  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;color:#fff">${escapeHtml(params.productTitle)} sabah bitir</h2>
    <p style="margin:0 0 12px;color:#d4d4d8">Bitiş tarixi: <b>${fmtDateAz(params.expiresAt)}</b></p>
    ${
      params.autoRenew
        ? balanceOk
          ? `<p style="margin:0;color:#86efac">Avtomatik yenilənmə aktivdir, balans yetərlidir — abunəlik problemsiz uzadılacaq.</p>`
          : `<p style="margin:0;color:#fda4af"><b>Son şans:</b> balansda ${fmtAzn(params.priceAznCents / 100)} olmasa, abunəlik avtomatik yenilənməyəcək. Cari balans: ${fmtAzn(params.walletBalanceCents / 100)}.</p>`
        : `<p style="margin:0;color:#d4d4d8">Avtomatik yenilənmə bağlıdır. Bitməsindən qaçınmaq üçün hesab səhifəndən aktivləşdir.</p>`
    }
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: `Abunəlik sabah bitir — ${params.productTitle}`,
    html: subscriptionEmailShell({
      greeting: `Salam ${params.userName},`,
      heading: "Abunəlik sabah bitir",
      bodyHtml: body,
      ctaHref,
      ctaLabel,
      accent: balanceOk && params.autoRenew ? "amber" : "rose",
    }),
  });
  if (error) {
    throw new Error(`Resend subscription-1d email failed: ${error.message}`);
  }
}

export async function sendSubscriptionRenewedEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  newExpiresAt: Date;
  amountAznCents: number;
}) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;color:#fff">${escapeHtml(params.productTitle)} avtomatik yeniləndi</h2>
    <p style="margin:0 0 8px;color:#d4d4d8">Cüzdandan <b>${fmtAzn(params.amountAznCents / 100)}</b> qopadıldı.</p>
    <p style="margin:0;color:#d4d4d8">Yeni bitiş tarixi: <b>${fmtDateAz(params.newExpiresAt)}</b></p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: `Abunəlik yeniləndi — ${params.productTitle}`,
    html: subscriptionEmailShell({
      greeting: `Salam ${params.userName},`,
      heading: "Abunəlik yeniləndi",
      bodyHtml: body,
      ctaHref: `${ADMIN_BASE_URL}/profile/subscriptions`,
      ctaLabel: "Abunəlikləri gör",
      accent: "emerald",
    }),
  });
  if (error) {
    throw new Error(`Resend subscription-renewed email failed: ${error.message}`);
  }
}

export async function sendSubscriptionRenewalFailedEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  priceAznCents: number;
  walletBalanceCents: number;
}) {
  const body = `
    <h2 style="margin:0 0 12px;font-size:18px;color:#fff">${escapeHtml(params.productTitle)} yenilənə bilmədi</h2>
    <p style="margin:0 0 12px;color:#fda4af">Avtomatik yenilənmə aktiv idi, lakin balansda kifayət qədər vəsait olmadı.</p>
    <table cellpadding="6" style="border-collapse:collapse;color:#d4d4d8;font-size:14px">
      <tr><td>Lazım olan:</td><td><b>${fmtAzn(params.priceAznCents / 100)}</b></td></tr>
      <tr><td>Cari balans:</td><td>${fmtAzn(params.walletBalanceCents / 100)}</td></tr>
    </table>
    <p style="margin:12px 0 0;color:#d4d4d8">Balansı artırıb yeni paket ala bilərsən.</p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: `Abunəlik yenilənə bilmədi — ${params.productTitle}`,
    html: subscriptionEmailShell({
      greeting: `Salam ${params.userName},`,
      heading: "Yenilənmə uğursuz oldu",
      bodyHtml: body,
      ctaHref: `${ADMIN_BASE_URL}/profile/wallet`,
      ctaLabel: "Balansı artır",
      accent: "rose",
    }),
  });
  if (error) {
    throw new Error(`Resend subscription-failed email failed: ${error.message}`);
  }
}

export async function sendAdminSubscriptionDigest(params: {
  expiringSoon: Array<{
    productTitle: string;
    userEmail: string;
    expiresAt: Date;
    autoRenew: boolean;
    balanceShortfallCents: number | null;
  }>;
}) {
  if (params.expiringSoon.length === 0) return;

  const rows = params.expiringSoon
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.userEmail)}</td>
        <td>${escapeHtml(s.productTitle)}</td>
        <td>${fmtDateAz(s.expiresAt)}</td>
        <td>${s.autoRenew ? "ON" : "OFF"}</td>
        <td>${
          s.balanceShortfallCents != null
            ? `<span style="color:#e11d48">${fmtAzn(s.balanceShortfallCents / 100)} az</span>`
            : "OK"
        }</td>
      </tr>`
    )
    .join("");

  const html = `
    <h2>3 günə bitən abunəliklər (${params.expiringSoon.length})</h2>
    <table cellpadding="6" style="border-collapse:collapse;border:1px solid #ddd;font-size:14px">
      <thead>
        <tr style="background:#f4f4f4">
          <th align="left">Müştəri</th>
          <th align="left">Plan</th>
          <th align="left">Bitir</th>
          <th align="left">Auto-renew</th>
          <th align="left">Balans</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><a href="${ADMIN_BASE_URL}/admin/subscriptions?filter=EXPIRING">Admin → Abunəliklər</a></p>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `Abunəlik digest: ${params.expiringSoon.length} bitir`,
    html,
  });
  if (error) {
    throw new Error(`Resend admin subscription digest failed: ${error.message}`);
  }
}

// ─── Favorite-on-sale notification ────────────────────────────────────────────

export async function sendFavoriteOnSaleEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  productId: string;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
  discountEndAt: Date | null;
  imageUrl: string | null;
}) {
  const productUrl = `${ADMIN_BASE_URL}/oyunlar/${encodeURIComponent(params.productId)}`;
  const endLine = params.discountEndAt
    ? `<p style="margin:8px 0 0;color:#a1a1aa;font-size:12px">Endirim bitir: <b style="color:#d4d4d8">${fmtDateAz(params.discountEndAt)}</b></p>`
    : "";
  const originalLine = params.originalAzn
    ? `<span style="color:#71717a;text-decoration:line-through;margin-right:8px">${fmtAzn(params.originalAzn)}</span>`
    : "";
  const badge =
    params.discountPct != null
      ? `<span style="display:inline-block;background:#6D28D9;color:#fff;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:12px">-${params.discountPct}% endirim</span>`
      : "";
  const cover = params.imageUrl
    ? `<img src="${params.imageUrl}" alt="${escapeHtml(params.productTitle)}" style="width:100%;max-width:480px;border-radius:14px;display:block;margin:0 auto 16px" />`
    : "";

  const body = `
    ${cover}
    ${badge}
    <h2 style="margin:0 0 12px;font-size:20px;color:#fff">${escapeHtml(params.productTitle)} endirimə düşdü!</h2>
    <p style="margin:0 0 8px;color:#d4d4d8">Favorilərinə əlavə etdiyin oyun yenidən endirimdədir.</p>
    <p style="margin:0;font-size:18px">
      ${originalLine}<b style="color:#fff;font-size:22px">${fmtAzn(params.finalAzn)}</b>
    </p>
    ${endLine}
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: `Favoritindəki oyun endirimdədir — ${params.productTitle}`,
    html: subscriptionEmailShell({
      greeting: `Salam ${params.userName},`,
      heading: "Favoritin endirimdədir",
      bodyHtml: body,
      ctaHref: productUrl,
      ctaLabel: "Oyuna bax",
      accent: "emerald",
    }),
  });
  if (error) {
    throw new Error(`Resend favorite-on-sale email failed: ${error.message}`);
  }
}

export async function sendGiftCardCodeEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  code: string;
  referralCode?: string | null;
}) {
  const { email, userName, productTitle, code, referralCode } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Hədiyyə kart kodunuz hazırdır`,
    react: GiftCardEmail({ userName, productTitle, code, referralCode }),
  });

  if (error) {
    throw new Error(`Resend failed to send gift-card email: ${error.message}`);
  }

  return data;
}

export async function sendStreamingDeliveryEmail(params: {
  email: string;
  userName: string;
  providerLabel: string;
  accountEmail: string;
  accountPassword: string;
  slotName: string;
  pinCode: string;
  startDate: string;
  endDate: string;
  months: number;
  paymentAznFormatted: string;
  referralCode?: string | null;
}) {
  const { email, userName, providerLabel } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `${providerLabel} abunəliyiniz aktivləşdirildi`,
    react: StreamingDeliveryEmail({
      userName,
      providerLabel,
      accountEmail: params.accountEmail,
      accountPassword: params.accountPassword,
      slotName: params.slotName,
      pinCode: params.pinCode,
      startDate: params.startDate,
      endDate: params.endDate,
      months: params.months,
      paymentAznFormatted: params.paymentAznFormatted,
      referralCode: params.referralCode,
    }),
  });

  if (error) {
    throw new Error(`Resend failed to send streaming-delivery email: ${error.message}`);
  }

  return data;
}
