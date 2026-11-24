'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIES,
  PROVIDERS,
  type CategoryKey,
  type MediaMetadata,
  type ProviderStat,
  type SearchResponse,
  type TorrentResult,
} from '@/lib/catalog';
import { AdvisoryBanner } from './AdvisoryBanner';

const TERMS_STORAGE_KEY = 'm2t_terms_accepted_v1';
const VALID_CATS = new Set<string>(CATEGORIES.map((c) => c.key));

function seedBadgeClass(seeds: number): string {
  if (seeds >= 100) return 'border-zinc-500 bg-zinc-800 text-white';
  if (seeds >= 10) return 'border-zinc-700 bg-zinc-900 text-zinc-200';
  return 'border-red-800/70 bg-red-950/50 text-red-300';
}

function providerStatusLabel(stat: ProviderStat): {
  text: string;
  className: string;
} {
  switch (stat.status) {
    case 'ok':
      return {
        text: `${stat.count} fetched (${stat.durationMs}ms)`,
        className: 'border-zinc-600 bg-zinc-900 text-white',
      };
    case 'empty':
      return {
        text: `0 fetched (${stat.durationMs}ms)`,
        className: 'border-zinc-800 bg-zinc-950 text-zinc-400',
      };
    case 'skipped':
      return {
        text: 'Skipped (type)',
        className: 'border-zinc-800/80 bg-black text-zinc-400',
      };
    case 'timeout':
      return {
        text: 'DOWN (Timeout)',
        className: 'border-red-800/70 bg-red-950/50 text-red-300',
      };
    case 'error':
    default:
      return {
        text: `DOWN (${stat.error || 'Error'})`,
        className: 'border-red-800/70 bg-red-950/50 text-red-300',
      };
  }
}

