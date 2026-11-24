interface AdvisoryBannerProps {
  termsAccepted: boolean;
  onResetTerms?: () => void;
}

export function AdvisoryBanner({ termsAccepted, onResetTerms }: AdvisoryBannerProps) {
  return (
    <aside
      aria-label="Legal and anti-piracy advisory"
      className="border-b border-zinc-800 bg-[#0c0c0f]"
    >
      <div className="h-[3px] w-full bg-red-600" />
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <details className="group text-xs">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="bg-red-700 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-white uppercase">
                Advisory
              </span>
              <span>
                Strictly for open-source, public-domain, and authorized P2P distribution.{' '}
                <strong className="font-semibold text-white">No piracy.</strong>
              </span>
            </span>

            <span className="shrink-0 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-200 uppercase transition group-open:border-red-600 group-open:bg-red-700 group-open:text-white hover:border-zinc-500">
              Disclaimer
            </span>
          </summary>

          <div className="mt-2.5 border border-zinc-800 bg-[#121216] p-4 text-xs leading-relaxed text-zinc-300">
            <p className="mb-2">
              <strong className="text-white">Anti-Piracy Policy:</strong> Magnet2Torrent is an
              open-source index aggregator built solely for legal file sharing (Linux distributions,
              Creative Commons media, public-domain works, and open datasets).
            </p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              <li>
                No torrent files or copyrighted media are hosted, stored, or cached by this service.
              </li>
              <li>
                Users bear full legal responsibility for verifying authorization to download any
                content under applicable laws.
              </li>
            </ul>
            {termsAccepted && onResetTerms && (
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5">
                <span className="font-mono text-[11px] text-zinc-400">
                  STATUS: TERMS ACCEPTED
                </span>
                <button
                  type="button"
                  onClick={onResetTerms}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider text-zinc-200 uppercase transition hover:border-red-600 hover:text-white"
                >
                  Revoke Consent
                </button>
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
