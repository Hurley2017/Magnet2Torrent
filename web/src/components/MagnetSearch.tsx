'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PROVIDERS,
  type MediaMetadata,
  type ProviderStat,
  type SearchResponse,
  type TorrentResult,
} from '@/lib/catalog';
import { AdvisoryBanner } from './AdvisoryBanner';

const TERMS_STORAGE_KEY = 'm2t_terms_accepted_v1';

function seedClass(seeds: number): string {
  if (seeds >= 100) return 'border-emerald-500/70 bg-emerald-950/75 text-emerald-200';
  if (seeds >= 10) return 'border-emerald-700/70 bg-emerald-950/55 text-emerald-300';
  return 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300';
}

function peerClass(): string {
  return 'border-amber-600/65 bg-amber-950/55 text-amber-300';
}

function formatStat(stat: ProviderStat): {
  badge: string;
  detail: string;
  className: string;
} {
  switch (stat.status) {
    case 'ok':
      return {
        badge: 'UP',
        detail: `${stat.count} hits · ${stat.durationMs}ms`,
        className: 'border-zinc-600 bg-zinc-800 text-white',
      };
    case 'empty':
      return {
        badge: '0',
        detail: `0 hits · ${stat.durationMs}ms`,
        className: 'border-zinc-800 bg-zinc-950 text-zinc-400',
      };
    case 'timeout':
      return {
        badge: 'DOWN',
        detail: 'Timed out',
        className: 'border-red-700/70 bg-red-950/60 text-red-300',
      };
    case 'error':
    default:
      return {
        badge: 'DOWN',
        detail: stat.error || 'Error',
        className: 'border-red-700/70 bg-red-950/60 text-red-300',
      };
  }
}

function computeDynamicPageSize(
  viewportWidth: number,
  viewportHeight: number,
  hasMediaCard: boolean
): number {
  const isDesktopSplit = viewportWidth >= 1024;
  const chromeHeight = isDesktopSplit ? 310 : hasMediaCard ? 460 : 330;
  const rowHeight = viewportWidth >= 640 ? 104 : 132;
  const available = Math.max(360, viewportHeight - chromeHeight);
  const count = Math.floor(available / rowHeight);
  return Math.max(4, Math.min(count, 15));
}

function getPageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: Array<number | 'ellipsis'> = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push('ellipsis');
  for (let p = left; p <= right; p += 1) {
    pages.push(p);
  }
  if (right < total - 1) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

function MagnetIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
    >
      <g transform="rotate(-45 16 16)">
        <path
          d="M9 7v9a7 7 0 0 0 14 0V7h-4.5v9a2.5 2.5 0 0 1-5 0V7H9z"
          fill="#dc2626"
        />
        <rect x="9" y="6" width="4.5" height="4.2" rx="0.8" fill="#ffffff" />
        <rect x="18.5" y="6" width="4.5" height="4.2" rx="0.8" fill="#ffffff" />
        <rect x="9" y="10.2" width="4.5" height="1.2" fill="#a1a1aa" />
        <rect x="18.5" y="10.2" width="4.5" height="1.2" fill="#a1a1aa" />
      </g>
    </svg>
  );
}

