import * as cheerio from 'cheerio';
import type { CategoryKey, ProviderInfo, ProviderStat, TorrentResult } from './types';

const PROVIDER_TIMEOUT_MS = 5500;

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
  'torrentproject.cc',
  'nyaa.si',
  'yts.mx',
]);

export const PROVIDERS: ProviderInfo[] = [
  {
    name: 'ThePirateBay',
    description: 'Public index JSON API (apibay) with embedded magnet links',
    baseUrl: 'https://apibay.org',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Books', 'Games', 'Anime', 'XXX'],
    supportsDirectMagnet: true,
  },
  {
    name: '1337x',
    description: 'General public torrent index across all categories',
    baseUrl: 'https://www.1337x.to',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Games', 'Anime', 'XXX'],
    supportsDirectMagnet: false,
  },
  {
    name: 'YTS',
    description: 'Movie releases API with instant magnet hash links',
    baseUrl: 'https://yts.mx',
    categories: ['All', 'Movies'],
    supportsDirectMagnet: true,
  },
  {
    name: 'EZTV',
    description: 'TV episodes and series releases with direct magnets',
    baseUrl: 'https://eztvx.to',
    categories: ['All', 'TV'],
    supportsDirectMagnet: true,
  },
  {
    name: 'LimeTorrents',
    description: 'Multi-category public tracker aggregator',
    baseUrl: 'https://www.limetorrents.lol',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Games', 'Anime'],
    supportsDirectMagnet: false,
  },
  {
    name: 'Nyaa',
    description: 'Anime, manga, and open media torrent index',
    baseUrl: 'https://nyaa.si',
    categories: ['All', 'Anime', 'Books', 'Music'],
    supportsDirectMagnet: true,
  },
  {
    name: 'TorrentProject',
    description: 'Meta-search torrent index with magnet extraction',
    baseUrl: 'https://torrentproject.cc',
    categories: ['All'],
    supportsDirectMagnet: false,
  },
];

export function buildMagnet(infoHash: string, title: string): string {
  const cleanHash = infoHash.trim();
  const tr = DEFAULT_TRACKERS.map((t) => `tr=${encodeURIComponent(t)}`).join('&');
  return `magnet:?xt=urn:btih:${cleanHash}&dn=${encodeURIComponent(title)}&${tr}`;
}

