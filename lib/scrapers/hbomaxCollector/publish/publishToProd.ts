/**
 * Lokal kollektor DB → prod (HTTPS, `POST <HBOMAX_PUBLISH_URL>/api/hbomax/import`).
 *
 * Prod DB internetə açıq deyil; Mac yalnız token ilə qorunan endpoint-ə gzip paketlər göndərir.
 * Yalnız son UĞURLU göndərişdən sonra dəyişən başlıqlar gedir (`--all` hamısı); vəziyyət
 * `.hbomax-admin/publish-state.json`-dadır (hədəf URL üzrə). Sonda prod-da proyeksiya
 * başladılır və bitməsi gözlənilir — StreamingTitle uyğunlaşması prod kataloquna qarşıdır.
 *
 * Göndərilmir: GLOBAL metadata trekləri, validasiya sübutları (`evidence`), xəta mətnləri.
 */
import { gzipSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { assertCollectorDbSelected, HboCollectorError } from "@/lib/scrapers/hbomaxCollector/errors";
import { hboLog } from "@/lib/scrapers/hbomaxCollector/log";
import { PLATFORM } from "@/lib/scrapers/hbomaxCollector/db/catalogStore";
import { sleep } from "@/lib/scrapers/fetchWithRetry";
import type { ImportTitle } from "@/lib/hbomaxImport";

const STATE_FILE = path.join(process.cwd(), ".hbomax-admin", "publish-state.json");
const MAX_TITLES_PER_BATCH = 40;
const MAX_ROWS_PER_BATCH = 50_000;
const MAX_GZIP_BYTES = 2_500_000;

export interface PublishOptions {
  all?: boolean;
  dryRun?: boolean;
  skipProjection?: boolean;
}

function target() {
  const base = process.env.HBOMAX_PUBLISH_URL?.trim().replace(/\/+$/, "");
  const token = process.env.HBOMAX_IMPORT_TOKEN?.trim();
  // http yalnız lokal sınaq serveri üçün — token açıq kanalda getməsin.
  if (!base || !/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$)/.test(base)) {
    throw new HboCollectorError("CONFIG", "HBOMAX_PUBLISH_URL must be the prod site (https://…)");
  }
  if (!token || token.length < 32) throw new HboCollectorError("CONFIG", "HBOMAX_IMPORT_TOKEN must be set (≥32 chars, same value as on the prod server)");
  return { base, token, endpoint: `${base}/api/hbomax/import` };
}

function readState(): Record<string, string> {
  try {
    return existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, "utf8")) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeState(s: Record<string, string>) {
  mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function loadTitle(id: string): Promise<ImportTitle> {
  const t = await prisma.providerTitle.findUniqueOrThrow({
    where: { id },
    include: {
      regions: true,
      seasons: true,
      episodes: {
        include: {
          regionStates: true,
          tracks: { where: { scope: "REGION" } },
        },
      },
      languages: true,
    },
  });
  return {
    title: {
      id: t.id,
      providerId: t.providerId,
      kind: t.kind,
      title: t.title,
      originalTitle: t.originalTitle,
      description: t.description,
      year: t.year,
      genres: t.genres,
      posterUrl: t.posterUrl,
      backdropUrl: t.backdropUrl,
      providerUrl: t.providerUrl,
      lastMetadataSyncAt: iso(t.lastMetadataSyncAt),
    },
    regions: t.regions.map((r) => ({
      id: r.id,
      region: r.region,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      isCurrentlyAvailable: r.isCurrentlyAvailable,
      consecutiveMissingSyncs: r.consecutiveMissingSyncs,
      missingSince: iso(r.missingSince),
    })),
    seasons: t.seasons.map((s) => ({ id: s.id, providerId: s.providerId, seasonNumber: s.seasonNumber, expectedEpisodes: s.expectedEpisodes })),
    episodes: t.episodes.map((e) => ({
      id: e.id,
      seasonId: e.seasonId,
      providerId: e.providerId,
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      name: e.name,
      providerUrl: e.providerUrl,
      metadataEditId: e.metadataEditId,
      globalTracksHash: e.globalTracksHash,
      lastMetadataSyncAt: iso(e.lastMetadataSyncAt),
      firstSeenAt: e.firstSeenAt.toISOString(),
      lastSeenAt: e.lastSeenAt.toISOString(),
      isCurrentlyListed: e.isCurrentlyListed,
    })),
    // Növbə sahələri (lockedAt, nextAttemptAt, xəta, sübut) prod-a lazım deyil.
    states: t.episodes.flatMap((e) =>
      e.regionStates.map((s) => ({
        id: s.id,
        episodeId: e.id,
        region: s.region,
        status: s.status === "VALIDATING" ? "PENDING" : s.status,
        priority: s.priority,
        validatedEditId: s.validatedEditId,
        validatedGlobalHash: s.validatedGlobalHash,
        lastRegionValidationAt: iso(s.lastRegionValidationAt),
        verifiedAt: iso(s.verifiedAt),
        attempts: s.attempts,
      }))
    ),
    tracks: t.episodes.flatMap((e) =>
      e.tracks.map((k) => ({
        id: k.id,
        episodeId: e.id,
        region: k.region,
        regionStateId: k.regionStateId,
        kind: k.kind,
        type: k.type,
        code: k.code,
        locale: k.locale,
        name: k.name,
        rawLabel: k.rawLabel,
        forced: k.forced,
        position: k.position,
        observedAt: k.observedAt.toISOString(),
      }))
    ),
    languages: t.languages.map((l) => ({
      id: l.id,
      region: l.region,
      kind: l.kind,
      trackGroup: l.trackGroup,
      code: l.code,
      locale: l.locale,
      displayName: l.displayName,
      episodesAvailable: l.episodesAvailable,
      episodesVerified: l.episodesVerified,
      episodesTotal: l.episodesTotal,
      status: l.status,
      computedAt: l.computedAt.toISOString(),
    })),
  };
}

const rowsOf = (t: ImportTitle) => t.regions.length + t.seasons.length + t.episodes.length + t.states.length + t.tracks.length + t.languages.length;

async function call(url: string, token: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    } catch (err) {
      if (attempt >= 4) throw err;
    }
    if (res) {
      if (res.ok) return res.json();
      const text = (await res.text()).slice(0, 300);
      if (res.status === 404) throw new HboCollectorError("CONFIG", `Import endpoint returned 404 — token mismatch, or prod has no HBOMAX_IMPORT_TOKEN / the HBO deploy (${url})`);
      if (res.status < 500 && res.status !== 409 && res.status !== 429) throw new Error(`HTTP ${res.status}: ${text}`);
      if (attempt >= 4) throw new Error(`HTTP ${res.status} after ${attempt} attempts: ${text}`);
    }
    await sleep(5000 * attempt);
  }
}

