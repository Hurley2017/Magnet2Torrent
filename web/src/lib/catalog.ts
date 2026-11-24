export interface TorrentResult {
  id: string;
  title: string;
  provider: string;
  size: string;
  sizeBytes: number;
  seeds: number;
  peers: number;
  time: string;
  magnet?: string;
  desc?: string;
  link?: string;
  isExactMatch?: boolean;
}

export interface ProviderInfo {
  name: string;
  description: string;
  baseUrl: string;
  supportsDirectMagnet: boolean;
}

export interface ProviderStat {
  name: string;
  status: 'ok' | 'empty' | 'error' | 'timeout';
  count: number;
  durationMs: number;
  error?: string;
}

export interface MediaMetadata {
  type: 'movie' | 'series';
  name: string;
  poster?: string;
  rating?: string;
  year?: string;
  runtime?: string;
  genres: string[];
  director?: string[];
  cast?: string[];
  description?: string;
  country?: string;
  awards?: string;
  episodesCount?: number;
  seasonsCount?: number;
  imdbId?: string;
}

export interface SearchResponse {
  query: string;
  totalRawHits: number;
  results: TorrentResult[];
  providerStats: ProviderStat[];
  media: MediaMetadata | null;
  durationMs: number;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    name: 'ThePirateBay',
    description: 'Public index API with direct magnet links',
    baseUrl: 'https://apibay.org',
    supportsDirectMagnet: true,
  },
  {
    name: 'Knaben',
    description: 'Multi-tracker aggregator with live seeder counts',
    baseUrl: 'https://api.knaben.org',
    supportsDirectMagnet: true,
  },
  {
    name: 'TorrentsCSV',
    description: 'Open-source collaborative torrent index',
    baseUrl: 'https://torrents-csv.com',
    supportsDirectMagnet: true,
  },
  {
    name: 'LimeTorrents',
    description: 'Multi-category public torrent directory',
    baseUrl: 'https://www.limetorrents.lol',
    supportsDirectMagnet: true,
  },
  {
    name: 'InternetArchive',
    description: 'Public-domain software, books, audio, and movies',
    baseUrl: 'https://archive.org',
    supportsDirectMagnet: true,
  },
  {
    name: 'Nyaa',
    description: 'Anime, manga, and open media index',
    baseUrl: 'https://nyaa.si',
    supportsDirectMagnet: true,
  },
  {
    name: 'SubsPlease',
    description: 'Anime releases API with direct magnet links',
    baseUrl: 'https://subsplease.org',
    supportsDirectMagnet: true,
  },
  {
    name: '1337x',
    description: 'General public torrent index',
    baseUrl: 'https://www.1337x.to',
    supportsDirectMagnet: false,
  },
  {
    name: 'EZTV',
    description: 'TV episodes and series index',
    baseUrl: 'https://eztvx.to',
    supportsDirectMagnet: true,
  },
];
