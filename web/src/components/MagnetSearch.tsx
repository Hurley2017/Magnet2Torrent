'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIES,
  PROVIDERS,
  type CategoryKey,
  type ProviderStat,
  type SearchResponse,
  type TorrentResult,
} from '@/lib/catalog';

const VALID_CATS = new Set<string>(CATEGORIES.map((c) => c.key));

function seedBadgeClass(seeds: number): string {
  if (seeds >= 100) return 'border-emerald-500/40 bg-[#132617] text-emerald-300';
  if (seeds >= 10) return 'border-yellow-500/45 bg-[#2d2109] text-yellow-300';
  return 'border-rose-500/40 bg-[#2c1212] text-rose-300';
}

function providerStatusLabel(stat: ProviderStat): {
  text: string;
  className: string;
} {
  switch (stat.status) {
    case 'ok':
      return {
        text: `${stat.count} fetched · ${stat.durationMs}ms`,
        className: 'border-emerald-500/40 bg-[#132617] text-emerald-300',
      };
    case 'empty':
      return {
        text: `0 results · ${stat.durationMs}ms`,
        className: 'border-[#573c22] bg-[#24170c] text-[#e7cfa8]',
      };
    case 'skipped':
      return {
        text: 'Skipped (type)',
        className: 'border-[#432d18] bg-[#1a1008] text-[#cbb082]',
      };
    case 'timeout':
      return {
        text: 'Down · Timeout',
        className: 'border-rose-500/45 bg-[#2c1212] text-rose-300',
      };
    case 'error':
    default:
      return {
        text: `Down · ${stat.error || 'Error'}`,
        className: 'border-rose-500/45 bg-[#2c1212] text-rose-300',
      };
  }
}

