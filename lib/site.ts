import { PLAYSTATION_ONLY } from "./storeScope";

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://honsell.site").replace(/\/$/, "");
export const SITE_NAME = "Honsell Store";
export const SITE_TAGLINE = PLAYSTATION_ONLY
  ? "PlayStation oyunları, PS Plus və gift card-lar"
  : "Oyun, streaming və rəqəmsal xidmətlər";
export const SITE_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION = PLAYSTATION_ONLY
  ? "PlayStation oyunları, PS Plus, EA Play, Türkiyə PSN gift card-ları və TR PSN hesabı. Anında çatdırılma, etibarlı ödəniş, ən sərfəli qiymət."
  : "PlayStation oyunları, PS Plus, hədiyyə kartları, Netflix və streaming abunələri, oyun pulları və daha çox rəqəmsal xidmət. Anında çatdırılma, etibarlı ödəniş, ən sərfəli qiymət.";
