"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Trash2,
  Minus,
  Plus,
  ShoppingCart,
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  AlertTriangle,
  Crown,
  ChevronDown,
  Check,
  Pencil,
  Gift,
  Send,
  Loader2,
  Copy,
} from "lucide-react";
import { useCart, type CartItem } from "@/lib/cart";
import { MIN_CART_AZN, MIN_CART_AZN_CENTS } from "@/lib/cartLimits";
import AccountCreationCartEditModal from "@/components/AccountCreationCartEditModal";
import EpicAccountOfferModal from "@/components/EpicAccountOfferModal";
import EpicAccountLinkModal from "@/components/EpicAccountLinkModal";
import PlatformCartEditModal from "@/components/PlatformCartEditModal";
import EpointWidgetModal from "@/components/EpointWidgetModal";
import ReferralShareButtons from "@/components/ReferralShareButtons";
import CartSimilarGames from "@/components/CartSimilarGames";
import { Share2 } from "lucide-react";

/** Dəstək xətti — WhatsApp (ulduzlu format, + prefiksi olmadan). */
const SUPPORT_WHATSAPP_MSISDN = "994702560509";

/**
 * Apple Pay / Google Pay düyməsinin görünməsi.
 * Epoint hesabımızda `/api/1/token/widget` endpoint-inə icazə verildikdən sonra
 * `NEXT_PUBLIC_EPOINT_WIDGET_ENABLED=1` qoyun.
 */
const EPOINT_WIDGET_ENABLED =
  process.env.NEXT_PUBLIC_EPOINT_WIDGET_ENABLED === "1";

export type PsnOption = {
  id: string;
  label: string;
  psnEmail: string;
  psModel?: string;
  isDefault: boolean;
};

export type EpicOption = {
  id: string;
  label: string;
  epicEmail: string;
  displayName: string;
  isDefault: boolean;
};

