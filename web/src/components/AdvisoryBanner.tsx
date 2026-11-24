'use client';

import { useState } from 'react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

export function AdvisoryBanner() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="border-b border-amber-500/25 bg-amber-950/30 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs sm:px-6 sm:text-sm">
          <div className="flex items-start gap-2.5 text-amber-200/95 sm:items-center">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400 sm:mt-0" />
            <p>
              <span className="font-semibold text-amber-300">Legal Advisory:</span>{' '}
              Magnet2Torrent is strictly intended for open-source, public-domain, and legally
              distributable P2P content (e.g., Linux ISOs).{' '}
              <span className="font-semibold text-amber-200">
                Do not use this tool for copyright infringement or piracy.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
          >
            Legal Disclaimer
          </button>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-title"
        >
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <h2 id="disclaimer-title" className="text-lg font-semibold text-white">
                  Legal Advisory &amp; Anti-Piracy Notice
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close disclaimer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-300">
              <section>
                <h3 className="mb-1 font-semibold text-cyan-300">Purpose and Scope</h3>
                <p>
                  <strong>Magnet2Torrent</strong> is an open-source search interface developed
                  strictly for educational, research, and legitimate file-distribution purposes
                  using the BitTorrent peer-to-peer protocol, including Linux distributions,
                  open-source software releases, public-domain archives, Creative Commons media,
                  and scientific datasets.
                </p>
              </section>

              <section className="rounded-xl border border-amber-500/25 bg-amber-950/25 p-4">
                <h3 className="mb-2 font-semibold text-amber-300">Anti-Piracy Statement</h3>
                <ul className="list-disc space-y-2 pl-5 text-amber-100/90">
                  <li>
                    <strong>No Piracy Endorsement:</strong> The creator and contributors do{' '}
                    <strong>not</strong> endorse, promote, encourage, or condone software piracy,
                    unauthorized downloading, or digital copyright infringement.
                  </li>
                  <li>
                    <strong>No Content Hosting:</strong> This application does <strong>not</strong>{' '}
                    host, store, index, cache, or maintain any torrent files, media files, or
                    copyrighted data. It queries third-party public search endpoints on demand.
                  </li>
                  <li>
                    <strong>User Responsibility:</strong> Users bear sole responsibility for
                    verifying that they hold the legal right, license, or authorization to access
                    or download any material retrieved via this tool.
                  </li>
                  <li>
                    <strong>Compliance with Laws:</strong> Users must comply with all applicable
                    local, national, and international copyright laws and ISP terms of service.
                  </li>
                  <li>
                    <strong>No Liability:</strong> Under no circumstances shall the authors or
                    distributors be liable for misuse, copyright infringement, or legal actions
                    arising from the use of this tool.
                  </li>
                </ul>
              </section>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
