'use client';

import { Radio, CheckCircle2, X, Globe, Zap } from 'lucide-react';
import type { ProviderInfo, ProviderStat } from '@/lib/types';

interface ProvidersModalProps {
  open: boolean;
  onClose: () => void;
  providers: ProviderInfo[];
  selectedProviders: string[];
  onToggleProvider: (name: string) => void;
  onSelectAll: () => void;
  stats?: ProviderStat[];
}

export function ProvidersModal({
  open,
  onClose,
  providers,
  selectedProviders,
  onToggleProvider,
  onSelectAll,
  stats,
}: ProvidersModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="providers-modal-title"
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Radio className="h-5 w-5 text-cyan-400" />
            <div>
              <h2 id="providers-modal-title" className="text-lg font-semibold text-white">
                Public Torrent Providers
              </h2>
              <p className="text-xs text-slate-400">
                Choose which public indexes to query concurrently
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close providers dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            {selectedProviders.length} of {providers.length} active
          </span>
          <button
            type="button"
            onClick={onSelectAll}
            className="font-medium text-cyan-400 transition hover:text-cyan-300"
          >
            Enable all providers
          </button>
        </div>

        <div className="space-y-2.5">
          {providers.map((provider) => {
            const active = selectedProviders.includes(provider.name);
            const stat = stats?.find((s) => s.name === provider.name);

            return (
              <button
                key={provider.name}
                type="button"
                onClick={() => onToggleProvider(provider.name)}
                className={`flex w-full items-start justify-between gap-4 rounded-xl border p-3.5 text-left transition ${
                  active
                    ? 'border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/30'
                    : 'border-slate-800 bg-slate-950/40 opacity-65 hover:opacity-100'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{provider.name}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300">
                      <Globe className="h-3 w-3 text-slate-400" />
                      {provider.baseUrl.replace(/^https?:\/\//, '')}
                    </span>
                    {provider.supportsDirectMagnet && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                        <Zap className="h-3 w-3" />
                        Instant Magnet
                      </span>
                    )}
                    {stat && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          stat.status === 'ok'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : stat.status === 'empty' || stat.status === 'skipped'
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {stat.status === 'ok'
                          ? `${stat.count} hits · ${stat.durationMs}ms`
                          : stat.status === 'empty'
                            ? `0 hits · ${stat.durationMs}ms`
                            : stat.status === 'skipped'
                              ? 'category skipped'
                              : `${stat.status} (${stat.error || 'blocked'})`}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{provider.description}</p>
                </div>

                <div
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    active
                      ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                      : 'border-slate-600 bg-slate-900'
                  }`}
                >
                  {active && <CheckCircle2 className="h-4 w-4" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
