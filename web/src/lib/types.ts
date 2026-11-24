export type CategoryKey =
  | 'All'
  | 'Movies'
  | 'TV'
  | 'Music'
  | 'Applications'
  | 'Books'
  | 'Games'
  | 'Anime'
  | 'XXX';

export interface CategoryOption {
  key: CategoryKey;
  label: string;
  emoji: string;
}

export const CATEGORIES: CategoryOption[] = [
  { key: 'All', label: 'All', emoji: '🌐' },
  { key: 'Movies', label: 'Movies', emoji: '🎬' },
  { key: 'TV', label: 'TV Shows', emoji: '📺' },
  { key: 'Music', label: 'Music', emoji: '🎵' },
  { key: 'Applications', label: 'Apps / Software', emoji: '💾' },
  { key: 'Books', label: 'Books', emoji: '📚' },
  { key: 'Games', label: 'Games', emoji: '🎮' },
  { key: 'Anime', label: 'Anime', emoji: '🌸' },
  { key: 'XXX', label: 'Adult (18+)', emoji: '🔞' },
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
  limit: number;
  totalRawHits: number;
  results: TorrentResult[];
  providerStats: ProviderStat[];
  durationMs: number;
}