function MediaDossier({ media }: { media: MediaMetadata }) {
  const [posterHidden, setPosterHidden] = useState(false);

  return (
    <section
      aria-label="Title dossier"
      className="border border-zinc-800 bg-[#101014]"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
        <span className="font-mono text-[11px] font-bold tracking-widest text-red-400 uppercase">
          {media.type === 'movie' ? 'Movie Dossier' : 'Series Dossier'}
        </span>
        {media.rating && (
          <span className="bg-red-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
            IMDb {media.rating}/10
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex gap-4">
          {media.poster && !posterHidden && (
            <img
              src={media.poster}
              alt={`${media.name} poster`}
              width={96}
              height={144}
              onError={() => setPosterHidden(true)}
              className="h-[144px] w-[96px] shrink-0 border border-zinc-700 bg-zinc-950 object-cover"
            />
          )}
          <div className="min-w-0 space-y-2">
            <h2 className="text-lg leading-snug font-bold text-white">{media.name}</h2>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-zinc-300">
              {media.year && (
                <span className="border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                  {media.year}
                </span>
              )}
              {media.runtime && (
                <span className="border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                  {media.runtime}
                </span>
              )}
              {media.seasonsCount && (
                <span className="border border-zinc-800 bg-zinc-950 px-2 py-0.5">
                  {media.seasonsCount}S{media.episodesCount ? ` · ${media.episodesCount}E` : ''}
                </span>
              )}
            </div>
            {media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {media.genres.slice(0, 4).map((g) => (
                  <span
                    key={g}
                    className="border border-zinc-800 bg-black px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 uppercase"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {media.description && (
          <p className="text-xs leading-relaxed text-zinc-300">{media.description}</p>
        )}

        {(media.director?.length || media.cast?.length || media.awards || media.country) && (
          <dl className="space-y-1 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
            {media.director && media.director.length > 0 && (
              <div>
                <dt className="inline font-semibold text-zinc-200">Director: </dt>
                <dd className="inline">{media.director.join(', ')}</dd>
              </div>
            )}
            {media.cast && media.cast.length > 0 && (
              <div>
                <dt className="inline font-semibold text-zinc-200">Cast: </dt>
                <dd className="inline">{media.cast.join(', ')}</dd>
              </div>
            )}
            {media.country && (
              <div>
                <dt className="inline font-semibold text-zinc-200">Country: </dt>
                <dd className="inline">{media.country}</dd>
              </div>
            )}
            {media.awards && (
              <div>
                <dt className="inline font-semibold text-zinc-200">Awards: </dt>
                <dd className="inline">{media.awards}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}

interface ResultRowProps {
  item: TorrentResult;
  rank: number;
  busy: boolean;
  copied: boolean;
  onCopy: (item: TorrentResult) => void;
  onLaunch: (item: TorrentResult) => void;
}

function ResultRow({ item, rank, busy, copied, onCopy, onLaunch }: ResultRowProps) {
  return (
    <article className="p-4 transition hover:bg-zinc-900/60">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <span className="font-bold text-red-400">{String(rank).padStart(2, '0')}</span>
            <span>//</span>
            <span className="font-semibold text-zinc-200">{item.provider}</span>
            {item.time && (
              <>
                <span>·</span>
                <span>{item.time}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 text-sm leading-snug font-semibold text-white break-words sm:text-base">
            {item.title}
          </h3>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-zinc-200">
            {item.size}
          </span>
          <span className={`border px-2 py-0.5 font-semibold ${seedClass(item.seeds)}`}>
            Seeds: {item.seeds}
          </span>
          <span className={`border px-2 py-0.5 font-semibold ${peerClass()}`}>
            Peers: {item.peers}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onCopy(item)}
            className="min-h-[38px] rounded-md border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 font-mono text-[11px] font-semibold tracking-wider text-zinc-100 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white active:translate-y-px disabled:opacity-50"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onLaunch(item)}
            aria-label={`Launch ${item.title}`}
            title="Launch in default torrent client"
            className="inline-flex min-h-[38px] min-w-[44px] items-center justify-center rounded-md border border-red-700/80 bg-zinc-950 px-3 py-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_10px_rgba(185,28,28,0.25)] transition hover:border-red-500 hover:bg-red-950/60 hover:shadow-[0_0_16px_rgba(220,38,38,0.4)] active:translate-y-px disabled:opacity-50"
          >
            {busy ? (
              <span className="font-mono text-[11px] text-red-300">...</span>
            ) : (
              <MagnetIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

export function MagnetSearch() {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<SearchResponse | null>(null);
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [launched, setLaunched] = useState<{ title: string; magnet: string } | null>(null);

  // Dynamic viewport-aware pagination
  const [pageSize, setPageSize] = useState(7);
  const [currentPage, setCurrentPage] = useState(1);

  const searchCacheRef = useRef<Map<string, SearchResponse>>(new Map());
  const internalNavCountRef = useRef(0);
  const resultsTopRef = useRef<HTMLDivElement | null>(null);
  const currentPageRef = useRef(1);
  const pageSizeRef = useRef(7);
  currentPageRef.current = currentPage;
  pageSizeRef.current = pageSize;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function updateSize() {
      const nextSize = computeDynamicPageSize(
        window.innerWidth,
        window.innerHeight,
        Boolean(searchData?.media)
      );
      if (nextSize !== pageSizeRef.current) {
        const anchorIndex = (currentPageRef.current - 1) * pageSizeRef.current;
        const nextPage = Math.floor(anchorIndex / nextSize) + 1;
        setPageSize(nextSize);
        setCurrentPage(Math.max(1, nextPage));
      }
    }

    updateSize();
    function handleResize() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(updateSize, 120);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timer) clearTimeout(timer);
    };
  }, [searchData?.media]);

  const clearToHomeState = useCallback(() => {
    setQuery('');
    setLoading(false);
    setError(null);
    setSearchData(null);
    setResults([]);
    setLaunched(null);
    setCurrentPage(1);
  }, []);

  const runSearch = useCallback(async (q: string, pushHistory = true) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setError('Please enter a search term.');
      return;
    }

    if (pushHistory && typeof window !== 'undefined') {
      const targetUrl = `/?${new URLSearchParams({ q: trimmed }).toString()}`;
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== targetUrl) {
        window.history.pushState({ q: trimmed }, '', targetUrl);
        internalNavCountRef.current += 1;
      }
    }

    const cached = searchCacheRef.current.get(trimmed.toLowerCase());
    if (cached && !pushHistory) {
      setQuery(cached.query);
      setSearchData(cached);
      setResults(cached.results);
      setCurrentPage(1);
      setError(null);
      setLaunched(null);
      return;
    }

    setLoading(true);
    setError(null);
    setLaunched(null);
    setCurrentPage(1);

    try {
      const params = new URLSearchParams({ q: trimmed });
      const res = await fetch(`/api/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Search failed');
      }
      const typed = json as SearchResponse;
      searchCacheRef.current.set(trimmed.toLowerCase(), typed);
      setSearchData(typed);
      setResults(typed.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach search API.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGoHome = useCallback(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== '/') {
        window.history.pushState({ q: '' }, '', '/');
        internalNavCountRef.current += 1;
      }
    }
    clearToHomeState();
  }, [clearToHomeState]);

  const handleGoBack = useCallback(() => {
    if (typeof window !== 'undefined' && internalNavCountRef.current > 0) {
      internalNavCountRef.current -= 1;
      window.history.back();
      return;
    }
    handleGoHome();
  }, [handleGoHome]);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const urlQ = (sp.get('q') || '').trim();
    if (urlQ) setQuery(urlQ);

    try {
      if (window.localStorage.getItem(TERMS_STORAGE_KEY) === '1') {
        setTermsAccepted(true);
        if (urlQ) {
          runSearch(urlQ, false);
        }
      }
    } catch {
      // Storage unavailable; require explicit acceptance
    }
  }, [runSearch]);

  useEffect(() => {
    function onPopState() {
      const sp = new URLSearchParams(window.location.search);
      const urlQ = (sp.get('q') || '').trim();
      if (!urlQ) {
        clearToHomeState();
        return;
      }
      setQuery(urlQ);
      if (termsAccepted) {
        runSearch(urlQ, false);
      }
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [clearToHomeState, runSearch, termsAccepted]);

  function handleAcceptTerms(e: React.FormEvent) {
    e.preventDefault();
    if (!checkboxChecked) return;
    try {
      window.localStorage.setItem(TERMS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failure
    }
    setTermsAccepted(true);
    if (query.trim()) {
      runSearch(query, false);
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
    runSearch(query, true);
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

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, results.length);

  const pagedItems = useMemo(
    () =>
      results.slice(startIdx, endIdx).map((item, offset) => ({
        item,
        rank: startIdx + offset + 1,
      })),
    [endIdx, results, startIdx]
  );

  const { totalMatchedCount, pageMatched, pageOthers } = useMemo(() => {
    if (!searchData?.media) {
      return {
        totalMatchedCount: 0,
        pageMatched: [] as Array<{ item: TorrentResult; rank: number }>,
        pageOthers: pagedItems,
      };
    }
    const matchedTotal = results.filter((r) => r.isExactMatch).length;
    return {
      totalMatchedCount: matchedTotal,
      pageMatched: pagedItems.filter((entry) => entry.item.isExactMatch),
      pageOthers: pagedItems.filter((entry) => !entry.item.isExactMatch),
    };
  }, [pagedItems, results, searchData?.media]);

  const showSplitMediaGroups = Boolean(searchData?.media && totalMatchedCount > 0);

  function goToPage(page: number) {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <div className="min-h-screen bg-[#070709] text-white">
      <AdvisoryBanner termsAccepted={termsAccepted} onResetTerms={handleResetTerms} />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        {/* Editorial Masthead */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-red-400 uppercase">
              Distributed Magnet Search Engine
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tighter text-white sm:text-4xl">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  handleGoHome();
                }}
                className="transition hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
              >
                MAGNET<span className="text-red-500">2</span>TORRENT
              </a>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {(searchData || loading || error) && termsAccepted && (
              <button
                type="button"
                onClick={handleGoBack}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-xs font-semibold tracking-wide text-zinc-100 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-red-600 hover:bg-zinc-800 hover:text-white active:translate-y-px"
              >
                Back
              </button>
            )}
            <span className="hidden border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] text-zinc-300 sm:inline-block">
              {PROVIDERS.length} SOURCES INDEXED
            </span>
            <a
              href="https://github.com/Hurley2017/Magnet2Torrent"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-xs font-semibold tracking-wide text-zinc-100 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-red-600 hover:bg-zinc-800 hover:text-white focus-visible:outline-2 focus-visible:outline-red-500"
            >
              GitHub / CLI
            </a>
          </div>
        </header>

        {/* Mandatory Terms & Conditions Gate */}
        {!termsAccepted ? (
          <section
            aria-labelledby="terms-heading"
            className="grid gap-6 border border-zinc-800 bg-[#0e0e12] p-6 sm:p-8 lg:grid-cols-12 lg:gap-10"
          >
            <div className="flex flex-col justify-between space-y-5 border-b border-zinc-800 pb-6 lg:col-span-5 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
              <div>
                <span className="inline-block bg-red-700 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-white uppercase">
                  Required Consent
                </span>
                <h2
                  id="terms-heading"
                  className="mt-4 text-2xl leading-tight font-black tracking-tight text-white sm:text-3xl"
                >
                  LEGAL P2P DISTRIBUTION ONLY.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                  Magnet2Torrent indexes public BitTorrent sources strictly for open-source
                  software, Linux distributions, Creative Commons works, and public-domain media.
                </p>
              </div>
              <p className="font-mono text-[11px] text-zinc-400">
                ACCEPT THE TERMS TO UNLOCK SEARCH
              </p>
            </div>

            <div className="space-y-5 lg:col-span-7">
              <div className="divide-y divide-zinc-800 border border-zinc-800 bg-zinc-950 text-xs leading-relaxed text-zinc-300 sm:text-sm">
                <div className="p-3.5">
                  <span className="mr-2 font-mono font-bold text-red-400">01 //</span>
                  <strong className="text-white">No Piracy:</strong> Do not search, download, or
                  distribute copyrighted files without explicit authorization.
                </div>
                <div className="p-3.5">
                  <span className="mr-2 font-mono font-bold text-red-400">02 //</span>
                  <strong className="text-white">Zero Hosting:</strong> No torrent files or media
                  are hosted, stored, or cached by this application.
                </div>
                <div className="p-3.5">
                  <span className="mr-2 font-mono font-bold text-red-400">03 //</span>
                  <strong className="text-white">User Compliance:</strong> You assume sole legal
                  responsibility for complying with applicable laws in your jurisdiction.
                </div>
              </div>

              <form onSubmit={handleAcceptTerms} className="space-y-4">
                <label
                  htmlFor="accept-terms-checkbox"
                  className="flex cursor-pointer items-start gap-3 border border-zinc-800 bg-zinc-950/90 p-3.5 text-xs text-zinc-200 transition hover:border-zinc-600 sm:text-sm"
                >
                  <input
                    id="accept-terms-checkbox"
                    type="checkbox"
                    checked={checkboxChecked}
                    onChange={(e) => setCheckboxChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                  />
                  <span>
                    I accept the{' '}
                    <strong className="text-white">Legal Disclaimer &amp; Terms of Use</strong> and
                    confirm I will use this tool solely for lawful transfers.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!checkboxChecked}
                  className="w-full rounded-md bg-gradient-to-b from-red-600 to-red-700 px-6 py-3.5 font-mono text-sm font-bold tracking-wider text-white uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_16px_rgba(185,28,28,0.4)] transition hover:from-red-500 hover:to-red-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_24px_rgba(220,38,38,0.5)] active:translate-y-px disabled:cursor-not-allowed disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-400 disabled:shadow-none"
                >
                  Accept Terms &amp; Enter
                </button>
              </form>
            </div>
          </section>
        ) : (
          <>
            {/* Command Bar Search */}
            <section aria-label="Search command bar" className="mb-8">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col border border-zinc-700 bg-[#101014] p-1.5 transition focus-within:border-red-600 sm:flex-row sm:items-stretch"
              >
                <label htmlFor="torrent-search" className="sr-only">
                  Search torrents
                </label>
                <input
                  id="torrent-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter title (e.g. Ubuntu 24.04, Inception, Breaking Bad)..."
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-zinc-400 focus:outline-none sm:text-base"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[46px] min-w-[140px] rounded-md bg-gradient-to-b from-red-600 to-red-700 px-6 py-3 font-mono text-xs font-bold tracking-widest text-white uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_12px_rgba(185,28,28,0.4)] transition hover:from-red-500 hover:to-red-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_20px_rgba(220,38,38,0.5)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </form>
            </section>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="mb-6 flex items-center justify-between border border-red-700 bg-red-950/60 px-4 py-3 text-sm text-red-200"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-3 rounded border border-red-700 bg-red-900/60 px-3 py-1 font-mono text-xs font-semibold text-white uppercase transition hover:bg-red-800"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Pre-Search Index Grid (Home) */}
            {!loading && !searchData && (
              <section aria-label="Active torrent index roster" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-300 uppercase">
                    Active Index Roster
                  </h2>
                  <span className="font-mono text-[11px] text-zinc-400">
                    Searches across all {PROVIDERS.length} sources automatically
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-px border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-3">
                  {PROVIDERS.map((p, idx) => (
                    <div key={p.name} className="bg-[#0e0e12] p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-red-400">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-200 uppercase">
                          Ready
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-bold text-white">{p.name}</h3>
                      <p className="mt-1 text-xs text-zinc-400">{p.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Loading State */}
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="border border-zinc-800 bg-[#0e0e12] py-16 text-center"
              >
                <p className="font-mono text-sm font-bold tracking-wider text-white uppercase">
                  Querying {PROVIDERS.length} Sources…
                </p>
                <p className="mt-1.5 text-xs text-zinc-400">
                  Aggregating results and sorting by highest seeders
                </p>
              </div>
            )}

            {/* Post-Search Split Workspace */}
            {!loading && searchData && (
              <div ref={resultsTopRef} className="grid gap-6 lg:grid-cols-12 lg:items-start">
                {/* Left Sidebar Rail: Media Dossier + Source Fetch Ledger */}
                <aside className="space-y-6 lg:sticky lg:top-6 lg:col-span-4">
                  {searchData.media && <MediaDossier media={searchData.media} />}

                  <section
                    aria-label="Source status and fetch breakdown"
                    className="border border-zinc-800 bg-[#101014]"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
                      <h2 className="font-mono text-[11px] font-bold tracking-widest text-zinc-200 uppercase">
                        Source Ledger
                      </h2>
                      <span className="font-mono text-[11px] text-red-400">
                        {searchData.durationMs}ms
                      </span>
                    </div>

                    <ul className="divide-y divide-zinc-800/80">
                      {searchData.providerStats.map((stat) => {
                        const info = formatStat(stat);
                        return (
                          <li
                            key={stat.name}
                            className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-white">{stat.name}</div>
                              <div className="font-mono text-[11px] text-zinc-400">
                                {info.detail}
                              </div>
                            </div>
                            <span
                              className={`shrink-0 border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase ${info.className}`}
                            >
                              {info.badge}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </aside>

                {/* Right Results Feed */}
                <section aria-label="Search results" className="space-y-6 lg:col-span-8">
                  {results.length === 0 ? (
                    <div className="border border-zinc-800 bg-[#101014] px-6 py-12 text-center">
                      <p className="text-sm font-bold text-white">
                        No results found for &ldquo;{searchData.query}&rdquo;
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        Try different keywords or inspect source availability on the left.
                      </p>
                    </div>
                  ) : (
                    <>
                      {showSplitMediaGroups ? (
                        <>
                          {pageMatched.length > 0 && (
                            <div>
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-red-800/60 pb-2.5">
                                <h2 className="font-mono text-xs font-bold tracking-widest text-white uppercase">
                                  <span className="text-red-400">Matched: </span>
                                  {searchData.media!.name} // {totalMatchedCount} Total
                                </h2>
                                <span className="font-mono text-[11px] text-zinc-400">
                                  HIGHEST SEEDERS FIRST
                                </span>
                              </div>
                              <div className="divide-y divide-zinc-800 border border-zinc-800 bg-[#101014]">
                                {pageMatched.map(({ item, rank }) => (
                                  <ResultRow
                                    key={item.id}
                                    item={item}
                                    rank={rank}
                                    busy={resolvingId === item.id}
                                    copied={copiedId === item.id}
                                    onCopy={handleCopy}
                                    onLaunch={handleLaunch}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {pageOthers.length > 0 && (
                            <div>
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                                <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-300 uppercase">
                                  Rest of Search Results // {results.length - totalMatchedCount} Total
                                </h2>
                                <span className="font-mono text-[11px] text-zinc-400">
                                  HIGHEST SEEDERS FIRST
                                </span>
                              </div>
                              <div className="divide-y divide-zinc-800 border border-zinc-800 bg-[#101014]">
                                {pageOthers.map(({ item, rank }) => (
                                  <ResultRow
                                    key={item.id}
                                    item={item}
                                    rank={rank}
                                    busy={resolvingId === item.id}
                                    copied={copiedId === item.id}
                                    onCopy={handleCopy}
                                    onLaunch={handleLaunch}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                            <h2 className="font-mono text-xs font-bold tracking-widest text-zinc-200 uppercase">
                              Results // {results.length} Shown of {searchData.totalRawHits} Fetched
                            </h2>
                            <span className="font-mono text-[11px] text-zinc-400">
                              HIGHEST SEEDERS FIRST
                            </span>
                          </div>
                          <div className="divide-y divide-zinc-800 border border-zinc-800 bg-[#101014]">
                            {pagedItems.map(({ item, rank }) => (
                              <ResultRow
                                key={item.id}
                                item={item}
                                rank={rank}
                                busy={resolvingId === item.id}
                                copied={copiedId === item.id}
                                onCopy={handleCopy}
                                onLaunch={handleLaunch}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dynamic Viewport Pagination Controls */}
                      <nav
                        aria-label="Pagination"
                        className="flex flex-wrap items-center justify-between gap-3 border border-zinc-800 bg-[#101014] px-4 py-3"
                      >
                        <p className="font-mono text-[11px] text-zinc-300">
                          SHOWING {startIdx + 1}–{endIdx} OF {results.length} ({pageSize}/SCREEN)
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => goToPage(safePage - 1)}
                            className="min-h-[36px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[11px] font-semibold text-zinc-200 uppercase transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Prev
                          </button>

                          {getPageNumbers(safePage, totalPages).map((entry, i) =>
                            entry === 'ellipsis' ? (
                              <span
                                key={`ellipsis-${i}`}
                                className="px-1.5 font-mono text-xs text-zinc-400"
                              >
                                …
                              </span>
                            ) : (
                              <button
                                key={entry}
                                type="button"
                                aria-current={entry === safePage ? 'page' : undefined}
                                onClick={() => goToPage(entry)}
                                className={`min-h-[36px] min-w-[36px] rounded-md border px-2.5 py-1 font-mono text-xs font-bold transition ${
                                  entry === safePage
                                    ? 'border-red-600 bg-red-700 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                                    : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600 hover:text-white'
                                }`}
                              >
                                {entry}
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => goToPage(safePage + 1)}
                            className="min-h-[36px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1 font-mono text-[11px] font-semibold text-zinc-200 uppercase transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </nav>
                    </>
                  )}
                </section>
              </div>
            )}

            {/* Launched Magnet Bar */}
            {launched && (
              <div
                role="region"
                aria-label="Launched magnet link"
                className="mt-6 border border-red-700 bg-[#140e10] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-white sm:text-sm">
                    <span className="font-mono text-red-400 uppercase">Magnet Ready // </span>
                    {launched.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={launched.magnet}
                      className="rounded-md bg-gradient-to-b from-red-600 to-red-700 px-4 py-1.5 font-mono text-xs font-bold tracking-wider text-white uppercase transition hover:from-red-500 hover:to-red-600"
                    >
                      Open Client
                    </a>
                    <button
                      type="button"
                      onClick={() => setLaunched(null)}
                      className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-200 uppercase transition hover:bg-zinc-800"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <p className="mt-2 truncate font-mono text-[11px] text-zinc-300">
                  {launched.magnet}
                </p>
              </div>
            )}
          </>
        )}

        <footer className="mt-14 border-t border-zinc-800 pt-5 text-center font-mono text-[11px] text-zinc-400">
          MAGNET2TORRENT // MIT LICENSE // STRICTLY FOR LEGAL &amp; OPEN-SOURCE P2P TRANSFERS
        </footer>
      </main>
    </div>
  );
}
