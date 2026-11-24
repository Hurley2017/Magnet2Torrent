import { Suspense } from 'react';
import { AdvisoryBanner } from '@/components/AdvisoryBanner';
import { MagnetSearchClient } from '@/components/MagnetSearchClient';

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070b14]">
      {/* Subtle radial glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.12),transparent_70%)]"
      />

      <AdvisoryBanner />

      <main className="relative z-10">
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-slate-400">
              Loading Magnet2Torrent Web…
            </div>
          }
        >
          <MagnetSearchClient />
        </Suspense>
      </main>
    </div>
  );
}
