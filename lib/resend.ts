import { Resend } from "resend";
import WelcomeEmail from "@/emails/WelcomeEmail";
import OtpEmail from "@/emails/OtpEmail";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import SetPasswordEmail from "@/emails/SetPasswordEmail";
import GiftCardEmail from "@/emails/GiftCardEmail";
import HonsellGiftCardEmail from "@/emails/HonsellGiftCardEmail";
import HonsellGiftCardRedeemedEmail from "@/emails/HonsellGiftCardRedeemedEmail";
import ProductGiftCodeEmail from "@/emails/ProductGiftCodeEmail";
import ProductGiftClaimedEmail from "@/emails/ProductGiftClaimedEmail";
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

/** TTL of admin-issued set-password links (manual user creation). */
export const SET_PASSWORD_TTL_HOURS = 48;

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendSetPasswordEmail(params: {
  email: string;
  userName: string;
  setPasswordUrl: string;
  expiresInHours?: number;
}) {
  const { email, userName, setPasswordUrl } = params;
  const expiresInHours = params.expiresInHours ?? SET_PASSWORD_TTL_HOURS;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: "Hesabını aktivləşdir — şifrəni təyin et",
    react: SetPasswordEmail({ userName, setPasswordUrl, expiresInHours }),
  });

  if (error) {
    throw new Error(
      `Resend failed to send set-password email: ${error.message}`
    );
  }

  return data;
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
  heardAbout?: string | null;
}) {
  const { userId, email, name, phone, heardAbout } = params;
  const html = `
    <h2>Yeni qeydiyyat</h2>
    <p>Yeni müştəri qeydiyyatdan keçdi və e-poçtu təsdiqlədi.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      <tr><td><b>Ad Soyad</b></td><td>${escapeHtml(name ?? "—")}</td></tr>
      <tr><td><b>E-poçt</b></td><td>${escapeHtml(email)}</td></tr>
      <tr><td><b>Telefon</b></td><td>${escapeHtml(phone ?? "—")}</td></tr>
      <tr><td><b>Haradan eşidib</b></td><td>${escapeHtml(heardAbout ?? "—")}</td></tr>
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
  paymentSource: "wallet" | "referral" | "epoint";
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
      <tr><td><b>Ödəniş mənbəyi</b></td><td>${paymentSource === "referral" ? "Referal balansı" : paymentSource === "epoint" ? "Epoint" : "Cüzdan"}</td></tr>
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

/**
 * Həftəlik "yeni endirimlər" bülleteni. Tək e-poçtda bir neçə oyun göstərilir.
 * Marketinq mesajı olduğu üçün footer-də məcburi unsubscribe linki var.
 */
export async function sendDiscountDigestEmail(params: {
  email: string;
  userName: string;
  unsubscribeUrl: string;
  games: Array<{
    productId: string;
    title: string;
    imageUrl: string | null;
    finalAzn: number;
    originalAzn: number | null;
    discountPct: number | null;
    discountEndAt: Date | null;
  }>;
}) {
  const accent = "#10b981";
  const catalogUrl = `${ADMIN_BASE_URL}/oyunlar`;

  const cards = params.games
    .map((g) => {
      const url = `${ADMIN_BASE_URL}/oyunlar/${encodeURIComponent(g.productId)}`;
      const cover = g.imageUrl
        ? `<img src="${g.imageUrl}" alt="${escapeHtml(g.title)}" width="84" height="84" style="width:84px;height:84px;object-fit:cover;border-radius:10px;display:block" />`
        : `<div style="width:84px;height:84px;border-radius:10px;background:#27272a"></div>`;
      const badge =
        g.discountPct != null
          ? `<span style="display:inline-block;background:#6D28D9;color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:6px">-${g.discountPct}%</span>`
          : "";
      const original = g.originalAzn
        ? `<span style="color:#71717a;text-decoration:line-through;margin-right:6px;font-size:13px">${fmtAzn(g.originalAzn)}</span>`
        : "";
      const endLine = g.discountEndAt
        ? `<div style="margin-top:4px;color:#a1a1aa;font-size:11px">Bitir: ${fmtDateAz(g.discountEndAt)}</div>`
        : "";
      return `
        <a href="${url}" style="text-decoration:none;color:inherit;display:block">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#18181b;border:1px solid #27272a;border-radius:12px">
            <tr>
              <td style="padding:12px;width:84px;vertical-align:top">${cover}</td>
              <td style="padding:12px 12px 12px 0;vertical-align:top">
                ${badge}
                <div style="color:#fff;font-size:15px;font-weight:600;line-height:1.3">${escapeHtml(g.title)}</div>
                <div style="margin-top:6px">${original}<b style="color:#fff;font-size:16px">${fmtAzn(g.finalAzn)}</b></div>
                ${endLine}
              </td>
            </tr>
          </table>
        </a>`;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <div style="background:${accent};padding:20px 24px">
          <h1 style="margin:0;font-size:20px;color:#0a0a0a">Bu həftənin yeni endirimləri 🎮</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8">Salam ${escapeHtml(params.userName)}, PlayStation Store-da bu həftə endirimə düşən seçilmiş oyunlar:</p>
          ${cards}
          <div style="margin-top:20px;text-align:center">
            <a href="${catalogUrl}" style="display:inline-block;background:${accent};color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Bütün endirimlərə bax
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;text-align:center;line-height:1.6">
            Honsell PS Store — <a href="${ADMIN_BASE_URL}" style="color:#a1a1aa;text-decoration:none">honsell.store</a><br/>
            Bu bültenləri almaq istəmirsiniz? <a href="${params.unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline">Abunəlikdən çıxın</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: `Bu həftə ${params.games.length} yeni endirim — Honsell PS Store`,
    html,
  });
  if (error) {
    throw new Error(`Resend discount-digest email failed: ${error.message}`);
  }
}

/**
 * Tərk edilmiş səbət (abandoned cart) xatırlatması — istifadəçinin səbətində
 * qalıb amma almadığı məhsulları göstərir. Marketinq mesajı olduğu üçün
 * footer-də məcburi unsubscribe linki var.
 */
export async function sendAbandonedCartEmail(params: {
  email: string;
  userName: string;
  unsubscribeUrl: string;
  items: Array<{
    title: string;
    imageUrl: string | null;
    finalAzn: number;
    qty: number;
  }>;
  /** items siyahısına sığmayan əlavə məhsul sayı (ABANDONED_MAX_ITEMS-dən artıq). */
  extraCount: number;
  totalAzn: number;
}) {
  const accent = "#6D28D9";
  const cartUrl = `${ADMIN_BASE_URL}/cart`;

  const cards = params.items
    .map((it) => {
      const cover = it.imageUrl
        ? `<img src="${it.imageUrl}" alt="${escapeHtml(it.title)}" width="84" height="84" style="width:84px;height:84px;object-fit:cover;border-radius:10px;display:block" />`
        : `<div style="width:84px;height:84px;border-radius:10px;background:#27272a"></div>`;
      const qtyLine =
        it.qty > 1
          ? `<div style="margin-top:4px;color:#a1a1aa;font-size:12px">Say: ${it.qty}</div>`
          : "";
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#18181b;border:1px solid #27272a;border-radius:12px">
          <tr>
            <td style="padding:12px;width:84px;vertical-align:top">${cover}</td>
            <td style="padding:12px 12px 12px 0;vertical-align:top">
              <div style="color:#fff;font-size:15px;font-weight:600;line-height:1.3">${escapeHtml(it.title)}</div>
              <div style="margin-top:6px"><b style="color:#fff;font-size:16px">${fmtAzn(it.finalAzn)}</b></div>
              ${qtyLine}
            </td>
          </tr>
        </table>`;
    })
    .join("");

  const extraLine =
    params.extraCount > 0
      ? `<p style="margin:0 0 12px;color:#a1a1aa;font-size:13px;text-align:center">… və daha ${params.extraCount} məhsul</p>`
      : "";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <div style="background:${accent};padding:20px 24px">
          <h1 style="margin:0;font-size:20px;color:#fff">Səbətinizdə nəsə qaldı 🛒</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8">Salam ${escapeHtml(params.userName)}, səbətinizdəki məhsulları sizə saxladıq. Almağı tamamlamağa hazırsınız?</p>
          ${cards}
          ${extraLine}
          <div style="margin:16px 0 4px;text-align:center;color:#d4d4d8;font-size:15px">Cəmi: <b style="color:#fff">${fmtAzn(params.totalAzn)}</b></div>
          <div style="margin-top:20px;text-align:center">
            <a href="${cartUrl}" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Səbətə qayıt
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;text-align:center;line-height:1.6">
            Honsell PS Store — <a href="${ADMIN_BASE_URL}" style="color:#a1a1aa;text-decoration:none">honsell.store</a><br/>
            Belə xatırlatmaları almaq istəmirsiniz? <a href="${params.unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline">Abunəlikdən çıxın</a>.
          </p>
        </div>
      </div>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: "Səbətinizdə nəsə qaldı — Honsell PS Store",
    html,
  });
  if (error) {
    throw new Error(`Resend abandoned-cart email failed: ${error.message}`);
  }
}