export interface PublishSummary {
  candidates: number;
  sent: number;
  batches: number;
  episodes: number;
  tracks: number;
  projection?: unknown;
}

export async function publishToProd(opts: PublishOptions): Promise<PublishSummary> {
  assertCollectorDbSelected();
  const { base, token, endpoint } = target();
  const state = readState();
  const since = opts.all ? null : state[base] ? new Date(state[base]) : null;
  const startedAt = new Date();

  const changed = await prisma.providerTitle.findMany({
    where: {
      platform: PLATFORM,
      lastMetadataSyncAt: { not: null },
      ...(since
        ? {
            OR: [
              { updatedAt: { gt: since } },
              { regions: { some: { OR: [{ lastSeenAt: { gt: since } }, { consecutiveMissingSyncs: { gt: 0 } }] } } },
              { episodes: { some: { updatedAt: { gt: since } } } },
              { episodes: { some: { regionStates: { some: { updatedAt: { gt: since } } } } } },
              { languages: { some: { computedAt: { gt: since } } } },
            ],
          }
        : {}),
    },
    select: { id: true },
    orderBy: { title: "asc" },
  });
  hboLog.info(`Publish → ${base}`, { titles: changed.length, since: since?.toISOString() ?? "all" });
  const summary: PublishSummary = { candidates: changed.length, sent: 0, batches: 0, episodes: 0, tracks: 0 };
  if (opts.dryRun) return summary;

  let batch: ImportTitle[] = [];
  let rows = 0;
  const flush = async () => {
    if (!batch.length) return;
    const body = gzipSync(JSON.stringify({ version: 1, titles: batch }));
    const res = (await call(endpoint, token, { method: "POST", headers: { "Content-Type": "application/x-hbomax-batch+gzip" }, body })) as { titles: number; episodes: number; tracks: number };
    summary.sent += res.titles;
    summary.episodes += res.episodes;
    summary.tracks += res.tracks;
    summary.batches++;
    hboLog.info(`Batch ${summary.batches} sent`, { titles: summary.sent, of: changed.length, kb: Math.round(body.length / 1024) });
    batch = [];
    rows = 0;
  };

  for (const { id } of changed) {
    const t = await loadTitle(id);
    const r = rowsOf(t);
    if (batch.length && (batch.length >= MAX_TITLES_PER_BATCH || rows + r > MAX_ROWS_PER_BATCH)) await flush();
    batch.push(t);
    rows += r;
    // Sıxılmış ölçünü ara-sıra yoxla (proxy body limiti).
    if (batch.length % 10 === 0 && gzipSync(JSON.stringify({ version: 1, titles: batch })).length > MAX_GZIP_BYTES) await flush();
  }
  await flush();

  if (!opts.skipProjection) {
    await call(`${endpoint}?action=project`, token, { method: "POST" });
    hboLog.info("Projection started on prod — waiting");
    for (;;) {
      await sleep(10_000);
      const st = (await call(endpoint, token)) as { projection: { running: boolean; summary?: unknown; error?: string } };
      if (!st.projection.running) {
        if (st.projection.error) throw new Error(`Prod projection failed: ${st.projection.error}`);
        summary.projection = st.projection.summary;
        break;
      }
    }
  }
  writeState({ ...state, [base]: startedAt.toISOString() });
  return summary;
}