export function MagnetSearch() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launched, setLaunched] = useState<{ title: string; magnet: string } | null>(null);

  const runSearch = useCallback(async (q: string, cat: CategoryKey) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setError('Please enter a search term.');
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ q: trimmed, category: cat });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/?${params.toString()}`);
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
      setError(err instanceof Error ? err.message : 'Unable to reach search API.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlQ = (sp.get('q') || '').trim();
    const rawCat = sp.get('category') || 'All';
    const urlCat: CategoryKey = VALID_CATS.has(rawCat) ? (rawCat as CategoryKey) : 'All';
    if (urlQ) {
      setQuery(urlQ);
      setCategory(urlCat);
      runSearch(urlQ, urlCat);
    } else if (urlCat !== 'All') {
      setCategory(urlCat);
    }
  }, [runSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query, category);
  }

  async function resolveMagnet(item: TorrentResult): Promise<string | null> {
    if (item.magnet && item.magnet.startsWith('magnet:')) {
      return item.magnet;
    }
    setResolvingId(item.id);
    setError(null);
    try {
      const res = await fetch('/api/magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magnet: item.magnet, desc: item.desc, title: item.title }),
      });
      const json = (await res.json()) as { magnet?: string; error?: string };
      if (!res.ok || !json.magnet) {
        throw new Error(json.error || 'Could not resolve magnet link');
      }
      setResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, magnet: json.magnet } : r))
      );
      return json.magnet;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch magnet link.');
      return null;
    } finally {
      setResolvingId(null);
    }
  }

  async function handleLaunch(item: TorrentResult) {
    const magnet = await resolveMagnet(item);
    if (!magnet) return;
    setLaunched({ title: item.title, magnet });
    const a = document.createElement('a');
    a.href = magnet;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleCopy(item: TorrentResult) {
    const magnet = await resolveMagnet(item);
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 1800);
    } catch {
      setLaunched({ title: item.title, magnet });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/40 bg-[#2a1b0c] text-yellow-400">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15" />
              <path d="m5 8 4 4" />
              <path d="m12 15 4 4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-yellow-300 sm:text-2xl">
              Magnet2Torrent
            </h1>
            <p className="text-xs text-[#e7cfa8]">
              Search {PROVIDERS.length} public sources &amp; launch magnets in your torrent client
            </p>
          </div>
        </div>

        <a
          href="https://github.com/Hurley2017/Magnet2Torrent"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-[#52371e] bg-[#21150a] px-3 py-2 text-xs font-medium text-[#fde68a] transition hover:border-yellow-400 hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-yellow-400"
        >
          GitHub &amp; CLI
        </a>
      </header>

      {/* Search Form */}
      <section
        aria-label="Torrent search"
        className="mb-5 rounded-xl border border-[#4a3019] bg-[#1f140b] p-4 shadow-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <label htmlFor="torrent-search" className="sr-only">
                Search torrent title
              </label>
              <input
                id="torrent-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title (e.g. Ubuntu 24.04, Blender, Debian)..."
                className="w-full rounded-lg border border-[#5c3d21] bg-[#120b05] px-4 py-3 text-sm text-[#fef3c7] placeholder-[#a98d62] focus:border-yellow-400 focus:outline-none sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-lg bg-yellow-400 px-6 py-3 text-sm font-bold text-[#140d07] transition hover:bg-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>

          {/* Torrent Type Selector */}
          <div
            role="radiogroup"
            aria-label="Type of torrent"
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="mr-1 text-xs font-medium text-[#cbb082]">Type:</span>
            {CATEGORIES.map((cat) => {
              const selected = category === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(cat.key)}
                  className={`min-h-[34px] rounded-md border px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-yellow-400 ${
                    selected
                      ? 'border-yellow-400 bg-yellow-400 text-[#140d07] font-semibold'
                      : 'border-[#4a3019] bg-[#160e07] text-[#e7cfa8] hover:border-yellow-500/50 hover:text-yellow-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </form>
      </section>

      {/* Error Notice */}
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between rounded-lg border border-rose-500/45 bg-[#2c1212] px-4 py-3 text-sm text-rose-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-3 rounded px-2 py-0.5 text-xs font-semibold text-rose-200 hover:bg-rose-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sources & Live Status */}
      <section
        aria-label="Torrent sources and fetch status"
        className="mb-5 rounded-xl border border-[#422b18] bg-[#1b1108] px-4 py-3"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-yellow-300 uppercase">
            {searchData ? 'Source Status & Fetch Breakdown' : 'Configured Torrent Sources'}
          </h2>
          {searchData && (
            <p className="text-xs text-[#e7cfa8]">
              Showing <strong className="text-yellow-300">{results.length}</strong> top results
              from <strong className="text-yellow-200">{searchData.totalRawHits}</strong> fetched in{' '}
              <span className="font-mono text-yellow-300">{searchData.durationMs}ms</span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {searchData
            ? searchData.providerStats.map((stat) => {
                const badge = providerStatusLabel(stat);
                return (
                  <div
                    key={stat.name}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${badge.className}`}
                  >
                    <span className="font-semibold">{stat.name}:</span>
                    <span>{badge.text}</span>
                  </div>
                );
              })
            : PROVIDERS.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center rounded-md border border-[#4a3019] bg-[#24170c] px-2.5 py-1 text-xs text-[#e7cfa8]"
                >
                  {p.name}
                </span>
              ))}
        </div>
      </section>

      {/* Loading Indicator */}
      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#4a3019] bg-[#1f140b] py-12 text-center"
        >
          <p className="text-sm font-semibold text-yellow-300">
            Searching {PROVIDERS.length} sources for &ldquo;{query}&rdquo;…
          </p>
          <p className="mt-1 text-xs text-[#cbb082]">Sorting by highest seed count</p>
        </div>
      )}

      {/* Empty Search Result */}
      {!loading && searchData && results.length === 0 && (
        <div className="rounded-xl border border-[#4a3019] bg-[#1f140b] px-4 py-12 text-center">
          <p className="text-sm font-semibold text-yellow-300">
            No results found for &ldquo;{searchData.query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-[#e7cfa8]">
            Try broadening your keywords or selecting <strong>All</strong> under Type.
          </p>
        </div>
      )}

      {/* Results Table (Desktop) & Cards (Mobile) */}
      {!loading && results.length > 0 && (
        <section
          aria-label="Search results"
          className="overflow-hidden rounded-xl border border-[#4a3019] bg-[#1f140b] shadow-lg"
        >
          <h2 className="sr-only">Search Results</h2>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#4a3019] bg-[#170f07] text-xs tracking-wider text-[#e7cfa8] uppercase">
                  <th className="w-10 px-3 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Title</th>
                  <th className="w-32 px-3 py-3 font-semibold">Provider</th>
                  <th className="w-24 px-3 py-3 font-semibold">Size</th>
                  <th className="w-20 px-3 py-3 text-right font-semibold text-emerald-300">
                    Seeds
                  </th>
                  <th className="w-20 px-3 py-3 text-right font-semibold text-yellow-300">
                    Peers
                  </th>
                  <th className="w-28 px-3 py-3 font-semibold">Age</th>
                  <th className="w-40 px-3 py-3 text-right font-semibold">Magnet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#362312]">
                {results.map((item, idx) => {
                  const busy = resolvingId === item.id;
                  const copied = copiedId === item.id;
                  return (
                    <tr key={item.id} className="transition hover:bg-[#2a1c10]">
                      <td className="px-3 py-3 font-mono text-xs text-[#cbb082]">{idx + 1}</td>
                      <td className="max-w-md px-3 py-3 font-medium text-[#fef3c7] break-words">
                        {item.title}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-block rounded border border-yellow-500/35 bg-[#2d1f0d] px-2 py-0.5 text-xs font-medium text-yellow-300">
                          {item.provider}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-[#f5e3be]">{item.size}</td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`inline-block min-w-[2.5rem] rounded border px-1.5 py-0.5 text-center font-mono text-xs font-semibold ${seedBadgeClass(
                            item.seeds
                          )}`}
                        >
                          {item.seeds}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-[#e7cfa8]">
                        {item.peers}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#cbb082]">{item.time || '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleCopy(item)}
                            className="rounded-md border border-[#5c3d21] bg-[#160e07] px-2.5 py-1.5 text-xs font-medium text-[#fde68a] transition hover:border-yellow-400 hover:text-yellow-300 disabled:opacity-50"
                          >
                            {copied ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleLaunch(item)}
                            className="rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-bold text-[#140d07] transition hover:bg-yellow-300 disabled:opacity-50"
                          >
                            {busy ? 'Loading…' : 'Launch'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#362312] md:hidden">
            {results.map((item, idx) => {
              const busy = resolvingId === item.id;
              const copied = copiedId === item.id;
              return (
                <div key={item.id} className="space-y-2.5 p-4">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-[#cbb082]">#{idx + 1}</span>
                    <span className="rounded border border-yellow-500/35 bg-[#2d1f0d] px-2 py-0.5 font-medium text-yellow-300">
                      {item.provider}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#fef3c7] break-words">{item.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-[#f5e3be]">{item.size}</span>
                    <span
                      className={`rounded border px-1.5 py-0.5 font-mono font-semibold ${seedBadgeClass(
                        item.seeds
                      )}`}
                    >
                      Seeds: {item.seeds}
                    </span>
                    <span className="font-mono text-[#e7cfa8]">Peers: {item.peers}</span>
                    {item.time && <span className="text-[#cbb082]">{item.time}</span>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleCopy(item)}
                      className="min-h-[40px] flex-1 rounded-md border border-[#5c3d21] bg-[#160e07] py-2 text-xs font-medium text-[#fde68a]"
                    >
                      {copied ? 'Copied!' : 'Copy Magnet'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleLaunch(item)}
                      className="min-h-[40px] flex-1 rounded-md bg-yellow-400 py-2 text-xs font-bold text-[#140d07]"
                    >
                      {busy ? 'Fetching…' : 'Launch Client'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Magnet Launch Fallback Strip */}
      {launched && (
        <div
          role="region"
          aria-label="Launched magnet link"
          className="mt-5 rounded-xl border border-yellow-400/50 bg-[#25180b] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-yellow-300 sm:text-sm">
              Launched: <span className="text-[#fef3c7]">{launched.title}</span>
            </p>
            <div className="flex items-center gap-2">
              <a
                href={launched.magnet}
                className="rounded-md bg-yellow-400 px-3 py-1.5 text-xs font-bold text-[#140d07] hover:bg-yellow-300"
              >
                Open Client
              </a>
              <button
                type="button"
                onClick={() => setLaunched(null)}
                className="rounded-md border border-[#5c3d21] px-2.5 py-1.5 text-xs text-[#e7cfa8] hover:border-yellow-400"
              >
                Close
              </button>
            </div>
          </div>
          <p className="mt-2 truncate font-mono text-[11px] text-[#cbb082]">{launched.magnet}</p>
        </div>
      )}

      <footer className="mt-10 border-t border-[#3b2716] pt-4 text-center text-xs text-[#cbb082]">
        Magnet2Torrent · MIT License · Intended strictly for legal, open-source P2P transfers.
      </footer>
    </div>
  );
}