export type CampaignEmailGame = {
  productId: string;
  title: string;
  imageUrl: string | null;
  finalAzn: number;
  originalAzn: number | null;
  discountPct: number | null;
};

export type CampaignEmailContent = {
  userName: string;
  title: string;
  messageText: string;
  unsubscribeUrl: string;
  games: CampaignEmailGame[];
  /** Hər oyun üçün link qurucu (klik izləmə üçün). Default: birbaşa oyun səhifəsi. */
  linkFor?: (productId: string) => string;
  /** PROMO (default) | REVIEW_INVITE — rəy dəvətində oyun yox, "Rəy yaz" CTA göstərilir. */
  kind?: "PROMO" | "REVIEW_INVITE";
  /** REVIEW_INVITE rejimində "Rəy yaz" düyməsinin hədəfi. */
  reviewUrl?: string;
};

/** Kampaniya e-poçtunun mövzu sətri. */
export function campaignEmailSubject(title: string): string {
  return `${title} — Honsell PS Store`;
}

/**
 * Kampaniya e-poçtunun HTML gövdəsini qurur (göndərmədən asılı deyil) — həm
 * `sendCampaignEmail`, həm də admin önizləmə endpoint-i bunu çağırır. Oyun
 * şəkilləri klik izləmə linkinə sarınır (bütün kart kliklənəndir).
 */
