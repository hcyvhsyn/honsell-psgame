/**
 * DOM fallback-ları — JSON-da olmayan sahələr üçün.
 *
 * 1. `readPageMeta` — og:/twitter: meta teqləri + JSON-LD (TVSeries/TVEpisode).
 * 2. `readTrackPanel` — player-in "Audio & Subtitles" panelindəki etiketlər.
 *
 * Hamısı yalnız görünən UI mətnini/atributları oxuyur — media elementinə,
 * `src`-ə və ya DRM-ə toxunmur.
 */
import type { Locator, Page } from "playwright";
import { TRACK_PANEL } from "@/lib/scrapers/hbomaxCollector/selectors";

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  documentTitle: string;
  ldJson: unknown[];
}

export async function readPageMeta(page: Page): Promise<PageMeta> {
  return page.evaluate(() => {
    const meta = (sel: string) => document.querySelector<HTMLMetaElement>(sel)?.content?.trim() || undefined;
    const ldJson: unknown[] = [];
    for (const s of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
      try {
        ldJson.push(JSON.parse(s.textContent || ""));
      } catch {
        /* zədəli JSON-LD — atlanır */
      }
    }
    return {
      title: meta('meta[property="og:title"]') ?? meta('meta[name="twitter:title"]'),
      description: meta('meta[property="og:description"]') ?? meta('meta[name="description"]'),
      image: meta('meta[property="og:image"]') ?? meta('meta[name="twitter:image"]'),
      documentTitle: document.title,
      ldJson,
    };
  });
}

/** "Game of Thrones | HBO Max" → "Game of Thrones". */
export function cleanDocumentTitle(t: string | undefined): string | undefined {
  if (!t) return undefined;
  const cleaned = t.replace(/\s*[|•–-]\s*(HBO\s*Max|Max)\s*$/i, "").replace(/^(watch|izle|смотреть)\s+/i, "").trim();
  return cleaned || undefined;
}

export interface PanelOption {
  label: string;
  group: "audio" | "subtitles" | "unknown";
  selected: boolean;
}

/**
 * Açıq paneldəki seçimləri qruplaşdırır: hər seçim üçün yuxarı qalxılır, başlıq
 * ("Audio"/"Subtitles") daşıyan ilk əcdad seçimin qrupunu təyin edir. Hər iki
 * başlığı daşıyan əcdada çatılsa qrup məlum deyil ("unknown").
 */
export async function readTrackPanel(page: Page, root?: Locator | null): Promise<PanelOption[]> {
  const args = { audioRe: TRACK_PANEL.audioHeading, subRe: TRACK_PANEL.subtitleHeading, optionSelector: TRACK_PANEL.optionSelector };
  return (root ?? page.locator("body")).evaluate(collectPanelOptions, args);
}

interface PanelArgs {
  audioRe: string;
  subRe: string;
  optionSelector: string;
}

// ⚠️ BRAUZERDƏ işləyir (mənbəyi serialize olunur) — xarici dəyişənə, importa və ya
// bu fayldakı başqa funksiyaya müraciət etməməlidir.
function collectPanelOptions(rootEl: Element, { audioRe, subRe, optionSelector }: PanelArgs): PanelOption[] {
  const audioHeading = new RegExp(audioRe, "i");
  const subHeading = new RegExp(subRe, "i");
  const textOf = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();

  const findHeadings = (scope: Element) => {
    const found: Array<{ el: Element; group: "audio" | "subtitles" }> = [];
    // Başlıq namizədləri: qısa mətnli, (demək olar) uşaqsız elementlər.
    for (const el of Array.from(scope.querySelectorAll("h1,h2,h3,h4,h5,h6,[role='heading'],legend,label,span,div,p"))) {
      if (el.children.length > 1) continue;
      const t = textOf(el);
      if (!t || t.length > 30) continue;
      if (audioHeading.test(t)) found.push({ el, group: "audio" });
      else if (subHeading.test(t)) found.push({ el, group: "subtitles" });
    }
    return found;
  };

  // Panel kökü başlıq daşımırsa (yalnız bir sütun tutulub) bütün sənədə keç.
  let scope: Element = rootEl;
  let headings = findHeadings(scope);
  if (!headings.length && rootEl !== document.body) {
    scope = document.body;
    headings = findHeadings(scope);
  }

  const out: PanelOption[] = [];
  const seen: Element[] = [];
  for (const opt of Array.from(scope.querySelectorAll(optionSelector))) {
    // İç-içə uyğunluqda yalnız ən xarici seçim saxlanılır.
    if (seen.some((s) => s.contains(opt))) continue;
    const label = (opt.getAttribute("aria-label") || textOf(opt)).trim();
    if (!label || label.length > 80) continue;
    if (headings.some((h) => h.el === opt)) continue;
    const style = window.getComputedStyle(opt as HTMLElement);
    if (style.display === "none" || style.visibility === "hidden") continue;
    seen.push(opt);

    let group: PanelOption["group"] = "unknown";
    for (let a: Element | null = opt.parentElement; a; a = a.parentElement) {
      const anc = a;
      const inside = headings.filter((h) => anc.contains(h.el));
      if (!inside.length) continue;
      group = new Set(inside.map((h) => h.group)).size === 1 ? inside[0].group : "unknown";
      break;
    }
    const selected =
      opt.getAttribute("aria-checked") === "true" ||
      opt.getAttribute("aria-selected") === "true" ||
      opt.getAttribute("aria-pressed") === "true";
    out.push({ label, group, selected });
  }
  return out;
}

/** Selektor sınanda diaqnostika: görünən düymələrin accessible adları (ekran görüntüsü YOX — media kadrı düşə bilər). */
export async function dumpButtons(page: Page): Promise<Array<{ role: string; name: string; testId?: string }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button, [role='button'], [role='tab'], [role='menuitem'], [role='combobox']"))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .slice(0, 300)
      .map((el) => ({
        role: el.getAttribute("role") ?? el.tagName.toLowerCase(),
        name: (el.getAttribute("aria-label") || (el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
        testId: el.getAttribute("data-testid") ?? undefined,
      }))
  );
}
