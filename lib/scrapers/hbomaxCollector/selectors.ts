/**
 * HBO Max-a xas BÜTÜN selektorlar və mətn nümunələri — TƏK yer.
 *
 * UI dəyişəndə yalnız bu fayl düzəlir. Qayda: avtomatik yaranan CSS sinifləri
 * (`.css-1x2y3z`) YAZMA. Üstünlük sırası: role + accessible name → aria-* →
 * sabit `data-testid` → görünən mətn. Hər element üçün bir neçə namizəd var,
 * birincisi tapılan işlədilir (`firstVisible`).
 *
 * Mətn nümunələri ingiliscə + türkcə + rusca + azərbaycancadır — hesabın UI dili
 * hansı olursa olsun işləsin.
 */
import type { Locator, Page } from "playwright";

export type LocatorFactory = (page: Page) => Locator;

// ── Səhifə vəziyyəti (URL + görünən mətn) ──────────────────────────────────
export const PAGE_STATE = {
  /** Bu URL-lərə yönləndirmə = sessiya yoxdur/bitib. */
  authUrl: /\/(sign-?in|login|signin|auth)(\/|\?|$)|^https?:\/\/auth\.|\/(welcome|subscribe)(\/|\?|$)/i,
  /** Girişli tətbiq yalnız `play.*` hostundadır; sessiyasız `www.hbomax.com` marketinq səhifəsinə atır. */
  appHost: /^play\./i,
  /** HBO-nun ümumi xəta səhifəsi (yanlış/əlçatmaz link, müvəqqəti xəta). */
  errorUrl: /^https?:\/\/[^/]+\/error(\/|\?|$)/i,
  signInText: /^(sign in|log in|daxil ol|giriş yap|oturum aç|войти)$/i,
  profilePickerText: /who'?s watching|kim izliyor|кто смотрит|kim baxır/i,
  geoBlockedText:
    /not (yet )?available in your (region|country|location)|unavailable in your (region|country)|bölgenizde (kullanılamıyor|mevcut değil)|недоступн\S* в вашем (регионе|стране)|bölgənizdə mövcud deyil/i,
  notFoundText:
    /page (not found|doesn'?t exist|could not be found)|this (content|title) is (no longer|not) available|sayfa bulunamadı|страница не найдена|səhifə tapılmadı/i,
  playerErrorText:
    /something went wrong|error code|unable to play|playback error|bir şeyler ters gitti|что-то пошло не так|oynatılamıyor/i,
} as const;

// ── Aktiv profil (real UI 2026-10) ──────────────────────────────────────────
// Header dropdown-u AKTİV profilin adını göstərmir — yalnız avatar; siyahıda yalnız
// keçid edilə bilən DİGƏR profillər var. Bütün profillər "Manage Profiles"-dadır.
export const PROFILE = {
  toggle: '[data-testid="profile_button"]',
  /** Dropdown-dakı DİGƏR profillər — `aria-label` = profil adı. */
  switchItem: '[data-testid="profile_icon"]',
  manageButton: '[data-testid="manage_profiles_button"]',
  /** Manage Profiles: `aria-label` = "Edit ⁨⁨⁨<Ad>⁩, requires profile PIN…, 1 of 5⁩, …" */
  editAvatarButton: '[data-testid="edit_avatar_selection_button"]',
} as const;

/** "Edit ⁨⁨⁨Honsell⁩, requires profile PIN…" → "Honsell" (Unicode bidi izolyatorları atılır). */
export function profileNameFromEditLabel(label: string): string | null {
  const clean = label.replace(/[\u2066-\u2069]/g, "").trim();
  const m = clean.match(/^Edit\s+(.+?)(?:,|$)/);
  return m ? m[1].trim() : null;
}

// ── Profil seçimi ───────────────────────────────────────────────────────────
export const profileButton = (page: Page, name: string): Locator =>
  page.getByRole("button", { name: new RegExp(`^${escapeRegExp(name)}$`, "i") });

// ── Serial səhifəsi ─────────────────────────────────────────────────────────
const SEASON_NAME = /^(season|sezon|сезон)\s*\d+|\d+\.?\s*(sezon|сезон)$/i;
const SEASON_NAME_EXACT = /^\s*((season|sezon|сезон)\s*\d+|\d+\.?\s*(sezon|сезон))\s*$/i;

export const SERIES = {
  seasonNamePattern: SEASON_NAME,
  /** Tab-lar: [role=tab] "Season 1" … */
  seasonTabs: ((page) => page.getByRole("tab", { name: SEASON_NAME })) as LocatorFactory,
  /** Dropdown düyməsi (real UI 2026-10: `button[aria-haspopup]` "Season 3").
   *  ⚠️ Ad TAM uyğun olmalıdır (`$`) və `aria-haspopup` tələb olunur — sezon
   *  yükləndikdən sonra epizod kartlarının adı da "Season 1, Episode 1…" ilə başlayır. */
  seasonDropdown: [
    (page) => page.locator("button[aria-haspopup]").filter({ hasText: SEASON_NAME_EXACT }),
    (page) => page.getByRole("button", { name: SEASON_NAME_EXACT }),
    (page) => page.getByRole("combobox", { name: /season|sezon|сезон/i }),
    (page) => page.locator('[data-testid*="season" i][aria-haspopup]'),
  ] as LocatorFactory[],
} as const;

/** Konkret nömrəli sezon seçimi — sıra indeksi ilə YOX, ada görə (real UI: `li[role=option]` "Season 1"). */
export function seasonOption(page: Page, n: number): Locator {
  const name = new RegExp(`^(season|sezon|сезон)\\s*${n}$|^${n}\\.?\\s*(sezon|сезон)$`, "i");
  return page
    .getByRole("option", { name })
    .or(page.getByRole("menuitemradio", { name }))
    .or(page.getByRole("menuitem", { name }))
    .or(page.getByRole("tab", { name }));
}

/** "S1 E3", "S01E03", "Season 1, Episode 3", "Sezon 1 Bölüm 3", "Сезон 1 Серия 3". */
export const EPISODE_CODE_RE =
  /\bS\s*(\d{1,2})\s*[:,.]?\s*E\s*(\d{1,3})\b|(?:season|sezon|сезон)\s*(\d{1,2})\D{1,12}(?:episode|bölüm|серия|epizod)\s*(\d{1,3})/i;

// ── Player ──────────────────────────────────────────────────────────────────
export const PLAYER = {
  /** Epizod səhifəsi birbaşa player açmırsa — "Play"/"Resume". */
  playButton: [
    (page) => page.getByRole("button", { name: /^(play|watch|resume|start watching|continue watching|izle|oynat|devam et|смотреть|продолжить|izlə|başla)\b/i }),
    (page) => page.getByRole("link", { name: /^(play|watch|resume|start watching|izle|смотреть|izlə)\b/i }),
    (page) => page.locator('[data-testid*="play" i][role="button"], button[data-testid*="play" i]'),
  ] as LocatorFactory[],
  /** Player konteyneri — kontrollar bunun üzərində hover ilə açılır. */
  container: [
    (page) => page.locator('[data-testid*="player" i]'),
    (page) => page.getByRole("region", { name: /player|video/i }),
    (page) => page.locator("video").locator(".."),
  ] as LocatorFactory[],
  /** "Audio & Subtitles" düyməsi. */
  audioSubtitlesButton: [
    (page) => page.getByRole("button", { name: /audio\s*(&|and|\+)?\s*subtitles?|subtitles?\s*(&|and|\+)\s*audio/i }),
    (page) => page.getByRole("button", { name: /^(subtitles|captions|audio|language|languages|altyazı|ses ve altyazı|аудио и субтитры|субтитры|dil|altyazılar)$/i }),
    (page) => page.locator('[data-testid*="audio" i][role="button"], button[data-testid*="audio" i]'),
    (page) => page.locator('[data-testid*="subtitle" i][role="button"], button[data-testid*="subtitle" i]'),
    (page) => page.locator('button[aria-label*="subtitle" i], button[aria-label*="audio" i], button[aria-label*="caption" i]'),
  ] as LocatorFactory[],
  /** Açılan panel. */
  panel: [
    (page) => page.getByRole("dialog"),
    (page) => page.getByRole("menu"),
    (page) => page.locator('[data-testid*="audio" i][data-testid*="panel" i], [data-testid*="track" i][data-testid*="menu" i]'),
  ] as LocatorFactory[],
} as const;

/** Paneldaki bölmə başlıqları (brauzer kontekstində regex mənbəyi kimi ötürülür). */
export const TRACK_PANEL = {
  audioHeading: "^(audio|ses|аудио|звук|səs)$",
  subtitleHeading: "^(subtitles?|captions?|altyazı(lar)?|субтитры|altyazılar)$",
  /** Seçim elementləri — ARIA rolları və sabit atributlar. */
  optionSelector:
    '[role="radio"], [role="menuitemradio"], [role="option"], [role="menuitemcheckbox"], [aria-checked], [aria-selected], li > button, [role="listitem"] button',
} as const;

// ── Köməkçilər ──────────────────────────────────────────────────────────────
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Namizədlərdən ilk görünəni qaytarır, yoxdursa null. */
export async function firstVisible(page: Page, factories: LocatorFactory[], timeoutMs = 3_000): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  do {
    for (const make of factories) {
      const loc = make(page).first();
      if (await loc.isVisible().catch(() => false)) return loc;
    }
    await page.waitForTimeout(250);
  } while (Date.now() < deadline);
  return null;
}
