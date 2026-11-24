'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownUp,
  Check,
  Copy,
  Filter,
  Github,
  Loader2,
  Magnet,
  Radio,
  Rocket,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  type CategoryKey,
  type ProviderInfo,
  type ProviderStat,
  type SearchResponse,
  type TorrentResult,
} from '@/lib/types';
import { ProvidersModal } from './ProvidersModal';
import { MagnetLaunchModal } from './MagnetLaunchModal';

type SortField = 'seeds' | 'peers' | 'size' | 'title';

const SAMPLE_QUERIES = [
  { label: 'Ubuntu 24.04 LTS', query: 'ubuntu 24.04', category: 'Applications' as CategoryKey },
  { label: 'Debian 12', query: 'debian 12', category: 'Applications' as CategoryKey },
  { label: 'Arch Linux', query: 'archlinux', category: 'Applications' as CategoryKey },
  { label: 'Blender 3D', query: 'blender', category: 'Applications' as CategoryKey },
  { label: 'Big Buck Bunny', query: 'big buck bunny', category: 'Movies' as CategoryKey },
];

const LIMIT_OPTIONS = [10, 20, 35, 50];

function seedColorClass(seeds: number): string {
  if (seeds >= 100) return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300';
  if (seeds >= 10) return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
  return 'border-rose-500/30 bg-rose-500/15 text-rose-300';
}