export default function CartView({
  isAuthed,
  walletBalanceAzn,
  cashbackBalanceAzn = 0,
  psnAccounts,
  epicAccounts = [],
  epicAccountProduct = null,
  loyaltyCashbackPct = 0,
  referralCode = null,
  onRequestLogin,
  onNavigate,
}: {
  isAuthed: boolean;
  walletBalanceAzn: number;
  /** Loyalty tərəfindən toplanmış cashback balansı (deposit cüzdandan ayrı). */
  cashbackBalanceAzn?: number;
  psnAccounts: PsnOption[];
  /** İstifadəçinin Epic (Türkiye) hesabları. */
  epicAccounts?: EpicOption[];
  /** EPIC_ACCOUNT_CREATION məhsulu — Epic hesabı olmayan müştəriyə təklif modalı üçün. */
  epicAccountProduct?: { id: string; title: string; imageUrl: string | null; priceAznCents: number } | null;
  /** Cashback % the buyer will earn after this purchase. 0 = none. */
  loyaltyCashbackPct?: number;
  /** Login olmuş istifadəçinin referal kodu — uğurlu sifarişdən sonra share blok-da göstərilir. */
  referralCode?: string | null;
  /** When provided, replaces the “login” link with a callback (used in modal flow). */
  onRequestLogin?: () => void;
  /** Fired when the user clicks any internal Link inside the cart (used to close the modal). */
  onNavigate?: () => void;
}) {
  const {
    items,
    totalAzn,
    setQty,
    remove,
    clear,
    hydrated,
    priceNotices,
    dismissPriceNotices,
    refreshPrices,
    setGiftMessage,
  } = useCart();

  // Səbət səhifəsi açıldıqda fresh qiymətləri yenidən gətir
  // (Provider hydration-da artıq edir, amma uzun session-larda
  // istifadəçi səhifəyə qayıtdıqda da freshliyi təmin edirik).
  useEffect(() => {
    if (!hydrated) return;
    void refreshPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  const cashbackAzn = (totalAzn * loyaltyCashbackPct) / 100;
  const [busy, setBusy] = useState(false);
  const [widget, setWidget] = useState<{
    url: string;
    successUrl: string;
    errorUrl: string;
    brand: "apple" | "google";
  } | null>(null);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
    orderCode?: string;
    cashbackEarnedAzn?: number;
    cashbackPctEarned?: number;
    newCashbackBalanceAzn?: number;
    gifts?: { title: string; code: string; formattedCode: string }[];
  } | null>(null);

  const [accountEdit, setAccountEdit] = useState<{ itemId: string; key: number } | null>(null);
  const [platformEdit, setPlatformEdit] = useState<{ itemId: string; key: number } | null>(null);
  // Default to the user's flagged-default PSN account; fall back to the first.
  const defaultId = psnAccounts.find((a) => a.isDefault)?.id ?? psnAccounts[0]?.id ?? "";
  const [psnAccountId, setPsnAccountId] = useState<string>(defaultId);
  // Epic hesabları lokal state-də saxlanır ki, müştəri səbətdə mövcud hesabını
  // əlavə etdikdə (EpicAccountLinkModal) tam reload olmadan dərhal seçilə bilsin.
  const [epicAccountList, setEpicAccountList] = useState<EpicOption[]>(epicAccounts);
  useEffect(() => {
    // Prop yeniləndikdə birləşdir — lokal əlavələri itirmədən serverdən gələni absorb et.
    setEpicAccountList((prev) => {
      const byId = new Map(prev.map((a) => [a.id, a]));
      for (const a of epicAccounts) byId.set(a.id, a);
      return Array.from(byId.values());
    });
  }, [epicAccounts]);
  const defaultEpicId =
    epicAccountList.find((a) => a.isDefault)?.id ?? epicAccountList[0]?.id ?? "";
  const [epicAccountId, setEpicAccountId] = useState<string>(defaultEpicId);
  const [epicOfferOpen, setEpicOfferOpen] = useState(false);
  const [epicLinkOpen, setEpicLinkOpen] = useState(false);

  const handleEpicAccountAdded = useCallback((account: EpicOption) => {
    setEpicAccountList((prev) =>
      prev.some((a) => a.id === account.id) ? prev : [...prev, account]
    );
    setEpicAccountId(account.id);
  }, []);

  useEffect(() => {
    setPsnAccountId(defaultId);
  }, [defaultId]);

  useEffect(() => {
    if (accountEdit && !items.some((i) => i.id === accountEdit.itemId)) {
      setAccountEdit(null);
    }
  }, [items, accountEdit]);

  useEffect(() => {
    if (platformEdit && !items.some((i) => i.id === platformEdit.itemId)) {
      setPlatformEdit(null);
    }
  }, [items, platformEdit]);

  const openAccountCartEdit = useCallback((item: CartItem) => {
    if (item.productType !== "ACCOUNT_CREATION") return;
    setAccountEdit((prev) => ({
      itemId: item.id,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);

  const openPlatformCartEdit = useCallback((item: CartItem) => {
    if (item.productType !== "PLATFORM") return;
    setPlatformEdit((prev) => ({
      itemId: item.id,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400">
        Səbət yüklənir…
      </div>
    );
  }

  /** Oyun / PS Plus / TRY üçün PSN seçimi mütləqdir. Epic oyunları (store=EPIC)
   *  PSN yox, Epic hesabı tələb edir — productType hər ikisində "GAME" olduğu üçün
   *  store ilə ayırırıq. Hesab-açılışı və streaming heç bir hesab tələb etmir. */
  // HƏDİYYƏ sətirləri çatdırılma hesabı tələb etmir — onu hədiyyəni açan dost verir.
  const deliveryNeedsPsn = items.some(
    (i) =>
      !i.gift &&
      ((i.productType === "GAME" && i.store !== "EPIC") ||
        ["PS_PLUS", "EA_PLAY", "TRY_BALANCE"].includes(i.productType))
  );
  const deliveryNeedsEpic = items.some(
    (i) => !i.gift && i.productType === "GAME" && i.store === "EPIC"
  );
  // Epic hesab-açılışı artıq səbətdədirsə, hesab yoxluğu bloklamır (alışla birlikdə açılır).
  const hasEpicCreationInCart = items.some(
    (i) => i.productType === "EPIC_ACCOUNT_CREATION"
  );
  // PSN hesab-açılışı (Türkiyə PSN) səbətdədirsə, mövcud PSN hesabı istəmirik:
  // yeni açılacaq hesab admin tərəfindən oyun sifarişlərinə bağlanacaq.
  const hasPsnCreationInCart = items.some(
    (i) => i.productType === "ACCOUNT_CREATION"
  );
  const blockedNoPsn =
    isAuthed && deliveryNeedsPsn && psnAccounts.length === 0 && !hasPsnCreationInCart;
  const blockedNoEpic =
    isAuthed && deliveryNeedsEpic && epicAccountList.length === 0 && !hasEpicCreationInCart;

  if (items.length === 0) {
    if (message?.kind === "ok" && message.gifts && message.gifts.length > 0) {
      return (
        <GiftCheckoutSuccess
          gifts={message.gifts}
          orderCode={message.orderCode}
          onNavigate={onNavigate}
        />
      );
    }
    if (message?.kind === "ok") {
      const waPrefill = message.orderCode
        ? `Salam. Sifariş kodum: ${message.orderCode}`
        : "Salam, alış haqqında əlaqə saxlayıram.";
      const waHref = `https://wa.me/${SUPPORT_WHATSAPP_MSISDN}?text=${encodeURIComponent(waPrefill)}`;
      return (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-10 text-center shadow-lg shadow-emerald-500/5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Təşəkkürlər!</h2>
          {message.orderCode ? (
            <div className="mx-auto mb-5 max-w-md rounded-xl border border-emerald-500/30 bg-zinc-950/40 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">
                Sifariş kodu
              </p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wide text-white">{message.orderCode}</p>
              <p className="mt-1 text-xs text-zinc-500">Bu kodu dəstəklə əlaqə saxlayarkən göndərin.</p>
            </div>
          ) : null}
          {typeof message.cashbackEarnedAzn === "number" && message.cashbackEarnedAzn > 0 ? (
            <div className="mx-auto mb-5 max-w-md rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
                Cashback qazancı
              </p>
              <p className="mt-2 text-sm font-medium leading-snug text-amber-50">
                Bu alışınızdan{" "}
                <span className="tabular-nums font-bold text-white">
                  {message.cashbackEarnedAzn.toFixed(2)} AZN
                </span>{" "}
                cashback qazandınız
                {typeof message.cashbackPctEarned === "number" && message.cashbackPctEarned > 0
                  ? ` (${message.cashbackPctEarned}% loyalty).`
                  : "."}
              </p>
              {typeof message.newCashbackBalanceAzn === "number" ? (
                <p className="mt-2 text-xs text-amber-200/75">
                  Cashback balansınız indi:{" "}
                  <span className="font-semibold tabular-nums text-white">
                    {message.newCashbackBalanceAzn.toFixed(2)} AZN
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="text-base text-emerald-200/90 max-w-md mx-auto leading-relaxed">{message.text}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#20bd5a]"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp ilə əlaqə
            </a>
            {onNavigate ? (
              <button
                type="button"
                onClick={onNavigate}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Alış-verişə davam et
              </button>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Alış-verişə davam et
              </Link>
            )}

            <Link
              href="/profile/orders"
              onClick={onNavigate}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Sifarişlərimə bax
            </Link>
          </div>

          {referralCode ? (
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-700/15 via-purple-700/10 to-transparent p-5 text-left shadow-xl">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-fuchsia-500/20 ring-1 ring-fuchsia-500/40">
                  <Share2 className="h-5 w-5 text-fuchsia-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
                    İndi qazanc başlat
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Kodunu paylaş — hər dəvət etdiyin dostun alışından komissiya qazan.
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Kodun:{" "}
                    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-semibold text-white">
                      {referralCode}
                    </span>
                  </p>
                  <div className="mt-3">
                    <ReferralShareButtons code={referralCode} variant="compact" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center">
        <ShoppingCart className="mx-auto h-10 w-10 text-zinc-600" />
        <p className="mt-3 text-sm text-zinc-400">Səbətin boşdur.</p>
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </button>
        ) : (
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            Oyunlara bax
          </Link>
        )}
      </div>
    );
  }

  const insufficientWallet = isAuthed && walletBalanceAzn < totalAzn;

  // Minimum sifariş məbləği yoxlaması. totalAzn float olduğu üçün qəpik
  // vahidinə yuvarlayıb müqayisə edirik — 4.999... → 500 qəpik kimi düz oxunur.
  const totalCentsForCheck = Math.round(totalAzn * 100);
  const belowMinimum = totalCentsForCheck > 0 && totalCentsForCheck < MIN_CART_AZN_CENTS;
  const missingForMinimumAzn = belowMinimum
    ? MIN_CART_AZN - totalAzn
    : 0;

  function checkoutBalanceSuffix(d: Record<string, unknown>): string {
    const nw = d.newWalletBalanceAzn;
    const nr = d.newReferralBalanceAzn;
    if (typeof nw === "number" && typeof nr === "number") {
      return ` Cüzdan: ${nw.toFixed(2)} AZN · Referal: ${nr.toFixed(2)} AZN.`;
    }
    if (typeof d.newBalanceAzn === "number") {
      return ` Yeni cüzdan göstəricisi: ${d.newBalanceAzn.toFixed(2)} AZN.`;
    }
    return "";
  }

  async function checkout(
    paymentMethod: "wallet" | "epoint" | "epoint-widget",
    widgetBrand: "apple" | "google" = "google",
  ) {
    if (!isAuthed || blockedNoPsn || blockedNoEpic) return;
    if (
      items.some(
        (i) => !i.gift && i.productType === "ACCOUNT_CREATION" && !i.accountCreation
      )
    ) {
      setMessage({
        kind: "error",
        text: "PSN hesab açılışı üçün məlumatları doldurub yadda saxlayın (Redaktə et).",
      });
      return;
    }
    if (
      items.some(
        (i) => !i.gift && i.productType === "EPIC_ACCOUNT_CREATION" && !i.epicAccountCreation
      )
    ) {
      setMessage({
        kind: "error",
        text: "Epic hesab açılışı üçün məlumatları doldurub yadda saxlayın (Redaktə et).",
      });
      return;
    }
    const missingStreamingGmail = items.find(
      (i) =>
        !i.gift &&
        i.productType === "STREAMING" &&
        i.title.toLowerCase().includes("youtube") &&
        !i.streaming?.gmail
    );
    if (missingStreamingGmail) {
      setMessage({
        kind: "error",
        text: `${missingStreamingGmail.title} üçün Gmail ünvanı tələb olunur.`,
      });
      return;
    }
    const missingYoutubeCreds = items.find(
      (i) =>
        !i.gift &&
        i.productType === "PLATFORM" &&
        i.title.toLowerCase().includes("youtube") &&
        (!i.streaming?.gmail || !i.streaming?.password)
    );
    if (missingYoutubeCreds) {
      setMessage({
        kind: "error",
        text: `${missingYoutubeCreds.title} üçün Gmail ünvanı və şifrə tələb olunur.`,
      });
      return;
    }
    const missingPlatformAccounts = items.find(
      (i) =>
        !i.gift &&
        i.productType === "PLATFORM" &&
        i.streaming?.accounts &&
        (i.streaming.accounts.length === 0 ||
          i.streaming.accounts.some((a) => !a.email?.trim() || !a.password)),
    );
    if (missingPlatformAccounts) {
      setMessage({
        kind: "error",
        text: `${missingPlatformAccounts.title} üçün bütün hesab məlumatlarını doldurun (Redaktə et).`,
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            qty: i.qty,
            ...(i.gift ? { isGift: true, giftMessage: i.gift.message } : {}),
            ...(!i.gift && i.productType === "ACCOUNT_CREATION" && i.accountCreation
              ? { accountCreation: i.accountCreation }
              : {}),
            ...(!i.gift &&
            (i.productType === "STREAMING" || i.productType === "PLATFORM") &&
            i.streaming
              ? { streaming: i.streaming }
              : {}),
            ...(!i.gift && i.productType === "EPIC_ACCOUNT_CREATION" && i.epicAccountCreation
              ? { epicAccountCreation: i.epicAccountCreation }
              : {}),
          })),
          psnAccountId: deliveryNeedsPsn && !hasPsnCreationInCart ? psnAccountId : null,
          epicAccountId: deliveryNeedsEpic ? epicAccountId : null,
          paymentSource: "wallet",
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (paymentMethod === "epoint" && typeof data.redirectUrl === "string") {
          window.location.href = data.redirectUrl;
          return;
        }

        if (
          paymentMethod === "epoint-widget" &&
          typeof data.widgetUrl === "string" &&
          typeof data.successUrl === "string" &&
          typeof data.errorUrl === "string"
        ) {
          setWidget({
            url: data.widgetUrl,
            successUrl: data.successUrl,
            errorUrl: data.errorUrl,
            brand: widgetBrand,
          });
          return;
        }

        clear();
        const target = data.deliveredTo?.label ?? "hesabına";
        let text = "";

        const pendingGameQty = Number(data.pendingGameFulfillmentQty ?? 0);
        const balanceSuffix = pendingGameQty > 0 ? "" : checkoutBalanceSuffix(data);
        const orderCode = typeof data.orderCode === "string" ? data.orderCode : undefined;

        const gameFulfillmentSentence =
          pendingGameQty > 0
            ? pendingGameQty === 1
              ? "Oyun admin tərəfindən seçdiyiniz PSN-da mağaza üzərindən alınacaq; tezliklə sizinlə əlaqə saxlanılacaq. Hazırki mərhələni Sifarişlər bölməsində izləyə bilərsiniz."
              : `${pendingGameQty} oyun admin tərəfindən eyni qaydada icra olunacaq; əlaqə və status Sifarişlər bölməsindədir.`
            : "";

        const onlyAcct =
          Boolean(data?.hasAccountCreation) &&
          !data?.hasTryBalance &&
          items.every((it) => it.productType === "ACCOUNT_CREATION");

        if (onlyAcct && !data.deliveredTo) {
          text = `Türkiyə PSN hesab açılışı sifarişiniz qəbul edildi və icraya götürüləcək. Ətraflı məlumat Sifarişlər bölməsindədir.${balanceSuffix}`;
        } else if (Boolean(data?.hasAccountCreation) && data.deliveredTo) {
          text = `Ödəniş tamamlandı (o cümlədən hesab açılışı xidməti). Hesab təhvil tarixini Sifarişlər bölməsində izləyə bilərsiniz.${balanceSuffix}`;
          if (gameFulfillmentSentence) text = `${text.trim()} ${gameFulfillmentSentence}`;
        } else if (pendingGameQty > 0 && !Boolean(data?.hasTryBalance)) {
          text = `Ödəniş qəbul olundu.${gameFulfillmentSentence ? ` ${gameFulfillmentSentence}` : ""}${balanceSuffix}`;
        } else {
          text = `Alış tamamlandı — ${data.purchaseCount} məhsul ${target} hesabına çatdırıldı.${balanceSuffix}`;
        }
        if (data.hasStreaming) {
          const streamingSuffix = pendingGameQty > 0 ? "" : checkoutBalanceSuffix(data);
          text = `Streaming sifarişiniz qəbul edildi. Giriş məlumatları (və ya YouTube üçün dəvət) tezliklə email və Sifarişlər bölməsinə göndəriləcək.${streamingSuffix}`;
          if (gameFulfillmentSentence) {
            text = `${text.trim()} ${gameFulfillmentSentence}`;
          }
        }
        if (data.hasTryBalance) {
          const tryBalanceSuffix = pendingGameQty > 0 ? "" : checkoutBalanceSuffix(data);
          const pendingCount = Number(data.tryBalancePendingCount ?? 0);
          if (pendingCount > 0) {
            text = `Hədiyyə kart sifarişiniz qəbul edildi və hazırda gözləmədədir. Kodunuz hazır olduqda email ilə göndəriləcək və Sifarişlər bölməsində görünəcək.${tryBalanceSuffix}`;
          } else {
            text = `Hədiyyə kartınız sisteminizə yükləndi. Kodunuzu Sifarişlər bölməsindən görə bilərsiniz.${tryBalanceSuffix}`;
          }
          if (gameFulfillmentSentence) {
            text = `${text.trim()} ${gameFulfillmentSentence}`;
          }
        }
        if (data.hasPointBlank) {
          const pbSuffix = pendingGameQty > 0 ? "" : checkoutBalanceSuffix(data);
          const pendingCount = Number(data.pointBlankPendingCount ?? 0);
          if (pendingCount > 0) {
            text = `Point Blank sifarişiniz qəbul edildi və hazırda gözləmədədir. Kodunuz hazır olduqda email ilə göndəriləcək və Sifarişlər bölməsində görünəcək.${pbSuffix}`;
          } else {
            text = `Point Blank TG kodunuz hazırdır. Kodunuzu Sifarişlər bölməsindən görə bilərsiniz.${pbSuffix}`;
          }
          if (gameFulfillmentSentence) {
            text = `${text.trim()} ${gameFulfillmentSentence}`;
          }
        }
        if (Array.isArray(data.honsellGiftCards) && data.honsellGiftCards.length > 0) {
          const hglSuffix = pendingGameQty > 0 ? "" : checkoutBalanceSuffix(data);
          const cnt = data.honsellGiftCards.length;
          text = `Honsell hədiyyə kart${cnt > 1 ? "larınız" : "ınız"} sifarişi qəbul edildi və hazırda gözləmədədir. ${
            cnt > 1 ? "Kodlarınız" : "Kodunuz"
          } hazır olduqda email ilə göndəriləcək və Sifarişlər bölməsində görünəcək. Aktivləşdirmək üçün Profil → Hədiyyə kart səhifəsinə daxil olun.${hglSuffix}`;
          if (gameFulfillmentSentence) {
            text = `${text.trim()} ${gameFulfillmentSentence}`;
          }
        }

        const giftList = Array.isArray(data.gifts)
          ? (data.gifts as { title: string; code: string; formattedCode: string }[])
          : [];

        const earnedCb =
          typeof data.cashbackAzn === "number" && data.cashbackAzn > 0 ? data.cashbackAzn : 0;

        setMessage({
          kind: "ok",
          text,
          orderCode,
          ...(giftList.length > 0 ? { gifts: giftList } : {}),
          ...(earnedCb > 0
            ? {
                cashbackEarnedAzn: earnedCb,
                cashbackPctEarned: Number(data.cashbackPct ?? 0),
                newCashbackBalanceAzn:
                  typeof data.newCashbackBalanceAzn === "number"
                    ? data.newCashbackBalanceAzn
                    : undefined,
              }
            : {}),
        });
      } else {
        setMessage({ kind: "error", text: data.error ?? "Sifariş alınmadı." });
      }
    } catch {
      setMessage({ kind: "error", text: "Şəbəkə xətası. Yenidən cəhd et." });
    } finally {
      setBusy(false);
    }
  }

  const accountEditLine =
    accountEdit != null
      ? items.find((i) => i.id === accountEdit.itemId && i.productType === "ACCOUNT_CREATION")
      : undefined;
  const platformEditLine =
    platformEdit != null
      ? items.find((i) => i.id === platformEdit.itemId && i.productType === "PLATFORM")
      : undefined;

  return (
    <>
      {priceNotices.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-semibold text-amber-200">Səbətdə qiymət yeniləndi</p>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                {priceNotices.map((n) =>
                  n.kind === "price" ? (
                    <li key={`price-${n.id}`} className="leading-snug">
                      <span className="font-medium">{n.title}</span>:{" "}
                      <span className="text-zinc-400 line-through tabular-nums">
                        {n.oldAzn.toFixed(2)} AZN
                      </span>{" "}
                      → <span className="font-semibold tabular-nums">{n.newAzn.toFixed(2)} AZN</span>
                    </li>
                  ) : (
                    <li key={`removed-${n.id}`} className="leading-snug">
                      <span className="font-medium">{n.title}</span>{" "}
                      <span className="text-zinc-400">— artıq mövcud deyil, səbətdən silindi.</span>
                    </li>
                  ),
                )}
              </ul>
              <button
                type="button"
                onClick={dismissPriceNotices}
                className="mt-3 text-xs font-medium text-amber-300 underline-offset-2 hover:underline"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <ul className="space-y-3">
        {items.map((item) => (
          <CartLine
            key={item.id}
            item={item}
            onIncrement={() => setQty(item.id, item.qty + 1)}
            onDecrement={() => setQty(item.id, item.qty - 1)}
            onRemove={() => remove(item.id)}
            onEditAccountCreation={
              item.productType === "ACCOUNT_CREATION" ? () => openAccountCartEdit(item) : undefined
            }
            onEditPlatform={
              item.productType === "PLATFORM" &&
              (item.streaming?.gmail || item.streaming?.accounts?.length)
                ? () => openPlatformCartEdit(item)
                : undefined
            }
            onSetGiftMessage={
              item.gift ? (msg) => setGiftMessage(item.id, msg) : undefined
            }
          />
        ))}
      </ul>

      <aside className="h-fit space-y-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5 shadow-2xl backdrop-blur-md">
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Xülasə</h2>
          <div className="flex items-end justify-between border-b border-zinc-800/60 pb-4">
            <span className="text-sm text-zinc-400">
              {items.length} məhsul
            </span>
            <span className="text-2xl font-bold tabular-nums text-white">
              {totalAzn.toFixed(2)} <span className="text-sm font-medium text-zinc-400">AZN</span>
            </span>
          </div>
        </div>

        {isAuthed ? (
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">Cashback balansı: </span>
            <span className="tabular-nums font-semibold text-amber-200">{cashbackBalanceAzn.toFixed(2)} AZN</span>
          </div>
        ) : null}

        {loyaltyCashbackPct > 0 && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-sm">
            <span className="flex items-start gap-2 text-amber-200/90">
              <Crown className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span className="leading-snug">
                <span className="block font-medium text-amber-300">Ödənişdən sonra cashback</span>
                <span className="text-[11px] text-amber-400/60">
                  Bu məbləğin {loyaltyCashbackPct}%-i cashback balansına yüklənəcək
                </span>
              </span>
            </span>
            <span className="font-semibold tabular-nums text-amber-400">
              +{cashbackAzn.toFixed(2)} AZN
            </span>
          </div>
        )}

        {isAuthed && deliveryNeedsPsn && hasPsnCreationInCart && (
          <div className="flex items-start gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2.5 text-xs text-indigo-200">
            <Gamepad2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Sifarişinizdə Türkiyə PSN hesab açılışı var. Açıldıqdan sonra oyunlar
              həmin hesaba bağlanacaq — ayrıca PSN hesabı seçməyə ehtiyac yoxdur.
            </span>
          </div>
        )}

        {isAuthed && deliveryNeedsPsn && psnAccounts.length > 0 && !hasPsnCreationInCart && (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
              <span className="flex items-center gap-1.5"><Gamepad2 className="h-3.5 w-3.5" /> Hesab</span>
              <Link
                href="/profile/accounts"
                onClick={onNavigate}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                İdarə et
              </Link>
            </label>
            {psnAccounts.length === 1 ? (
              <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{psnAccounts[0].label}</span>
                  <span className="text-xs text-zinc-500">{psnAccounts[0].psnEmail}</span>
                </div>
                {psnAccounts[0].psModel && (
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                    {psnAccounts[0].psModel}
                  </span>
                )}
              </div>
            ) : (
              <AccountDropdown
                accounts={psnAccounts}
                value={psnAccountId}
                onChange={setPsnAccountId}
              />
            )}
          </div>
        )}

        {isAuthed && deliveryNeedsEpic && epicAccountList.length > 0 && (
          <div className="space-y-2">
            <label className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Image src="/epic-white-logo.png" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                Epic hesabı
              </span>
              <Link
                href="/profile/profiles"
                onClick={onNavigate}
                className="text-[10px] text-violet-400 hover:text-violet-300"
              >
                İdarə et
              </Link>
            </label>
            {epicAccountList.length === 1 ? (
              <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">{epicAccountList[0].displayName || epicAccountList[0].label}</span>
                  <span className="text-xs text-zinc-500">{epicAccountList[0].epicEmail}</span>
                </div>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">PC</span>
              </div>
            ) : (
              <EpicAccountDropdown
                accounts={epicAccountList}
                value={epicAccountId}
                onChange={setEpicAccountId}
              />
            )}
          </div>
        )}

        <div className="pt-2">
          {!isAuthed ? (
            onRequestLogin ? (
              <button
                type="button"
                onClick={onRequestLogin}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
              >
                Daxil ol və Ödə <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href="/login?next=/cart"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
              >
                Daxil ol və Ödə <ArrowRight className="h-4 w-4" />
              </Link>
            )
          ) : blockedNoPsn ? (
            <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="flex items-start gap-2 text-xs text-amber-200/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                Davam etmək üçün PlayStation hesabı əlavə edin.
              </p>
              <Link
                href="/profile/accounts"
                onClick={onNavigate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Hesab əlavə et
              </Link>
            </div>
          ) : blockedNoEpic ? (
            <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="flex items-start gap-2 text-xs text-violet-100/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
                Epic oyununu almaq üçün Türkiyə Epic hesabı lazımdır. Hesabınız
                varsa əlavə edin, yoxdursa açılışını sifarişə əlavə edin.
              </p>
              <button
                type="button"
                onClick={() => setEpicLinkOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                Hesabım var — əlavə et
              </button>

              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-violet-300/60">
                <span className="h-px flex-1 bg-violet-500/20" />
                <span>və ya</span>
                <span className="h-px flex-1 bg-violet-500/20" />
              </div>

              {epicAccountProduct ? (
                <button
                  type="button"
                  onClick={() => setEpicOfferOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Yeni hesab aç ({(epicAccountProduct.priceAznCents / 100).toFixed(2)} AZN)
                </button>
              ) : (
                <Link
                  href="/profile/profiles"
                  onClick={onNavigate}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-100 hover:bg-violet-500/20"
                >
                  Profildən hesab aç
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Compact wallet line — the explanatory "Ödəniş növləri" card
                  group was redundant with the action buttons below, so it was
                  removed. We still surface the wallet balance because users
                  need to know whether they have enough to pay with it. */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5 text-sm">
                <span className="text-zinc-400">Cüzdan balansı</span>
                <span
                  className={`font-semibold tabular-nums ${
                    insufficientWallet ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {walletBalanceAzn.toFixed(2)} AZN
                </span>
              </div>

              {belowMinimum && (
                <div
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Minimum sifariş məbləği <b>{MIN_CART_AZN} AZN</b>-dir. Sebətə{" "}
                    <b>{missingForMinimumAzn.toFixed(2)} AZN</b> dəyərində məhsul
                    əlavə edin ki, ödənişi tamamlaya biləsiniz.
                  </span>
                </div>
              )}

              {insufficientWallet && !belowMinimum ? (
                <Link
                  href="/profile/wallet"
                  onClick={onNavigate}
                  className="group flex w-full items-center justify-between rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98]"
                >
                  <span>Balansı artır</span>
                  <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs">
                    {(totalAzn - walletBalanceAzn).toFixed(2)} AZN çatmır
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => checkout("wallet")}
                  disabled={busy || belowMinimum || insufficientWallet}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "İşlənir..." : "Cüzdanla ödə"}
                </button>
              )}

              <button
                type="button"
                onClick={() => checkout("epoint")}
                disabled={busy || belowMinimum}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "İşlənir..." : "Kartla birbaşa ödə"}
              </button>

              {EPOINT_WIDGET_ENABLED ? (
                <>
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
                    <span className="h-px flex-1 bg-zinc-800" />
                    <span>və ya</span>
                    <span className="h-px flex-1 bg-zinc-800" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => checkout("epoint-widget", "apple")}
                      disabled={busy || belowMinimum}
                      aria-label="Apple Pay ilə ödə"
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 transition hover:border-zinc-400 hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Image
                        src="/apple-pay.png"
                        alt="Apple Pay"
                        width={96}
                        height={40}
                        className="h-10 w-auto object-contain"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => checkout("epoint-widget", "google")}
                      disabled={busy || belowMinimum}
                      aria-label="Google Pay ilə ödə"
                      className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-zinc-700 bg-white px-4 transition hover:border-zinc-400 hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Image
                        src="/google-pay.webp"
                        alt="Google Pay"
                        width={64}
                        height={28}
                        className="h-7 w-auto object-contain"
                      />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>

        {message && (
          <div
            className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
              message.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                : "bg-red-500/10 text-red-300 border border-red-500/20"
            }`}
          >
            {message.kind === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            )}
            <span className="leading-snug">{message.text}</span>
          </div>
        )}

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => clear()}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Səbəti təmizlə
          </button>
        </div>
      </aside>
    </div>

    {(() => {
      // Recommend within the cart's game storefront: Epic cart → Epic games,
      // PS cart → PS games. A cart with no games (only streaming / platform /
      // gift cards) gets store=null → no recommendations.
      const cartGames = items.filter(
        (i) => i.productType === "GAME" || i.productType === "ADDON"
      );
      const recommendStore: "PS" | "EPIC" | null =
        cartGames.length === 0
          ? null
          : cartGames.some((i) => i.store === "EPIC")
            ? "EPIC"
            : "PS";
      return (
        <CartSimilarGames
          cartGameIds={cartGames.map((i) => i.id)}
          store={recommendStore}
        />
      );
    })()}

      {accountEdit && accountEditLine ? (
        <AccountCreationCartEditModal
          key={accountEdit.key}
          open
          item={accountEditLine}
          onClose={() => setAccountEdit(null)}
        />
      ) : null}

      {platformEdit && platformEditLine ? (
        <PlatformCartEditModal
          key={platformEdit.key}
          open
          item={platformEditLine}
          onClose={() => setPlatformEdit(null)}
        />
      ) : null}

      {widget ? (
        <EpointWidgetModal
          widgetUrl={widget.url}
          successUrl={widget.successUrl}
          errorUrl={widget.errorUrl}
          title={widget.brand === "apple" ? "Apple Pay" : "Google Pay"}
          onClose={() => setWidget(null)}
        />
      ) : null}

      {epicAccountProduct ? (
        <EpicAccountOfferModal
          open={epicOfferOpen}
          onClose={() => setEpicOfferOpen(false)}
          product={epicAccountProduct}
        />
      ) : null}

      <EpicAccountLinkModal
        open={epicLinkOpen}
        onClose={() => setEpicLinkOpen(false)}
        onAdded={handleEpicAccountAdded}
      />
    </>
  );
}

/** Hədiyyə alışından sonra yığcam uğur ekranı — hər hədiyyə üçün "dostuna göndər". */
function GiftCheckoutSuccess({
  gifts,
  orderCode,
  onNavigate,
}: {
  gifts: { title: string; code: string; formattedCode: string }[];
  orderCode?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 shadow-lg shadow-emerald-500/5 sm:p-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Hədiyyəniz hazırdır 🎁</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-zinc-400">
          {gifts.length > 1 ? "Kodlar" : "Kod"} email ünvanınıza da göndərildi.
          {orderCode ? (
            <> Sifariş kodu: <span className="font-mono text-zinc-300">{orderCode}</span></>
          ) : null}
        </p>
      </div>

      <div className="mx-auto mt-5 max-w-md space-y-3">
        {gifts.map((g) => (
          <GiftDeliveryCard key={g.code} title={g.title} code={g.code} formattedCode={g.formattedCode} />
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
        {onNavigate ? (
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Alış-verişə davam et
          </button>
        ) : (
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Alış-verişə davam et
          </Link>
        )}
        <Link
          href="/profile/orders"
          onClick={onNavigate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
        >
          Sifarişlərimə bax
        </Link>
      </div>
    </div>
  );
}

function GiftDeliveryCard({
  title,
  code,
  formattedCode,
}: {
  title: string;
  code: string;
  formattedCode: string;
}) {
  const [phase, setPhase] = useState<"idle" | "input" | "sending" | "sent">("idle");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(formattedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function send() {
    if (!phone.trim()) {
      setError("Dostunuzun WhatsApp nömrəsini yazın.");
      return;
    }
    setPhase("sending");
    setError(null);
    try {
      const res = await fetch("/api/gifts/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPhase("sent");
      } else if (typeof data?.waLink === "string") {
        // WaSender əlçatan deyil və ya göndərmə alınmadı — WhatsApp-ı manual aç.
        window.open(data.waLink, "_blank", "noopener,noreferrer");
        setPhase("sent");
      } else if (data?.reason === "INVALID_PHONE") {
        setError("Nömrə düzgün deyil. Beynəlxalq formatda yazın, məs: +99450...");
        setPhase("input");
      } else {
        setError("Göndərilmədi. Nömrəni yoxlayıb yenidən cəhd edin.");
        setPhase("input");
      }
    } catch {
      setError("Şəbəkə xətası. Yenidən cəhd edin.");
      setPhase("input");
    }
  }

  return (
    <div className="rounded-xl border border-fuchsia-500/25 bg-zinc-950/40 p-3.5 text-left">
      <p className="truncate text-xs text-zinc-400">{title}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-lg font-bold tracking-wider text-white">{formattedCode}</span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>

      {phase === "sent" ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Dostunuza WhatsApp ilə göndərildi.
        </div>
      ) : phase === "input" || phase === "sending" ? (
        <div className="mt-2.5 space-y-2">
          <input
            type="tel"
            inputMode="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Dostunun WhatsApp nömrəsi (+99450...)"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500/60"
          />
          {error ? <p className="text-[11px] text-rose-300">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={send}
              disabled={phase === "sending"}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#20bd5a] disabled:opacity-50"
            >
              {phase === "sending" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Göndərilir…</>
              ) : (
                <><Send className="h-4 w-4" /> Göndər</>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setPhase("idle"); setError(null); }}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800"
            >
              Ləğv et
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPhase("input")}
          className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-fuchsia-500 hover:to-violet-500"
        >
          <Gift className="h-4 w-4" /> Hədiyyəni dostuna göndər
        </button>
      )}
    </div>
  );
}

function CartLine({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  onEditAccountCreation,
  onEditPlatform,
  onSetGiftMessage,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onEditAccountCreation?: () => void;
  onEditPlatform?: () => void;
  onSetGiftMessage?: (message: string) => void;
}) {
  // Hədiyyə həmişə tək nüsxə (qty 1) — say düymələri gizlədilir.
  const isSingleLicense =
    Boolean(item.gift) ||
    item.productType === "GAME" ||
    item.productType === "PS_PLUS" ||
    item.productType === "EA_PLAY" ||
    item.productType === "ACCOUNT_CREATION" ||
    item.productType === "STREAMING";
  const platformCreds = platformCredentialMeta(item);
  return (
    <li className="flex gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30 p-2.5 shadow-sm transition hover:border-zinc-700/60 hover:bg-zinc-900/50">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900 shadow-inner sm:h-16 sm:w-16">
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="64px"
            className="object-cover"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-1.5 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium text-zinc-100 leading-snug">{item.title}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              {labelForType(item.productType)}
              {item.gift ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-fuchsia-300">
                  🎁 Hədiyyə
                </span>
              ) : null}
            </p>
            {item.gift && onSetGiftMessage ? (
              <div className="mt-2 w-full max-w-md">
                <input
                  type="text"
                  defaultValue={item.gift.message ?? ""}
                  onChange={(e) => onSetGiftMessage(e.target.value)}
                  maxLength={300}
                  placeholder="Dostuna mesaj (opsional)"
                  className="w-full rounded-md border border-fuchsia-500/25 bg-zinc-950/50 px-2.5 py-1.5 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-fuchsia-500/60"
                />
              </div>
            ) : null}
            {item.productType === "STREAMING" && item.streaming?.gmail ? (
              <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-fuchsia-500/25 bg-fuchsia-500/[0.07] px-2 py-1">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-fuchsia-300">
                  Gmail
                </span>
                <span className="truncate text-[11px] font-medium text-zinc-200">
                  {item.streaming.gmail}
                </span>
              </div>
            ) : null}
            {item.productType === "PLATFORM" && item.streaming?.accounts?.length ? (
              <div
                className={`mt-1.5 w-full max-w-md space-y-1.5 rounded-md border px-2.5 py-1.5 ${platformCreds.accentClass}`}
              >
                {item.streaming.accounts.map((acc, idx) => (
                  <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${platformCreds.labelTextClass}`}>
                      Hesab {idx + 1}
                    </span>
                    <span className="truncate text-[11px] font-medium text-zinc-200">
                      {acc.email}
                    </span>
                    {acc.password && (
                      <span className="font-mono text-[11px] tracking-wider text-zinc-400">
                        {"•".repeat(Math.min(acc.password.length, 8))}
                      </span>
                    )}
                  </div>
                ))}
                {onEditPlatform ? (
                  <button
                    type="button"
                    onClick={onEditPlatform}
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold ${platformCreds.labelTextClass} transition hover:text-white`}
                  >
                    <Pencil className="h-3 w-3" />
                    Redaktə
                  </button>
                ) : null}
              </div>
            ) : item.productType === "PLATFORM" && item.streaming?.gmail ? (
              <div
                className={`mt-1.5 flex w-full max-w-md flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-2.5 py-1.5 ${platformCreds.accentClass}`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`text-[9px] font-semibold uppercase tracking-wider ${platformCreds.labelTextClass}`}>
                    {platformCreds.emailLabel}
                  </span>
                  <span className="truncate text-[11px] font-medium text-zinc-200">
                    {item.streaming.gmail}
                  </span>
                </div>
                {item.streaming.password && (
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${platformCreds.labelTextClass}`}>
                      Şifrə
                    </span>
                    <span className="font-mono text-[11px] tracking-wider text-zinc-300">
                      {"•".repeat(Math.min(item.streaming.password.length, 8))}
                    </span>
                  </div>
                )}
                {onEditPlatform ? (
                  <button
                    type="button"
                    onClick={onEditPlatform}
                    className={`ml-auto inline-flex items-center gap-1 text-[10px] font-semibold ${platformCreds.labelTextClass} transition hover:text-white`}
                  >
                    <Pencil className="h-3 w-3" />
                    Redaktə
                  </button>
                ) : null}
              </div>
            ) : null}
            {item.productType === "ACCOUNT_CREATION" ? (
              <div className="mt-1.5 w-full max-w-md space-y-1 rounded-md border border-fuchsia-500/25 bg-fuchsia-500/[0.07] px-2.5 py-1.5">
                {item.accountCreation?.fullName ? (
                  <p className="text-[10px] text-zinc-400">
                    {item.accountCreation.fullName}
                    {item.accountCreation.birthDate ? ` · ${item.accountCreation.birthDate}` : ""}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  <span>
                    <span className="text-zinc-500">E-poçt:</span>{" "}
                    <span className="break-all font-medium text-zinc-200">
                      {item.accountCreation?.email ?? "—"}
                    </span>
                  </span>
                  <span>
                    <span className="text-zinc-500">Şifrə:</span>{" "}
                    <span className="font-mono font-medium text-zinc-200">
                      {item.accountCreation?.password
                        ? "•".repeat(Math.min(item.accountCreation.password.length, 8))
                        : "—"}
                    </span>
                  </span>
                </div>
                {onEditAccountCreation ? (
                  <button
                    type="button"
                    onClick={onEditAccountCreation}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-fuchsia-300 transition hover:text-fuchsia-200"
                  >
                    <Pencil className="h-3 w-3" />
                    Redaktə
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="group rounded-md p-1 transition hover:bg-red-500/10"
            aria-label="Sil"
          >
            <Trash2 className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-red-400" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          {isSingleLicense ? (
            <span />
          ) : (
            <div className="inline-flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-950/50 p-0.5">
              <button
                type="button"
                onClick={onDecrement}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-[1.25rem] text-center text-[11px] font-semibold tabular-nums text-zinc-200">
                {item.qty}
              </span>
              <button
                type="button"
                onClick={onIncrement}
                className="rounded p-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}

          <span className="ml-auto text-sm font-bold tabular-nums text-white">
            {(item.finalAzn * item.qty).toFixed(2)} AZN
          </span>
        </div>
      </div>
    </li>
  );
}

function labelForType(t: string) {
  switch (t) {
    case "GAME":
      return "Oyun";
    case "ADDON":
      return "Əlavə / DLC";
    case "CURRENCY":
      return "Pul kartı";
    case "PS_PLUS":
      return "PS Plus";
    case "EA_PLAY":
      return "EA Play";
    case "TRY_BALANCE":
      return "Hədiyyə Kartı";
    case "HONSELL_GIFT_CARD":
      return "Honsell Hədiyyə Kartı";
    case "ACCOUNT_CREATION":
      return "PSN Hesab Açılışı";
    case "STREAMING":
      return "Streaming abunəliyi";
    case "PLATFORM":
      return "Platform abunəliyi";
    default:
      return "Digər";
  }
}

/** PLATFORM (LinkedIn / YouTube / digər) item-i üçün credentials qutusunun rəngi və label-i. */
function platformCredentialMeta(item: CartItem): {
  emailLabel: string;
  accentClass: string;
  labelTextClass: string;
} {
  const kind = item.streaming?.platformKind;
  if (kind === "LINKEDIN") {
    return {
      emailLabel: "LinkedIn email",
      accentClass: "border-sky-500/25 bg-sky-500/[0.07]",
      labelTextClass: "text-sky-300",
    };
  }
  if (kind === "YOUTUBE") {
    return {
      emailLabel: "YouTube (Gmail)",
      accentClass: "border-red-500/25 bg-red-500/[0.07]",
      labelTextClass: "text-red-300",
    };
  }
  if (kind === "SPOTIFY") {
    return {
      emailLabel: "Spotify hesabı",
      accentClass: "border-emerald-500/25 bg-emerald-500/[0.07]",
      labelTextClass: "text-emerald-300",
    };
  }
  return {
    emailLabel: "Hesab email",
    accentClass: "border-zinc-700/50 bg-zinc-800/30",
    labelTextClass: "text-zinc-300",
  };
}

function AccountDropdown({
  accounts,
  value,
  onChange,
}: {
  accounts: PsnOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value) || accounts[0];

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!open) return;
    const handleDocClick = () => setOpen(false);
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    
    // Add small delay to prevent immediate close on the opening click
    const timer = setTimeout(() => {
      document.addEventListener("click", handleDocClick);
      document.addEventListener("keydown", handleKeydown);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex w-full items-center justify-between rounded-lg border bg-zinc-950/50 px-3 py-2.5 text-sm transition ${
          open
            ? "border-indigo-500/50 ring-1 ring-indigo-500/50"
            : "border-zinc-800/80 hover:border-zinc-700/80"
        }`}
      >
        <div className="flex flex-col text-left">
          <span className="flex items-center gap-2 font-medium text-zinc-200">
            {selected?.label}
            {selected?.psModel && (
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
                {selected.psModel}
              </span>
            )}
          </span>
          <span className="text-xs text-zinc-500">{selected?.psnEmail}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-180 text-indigo-400" : ""
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 z-50 mt-2 w-full origin-top overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl"
          style={{ animation: "dropdown-in 150ms ease-out forwards" }}
        >
          <div className="flex max-h-60 flex-col overflow-y-auto">
            {accounts.map((a) => {
              const isSelected = a.id === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "bg-indigo-500/10 text-indigo-300"
                      : "text-zinc-300 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 font-medium">
                      {a.label}
                      {a.psModel && (
                        <span className="text-[10px] text-zinc-500 opacity-80">
                          {a.psModel}
                        </span>
                      )}
                    </span>
                    <span className="text-xs opacity-70">{a.psnEmail}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-indigo-400" />}
                </button>
              );
            })}
          </div>
          <style jsx>{`
            @keyframes dropdown-in {
              from {
                opacity: 0;
                transform: translateY(-4px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

function EpicAccountDropdown({
  accounts,
  value,
  onChange,
}: {
  accounts: EpicOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === value) || accounts[0];

  useEffect(() => {
    if (!open) return;
    const handleDocClick = () => setOpen(false);
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", handleDocClick);
      document.addEventListener("keydown", handleKeydown);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`group flex w-full items-center justify-between rounded-lg border bg-zinc-950/50 px-3 py-2.5 text-sm transition ${
          open ? "border-violet-500/50 ring-1 ring-violet-500/50" : "border-zinc-800/80 hover:border-zinc-700/80"
        }`}
      >
        <div className="flex flex-col text-left">
          <span className="font-medium text-zinc-200">{selected?.displayName || selected?.label}</span>
          <span className="text-xs text-zinc-500">{selected?.epicEmail}</span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180 text-violet-400" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-full origin-top overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl">
          <div className="flex max-h-60 flex-col overflow-y-auto">
            {accounts.map((a) => {
              const isSelected = a.id === value;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-violet-500/10 text-violet-300" : "text-zinc-300 hover:bg-zinc-800/80"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{a.displayName || a.label}</span>
                    <span className="text-xs opacity-70">{a.epicEmail}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-violet-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
