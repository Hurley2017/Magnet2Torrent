export function AdvisoryBanner() {
  return (
    <aside
      aria-label="Legal and anti-piracy advisory"
      className="border-b border-yellow-500/35 bg-[#231609]"
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6">
        <details className="group text-xs sm:text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[#fde68a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400">
            <span className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0 text-yellow-400"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span>
                <strong className="font-semibold text-yellow-300">Legal Advisory:</strong>{' '}
                Strictly for open-source, public-domain, and authorized P2P sharing.{' '}
                <strong className="text-yellow-200">Do not use for piracy.</strong>
              </span>
            </span>
            <span className="shrink-0 rounded border border-yellow-500/40 bg-[#32200d] px-2 py-0.5 text-[11px] font-medium text-yellow-300 group-open:bg-yellow-400 group-open:text-[#140d07]">
              Disclaimer
            </span>
          </summary>

          <div className="mt-3 rounded-lg border border-yellow-500/30 bg-[#1a1006] p-3.5 text-xs leading-relaxed text-[#f5e3be]">
            <p className="mb-2">
              <strong className="text-yellow-300">Anti-Piracy Notice:</strong> Magnet2Torrent is an
              open-source search interface intended solely for legal file sharing (such as Linux
              distributions, Creative Commons works, public-domain media, and open datasets).
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[#ebd3a7]">
              <li>
                No torrent files or media are hosted, cached, or indexed by this app — queries go to
                external public APIs on demand.
              </li>
              <li>
                Users bear sole responsibility for complying with applicable copyright laws and
                verifying authorization to download any content.
              </li>
            </ul>
          </div>
        </details>
      </div>
    </aside>
  );
}
