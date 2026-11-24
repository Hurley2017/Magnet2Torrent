import type { CategoryKey, MediaMetadata } from './catalog';

const MEDIA_TIMEOUT_MS = 2800;

function cleanMediaQuery(rawQuery: string): string {
  return rawQuery
    .replace(/\bS\d{1,2}(?:E\d{1,2})?\b/gi, ' ')
    .replace(/\bSeason\s*\d+\b/gi, ' ')
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|bluray|bdrip|web-dl|webrip|hdrip|x264|x265|hevc)\b/gi, ' ')
    .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  const cleaned = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

async function fetchCinemeta(
  query: string,
  mediaType: 'movie' | 'series'
): Promise<MediaMetadata | null> {
  const searchUrl = `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/search=${encodeURIComponent(
    query
  )}.json`;
  const catalogRes = await fetch(searchUrl, {
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!catalogRes.ok) return null;

  const catalogJson = (await catalogRes.json()) as {
    metas?: Array<{ id?: string; imdb_id?: string; name?: string; poster?: string; releaseInfo?: string }>;
  };

  const top = catalogJson?.metas?.[0];
  const id = top?.imdb_id || top?.id;
  if (!id) return null;

  const metaUrl = `https://v3-cinemeta.strem.io/meta/${mediaType}/${encodeURIComponent(id)}.json`;
  const metaRes = await fetch(metaUrl, {
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!metaRes.ok) {
    return {
      type: mediaType,
      name: top.name || query,
      poster: top.poster,
      year: top.releaseInfo,
      genres: [],
      imdbId: top.imdb_id,
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

  const full = (await metaRes.json()) as CinemetaFull;
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
    type: mediaType,
    name: m.name || top.name || query,
    poster: m.poster || top.poster,
    rating: m.imdbRating ? String(m.imdbRating) : undefined,
    year: m.releaseInfo || (m.year ? String(m.year) : top.releaseInfo),
    runtime: m.runtime || undefined,
    genres: Array.isArray(m.genres) ? m.genres : Array.isArray(m.genre) ? m.genre : [],
    director: Array.isArray(m.director) ? m.director.slice(0, 3) : undefined,
    cast: Array.isArray(m.cast) ? m.cast.slice(0, 5) : undefined,
    description: m.description || undefined,
    country: m.country || undefined,
    awards: m.awards || undefined,
    episodesCount: Array.isArray(m.videos) && m.videos.length > 0 ? m.videos.length : undefined,
    seasonsCount: seasons.size > 0 ? seasons.size : undefined,
    imdbId: m.imdb_id || top.imdb_id,
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

export async function fetchMediaMetadata(
  rawQuery: string,
  category: CategoryKey
): Promise<MediaMetadata | null> {
  if (category !== 'Movies' && category !== 'TV') {
    return null;
  }

  const cleaned = cleanMediaQuery(rawQuery) || rawQuery.trim();
  if (!cleaned) return null;

  const targetType: 'movie' | 'series' = category === 'Movies' ? 'movie' : 'series';

  try {
    const primary = await fetchCinemeta(cleaned, targetType);
    if (primary) return primary;

    if (targetType === 'series') {
      return await fetchTvMazeFallback(cleaned);
    }
    return null;
  } catch {
    if (targetType === 'series') {
      try {
        return await fetchTvMazeFallback(cleaned);
      } catch {
        return null;
      }
    }
    return null;
  }
}
