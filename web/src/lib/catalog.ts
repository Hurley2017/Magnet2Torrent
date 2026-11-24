export type CategoryKey =
  | 'All'
  | 'Movies'
  | 'TV'
  | 'Music'
  | 'Applications'
  | 'Books'
  | 'Games'
  | 'Anime';

export interface CategoryOption {
  key: CategoryKey;
  label: string;
}

export const CATEGORIES: CategoryOption[] = [
  { key: 'All', label: 'All' },
  { key: 'Movies', label: 'Movies' },
  { key: 'TV', label: 'TV Shows' },
  { key: 'Music', label: 'Music' },
  { key: 'Applications', label: 'Apps / Software' },
  { key: 'Books', label: 'Books' },
  { key: 'Games', label: 'Games' },
  { key: 'Anime', label: 'Anime' },
];

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
}

export interface ProviderInfo {
  name: string;
  description: string;
  baseUrl: string;
  categories: CategoryKey[];
  supportsDirectMagnet: boolean;
}

export interface ProviderStat {
  name: string;
  status: 'ok' | 'empty' | 'error' | 'timeout' | 'skipped';
  count: number;
  durationMs: number;
  error?: string;
}

export interface SearchResponse {
  query: string;
  category: CategoryKey;
  totalRawHits: number;
  results: TorrentResult[];
  providerStats: ProviderStat[];
  durationMs: number;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    name: 'ThePirateBay',
    description: 'Public index API with direct magnet links',
    baseUrl: 'https://apibay.org',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Books', 'Games', 'Anime'],
    supportsDirectMagnet: true,
  },
  {
    name: 'Knaben',
    description: 'Multi-tracker database aggregator with live seeder counts',
    baseUrl: 'https://api.knaben.org',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Books', 'Games', 'Anime'],
    supportsDirectMagnet: true,
  },
  {
    name: 'TorrentsCSV',
    description: 'Open-source collaborative torrent search index',
    baseUrl: 'https://torrents-csv.com',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Books', 'Games', 'Anime'],
    supportsDirectMagnet: true,
  },
  {
    name: 'LimeTorrents',
    description: 'Multi-category public torrent directory',
    baseUrl: 'https://www.limetorrents.lol',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Games', 'Anime'],
    supportsDirectMagnet: true,
  },
  {
    name: 'InternetArchive',
    description: 'Legal public-domain software, books, audio, and movies',
    baseUrl: 'https://archive.org',
    categories: ['All', 'Movies', 'Music', 'Applications', 'Books'],
    supportsDirectMagnet: true,
  },
  {
    name: 'Nyaa',
    description: 'Anime, manga, and East Asian open media index',
    baseUrl: 'https://nyaa.si',
    categories: ['All', 'Anime', 'Books', 'Music'],
    supportsDirectMagnet: true,
  },
  {
    name: 'SubsPlease',
    description: 'Anime releases API with direct magnet downloads',
    baseUrl: 'https://subsplease.org',
    categories: ['All', 'Anime'],
    supportsDirectMagnet: true,
  },
  {
    name: '1337x',
    description: 'General public torrent index',
    baseUrl: 'https://www.1337x.to',
    categories: ['All', 'Movies', 'TV', 'Music', 'Applications', 'Games', 'Anime'],
    supportsDirectMagnet: false,
  },
  {
    name: 'EZTV',
    description: 'TV episodes and series releases',
    baseUrl: 'https://eztvx.to',
    categories: ['All', 'TV'],
    supportsDirectMagnet: true,
  },
];
