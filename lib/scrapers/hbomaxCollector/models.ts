/**
 * HBO Max kataloq kollektorunun normallaşdırılmış modelləri.
 *
 * Layihədə Zod və ya başqa validasiya kitabxanası yoxdur — `lib/scrapers/types.ts`
 * kimi sadə TS interfeysləri işlədilir. Bu modellər hələ DB-yə yazılmır (Phase 1),
 * yalnız `output/hbomax-series.json`-a.
 *
 * `lib/scrapers/types.ts`-dəki `ScrapedTitle`-dan fərqi: orada dillər yalnız
 * tr/ru/en `LanguageCode[]`-dir (vitrin üçün). Burada hər trek ayrıca saxlanılır —
 * kod, göstərilən ad və növ (orijinal/dublyaj/AD/altyazı/CC).
 */

export type LanguageTrackType =
  | "original"
  | "dub"
  | "voice_over"
  | "audio_description"
  | "subtitle"
  | "closed_caption"
  | "unknown";

export interface LanguageTrack {
  /** ISO 639-1 əsas kodu ("en", "tr"). Tanınmayan etiketdə boş qalır — uydurma kod yazılmır. */
  code?: string;
  /** Region/yazı variantı varsa: "pt-BR", "es-419", "zh-Hans". */
  locale?: string;
  /** Platformanın göstərdiyi etiket — DƏYİŞDİRİLMƏDƏN ("Portuguese (Brazil) - Audio Description"). */
  rawLabel: string;
  /** Normallaşdırılmış göstərmə adı: növ işarələri kəsilir, region variantı QALIR
   *  ("Portuguese (Brazil)"). Fərqli locale-lər bir qeydə birləşdirilmir. */
  name: string;
  type: LanguageTrackType;
  /** Yalnız altyazı: "Forced" (məcburi, yalnız xarici dildə danışılan hissələr). */
  forced?: boolean;
}

/** Hər sahənin haradan gəldiyi — Phase 1 hesabatı üçün. */
export type DataSource = "json" | "dom" | "player-ui";

export interface Episode {
  providerId?: string;
  title?: string;
  description?: string;

  seasonNumber: number;
  episodeNumber: number;

  providerUrl?: string;
  /** `video.relationships.edit.id` — versiya barmaq izinin bir hissəsi. */
  metadataEditId?: string;

  audioTracks: LanguageTrack[];
  subtitleTracks: LanguageTrack[];

  /** Treklərin mənbəyi; boşdursa trek hələ yoxlanmayıb. */
  tracksSource?: DataSource;
  /**
   * ⚠️ Treklərin ƏHATƏSİ (Phase 1 validasiyası, AZ, 2026-10-21):
   * - "global-assets" — CMS `edit.attributes.audioTracks/subtitles`: epizodun BÜTÜN
   *   dil aktivləri. Region üzrə süzülMÜR (S03E08: 21 audio / 33 altyazı, AZ player-də 10 / 26).
   * - "region-playable" — player "Audio & Subtitles" panelində görünənlər (AZ-da real seçim).
   */
  tracksScope?: "global-assets" | "region-playable";
  tracksCheckedAt?: string;
}

export interface Season {
  seasonNumber: number;
  providerId?: string;
  episodes: Episode[];
}

export interface Series {
  providerId?: string;

  title: string;
  originalTitle?: string;

  description?: string;

  year?: number;

  genres: string[];

  posterUrl?: string;
  backdropUrl?: string;

  /** Metadata-da orijinal dil açıq yazılıbsa (ISO 639-1). */
  originalLanguage?: string;

  providerUrl: string;

  region: "AZ";

  seasons: Season[];

  /** Sahə adı → mənbə (məs. `{ title: "json", posterUrl: "dom" }`). */
  provenance: Partial<Record<SeriesField, DataSource>>;

  lastCheckedAt: string;
}

export type SeriesField =
  | "providerId"
  | "title"
  | "originalTitle"
  | "description"
  | "year"
  | "genres"
  | "posterUrl"
  | "backdropUrl"
  | "originalLanguage"
  | "seasons";
