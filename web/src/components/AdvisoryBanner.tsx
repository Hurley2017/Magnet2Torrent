interface AdvisoryBannerProps {
  termsAccepted: boolean;
  onResetTerms?: () => void;
}

export function AdvisoryBanner({ termsAccepted, onResetTerms }: AdvisoryBannerProps) {
  return (
    <aside
      aria-label="Legal and anti-piracy advisory"
      className="border-b border-zinc-800 bg-zinc-950"
    >
      <div className="h-1 w-full bg-gradient-to-r from-red-800 via-red-600 to-red-800" />
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <details className="group text-xs sm:text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500">
            <span className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-red-700 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white uppercase">
                Legal Advisory
              </span>
              <span>
                Strictly for open-source, public-domain, and authorized P2P transfers.{' '}
                <strong className="font-semibold text-white">Do not use for piracy.</strong>
              </span>
            </span>

            <span className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 transition group-open:border-red-600 group-open:bg-red-700 group-open:text-white hover:border-zinc-500">
              Disclaimer
            </span>
          </summary>

          <div className="mt-3 rounded-lg border border-zinc-800 bg-[#111114] p-4 text-xs leading-relaxed text-zinc-300">
            <p className="mb-2">
              <strong className="text-white">Anti-Piracy Policy:</strong> Magnet2Torrent is an
              open-source search tool intended solely for legal file sharing (Linux distributions,
              Creative Commons media, public-domain works, and open datasets).
            </p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              <li>
                No torrent files or copyrighted media are hosted, cached, or indexed by this
                application.
              </li>
              <li>
                Users bear sole responsibility for complying with applicable copyright laws and
                verifying authorization to access any content.
              </li>
            </ul>
            {termsAccepted && onResetTerms && (
              <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5">
                <span className="text-zinc-400">Status: Terms accepted</span>
                <button
                  type="button"
                  onClick={onResetTerms}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-red-600 hover:text-white"
                >
                  Revoke &amp; Review Gate
                </button>
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