export function MagnetSearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get('q') || '';
  const initialCategory = (searchParams.get('category') as CategoryKey) || 'All';
  const initialLimit = Number(searchParams.get('limit')) || 20;

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<CategoryKey>(
    CATEGORIES.some((c) => c.key === initialCategory) ? initialCategory : 'All'
  );
  const [limit, setLimit] = useState<number>(
    LIMIT_OPTIONS.includes(initialLimit) ? initialLimit : 20
  );

  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showProvidersModal, setShowProvidersModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [results, setResults] = useState<TorrentResult[]>([]);

  // Local post-search filter and sorting
  const [filterText, setFilterText] = useState('');
  const [sortField, setSortField] = useState<SortField>('seeds');

  // Row magnet state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<{
    torrent: TorrentResult;
    magnet: string;
  } | null>(null);

  // Load provider list on mount
  useEffect(() => {
    fetch('/api/providers')
      .then((res) => res.json())
      .then((data: { providers?: ProviderInfo[] }) => {
        if (Array.isArray(data.providers)) {
          setProviders(data.providers);
          setSelectedProviders(data.providers.map((p) => p.name));
        }
      })
      .catch(() => {
        // Fallback if provider metadata request fails
      });
  }, []);

  const executeSearch = useCallback(
    async (
      searchQuery: string,
      searchCategory: CategoryKey,
      searchLimit: number,
      activeProviderNames?: string[]
    ) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) {
        setError('Please enter a search term.');
        return;
      }

      setLoading(true);
      setError(null);
      setFilterText('');

      const params = new URLSearchParams({
        q: trimmed,
        category: searchCategory,
        limit: String(searchLimit),
      });

      router.replace(`/?${params.toString()}`, { scroll: false });

      if (
        activeProviderNames &&
        providers.length > 0 &&
        activeProviderNames.length > 0 &&
        activeProviderNames.length < providers.length
      ) {
        params.set('providers', activeProviderNames.join(','));
      }

      try {
        const res = await fetch(`/api/search?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Search failed');
        }
        const typed = json as SearchResponse;
        setSearchData(typed);
        setResults(typed.results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to search providers right now.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [providers.length, router]
  );

  // Auto-run search if loaded with ?q= query param
  useEffect(() => {
    if (initialQuery.trim()) {
      executeSearch(initialQuery, category, limit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch(query, category, limit, selectedProviders);
  }

  function handleToggleProvider(name: string) {
    setSelectedProviders((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev; // Keep at least one enabled
        return prev.filter((p) => p !== name);
      }
      return [...prev, name];
    });
  }

  async function resolveMagnetForItem(item: TorrentResult): Promise<string | null> {
    if (item.magnet && item.magnet.startsWith('magnet:')) {
      return item.magnet;
    }

    setResolvingId(item.id);
    setError(null);
    try {
      const res = await fetch('/api/magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          magnet: item.magnet,
          desc: item.desc,
          title: item.title,
        }),
      });
      const json = (await res.json()) as { magnet?: string; error?: string };
      if (!res.ok || !json.magnet) {
        throw new Error(json.error || 'Could not resolve magnet link');
      }

      // Cache resolved magnet in results state
      setResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, magnet: json.magnet } : r))
      );
      return json.magnet;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch magnet link');
      return null;
    } finally {
      setResolvingId(null);
    }
  }

  async function handleLaunchMagnet(item: TorrentResult) {
    const magnet = await resolveMagnetForItem(item);
    if (!magnet) return;

    setActiveLaunch({ torrent: item, magnet });

    // Trigger system default torrent handler via anchor click
    const link = document.createElement('a');
    link.href = magnet;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleCopyMagnet(item: TorrentResult) {
    const magnet = await resolveMagnetForItem(item);
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 2000);
    } catch {
      setActiveLaunch({ torrent: item, magnet });
    }
  }

  const displayedResults = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    const filtered = term
      ? results.filter(
          (r) =>
            r.title.toLowerCase().includes(term) ||
            r.provider.toLowerCase().includes(term)
        )
      : results;

    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case 'peers':
          return b.peers - a.peers;
        case 'size':
          return b.sizeBytes - a.sizeBytes;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'seeds':
        default:
          return b.seeds - a.seeds;
      }
    });
  }, [filterText, results, sortField]);

  const activeProviderStats: ProviderStat[] = searchData?.providerStats || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 shadow-lg shadow-cyan-500/10">
            <Magnet className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Magnet2Torrent
              </h1>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                Web
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              Search across public torrent indexes &amp; launch magnet links directly in your
              torrent client
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowProvidersModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-cyan-500/40 hover:bg-slate-800 sm:text-sm"
          >
            <Radio className="h-4 w-4 text-emerald-400" />
            <span>
              Providers ({selectedProviders.length || providers.length || 7})
            </span>
          </button>

          <a
            href="https://github.com/Hurley2017/Magnet2Torrent"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 sm:text-sm"
          >
            <Github className="h-4 w-4" />
            <span>CLI &amp; Source</span>
          </a>
        </div>
      </header>

      {/* Search Card */}
      <section className="mb-6 rounded-2xl border border-slate-800/90 bg-slate-900/65 p-4 shadow-xl backdrop-blur-sm sm:p-6">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title (e.g., Ubuntu 24.04, Debian, Blender, Big Buck Bunny)..."
                aria-label="Search torrent query"
                className="w-full rounded-xl border border-slate-700/90 bg-slate-950/90 py-3.5 pr-10 pl-12 text-sm text-white placeholder-slate-500 shadow-inner transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none sm:text-base"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search query"
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex gap-2.5">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                aria-label="Maximum results"
                className="rounded-xl border border-slate-700/90 bg-slate-950/90 px-3.5 py-3.5 text-sm font-medium text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {LIMIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    Max {opt}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setCategory(cat.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-sm'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Open-Source Examples */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-3 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              Try legal open-source queries:
            </span>
            {SAMPLE_QUERIES.map((sample) => (
              <button
                key={sample.query}
                type="button"
                onClick={() => {
                  setQuery(sample.query);
                  setCategory(sample.category);
                  executeSearch(sample.query, sample.category, limit, selectedProviders);
                }}
                className="rounded-md border border-slate-700/70 bg-slate-800/60 px-2.5 py-1 text-slate-300 transition hover:border-cyan-500/40 hover:bg-slate-800 hover:text-cyan-200"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* Error Message */}
      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-300 hover:text-white"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Provider Telemetry Strip */}
      {searchData && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-300">
              Found <strong className="text-emerald-400">{results.length}</strong> result(s)
              {searchData.totalRawHits > results.length && (
                <span className="text-slate-400">
                  {' '}
                  from {searchData.totalRawHits} raw hits
                </span>
              )}{' '}
              in <span className="text-cyan-300">{searchData.durationMs}ms</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {activeProviderStats.map((stat) => (
              <span
                key={stat.name}
                title={stat.error || `${stat.count} results (${stat.durationMs}ms)`}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  stat.status === 'ok'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : stat.status === 'empty' || stat.status === 'skipped'
                      ? 'border-slate-800 bg-slate-900 text-slate-500'
                      : 'border-amber-500/25 bg-amber-500/10 text-amber-300/80'
                }`}
              >
                {stat.name}
                {stat.status === 'ok' ? ` (${stat.count})` : ''}
                {stat.status === 'timeout' ? ' (timeout)' : ''}
                {stat.status === 'error' ? ' (unavailable)' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-900/40 py-20 text-center">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm font-medium text-slate-200">
            Querying public torrent providers for &ldquo;{query}&rdquo;…
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Sorting results by highest seed count
          </p>
        </div>
      )}

      {!loading && searchData && results.length === 0 && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 px-6 py-16 text-center">
          <p className="text-base font-medium text-amber-300">
            No results found for &ldquo;{searchData.query}&rdquo;
          </p>
          <p className="mt-1.5 text-sm text-slate-400">
            Try a broader search term, switch category to <strong>All</strong>, or check provider
            status above.
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-xl">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-800/90 bg-slate-900/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Filter className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter displayed titles…"
                className="w-full rounded-lg border border-slate-700/80 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <ArrowDownUp className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Sort by:</span>
              {(['seeds', 'peers', 'size', 'title'] as SortField[]).map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => setSortField(field)}
                  className={`rounded-md px-2.5 py-1 capitalize transition ${
                    sortField === field
                      ? 'bg-cyan-500/20 font-semibold text-cyan-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {field}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs tracking-wider text-slate-400 uppercase">
                  <th className="w-12 px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="w-32 px-4 py-3 font-medium">Provider</th>
                  <th className="w-28 px-4 py-3 font-medium">Size</th>
                  <th className="w-24 px-4 py-3 text-right font-medium text-emerald-400">Seeds</th>
                  <th className="w-24 px-4 py-3 text-right font-medium text-fuchsia-400">Peers</th>
                  <th className="w-28 px-4 py-3 font-medium">Age</th>
                  <th className="w-44 px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {displayedResults.map((item, idx) => {
                  const isBusy = resolvingId === item.id;
                  const isCopied = copiedId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="max-w-xl font-medium text-slate-100 break-words">
                          {item.title}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
                          {item.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-cyan-300">
                        {item.size}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`inline-flex min-w-[3rem] justify-center rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${seedColorClass(
                            item.seeds
                          )}`}
                        >
                          {item.seeds}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-fuchsia-300">
                        {item.peers}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">
                        {item.time || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleCopyMagnet(item)}
                            title="Copy magnet link"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 disabled:opacity-50"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleLaunchMagnet(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Rocket className="h-3.5 w-3.5" />
                            )}
                            <span>{isBusy ? 'Fetching…' : 'Launch'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-slate-800 md:hidden">
            {displayedResults.map((item, idx) => {
              const isBusy = resolvingId === item.id;
              const isCopied = copiedId === item.id;

              return (
                <div key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-slate-500">#{idx + 1}</span>
                    <span className="rounded-md border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                      {item.provider}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-white break-words">{item.title}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-cyan-300">{item.size}</span>
                    <span className="text-slate-600">•</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${seedColorClass(
                        item.seeds
                      )}`}
                    >
                      🌱 {item.seeds}
                    </span>
                    <span className="font-mono text-fuchsia-300">⬇ {item.peers}</span>
                    {item.time && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">{item.time}</span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleCopyMagnet(item)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-medium text-slate-200"
                    >
                      {isCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {isCopied ? 'Copied!' : 'Copy Magnet'}
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleLaunchMagnet(item)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 py-2 text-xs font-semibold text-white"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Rocket className="h-3.5 w-3.5" />
                      )}
                      {isBusy ? 'Fetching…' : 'Launch Client'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Initial Empty State */}
      {!loading && !searchData && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Search className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Multi-Provider Search</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Concurrently searches public indexes including ThePirateBay, 1337x, YTS, EZTV,
              LimeTorrents, Nyaa, and TorrentProject sorted by seed health.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Rocket className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">One-Click Magnet Launch</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Resolves magnet links on demand and opens them directly in your local torrent
              application (qBittorrent, Transmission, Deluge, or uTorrent).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
              <Terminal className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Desktop CLI Companion</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Prefer running locally in your terminal? Grab the original Node.js CLI release from{' '}
              <a
                href="https://github.com/Hurley2017/Magnet2Torrent/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 underline hover:text-cyan-300"
              >
                GitHub Releases
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
        <p>
          Magnet2Torrent Web · Open-source MIT License · Strictly for legal, authorized, and
          open-source P2P transfers.
        </p>
      </footer>

      <ProvidersModal
        open={showProvidersModal}
        onClose={() => setShowProvidersModal(false)}
        providers={providers}
        selectedProviders={selectedProviders}
        onToggleProvider={handleToggleProvider}
        onSelectAll={() => setSelectedProviders(providers.map((p) => p.name))}
        stats={activeProviderStats}
      />

      <MagnetLaunchModal
        torrent={activeLaunch?.torrent || null}
        magnet={activeLaunch?.magnet || null}
        onClose={() => setActiveLaunch(null)}
      />
    </div>
  );
}
