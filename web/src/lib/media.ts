import type { MediaMetadata, TorrentResult } from './catalog';

const MEDIA_TIMEOUT_MS = 2500;

const VIDEO_SIGNAL_RE =
  /\b(2160p|1080p|720p|480p|4k|uhd|bluray|bdrip|brrip|web-dl|webrip|dvdrip|hdrip|hdtv|x264|x265|hevc|yify|yts|s\d{1,2}e\d{1,2}|s\d{2}|season\s*\d+|complete\s+series|mkv|mp4)\b/i;
const SERIES_SIGNAL_RE = /\b(s\d{1,2}e\d{1,2}|s\d{2}|season\s*\d+|complete\s+series)\b/i;
const NON_MEDIA_QUERY_RE =
  /\b(ubuntu|debian|archlinux|fedora|mint|kali|linux|iso|windows\s*\d*|macos|apk|exe|dmg|msi|software|installer|firmware|driver|blender|libreoffice|gimp|ebook|pdf|epub)\b/i;

function cleanMediaQuery(rawQuery: string): string {
  return rawQuery
    .replace(/\bS\d{1,2}(?:E\d{1,2})?\b/gi, ' ')
    .replace(/\bSeason\s*\d+\b/gi, ' ')
    .replace(
      /\b(2160p|1080p|720p|480p|4k|uhd|bluray|bdrip|brrip|web-dl|webrip|hdrip|dvdrip|x264|x265|hevc)\b/gi,
      ' '
    )
    .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  const cleaned = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

interface CatalogCandidate {
  id: string;
  type: 'movie' | 'series';
  name: string;
  poster?: string;
  releaseInfo?: string;
}

export async function prefetchMediaCandidates(rawQuery: string): Promise<{
  cleaned: string;
  movie: CatalogCandidate | null;
  series: CatalogCandidate | null;
} | null> {
  if (NON_MEDIA_QUERY_RE.test(rawQuery)) return null;
  const cleaned = cleanMediaQuery(rawQuery) || rawQuery.trim();
  if (!cleaned || cleaned.length < 2) return null;

  const [mRes, sRes] = await Promise.all([
    fetch(
      `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(cleaned)}.json`,
      { signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS), cache: 'no-store' }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(
      `https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(cleaned)}.json`,
      { signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS), cache: 'no-store' }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const topM = mRes?.metas?.[0];
  const topS = sRes?.metas?.[0];

  return {
    cleaned,
    movie:
      topM && (topM.imdb_id || topM.id)
        ? {
            id: topM.imdb_id || topM.id,
            type: 'movie',
            name: topM.name || cleaned,
            poster: topM.poster,
            releaseInfo: topM.releaseInfo,
          }
        : null,
    series:
      topS && (topS.imdb_id || topS.id)
        ? {
            id: topS.imdb_id || topS.id,
            type: 'series',
            name: topS.name || cleaned,
            poster: topS.poster,
            releaseInfo: topS.releaseInfo,
          }
        : null,
  };
}

async function fetchFullCinemeta(candidate: CatalogCandidate): Promise<MediaMetadata | null> {
  const metaUrl = `https://v3-cinemeta.strem.io/meta/${candidate.type}/${encodeURIComponent(
    candidate.id
  )}.json`;
  const res = await fetch(metaUrl, {
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      type: candidate.type,
      name: candidate.name,
      poster: candidate.poster,
      year: candidate.releaseInfo,
      genres: [],
      imdbId: candidate.id,
    };
  }

  type CinemetaFull = {
    meta?: {
      name?: string;
      poster?: string;
      imdbRating?: string;
      releaseInfo?: string;
      year?: string | number;
      runtime?: string;
      genres?: string[];
      genre?: string[];
      director?: string[];
      cast?: string[];
      description?: string;
      country?: string;
      awards?: string;
      imdb_id?: string;
      videos?: Array<{ season?: number }>;
    };
  };

  const full = (await res.json()) as CinemetaFull;
  const m = full?.meta;
  if (!m) return null;

  const seasons = new Set<number>();
  if (Array.isArray(m.videos)) {
    for (const v of m.videos) {
      if (typeof v.season === 'number' && v.season > 0) {
        seasons.add(v.season);
      }
    }
  }

  return {
    type: candidate.type,
    name: m.name || candidate.name,
    poster: m.poster || candidate.poster,
    rating: m.imdbRating ? String(m.imdbRating) : undefined,
    year: m.releaseInfo || (m.year ? String(m.year) : candidate.releaseInfo),
    runtime: m.runtime || undefined,
    genres: Array.isArray(m.genres) ? m.genres : Array.isArray(m.genre) ? m.genre : [],
    director: Array.isArray(m.director) ? m.director.slice(0, 3) : undefined,
    cast: Array.isArray(m.cast) ? m.cast.slice(0, 5) : undefined,
    description: m.description || undefined,
    country: m.country || undefined,
    awards: m.awards || undefined,
    episodesCount: Array.isArray(m.videos) && m.videos.length > 0 ? m.videos.length : undefined,
    seasonsCount: seasons.size > 0 ? seasons.size : undefined,
    imdbId: m.imdb_id || candidate.id,
  };
}

async function fetchTvMazeFallback(query: string): Promise<MediaMetadata | null> {
  const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) return null;

  type TvMazeShow = {
    name?: string;
    premiered?: string;
    ended?: string;
    averageRuntime?: number;
    runtime?: number;
    genres?: string[];
    rating?: { average?: number | null };
    image?: { medium?: string; original?: string };
    summary?: string;
    externals?: { imdb?: string };
  };

  const show = (await res.json()) as TvMazeShow;
  if (!show?.name) return null;

  const startYear = show.premiered ? show.premiered.slice(0, 4) : '';
  const endYear = show.ended ? show.ended.slice(0, 4) : '';
  const year = startYear ? (endYear ? `${startYear}–${endYear}` : `${startYear}–`) : undefined;
  const mins = show.averageRuntime || show.runtime;

  return {
    type: 'series',
    name: show.name,
    poster: show.image?.medium || show.image?.original,
    rating: show.rating?.average ? String(show.rating.average) : undefined,
    year,
    runtime: mins ? `${mins} min` : undefined,
    genres: Array.isArray(show.genres) ? show.genres : [],
    description: stripHtml(show.summary),
    imdbId: show.externals?.imdb,
  };
}

export async function resolveMatchedMedia(
  prefetched: Awaited<ReturnType<typeof prefetchMediaCandidates>>,
  torrentResults: TorrentResult[]
): Promise<MediaMetadata | null> {
  if (!prefetched) return null;
  const { cleaned, movie, series } = prefetched;
  if (!movie && !series) return null;

  // Verify the fetched torrents look like video/movie/series content (avoids matching OS/apps)
  const sample = torrentResults.slice(0, 20);
  if (sample.length === 0) return null;

  let videoHits = 0;
  let seriesHits = 0;
  for (const r of sample) {
    if (VIDEO_SIGNAL_RE.test(r.title)) videoHits += 1;
    if (SERIES_SIGNAL_RE.test(r.title)) seriesHits += 1;
  }

  if (videoHits / sample.length < 0.25) {
    return null;
  }

  const normQuery = normalizeTitle(cleaned);
  const movieExact = movie ? normalizeTitle(movie.name) === normQuery : false;
  const seriesExact = series ? normalizeTitle(series.name) === normQuery : false;
  const episodicResults = seriesHits >= 2 || SERIES_SIGNAL_RE.test(cleaned);

  let chosen: CatalogCandidate | null = null;
  if (seriesExact && (!movieExact || episodicResults)) {
    chosen = series;
  } else if (movieExact && !episodicResults) {
    chosen = movie;
  } else if (episodicResults && series) {
    chosen = series;
  } else if (movieExact) {
    chosen = movie;
  } else if (seriesExact) {
    chosen = series;
  } else {
    chosen = episodicResults ? series || movie : movie || series;
  }

  if (!chosen) return null;

  try {
    const full = await fetchFullCinemeta(chosen);
    if (full) return full;
    if (chosen.type === 'series') {
      return await fetchTvMazeFallback(cleaned);
    }
    return null;
  } catch {
    if (chosen.type === 'series') {
      try {
        return await fetchTvMazeFallback(cleaned);
      } catch {
        return null;
      }
    }
    return null;
  }
}
