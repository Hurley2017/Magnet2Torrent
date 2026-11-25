'use strict';

const cheerio = require('cheerio');

const PROVIDER_TIMEOUT_MS = 4000;
const MEDIA_TIMEOUT_MS = 2500;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.bittor.pw:1337/announce',
  'udp://public.popcorn-tracker.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
];

const ALLOWED_MAGNET_HOSTS = new Set([
  '1337x.to',
  'www.1337x.to',
  'x1337x.cc',
  'www.limetorrents.lol',
  'limetorrents.lol',
  'www.limetorrents.info',
  'limetorrents.info',
  'eztvx.to',
  'eztv.re',
  'nyaa.si',
  'archive.org',
]);

const PROVIDERS = [
  { name: 'ThePirateBay', description: 'Public index API with direct magnet links', baseUrl: 'https://apibay.org' },
  { name: 'Knaben', description: 'Multi-tracker aggregator with live seeder counts', baseUrl: 'https://api.knaben.org' },
  { name: 'TorrentsCSV', description: 'Open-source collaborative torrent index', baseUrl: 'https://torrents-csv.com' },
  { name: 'LimeTorrents', description: 'Multi-category public torrent directory', baseUrl: 'https://www.limetorrents.lol' },
  { name: 'InternetArchive', description: 'Public-domain software, books, audio, and movies', baseUrl: 'https://archive.org' },
  { name: 'Nyaa', description: 'Anime, manga, and open media index', baseUrl: 'https://nyaa.si' },
  { name: 'SubsPlease', description: 'Anime releases API with direct magnet links', baseUrl: 'https://subsplease.org' },
  { name: '1337x', description: 'General public torrent index', baseUrl: 'https://www.1337x.to' },
  { name: 'EZTV', description: 'TV episodes and series index', baseUrl: 'https://eztvx.to' },
];

const VIDEO_SIGNAL_RE =
  /\b(2160p|1080p|720p|480p|4k|uhd|bluray|bdrip|brrip|web-dl|webrip|dvdrip|hdrip|hdtv|x264|x265|hevc|yify|yts|s\d{1,2}e\d{1,2}|s\d{2}|season\s*\d+|complete\s+series|mkv|mp4)\b/i;
const SERIES_SIGNAL_RE = /\b(s\d{1,2}e\d{1,2}|s\d{2}|season\s*\d+|complete\s+series)\b/i;
const NON_MEDIA_QUERY_RE =
  /\b(ubuntu|debian|archlinux|fedora|mint|kali|linux|iso|windows\s*\d*|macos|apk|exe|dmg|msi|software|installer|firmware|driver|blender|libreoffice|gimp|ebook|pdf|epub)\b/i;

function buildMagnet(infoHash, title) {
  const cleanHash = String(infoHash || '').trim();
  const tr = DEFAULT_TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join('&');
  return `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(title || 'Magnet2Torrent')}&${tr}`;
}

function humanizeSize(bytesInput) {
  const bytes = typeof bytesInput === 'string' ? Number(bytesInput) : bytesInput;
  if (!Number.isFinite(bytes) || bytes <= 0) return 'N/A';
  const thresh = 1024;
  if (bytes < thresh) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let val = bytes;
  let u = -1;
  do {
    val /= thresh;
    ++u;
  } while (val >= thresh && u < units.length - 1);
  return `${val.toFixed(u >= 2 ? 2 : 1)} ${units[u]}`;
}

function parseSizeToBytes(sizeStr) {
  if (!sizeStr) return 0;
  const match = String(sizeStr).trim().match(/^([\d.,]+)\s*(b|kb|kib|mb|mib|gb|gib|tb|tib)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    tb: 1024 ** 4,
    tib: 1024 ** 4,
  };
  return Math.round(num * (multipliers[unit] ?? 1));
}