function MediaDetailsCard({ media }: { media: MediaMetadata }) {
  const [posterHidden, setPosterHidden] = useState(false);

  return (
    <section
      aria-label="Title overview"
      className="mb-6 rounded-xl border border-zinc-800 bg-[#111114] p-4 shadow-xl sm:p-5"
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        {media.poster && !posterHidden && (
          <div className="shrink-0 self-start overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
            <img
              src={media.poster}
              alt={`${media.name} poster`}
              width={120}
              height={180}
              onError={() => setPosterHidden(true)}
              className="h-[180px] w-[120px] object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
              {media.type === 'movie' ? 'Movie' : 'Series'}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white">{media.name}</h2>
            {media.year && <span className="text-sm font-medium text-zinc-400">{media.year}</span>}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {media.rating && (
              <span className="rounded-md border border-red-600/60 bg-red-950/60 px-2.5 py-1 font-semibold text-white">
                IMDb Rating: <span className="text-red-300">{media.rating} / 10</span>
              </span>
            )}
            {media.runtime && (
              <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-200">
                Runtime: {media.runtime}
              </span>
            )}
            {media.seasonsCount && (
              <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-medium text-zinc-200">
                {media.seasonsCount} {media.seasonsCount === 1 ? 'Season' : 'Seasons'}
                {media.episodesCount ? ` · ${media.episodesCount} Episodes` : ''}
              </span>
            )}
            {media.country && (
              <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-300">
                {media.country}
              </span>
            )}
          </div>

          {media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {media.genres.slice(0, 5).map((g) => (
                <span
                  key={g}
                  className="rounded border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300"
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {media.description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-zinc-300 sm:text-sm">
              {media.description}
            </p>
          )}

          {(media.director?.length || media.cast?.length || media.awards) && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-800/80 pt-2.5 text-xs text-zinc-400">
              {media.director && media.director.length > 0 && (
                <span>
                  <strong className="text-zinc-200">Director:</strong> {media.director.join(', ')}
                </span>
              )}
              {media.cast && media.cast.length > 0 && (
                <span>
                  <strong className="text-zinc-200">Cast:</strong> {media.cast.join(', ')}
                </span>
              )}
              {media.awards && (
                <span>
                  <strong className="text-zinc-200">Awards:</strong> {media.awards}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function MagnetSearch() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

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

    if (urlQ) setQuery(urlQ);
    if (urlCat !== 'All') setCategory(urlCat);

    try {
      if (window.localStorage.getItem(TERMS_STORAGE_KEY) === '1') {
        setTermsAccepted(true);
        if (urlQ) {
          runSearch(urlQ, urlCat);
        }
      }
    } catch {
      // Storage unavailable; keep explicit gate
    }
  }, [runSearch]);

  function handleAcceptTerms(e: React.FormEvent) {
    e.preventDefault();
    if (!checkboxChecked) return;
    try {
      window.localStorage.setItem(TERMS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage write failure
    }
    setTermsAccepted(true);
    if (query.trim()) {
      runSearch(query, category);
    }
  }

  function handleResetTerms() {
    try {
      window.localStorage.removeItem(TERMS_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setCheckboxChecked(false);
    setTermsAccepted(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) return;
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
    <div className="min-h-screen bg-[#09090b] text-white">
      <AdvisoryBanner termsAccepted={termsAccepted} onResetTerms={handleResetTerms} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Masthead Header (Pure Text) */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/90 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                MAGNET<span className="text-red-500">2</span>TORRENT
              </h1>
              <span className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-bold tracking-widest text-white uppercase">
                Web
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              Search {PROVIDERS.length} public sources and launch magnet links in your torrent
              client.
            </p>
          </div>

          <a
            href="https://github.com/Hurley2017/Magnet2Torrent"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-red-600 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-red-500"
          >
            GitHub &amp; CLI
          </a>
        </header>

        {/* Gate: Terms & Conditions Acceptance */}
        {!termsAccepted ? (
          <section
            aria-labelledby="terms-heading"
            className="mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-[#111114] p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-4 inline-block rounded bg-red-700 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
              Terms &amp; Legal Disclaimer
            </div>
            <h2 id="terms-heading" className="text-xl font-bold text-white sm:text-2xl">
              Accept Legal Conditions Before Proceeding
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Magnet2Torrent is strictly built for legal, educational, and open-source BitTorrent
              distribution (such as Linux ISOs, Creative Commons media, public-domain works, and
              open datasets).
            </p>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300 sm:text-sm">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-white">Anti-Piracy Prohibition:</strong> You must{' '}
                  <strong className="text-red-400">not</strong> use this application for copyright
                  infringement, software piracy, or unauthorized media downloads.
                </li>
                <li>
                  <strong className="text-white">No Content Hosting:</strong> This web service does
                  not host, store, cache, or index any torrent files or copyrighted material.
                </li>
                <li>
                  <strong className="text-white">User Liability:</strong> You are solely
                  responsible for complying with copyright and intellectual property laws in your
                  jurisdiction.
                </li>
              </ul>
            </div>

            <form onSubmit={handleAcceptTerms} className="mt-6 space-y-5">
              <label
                htmlFor="accept-terms-checkbox"
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 text-xs text-zinc-200 transition hover:border-zinc-700 sm:text-sm"
              >
                <input
                  id="accept-terms-checkbox"
                  type="checkbox"
                  checked={checkboxChecked}
                  onChange={(e) => setCheckboxChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>
                  I have read and agree to the{' '}
                  <strong className="text-white">Legal Disclaimer &amp; Anti-Piracy Terms</strong>
                  , and confirm I will only use Magnet2Torrent for legal and authorized content.
                </span>
              </label>

              <button
                type="submit"
                disabled={!checkboxChecked}
                className="w-full rounded-xl bg-gradient-to-b from-red-600 to-red-700 px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(185,28,28,0.35)] transition hover:from-red-500 hover:to-red-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_22px_rgba(220,38,38,0.45)] active:translate-y-px disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
              >
                Accept Terms &amp; Proceed
              </button>
            </form>
          </section>
        ) : (
          <>
            {/* Search Console */}
            <section
              aria-label="Torrent search"
              className="mb-6 rounded-2xl border border-zinc-800 bg-[#111114] p-4 shadow-xl sm:p-5"
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <label htmlFor="torrent-search" className="sr-only">
                      Search torrent title
                    </label>
                    <input
                      id="torrent-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search title (e.g. Ubuntu 24.04, Inception, Breaking Bad)..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-500 transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20 focus:outline-none sm:text-base"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-h-[46px] min-w-[140px] items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-700 px-6 py-3 text-sm font-bold tracking-wide text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_12px_rgba(185,28,28,0.35)] transition hover:from-red-500 hover:to-red-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_20px_rgba(220,38,38,0.45)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? 'Searching…' : 'Search'}
                  </button>
                </div>

                {/* Torrent Type Selector */}
                <div
                  role="radiogroup"
                  aria-label="Type of torrent"
                  className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1"
                >
                  <span className="px-2.5 text-xs font-semibold tracking-wider text-zinc-400 uppercase">
                    Type
                  </span>
                  {CATEGORIES.map((cat) => {
                    const selected = category === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setCategory(cat.key)}
                        className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-red-500 ${
                          selected
                            ? 'bg-red-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                            : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
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
                className="mb-6 flex items-center justify-between rounded-xl border border-red-700/70 bg-red-950/50 px-4 py-3 text-sm text-red-200"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-3 rounded-md border border-red-700/60 bg-red-900/50 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-800"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Movie / Series Metadata Card */}
            {!loading && searchData?.media && <MediaDetailsCard media={searchData.media} />}

            {/* Sources & Live Status */}
            <section
              aria-label="Torrent sources and fetch status"
              className="mb-6 rounded-xl border border-zinc-800 bg-[#111114] px-4 py-3.5"
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold tracking-wider text-zinc-300 uppercase">
                  {searchData ? 'Source Status & Fetch Breakdown' : 'Configured Torrent Sources'}
                </h2>
                {searchData && (
                  <p className="text-xs text-zinc-300">
                    Showing <strong className="text-white">{results.length}</strong> top results
                    from <strong className="text-white">{searchData.totalRawHits}</strong> fetched
                    in <span className="font-mono text-red-400">{searchData.durationMs}ms</span>
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
                        className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300"
                      >
                        {p.name}
                      </span>
                    ))}
              </div>
            </section>

            {/* Loading State */}
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-zinc-800 bg-[#111114] py-14 text-center"
              >
                <p className="text-sm font-semibold text-white">
                  Searching {PROVIDERS.length} sources for &ldquo;{query}&rdquo;…
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Fetching results and sorting by seed count
                </p>
              </div>
            )}

            {/* Empty State */}
            {!loading && searchData && results.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-[#111114] px-4 py-12 text-center">
                <p className="text-sm font-semibold text-white">
                  No results found for &ldquo;{searchData.query}&rdquo;
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Try broader keywords or switch Type to <strong>All</strong>.
                </p>
              </div>
            )}

            {/* Results Table (Desktop) & Cards (Mobile) */}
            {!loading && results.length > 0 && (
              <section
                aria-label="Search results"
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111114] shadow-xl"
              >
                <h2 className="sr-only">Search Results</h2>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-950 text-xs tracking-wider text-zinc-400 uppercase">
                        <th className="w-10 px-3.5 py-3.5 font-semibold">#</th>
                        <th className="px-3.5 py-3.5 font-semibold">Title</th>
                        <th className="w-32 px-3.5 py-3.5 font-semibold">Provider</th>
                        <th className="w-24 px-3.5 py-3.5 font-semibold">Size</th>
                        <th className="w-20 px-3.5 py-3.5 text-right font-semibold text-white">
                          Seeds
                        </th>
                        <th className="w-20 px-3.5 py-3.5 text-right font-semibold">Peers</th>
                        <th className="w-28 px-3.5 py-3.5 font-semibold">Age</th>
                        <th className="w-44 px-3.5 py-3.5 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {results.map((item, idx) => {
                        const busy = resolvingId === item.id;
                        const copied = copiedId === item.id;
                        return (
                          <tr key={item.id} className="transition hover:bg-zinc-900/70">
                            <td className="px-3.5 py-3 font-mono text-xs text-zinc-400">
                              {idx + 1}
                            </td>
                            <td className="max-w-md px-3.5 py-3 font-medium text-white break-words">
                              {item.title}
                            </td>
                            <td className="px-3.5 py-3">
                              <span className="inline-block rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs font-medium text-zinc-200">
                                {item.provider}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 font-mono text-xs text-zinc-300">
                              {item.size}
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              <span
                                className={`inline-block min-w-[2.5rem] rounded border px-1.5 py-0.5 text-center font-mono text-xs font-semibold ${seedBadgeClass(
                                  item.seeds
                                )}`}
                              >
                                {item.seeds}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono text-xs text-zinc-400">
                              {item.peers}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-zinc-400">
                              {item.time || '—'}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleCopy(item)}
                                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white active:translate-y-px disabled:opacity-50"
                                >
                                  {copied ? 'Copied' : 'Copy'}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleLaunch(item)}
                                  className="rounded-lg bg-gradient-to-b from-red-600 to-red-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:from-red-500 hover:to-red-600 active:translate-y-px disabled:opacity-50"
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

                <div className="divide-y divide-zinc-800 md:hidden">
                  {results.map((item, idx) => {
                    const busy = resolvingId === item.id;
                    const copied = copiedId === item.id;
                    return (
                      <div key={item.id} className="space-y-2.5 p-4">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-mono text-zinc-400">#{idx + 1}</span>
                          <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-medium text-zinc-200">
                            {item.provider}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white break-words">{item.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-zinc-300">{item.size}</span>
                          <span
                            className={`rounded border px-1.5 py-0.5 font-mono font-semibold ${seedBadgeClass(
                              item.seeds
                            )}`}
                          >
                            Seeds: {item.seeds}
                          </span>
                          <span className="font-mono text-zinc-400">Peers: {item.peers}</span>
                          {item.time && <span className="text-zinc-400">{item.time}</span>}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleCopy(item)}
                            className="min-h-[42px] flex-1 rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800"
                          >
                            {copied ? 'Copied!' : 'Copy Magnet'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleLaunch(item)}
                            className="min-h-[42px] flex-1 rounded-lg bg-gradient-to-b from-red-600 to-red-700 py-2 text-xs font-bold text-white transition hover:from-red-500 hover:to-red-600"
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

            {/* Launched Magnet Strip */}
            {launched && (
              <div
                role="region"
                aria-label="Launched magnet link"
                className="mt-5 rounded-xl border border-red-700/60 bg-[#151112] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white sm:text-sm">
                    <span className="text-red-400">Magnet Ready:</span> {launched.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={launched.magnet}
                      className="rounded-lg bg-gradient-to-b from-red-600 to-red-700 px-3.5 py-1.5 text-xs font-bold text-white transition hover:from-red-500 hover:to-red-600"
                    >
                      Open Client
                    </a>
                    <button
                      type="button"
                      onClick={() => setLaunched(null)}
                      className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <p className="mt-2 truncate font-mono text-[11px] text-zinc-400">
                  {launched.magnet}
                </p>
              </div>
            )}
          </>
        )}

        <footer className="mt-12 border-t border-zinc-800/80 pt-5 text-center text-xs text-zinc-400">
          Magnet2Torrent · MIT License · Strictly for legal, open-source P2P transfers.
        </footer>
      </main>
    </div>
  );
}