export function humanizeSize(bytesInput: number | string): string {
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

export function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.trim().match(/^([\d.,]+)\s*(b|kb|kib|mb|mib|gb|gib|tb|tib)?/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(num)) return 0;
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers: Record<string, number> = {
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

function parseIntSafe(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    const n = parseInt(cleaned, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

async function fetchText(url: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/json,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

async function fetchJson<T>(url: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function formatAgeFromEpoch(epochSec: number): string {
  if (!Number.isFinite(epochSec) || epochSec <= 0) return '';
  const d = new Date(epochSec * 1000);
  return d.toISOString().slice(0, 10);
}

// ─── Individual Provider Implementations ─────────────────────────────────────

async function searchThePirateBay(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const catMap: Partial<Record<CategoryKey, string>> = {
    All: '',
    Music: '100',
    Movies: '200',
    TV: '200',
    Applications: '300',
    Games: '400',
    XXX: '500',
  };
  const cat = catMap[category] ?? '';
  const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=${cat}`;

  type TpbItem = {
    id: string;
    name: string;
    info_hash: string;
    leechers: string;
    seeders: string;
    size: string;
    added: string;
  };

  const data = await fetchJson<TpbItem[]>(url);
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

async function searchYts(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  if (category !== 'All' && category !== 'Movies') {
    return [];
  }

  const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(query)}&sort_by=seeds&order_by=desc&limit=25`;
  type YtsResp = {
    data?: {
      movies?: Array<{
        id: number;
        title: string;
        title_long?: string;
        year?: number;
        url?: string;
        torrents?: Array<{
          hash: string;
          quality: string;
          type?: string;
          seeds: number;
          peers: number;
          size: string;
          size_bytes?: number;
          date_uploaded?: string;
          url?: string;
        }>;
      }>;
    };
  };

  const json = await fetchJson<YtsResp>(url);
  const movies = json?.data?.movies;
  if (!Array.isArray(movies)) return [];

  const out: TorrentResult[] = [];
  for (const m of movies) {
    if (!Array.isArray(m.torrents)) continue;
    for (const t of m.torrents) {
      if (!t.hash) continue;
      const labelTitle = `${m.title_long || m.title} [${t.quality}${t.type ? ` ${t.type.toUpperCase()}` : ''}]`;
      out.push({
        id: `yts-${m.id}-${t.hash.slice(0, 8)}`,
        title: labelTitle,
        provider: 'YTS',
        size: t.size || humanizeSize(t.size_bytes ?? 0),
        sizeBytes: t.size_bytes || parseSizeToBytes(t.size),
        seeds: parseIntSafe(t.seeds),
        peers: parseIntSafe(t.peers),
        time: t.date_uploaded ? t.date_uploaded.slice(0, 10) : '',
        magnet: buildMagnet(t.hash, labelTitle),
        link: t.url,
        desc: m.url,
      });
    }
  }
  return out;
}

async function search1337x(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const catMap: Partial<Record<CategoryKey, string>> = {
    Movies: 'Movies',
    TV: 'TV',
    Games: 'Games',
    Music: 'Music',
    Anime: 'Anime',
    Applications: 'Apps',
    XXX: 'XXX',
  };
  const mapped = catMap[category];
  const baseUrl = 'https://www.1337x.to';
  const url = mapped
    ? `${baseUrl}/category-search/${encodeURIComponent(query)}/${mapped}/1/`
    : `${baseUrl}/search/${encodeURIComponent(query)}/1/`;

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

  $('tbody > tr').each((idx, el) => {
    const titleLink = $(el).find('td.name a:nth-child(2)');
    const title = titleLink.text().trim();
    const href = titleLink.attr('href');
    if (!title || !href) return;

    const desc = href.startsWith('http') ? href : `${baseUrl}${href}`;
    const seeds = parseIntSafe($(el).find('.seeds').text());
    const peers = parseIntSafe($(el).find('.leeches').text());
    const time = $(el).find('.coll-date').text().trim();
    // Remove inner span from size cell
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

async function searchEztv(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  if (category !== 'All' && category !== 'TV') {
    return [];
  }

  const baseUrl = 'https://eztvx.to';
  const slug = encodeURIComponent(query.trim().replace(/\s+/g, '-'));
  const url = `${baseUrl}/search/${slug}`;
  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

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

async function searchLimeTorrents(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const catMap: Partial<Record<CategoryKey, string>> = {
    All: 'all',
    Movies: 'movies',
    TV: 'tv',
    Games: 'games',
    Music: 'music',
    Applications: 'applications',
    Anime: 'anime',
  };
  const cat = catMap[category] ?? 'all';
  const baseUrl = 'https://www.limetorrents.lol';
  const url = `${baseUrl}/search/${cat}/${encodeURIComponent(query)}/seeds/1/`;

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

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

    // Extract hash from itorrents.org/torrent/<HASH>.torrent if available
    let magnet: string | undefined;
    if (link) {
      const hashMatch = link.match(/\/([A-Fa-f0-9]{40})\.torrent/);
      if (hashMatch) {
        magnet = buildMagnet(hashMatch[1], title);
      }
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
      link,
      desc,
    });
  });

  return results;
}

async function searchNyaa(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  if (category !== 'All' && category !== 'Anime' && category !== 'Books' && category !== 'Music') {
    return [];
  }

  const catCode = category === 'Anime' ? '1_0' : category === 'Books' ? '3_0' : category === 'Music' ? '2_0' : '0_0';
  const baseUrl = 'https://nyaa.si';
  const url = `${baseUrl}/?f=0&c=${catCode}&q=${encodeURIComponent(query)}&s=seeders&o=desc`;

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

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

async function searchTorrentProject(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  if (category !== 'All') return [];
  const baseUrl = 'https://torrentproject.cc';
  const url = `${baseUrl}/?t=${encodeURIComponent(query)}&orderby=seeders`;

  const html = await fetchText(url);
  const $ = cheerio.load(html);
  const results: TorrentResult[] = [];

  $('#similarfiles > div:not(.gac_bb)').each((idx, el) => {
    const a = $(el).find('a').first();
    const title = a.text().trim();
    const href = a.attr('href');
    if (!title || !href) return;

    const desc = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    const spans = $(el).find('span');
    const seeds = parseIntSafe(spans.eq(1).text());
    const peers = parseIntSafe(spans.eq(2).text());
    const time = spans.eq(3).text().trim();
    const size = spans.eq(4).text().trim() || 'N/A';

    results.push({
      id: `tp-${idx}-${title.slice(0, 12)}`,
      title,
      provider: 'TorrentProject',
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

const PROVIDER_RUNNERS: Record<string, (query: string, category: CategoryKey) => Promise<TorrentResult[]>> = {
  ThePirateBay: searchThePirateBay,
  '1337x': search1337x,
  YTS: searchYts,
  EZTV: searchEztv,
  LimeTorrents: searchLimeTorrents,
  Nyaa: searchNyaa,
  TorrentProject: searchTorrentProject,
};

// ─── Unified Search & Magnet Resolution ──────────────────────────────────────

export async function searchAllProviders(
  query: string,
  category: CategoryKey = 'All',
  limit = 20,
  enabledProviders?: string[]
): Promise<{
  results: TorrentResult[];
  totalRawHits: number;
  providerStats: ProviderStat[];
}> {
  const clampedLimit = Math.max(1, Math.min(limit, 50));
  const selectedNames =
    enabledProviders && enabledProviders.length > 0
      ? PROVIDERS.map((p) => p.name).filter((name) => enabledProviders.includes(name))
      : PROVIDERS.map((p) => p.name);

  const tasks = selectedNames.map(async (name): Promise<{ stat: ProviderStat; items: TorrentResult[] }> => {
    const info = PROVIDERS.find((p) => p.name === name);
    if (!info || !info.categories.includes(category)) {
      return {
        stat: { name, status: 'skipped', count: 0, durationMs: 0 },
        items: [],
      };
    }

    const runner = PROVIDER_RUNNERS[name];
    const start = Date.now();
    try {
      const items = await runner(query, category);
      const durationMs = Date.now() - start;
      return {
        stat: {
          name,
          status: items.length > 0 ? 'ok' : 'empty',
          count: items.length,
          durationMs,
        },
        items,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isTimeout = message.includes('abort') || message.includes('Timeout') || message.includes('timed out');
      return {
        stat: {
          name,
          status: isTimeout ? 'timeout' : 'error',
          count: 0,
          durationMs,
          error: message,
        },
        items: [],
      };
    }
  });

  const settled = await Promise.all(tasks);
  const providerStats = settled.map((s) => s.stat);
  const rawResults = settled.flatMap((s) => s.items);

  // Mirror CLI TV pattern filter when TV category is active (fallback to all if none match)
  let filtered = rawResults;
  if (category === 'TV' && rawResults.length > 0) {
    const tvPattern = /\bS\d{1,2}E\d{1,2}\b|\bSeason\b|\bComplete Series\b/i;
    const tvMatches = rawResults.filter((r) => tvPattern.test(r.title));
    if (tvMatches.length > 0) {
      filtered = tvMatches;
    }
  }

  // Sort descending by seeds, mirroring CLI sortBySeeds()
  const sorted = [...filtered]
    .sort((a, b) => b.seeds - a.seeds)
    .slice(0, clampedLimit);

  return {
    results: sorted,
    totalRawHits: rawResults.length,
    providerStats,
  };
}

export async function resolveMagnetLink(descUrl: string, title = ''): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(descUrl);
  } catch {
    throw new Error('Invalid torrent detail URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Unsupported protocol');
  }

  if (!ALLOWED_MAGNET_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`Host "${parsed.hostname}" is not an allowlisted torrent provider`);
  }

  const html = await fetchText(parsed.toString(), 6500);
  const $ = cheerio.load(html);

  // Primary: direct magnet anchor
  const directMagnet = $('a[href^="magnet:?xt=urn:btih:"]').first().attr('href');
  if (directMagnet) return directMagnet;

  // TorrentProject wrapped magnet URL
  const tpHref = $('.usite a[href*="magnet"]').first().attr('href');
  if (tpHref) {
    const m = tpHref.match(/url=(.+)/);
    if (m?.[1]) {
      const decoded = decodeURIComponent(m[1]);
      if (decoded.startsWith('magnet:')) return decoded;
    }
  }

  // Fallback: infohash box (1337x)
  const hashText = $('.infohash-box span').first().text().trim();
  if (/^[A-Fa-f0-9]{40}$/.test(hashText)) {
    return buildMagnet(hashText, title || 'Magnet2Torrent');
  }

  // Generic regex scan inside HTML
  const rawMatch = html.match(/magnet:\?xt=urn:btih:[A-Za-z0-9]{32,40}[^"'\s<>]*/i);
  if (rawMatch) return rawMatch[0];

  throw new Error('Could not locate magnet link on provider page');
}