function parseIntSafe(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
  if (typeof val === 'string') {
    const n = parseInt(val.replace(/,/g, '').trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function formatAgeFromEpoch(epochSec) {
  if (!Number.isFinite(epochSec) || epochSec <= 0) return '';
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

async function fetchText(url, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Provider Searches ────────────────────────────────────────────────────────

async function searchThePirateBay(query) {
  const data = await fetchJson(`https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=`);
  if (!Array.isArray(data)) return [];
  return data
    .filter(
      (r) =>
        r &&
        r.id !== '0' &&
        r.info_hash &&
        r.info_hash !== '0000000000000000000000000000000000000000' &&
        r.name !== 'No results returned'
    )
    .map((r) => {
      const bytes = Number(r.size) || 0;
      return {
        id: `tpb-${r.id}`,
        title: r.name,
        provider: 'ThePirateBay',
        size: humanizeSize(bytes),
        sizeBytes: bytes,
        seeds: parseIntSafe(r.seeders),
        peers: parseIntSafe(r.leechers),
        time: formatAgeFromEpoch(Number(r.added)),
        magnet: buildMagnet(r.info_hash, r.name),
        desc: `https://thepiratebay.org/description.php?id=${r.id}`,
      };
    });
}

async function searchKnaben(query) {
  const json = await fetchJson('https://api.knaben.org/v1', {
    method: 'POST',
    body: JSON.stringify({
      query,
      size: 35,
      order_by: 'seeders',
      order_direction: 'desc',
      hide_unsafe: true,
    }),
  });
  if (!Array.isArray(json?.hits)) return [];
  return json.hits
    .filter((h) => h && h.title && (h.magnetUrl || h.hash))
    .map((h) => ({
      id: `knaben-${h.id}`,
      title: h.title,
      provider: 'Knaben',
      size: humanizeSize(h.bytes || 0),
      sizeBytes: Number(h.bytes) || 0,
      seeds: parseIntSafe(h.seeders),
      peers: parseIntSafe(h.peers),
      time: h.date ? h.date.slice(0, 10) : '',
      magnet: h.magnetUrl || buildMagnet(h.hash || '', h.title),
      desc: h.details || undefined,
    }));
}

async function searchTorrentsCsv(query) {
  const json = await fetchJson(
    `https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=35`
  );
  if (!Array.isArray(json?.torrents)) return [];
  return json.torrents
    .filter((t) => t && t.infohash && t.name)
    .map((t, idx) => ({
      id: `tcsv-${t.id ?? idx}-${t.infohash.slice(0, 8)}`,
      title: t.name,
      provider: 'TorrentsCSV',
      size: humanizeSize(t.size_bytes),
      sizeBytes: Number(t.size_bytes) || 0,
      seeds: parseIntSafe(t.seeders),
      peers: parseIntSafe(t.leechers),
      time: formatAgeFromEpoch(Number(t.created_unix)),
      magnet: buildMagnet(t.infohash, t.name),
    }));
}

async function searchInternetArchive(query) {
  const expr = `(${query}) AND format:"Archive BitTorrent"`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(expr)}` +
    '&fl%5B%5D=identifier,title,item_size,btih,downloads,publicdate&sort%5B%5D=downloads+desc&rows=20&output=json';
  const json = await fetchJson(url);
  const docs = json?.response?.docs;
  if (!Array.isArray(docs)) return [];
  return docs
    .filter((d) => d && d.identifier && d.btih)
    .map((d) => {
      const title = Array.isArray(d.title) ? d.title[0] : d.title || d.identifier;
      const bytes = Number(d.item_size) || 0;
      return {
        id: `ia-${d.identifier}`,
        title,
        provider: 'InternetArchive',
        size: humanizeSize(bytes),
        sizeBytes: bytes,
        seeds: 0,
        peers: 0,
        time: d.publicdate ? d.publicdate.slice(0, 10) : '',
        magnet: buildMagnet(d.btih, title),
        desc: `https://archive.org/details/${d.identifier}`,
      };
    });
}

async function searchLimeTorrents(query) {
  const baseUrl = 'https://www.limetorrents.lol';
  const html = await fetchText(`${baseUrl}/search/all/${encodeURIComponent(query)}/seeds/1/`);
  const $ = cheerio.load(html);
  const results = [];
  $('.table2 tr').each((idx, el) => {
    if (idx === 0) return;
    const nameLink = $(el).find('.tt-name > a:nth-child(2)');
    const title = nameLink.text().trim();
    const href = nameLink.attr('href');
    if (!title || !href) return;
    const desc = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const link = $(el).find('a.csprite_dl14').attr('href') || undefined;
    const seeds = parseIntSafe($(el).find('.tdseed').text());
    const peers = parseIntSafe($(el).find('.tdleech').text());
    const rawTime = $(el).find('td.tdnormal').eq(0).text().trim();
    const time = rawTime.split(' - ')[0]?.trim() || rawTime;
    const size = $(el).find('td.tdnormal').eq(1).text().trim() || 'N/A';

    let magnet;
    if (link) {
      const hashMatch = link.match(/\/([A-Fa-f0-9]{40})\.torrent/);
      if (hashMatch) magnet = buildMagnet(hashMatch[1], title);
    }

    results.push({
      id: `lime-${idx}-${title.slice(0, 12)}`,
      title,
      provider: 'LimeTorrents',
      size,
      sizeBytes: parseSizeToBytes(size),
      seeds,
      peers,
      time,
      magnet,
      desc,
    });
  });
  return results;
}

async function searchNyaa(query) {
  const baseUrl = 'https://nyaa.si';
  const html = await fetchText(`${baseUrl}/?f=0&c=0_0&q=${encodeURIComponent(query)}&s=seeders&o=desc`);
  const $ = cheerio.load(html);
  const results = [];
  $('table.torrent-list tbody tr').each((idx, el) => {
    const titleEl = $(el).find('td:nth-child(2) a:not(.comments)').last();
    const title = titleEl.text().trim();
    const href = titleEl.attr('href');
    if (!title) return;
    const magnet = $(el).find('a[href^="magnet:"]').attr('href') || undefined;
    const size = $(el).find('td:nth-child(4)').text().trim() || 'N/A';
    const time = $(el).find('td:nth-child(5)').text().trim().slice(0, 10);
    const seeds = parseIntSafe($(el).find('td:nth-child(6)').text());
    const peers = parseIntSafe($(el).find('td:nth-child(7)').text());
    const desc = href ? (href.startsWith('http') ? href : `${baseUrl}${href}`) : undefined;
    results.push({
      id: `nyaa-${idx}-${title.slice(0, 12)}`,
      title,
      provider: 'Nyaa',
      size,
      sizeBytes: parseSizeToBytes(size),
      seeds,
      peers,
      time,
      magnet,
      desc,
    });
  });
  return results;
}

async function searchSubsPlease(query) {
  const data = await fetchJson(
    `https://subsplease.org/api/?f=search&tz=UTC&s=${encodeURIComponent(query)}`
  );
  if (!data || Array.isArray(data)) return [];
  const out = [];
  for (const [key, item] of Object.entries(data)) {
    if (!item || !Array.isArray(item.downloads)) continue;
    for (const dl of item.downloads) {
      if (!dl.magnet) continue;
      const sizeMatch = dl.magnet.match(/[?&]xl=(\d+)/);
      const bytes = sizeMatch ? Number(sizeMatch[1]) : 0;
      const dateStr = item.release_date ? new Date(item.release_date).toISOString().slice(0, 10) : '';
      out.push({
        id: `sp-${key}-${dl.res}`,
        title: `[SubsPlease] ${key} (${dl.res}p)`,
        provider: 'SubsPlease',
        size: humanizeSize(bytes),
        sizeBytes: bytes,
        seeds: 0,
        peers: 0,
        time: dateStr,
        magnet: dl.magnet,
        desc: item.page ? `https://subsplease.org/shows/${item.page}` : undefined,
      });
    }
  }
  return out;
}

async function search1337x(query) {
  const baseUrl = 'https://www.1337x.to';
  const html = await fetchText(`${baseUrl}/search/${encodeURIComponent(query)}/1/`);
  const $ = cheerio.load(html);
  const results = [];
  $('tbody > tr').each((idx, el) => {
    const titleLink = $(el).find('td.name a:nth-child(2)');
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;
    const desc = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const seeds = parseIntSafe($(el).find('.seeds').text());
    const peers = parseIntSafe($(el).find('.leeches').text());
    const time = $(el).find('.coll-date').text().trim();
    const sizeCell = $(el).find('.size').clone();
    sizeCell.find('span').remove();
    const size = sizeCell.text().trim() || 'N/A';
    results.push({
      id: `1337x-${idx}-${href.slice(-12)}`,
      title,
      provider: '1337x',
      size,
      sizeBytes: parseSizeToBytes(size),
      seeds,
      peers,
      time,
      desc,
    });
  });
  return results;
}

async function searchEztv(query) {
  const baseUrl = 'https://eztvx.to';
  const slug = encodeURIComponent(query.trim().replace(/\s+/g, '-'));
  const html = await fetchText(`${baseUrl}/search/${slug}`);
  const $ = cheerio.load(html);
  const results = [];
  $('tr.forum_header_border').each((idx, el) => {
    const titleEl = $(el).find('a.epinfo');
    const title = titleEl.text().trim();
    if (!title) return;
    const magnet = $(el).find('a.magnet').attr('href') || undefined;
    const href = titleEl.attr('href');
    const desc = href ? (href.startsWith('http') ? href : `${baseUrl}${href}`) : undefined;
    const size = $(el).find('td.forum_thread_post').eq(3).text().trim() || 'N/A';
    const time = $(el).find('td.forum_thread_post').eq(4).text().trim();
    const seeds = parseIntSafe($(el).find('td.forum_thread_post_end').text());
    results.push({
      id: `eztv-${idx}-${title.slice(0, 12)}`,
      title,
      provider: 'EZTV',
      size,
      sizeBytes: parseSizeToBytes(size),
      seeds,
      peers: 0,
      time,
      magnet,
      desc,
    });
  });
  return results;
}

const PROVIDER_RUNNERS = {
  ThePirateBay: searchThePirateBay,
  Knaben: searchKnaben,
  TorrentsCSV: searchTorrentsCsv,
  LimeTorrents: searchLimeTorrents,
  InternetArchive: searchInternetArchive,
  Nyaa: searchNyaa,
  SubsPlease: searchSubsPlease,
  '1337x': search1337x,
  EZTV: searchEztv,
};

// ─── Media Dossier Helpers ───────────────────────────────────────────────────

function cleanMediaQuery(rawQuery) {
  return rawQuery
    .replace(/\bS\d{1,2}(?:E\d{1,2})?\b/gi, ' ')
    .replace(/\bSeason\s*\d+\b/gi, ' ')
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|bluray|bdrip|brrip|web-dl|webrip|hdrip|dvdrip|x264|x265|hevc)\b/gi, ' ')
    .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  if (!html) return undefined;
  const cleaned = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