export function renderCampaignEmailHtml(params: CampaignEmailContent): string {
  const accent = "#6D28D9";
  const isReview = params.kind === "REVIEW_INVITE";
  const catalogUrl = `${ADMIN_BASE_URL}/oyunlar`;
  const reviewUrl = params.reviewUrl ?? `${ADMIN_BASE_URL}/#reyler`;
  const linkFor =
    params.linkFor ?? ((pid: string) => `${ADMIN_BASE_URL}/oyunlar/${encodeURIComponent(pid)}`);

  // Rəy dəvəti — oyun kartı yox, mətn + "Rəy yaz" CTA.
  if (isReview) {
    const intro = escapeHtml(params.messageText.trim()).replace(/\n/g, "<br/>");
    return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <div style="background:${accent};padding:20px 24px">
          <h1 style="margin:0;font-size:20px;color:#fff">${escapeHtml(params.title)} ⭐</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8">Salam ${escapeHtml(params.userName)},</p>
          ${intro ? `<p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.6">${intro}</p>` : ""}
          <div style="margin-top:20px;text-align:center">
            <a href="${reviewUrl}" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Rəy yaz ⭐
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;text-align:center;line-height:1.6">
            Honsell PS Store — <a href="${ADMIN_BASE_URL}" style="color:#a1a1aa;text-decoration:none">honsell.store</a><br/>
            Bu mesajları almaq istəmirsiniz? <a href="${params.unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline">Abunəlikdən çıxın</a>.
          </p>
        </div>
      </div>
    </div>
  `;
  }

  const cards = params.games
    .map((g) => {
      const url = linkFor(g.productId);
      const cover = g.imageUrl
        ? `<img src="${g.imageUrl}" alt="${escapeHtml(g.title)}" width="84" height="84" style="width:84px;height:84px;object-fit:cover;border-radius:10px;display:block" />`
        : `<div style="width:84px;height:84px;border-radius:10px;background:#27272a"></div>`;
      const badge =
        g.discountPct != null
          ? `<span style="display:inline-block;background:#6D28D9;color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-bottom:6px">-${g.discountPct}%</span>`
          : "";
      const original = g.originalAzn
        ? `<span style="color:#71717a;text-decoration:line-through;margin-right:6px;font-size:13px">${fmtAzn(g.originalAzn)}</span>`
        : "";
      return `
        <a href="${url}" style="text-decoration:none;color:inherit;display:block">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#18181b;border:1px solid #27272a;border-radius:12px">
            <tr>
              <td style="padding:12px;width:84px;vertical-align:top">${cover}</td>
              <td style="padding:12px 12px 12px 0;vertical-align:top">
                ${badge}
                <div style="color:#fff;font-size:15px;font-weight:600;line-height:1.3">${escapeHtml(g.title)}</div>
                <div style="margin-top:6px">${original}<b style="color:#fff;font-size:16px">${fmtAzn(g.finalAzn)}</b></div>
              </td>
            </tr>
          </table>
        </a>`;
    })
    .join("");

  // Admin mətnindəki sətir keçidlərini qoru (HTML-ə çevir).
  const intro = escapeHtml(params.messageText.trim()).replace(/\n/g, "<br/>");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e4e4e7;padding:24px">
      <div style="max-width:560px;margin:0 auto;background:#111114;border:1px solid #27272a;border-radius:16px;overflow:hidden">
        <div style="background:${accent};padding:20px 24px">
          <h1 style="margin:0;font-size:20px;color:#fff">${escapeHtml(params.title)} 🎮</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 16px;font-size:15px;color:#d4d4d8">Salam ${escapeHtml(params.userName)},</p>
          ${intro ? `<p style="margin:0 0 16px;font-size:15px;color:#d4d4d8;line-height:1.6">${intro}</p>` : ""}
          ${cards}
          <div style="margin-top:20px;text-align:center">
            <a href="${catalogUrl}" style="display:inline-block;background:${accent};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
              Bütün endirimlərə bax
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:12px;color:#71717a;text-align:center;line-height:1.6">
            Honsell PS Store — <a href="${ADMIN_BASE_URL}" style="color:#a1a1aa;text-decoration:none">honsell.store</a><br/>
            Bu mesajları almaq istəmirsiniz? <a href="${params.unsubscribeUrl}" style="color:#a1a1aa;text-decoration:underline">Abunəlikdən çıxın</a>.
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Admin tərəfindən qurulan reklam kampaniyası e-poçtu. Bülletendən fərqli olaraq
 * admin başlığı və giriş mətnini özü yazır; oyun bloku eyni vizual stildədir.
 * Marketinq mesajı olduğu üçün footer-də məcburi unsubscribe linki var.
 */
export async function sendCampaignEmail(params: { email: string } & CampaignEmailContent) {
  const html = renderCampaignEmailHtml(params);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.email,
    subject: campaignEmailSubject(params.title),
    html,
  });
  if (error) {
    throw new Error(`Resend campaign email failed: ${error.message}`);
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

export async function sendHonsellGiftCardEmail(params: {
  email: string;
  userName: string;
  amountAznFormatted: string;
  code: string;
  formattedCode: string;
  expiresAtFormatted: string;
  redeemUrl: string;
  referralCode?: string | null;
}) {
  const { email, userName, amountAznFormatted, code, formattedCode, expiresAtFormatted, redeemUrl, referralCode } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Honsell hədiyyə kartınız (${amountAznFormatted})`,
    react: HonsellGiftCardEmail({
      userName,
      amountAznFormatted,
      code,
      formattedCode,
      expiresAtFormatted,
      redeemUrl,
      referralCode,
    }),
  });
  if (error) {
    throw new Error(`Resend failed to send honsell gift-card email: ${error.message}`);
  }
  return data;
}

