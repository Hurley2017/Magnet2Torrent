'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Magnet, X } from 'lucide-react';
import type { TorrentResult } from '@/lib/types';

interface MagnetLaunchModalProps {
  torrent: TorrentResult | null;
  magnet: string | null;
  onClose: () => void;
}

export function MagnetLaunchModal({ torrent, magnet, onClose }: MagnetLaunchModalProps) {
  const [copied, setCopied] = useState(false);

  if (!torrent || !magnet) return null;

  async function handleCopy() {
    if (!magnet) return;
    try {
      await navigator.clipboard.writeText(magnet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="magnet-modal-title"
    >
      <div className="relative w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
              <Magnet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="magnet-modal-title" className="text-base font-semibold text-white">
                Magnet Link Ready
              </h2>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-300">{torrent.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close magnet modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
              Provider: <strong className="text-cyan-300">{torrent.provider}</strong>
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
              Size: <strong className="text-white">{torrent.size}</strong>
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
              Seeds: <strong className="text-emerald-400">{torrent.seeds}</strong>
            </span>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Magnet URI
            </label>
            <textarea
              readOnly
              value={magnet}
              rows={3}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            Your browser was asked to open your default torrent client (qBittorrent, Transmission,
            Deluge, uTorrent, etc.). If nothing opened, click <strong>Open Torrent Client</strong>{' '}
            below or copy the magnet URI manually.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Magnet
              </>
            )}
          </button>

          <a
            href={magnet}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
          >
            <ExternalLink className="h-4 w-4" />
            Open Torrent Client
          </a>
        </div>
      </div>
    </div>
  );
}