async function prefetchMediaCandidates(rawQuery) {
  if (NON_MEDIA_QUERY_RE.test(rawQuery)) return null;
  const cleaned = cleanMediaQuery(rawQuery) || rawQuery.trim();
  if (!cleaned || cleaned.length < 2) return null;

  const [mRes, sRes] = await Promise.all([
    fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(cleaned)}.json`, {
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(cleaned)}.json`, {
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const topM = mRes?.metas?.[0];
  const topS = sRes?.metas?.[0];

  return {
    cleaned,
    movie:
      topM && (topM.imdb_id || topM.id)
        ? { id: topM.imdb_id || topM.id, type: 'movie', name: topM.name || cleaned, poster: topM.poster, releaseInfo: topM.releaseInfo }
        : null,
    series:
      topS && (topS.imdb_id || topS.id)
        ? { id: topS.imdb_id || topS.id, type: 'series', name: topS.name || cleaned, poster: topS.poster, releaseInfo: topS.releaseInfo }
        : null,
  };
}

async function fetchFullCinemeta(candidate) {
  const res = await fetch(
    `https://v3-cinemeta.strem.io/meta/${candidate.type}/${encodeURIComponent(candidate.id)}.json`,
    { signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS) }
  );
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
  const full = await res.json();
  const m = full?.meta;
  if (!m) return null;

  const seasons = new Set();
  if (Array.isArray(m.videos)) {
    for (const v of m.videos) {
      if (typeof v.season === 'number' && v.season > 0) seasons.add(v.season);
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

async function fetchTvMazeFallback(query) {
  const res = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const show = await res.json();
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

async function resolveMatchedMedia(prefetched, torrentResults) {
  if (!prefetched) return null;
  const { cleaned, movie, series } = prefetched;
  if (!movie && !series) return null;

  const sample = torrentResults.slice(0, 20);
  if (sample.length === 0) return null;

  let videoHits = 0;
  let seriesHits = 0;
  for (const r of sample) {
    if (VIDEO_SIGNAL_RE.test(r.title)) videoHits += 1;
    if (SERIES_SIGNAL_RE.test(r.title)) seriesHits += 1;
  }
  if (videoHits / sample.length < 0.25) return null;

  const normQuery = normalizeTitle(cleaned);
  const movieExact = movie ? normalizeTitle(movie.name) === normQuery : false;
  const seriesExact = series ? normalizeTitle(series.name) === normQuery : false;
  const episodicResults = seriesHits >= 2 || SERIES_SIGNAL_RE.test(cleaned);

  let chosen = null;
  if (seriesExact && (!movieExact || episodicResults)) chosen = series;
  else if (movieExact && !episodicResults) chosen = movie;
  else if (episodicResults && series) chosen = series;
  else if (movieExact) chosen = movie;
  else if (seriesExact) chosen = series;
  else chosen = episodicResults ? series || movie : movie || series;

  if (!chosen) return null;

  try {
    const full = await fetchFullCinemeta(chosen);
    if (full) return full;
    return chosen.type === 'series' ? await fetchTvMazeFallback(cleaned) : null;
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

function isTorrentMatchingMedia(torrentTitle, media) {
  const normMedia = normalizeTitle(media.name);
  if (!normMedia) return false;
  const withoutGroups = String(torrentTitle || '').replace(/^(\s*\[[^\]]+\]\s*)+/, '').trim();
  const normTorrent = normalizeTitle(withoutGroups);
  if (normTorrent !== normMedia && !normTorrent.startsWith(`${normMedia} `)) return false;
  if (media.type === 'movie' && SERIES_SIGNAL_RE.test(torrentTitle)) return false;

  if (media.type === 'movie' && media.year) {
    const mediaYearMatch = media.year.match(/\b(19\d{2}|20\d{2})\b/);
    const torrentYearMatch = torrentTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (mediaYearMatch && torrentYearMatch) {
      if (Math.abs(Number(mediaYearMatch[1]) - Number(torrentYearMatch[1])) > 1) return false;
    }
  }
  return true;
}

function partitionAndSortResults(sortedBySeeds, media) {
  if (!media) return sortedBySeeds.slice(0, 60);
  const matched = [];
  const rest = [];
  for (const item of sortedBySeeds) {
    if (isTorrentMatchingMedia(item.title, media)) matched.push({ ...item, isExactMatch: true });
    else rest.push({ ...item, isExactMatch: false });
  }
  matched.sort((a, b) => b.seeds - a.seeds);
  rest.sort((a, b) => b.seeds - a.seeds);
  const topMatched = matched.slice(0, 45);
  const remainingSlots = Math.max(20, 70 - topMatched.length);
  return [...topMatched, ...rest.slice(0, remainingSlots)];
}

async function searchAll(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) throw new Error('Search query cannot be empty.');
  const startedAt = Date.now();

  const mediaPromise = prefetchMediaCandidates(query);
  const tasks = PROVIDERS.map(async (info) => {
    const runner = PROVIDER_RUNNERS[info.name];
    const pStart = Date.now();
    try {
      const items = await runner(query);
      return {
        stat: { name: info.name, status: items.length > 0 ? 'ok' : 'empty', count: items.length, durationMs: Date.now() - pStart },
        items,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unavailable';
      const isTimeout = msg.includes('abort') || msg.includes('Timeout') || msg.includes('timed out');
      return {
        stat: { name: info.name, status: isTimeout ? 'timeout' : 'error', count: 0, durationMs: Date.now() - pStart, error: isTimeout ? 'Timed out' : msg },
        items: [],
      };
    }
  });

  const [settled, prefetched] = await Promise.all([Promise.all(tasks), mediaPromise]);
  const providerStats = settled.map((s) => s.stat);
  const rawResults = settled.flatMap((s) => s.items);
  const sortedBySeeds = [...rawResults].sort((a, b) => b.seeds - a.seeds);
  const media = await resolveMatchedMedia(prefetched, sortedBySeeds);
  const results = partitionAndSortResults(sortedBySeeds, media);

  return {
    query,
    totalRawHits: rawResults.length,
    results,
    providerStats,
    media,
    durationMs: Date.now() - startedAt,
  };
}

async function resolveMagnetLink(descUrl, title = '') {
  let parsed;
  try {
    parsed = new URL(descUrl);
  } catch {
    throw new Error('Invalid torrent detail URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol');
  if (!ALLOWED_MAGNET_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Host "${parsed.hostname}" is not an allowlisted torrent provider`);
  }

  const html = await fetchText(parsed.toString(), 5000);
  const $ = cheerio.load(html);
  const directMagnet = $('a[href^="magnet:?xt=urn:btih:"]').first().attr('href');
  if (directMagnet) return directMagnet;

  const hashText = $('.infohash-box span').first().text().trim();
  if (/^[A-Fa-f0-9]{40}$/.test(hashText)) {
    return buildMagnet(hashText, title || 'Magnet2Torrent');
  }

  const rawMatch = html.match(/magnet:\?xt=urn:btih:[A-Za-z0-9]{32,40}[^"'\s<>]*/i);
  if (rawMatch) return rawMatch[0];

  throw new Error('Could not locate magnet link on provider page');
}

module.exports = {
  PROVIDERS,
  searchAll,
  resolveMagnetLink,
  humanizeSize,
};
