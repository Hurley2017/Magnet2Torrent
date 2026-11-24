import * as cheerio from 'cheerio';
import {
  PROVIDERS,
  type CategoryKey,
  type ProviderStat,
  type TorrentResult,
} from './catalog';

const PROVIDER_TIMEOUT_MS = 3500;
const DEFAULT_RESULT_CAP = 60;

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

async function fetchJson<T>(
  url: string,
  options: { method?: 'GET' | 'POST'; body?: string } = {},
  timeoutMs = PROVIDER_TIMEOUT_MS
): Promise<T> {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body,
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
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
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

async function searchKnaben(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const catIds: Partial<Record<CategoryKey, number[]>> = {
    Music: [1000000],
    TV: [2000000],
    Movies: [3000000],
    Applications: [4000000],
    Anime: [6000000],
    Games: [7000000],
    Books: [9000000],
  };

  const payload: Record<string, unknown> = {
    query,
    size: 35,
    order_by: 'seeders',
    order_direction: 'desc',
    hide_unsafe: true,
  };
  if (category !== 'All' && catIds[category]) {
    payload.categories = catIds[category];
  }

  type KnabenHit = {
    id: string;
    title: string;
    bytes: number;
    seeders: number;
    peers: number;
    date?: string;
    magnetUrl?: string;
    hash?: string;
    details?: string;
  };

  const json = await fetchJson<{ hits?: KnabenHit[] }>('https://api.knaben.org/v1', {
    method: 'POST',
    body: JSON.stringify(payload),
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

async function searchTorrentsCsv(query: string): Promise<TorrentResult[]> {
  const url = `https://torrents-csv.com/service/search?q=${encodeURIComponent(query)}&size=35`;
  type CsvTorrent = {
    id?: number;
    infohash: string;
    name: string;
    size_bytes: number;
    created_unix: number;
    seeders: number;
    leechers: number;
  };

  const json = await fetchJson<{ torrents?: CsvTorrent[] }>(url);
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

async function searchInternetArchive(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const mediaFilterMap: Partial<Record<CategoryKey, string>> = {
    Movies: ' AND mediatype:movies',
    Music: ' AND mediatype:audio',
    Books: ' AND mediatype:texts',
    Applications: ' AND mediatype:software',
  };
  const extra = mediaFilterMap[category] ?? '';
  const searchExpr = `(${query}) AND format:"Archive BitTorrent"${extra}`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchExpr)}` +
    '&fl%5B%5D=identifier,title,item_size,btih,downloads,publicdate&sort%5B%5D=downloads+desc&rows=20&output=json';

  type ArchiveDoc = {
    identifier: string;
    title?: string | string[];
    item_size?: number;
    btih?: string;
    publicdate?: string;
  };

  const json = await fetchJson<{ response?: { docs?: ArchiveDoc[] } }>(url);
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
        magnet: buildMagnet(d.btih!, title),
        desc: `https://archive.org/details/${d.identifier}`,
      };
    });
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

async function searchSubsPlease(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  if (category !== 'All' && category !== 'Anime') {
    return [];
  }

  const url = `https://subsplease.org/api/?f=search&tz=UTC&s=${encodeURIComponent(query)}`;
  type SpRelease = {
    show?: string;
    episode?: string;
    release_date?: string;
    page?: string;
    downloads?: Array<{ res: string; magnet: string }>;
  };

  const data = await fetchJson<Record<string, SpRelease> | unknown[]>(url);
  if (!data || Array.isArray(data)) return [];

  const out: TorrentResult[] = [];
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

async function search1337x(query: string, category: CategoryKey): Promise<TorrentResult[]> {
  const catMap: Partial<Record<CategoryKey, string>> = {
    Movies: 'Movies',
    TV: 'TV',
    Games: 'Games',
    Music: 'Music',
    Anime: 'Anime',
    Applications: 'Apps',
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

const PROVIDER_RUNNERS: Record<string, (query: string, category: CategoryKey) => Promise<TorrentResult[]>> = {
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

// ─── Unified Search & Magnet Resolution ──────────────────────────────────────

export async function searchAllProviders(
  query: string,
  category: CategoryKey = 'All'
): Promise<{
  results: TorrentResult[];
  totalRawHits: number;
  providerStats: ProviderStat[];
}> {
  const tasks = PROVIDERS.map(async (info): Promise<{ stat: ProviderStat; items: TorrentResult[] }> => {
    if (!info.categories.includes(category)) {
      return {
        stat: { name: info.name, status: 'skipped', count: 0, durationMs: 0 },
        items: [],
      };
    }

    const runner = PROVIDER_RUNNERS[info.name];
    const start = Date.now();
    try {
      const items = await runner(query, category);
      const durationMs = Date.now() - start;
      return {
        stat: {
          name: info.name,
          status: items.length > 0 ? 'ok' : 'empty',
          count: items.length,
          durationMs,
        },
        items,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unavailable';
      const isTimeout = message.includes('abort') || message.includes('Timeout') || message.includes('timed out');
      return {
        stat: {
          name: info.name,
          status: isTimeout ? 'timeout' : 'error',
          count: 0,
          durationMs,
          error: isTimeout ? 'Timed out' : message,
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

  // Sort descending by seeds, keeping results cleanly bounded for fast rendering
  const sorted = [...filtered]
    .sort((a, b) => b.seeds - a.seeds)
    .slice(0, DEFAULT_RESULT_CAP);

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
