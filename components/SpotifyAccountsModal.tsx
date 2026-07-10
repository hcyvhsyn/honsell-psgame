"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Info,
  Lock,
  Mail,
  ShieldQuestion,
  ShoppingCart,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import type { PlatformAccountCredential } from "@/lib/cart";

/** Yeni hesab üçün şifrə tələbləri (yalnız "hesabım yoxdur" axınında). */
const SPOTIFY_RESET_URL = "https://www.spotify.com/password-reset/";

function newPasswordChecks(pw: string) {
  return {
    len: pw.length >= 10,
    letter: /[a-zA-Z]/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
  };
}

function newPasswordValid(pw: string) {
  const c = newPasswordChecks(pw);
  return c.len && c.letter && c.special;
}

/** Şifrə qaydalarını canlı (yazdıqca yenilənən) checklist kimi göstərir. */
function PasswordRules({ pw }: { pw: string }) {
  const c = newPasswordChecks(pw);
  const items: { ok: boolean; label: string }[] = [
    { ok: c.len, label: "Ən azı 10 simvol" },
    { ok: c.letter, label: "Ən azı bir hərf" },
    { ok: c.special, label: "Xüsusi simvol (@ # ! % və s.)" },
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
            it.ok
              ? "border-[#1ed760]/40 bg-[#1ed760]/10 text-[#8dffb2]"
              : "border-[#3a2a2a] bg-[#1a0f0f] text-[#c58b8b]"
          }`}
        >
          {it.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Spotify Premium üçün hesab məlumatı toplayan modal (həm /music/spotify
 * səhifəsində, həm də ana səhifə bannerində eyni komponent istifadə olunur).
 *
 * İki axın var — müştərinin Spotify hesabı ola da bilər, olmaya da:
 *   - `hasAccount = true`  → müştərinin MÖVCUD hesabı: email + şifrəni verir,
 *     admin bu hesabı Premium-a keçirir.
 *   - `hasAccount = false` → hesab YOXDUR: müştəri yeni hesab üçün İSTƏDİYİ
 *     email + şifrəni verir, admin bu məlumatlarla yeni hesab yaradır.
 *
 * Hər iki halda sahələr eynidir; fərq `hasAccount` bayrağıdır ki, admin dəqiq
 * bilsin hesabı yaratmalıdır, yoxsa mövcudunu yüksəltməli.
 */
export default function SpotifyAccountsModal({
  title,
  slots,
  hasTerms = false,
  onClose,
  onOpenTerms,
  onSubmit,
}: {
  title: string;
  slots: number;
  hasTerms?: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  onSubmit: (accounts: PlatformAccountCredential[], hasAccount: boolean) => void;
}) {
  const [hasAccount, setHasAccount] = useState(true);
  const [rows, setRows] = useState<PlatformAccountCredential[]>(
    Array.from({ length: slots }, () => ({ email: "", password: "" })),
  );
  const [show, setShow] = useState<boolean[]>(Array.from({ length: slots }, () => false));
  const [acceptedTerms, setAcceptedTerms] = useState(!hasTerms);
  const [err, setErr] = useState<string | null>(null);

  function patch(i: number, key: keyof PlatformAccountCredential, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
    if (err) setErr(null);
  }

  function submit() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned: PlatformAccountCredential[] = [];
    for (let i = 0; i < rows.length; i++) {
      const email = rows[i].email.trim().toLowerCase();
      const password = rows[i].password;
      if (!email || !emailRegex.test(email)) {
        setErr(`${i + 1}-ci hesab üçün düzgün email daxil et.`);
        return;
      }
      if (hasAccount) {
        if (!password || password.length < 4) {
          setErr(`${i + 1}-ci hesab üçün şifrə daxil et (ən az 4 simvol).`);
          return;
        }
      } else if (!newPasswordValid(password)) {
        // Yeni hesab üçün güclü şifrə: 10+ simvol, hərf və xüsusi simvol.
        setErr(
          `${i + 1}-ci hesab üçün şifrə tələblərə uyğun deyil: ən azı 10 simvol, hərf və xüsusi simvol (@ #).`,
        );
        return;
      }
      cleaned.push({ email, password });
    }
    if (hasTerms && !acceptedTerms) {
      setErr("Səbətə əlavə etməzdən əvvəl şərtləri qəbul et.");
      return;
    }
    onSubmit(cleaned, hasAccount);
  }

  const multi = slots > 1;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[min(92vh,760px)] w-full max-w-xl overflow-y-auto rounded-lg border border-[#1ed760]/30 bg-[#030806] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#1ed760]/10 p-5">
          <div>
            <p className="text-lg font-black text-[#f5fff7]">Spotify hesab məlumatları</p>
            <p className="mt-0.5 text-sm text-[#9bad9f]">{title}</p>
          </div>
          <button
            type="button"
            aria-label="Bağla"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#8ea294] transition hover:bg-white/10 hover:text-[#f5fff7]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Hesab var / yoxdur seçimi — müştəridən dəqiq öyrənirik. */}
          <div className="rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#7dffa9]">
              <ShieldQuestion className="h-4 w-4" />
              Spotify hesab{multi ? "ların" : "ın"} var?
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={hasAccount}
                onClick={() => {
                  setHasAccount(true);
                  if (err) setErr(null);
                }}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  hasAccount
                    ? "border-[#1ed760] bg-[#1ed760]/10"
                    : "border-[#23452f] bg-[#030806] hover:border-[#1ed760]/50"
                }`}
              >
                <UserCheck className={`mt-0.5 h-5 w-5 shrink-0 ${hasAccount ? "text-[#1ed760]" : "text-[#6f8477]"}`} />
                <span>
                  <span className="block text-sm font-black text-[#f5fff7]">Bəli, hesabım var</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[#9bad9f]">
                    Mövcud hesab{multi ? "ların" : "ın"} email və şifrəsini ver — Premium ona
                    qoşulacaq.
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-pressed={!hasAccount}
                onClick={() => {
                  setHasAccount(false);
                  if (err) setErr(null);
                }}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition ${
                  !hasAccount
                    ? "border-[#1ed760] bg-[#1ed760]/10"
                    : "border-[#23452f] bg-[#030806] hover:border-[#1ed760]/50"
                }`}
              >
                <Sparkles className={`mt-0.5 h-5 w-5 shrink-0 ${!hasAccount ? "text-[#1ed760]" : "text-[#6f8477]"}`} />
                <span>
                  <span className="block text-sm font-black text-[#f5fff7]">Xeyr, hesabım yoxdur</span>
                  <span className="mt-0.5 block text-xs leading-snug text-[#9bad9f]">
                    İstədiyin email və şifrəni ver — yeni hesab{multi ? "lar" : ""} yaradıb Premium
                    qoşacağıq.
                  </span>
                </span>
              </button>
            </div>
          </div>

          {hasAccount ? (
            <div className="rounded-lg border border-[#1ed760]/20 bg-[#06120a] p-3 text-xs leading-relaxed text-[#9db3a4]">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#7dffa9]" />
                <div>
                  <p className="font-bold text-[#cce6d3]">
                    Şifrənin düzgün olduğuna əmin ol.
                  </p>
                  <p className="mt-1">
                    Səhv şifrə ilə Premium qoşula bilməz. Şifrəndən əmin deyilsənsə, əvvəlcə onu
                    yenilə:
                  </p>
                  <a
                    href={SPOTIFY_RESET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#1ed760]/40 bg-[#1ed760]/10 px-3 py-1.5 text-xs font-black text-[#8dffb2] transition hover:bg-[#1ed760]/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    spotify.com/password-reset
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-relaxed text-[#e7d6a8]">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <p className="font-bold text-[#ffe8a9]">
                    Bu email-ə aid Spotify hesabı OLMADIĞINA əmin ol.
                  </p>
                  <p className="mt-1">
                    Bu email və şifrə ilə sənə YENİ Spotify hesabı yaradılacaq. Əgər email-ə aid
                    hesab artıq varsa, yeni hesab açıla bilməz — bu halda “Bəli, hesabım var”
                    seçimini işlət.
                  </p>
                </div>
              </div>
            </div>
          )}

          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-[#1ed760]/10 bg-[#06120a] p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#7dffa9]">
                {hasAccount ? "Hesab" : "Yeni hesab"} {i + 1}
              </p>
              <label className="block text-sm font-semibold text-[#cce6d3]">
                Email
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7dffa9]" />
                  <input
                    type="email"
                    autoComplete="off"
                    value={row.email}
                    onChange={(e) => patch(i, "email", e.target.value)}
                    placeholder="hesab@example.com"
                    className="h-12 w-full rounded-lg border border-[#23452f] bg-[#030806] pl-12 pr-4 text-sm text-[#f5fff7] outline-none placeholder:text-[#506455] transition focus:border-[#1ed760]"
                  />
                </div>
              </label>
              <label className="mt-3 block text-sm font-semibold text-[#cce6d3]">
                {hasAccount ? "Şifrə" : "İstədiyin şifrə"}
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7dffa9]" />
                  <input
                    type={show[i] ? "text" : "password"}
                    autoComplete="off"
                    value={row.password}
                    onChange={(e) => patch(i, "password", e.target.value)}
                    placeholder={hasAccount ? "Hesab şifrəsi" : "Yeni hesab üçün şifrə"}
                    className="h-12 w-full rounded-lg border border-[#23452f] bg-[#030806] pl-12 pr-12 text-sm text-[#f5fff7] outline-none placeholder:text-[#506455] transition focus:border-[#1ed760]"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#819284] transition hover:bg-white/10 hover:text-[#f5fff7]"
                    aria-label={show[i] ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  >
                    {show[i] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!hasAccount && <PasswordRules pw={row.password} />}
              </label>
            </div>
          ))}

          {hasTerms && (
            <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex min-w-0 items-center gap-3 text-sm font-bold text-[#ffe8a9]">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => {
                      setAcceptedTerms(e.target.checked);
                      if (err) setErr(null);
                    }}
                    className="h-4 w-4 accent-[#1ed760]"
                  />
                  Şərtləri oxudum və qəbul edirəm.
                </label>
                {onOpenTerms && (
                  <button
                    type="button"
                    onClick={onOpenTerms}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/40 px-3 text-xs font-black text-[#ffe8a9] transition hover:bg-amber-300/10"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Şərtlər
                  </button>
                )}
              </div>
            </div>
          )}

          {err && (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
              {err}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-lg border border-[#2d4234] text-sm font-bold text-[#b8c8bd] transition hover:bg-white/10"
            >
              Ləğv et
            </button>
            <button
              type="button"
              onClick={submit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#1ed760] text-sm font-black text-[#031007] transition hover:bg-[#38ef7d]"
            >
              {hasAccount ? <ShoppingCart className="h-5 w-5" /> : <Check className="h-5 w-5" />}
              Səbətə əlavə et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
