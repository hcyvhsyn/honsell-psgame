/**
 * Müxtəlif YouTube URL formatlarından video ID-sini çıxarır.
 *   https://www.youtube.com/watch?v=abc123
 *   https://youtu.be/abc123
 *   https://www.youtube.com/embed/abc123
 *   https://www.youtube.com/shorts/abc123
 *   abc123 (yalnız ID)
 */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // Sadəcə ID gələ bilər (11 simvol, alphanumeric + _ + -)
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const segs = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /v/ID
      for (const prefix of ["embed", "shorts", "v"]) {
        const idx = segs.indexOf(prefix);
        if (idx >= 0 && segs[idx + 1] && /^[A-Za-z0-9_-]{11}$/.test(segs[idx + 1])) {
          return segs[idx + 1];
        }
      }
    }
  } catch {
    // URL parse uğursuz oldu
  }
  return null;
}

export function youTubeEmbedUrl(id: string, opts: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (opts.autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${id}?${params}`;
}