export async function sendHonsellGiftCardRedeemedEmail(params: {
  email: string;
  userName: string;
  amountAznFormatted: string;
  newWalletBalanceFormatted: string;
  referralCode?: string | null;
}) {
  const { email, userName, amountAznFormatted, newWalletBalanceFormatted, referralCode } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Hədiyyə kartınız aktivləşdirildi`,
    react: HonsellGiftCardRedeemedEmail({
      userName,
      amountAznFormatted,
      newWalletBalanceFormatted,
      referralCode,
    }),
  });
  if (error) {
    throw new Error(`Resend failed to send honsell gift-card redeemed email: ${error.message}`);
  }
  return data;
}

export async function sendProductGiftCodeEmail(params: {
  email: string;
  userName: string;
  claimUrl: string;
  gifts: { title: string; formattedCode: string; amountAznFormatted: string }[];
  referralCode?: string | null;
}) {
  const { email, userName, claimUrl, gifts, referralCode } = params;
  const subject =
    gifts.length > 1
      ? `Hədiyyə kodlarınız hazırdır (${gifts.length})`
      : `Hədiyyə kodunuz hazırdır`;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject,
    react: ProductGiftCodeEmail({ userName, claimUrl, gifts, referralCode }),
  });
  if (error) {
    throw new Error(`Resend failed to send product-gift code email: ${error.message}`);
  }
  return data;
}

export async function sendProductGiftClaimedEmail(params: {
  email: string;
  userName: string;
  productTitle: string;
  ordersUrl: string;
  referralCode?: string | null;
}) {
  const { email, userName, productTitle, ordersUrl, referralCode } = params;
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: `Hədiyyəniz açıldı: ${productTitle}`,
    react: ProductGiftClaimedEmail({ userName, productTitle, ordersUrl, referralCode }),
  });
  if (error) {
    throw new Error(`Resend failed to send product-gift claimed email: ${error.message}`);
  }
  return data;
}

export async function sendStreamingDeliveryEmail(params: {
  email: string;
  userName: string;
  providerLabel: string;
  accountEmail?: string;
  accountPassword?: string;
  slotName?: string;
  pinCode?: string;
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
