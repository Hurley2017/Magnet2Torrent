import { AdvisoryBanner } from '@/components/AdvisoryBanner';
import { MagnetSearch } from '@/components/MagnetSearch';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#140d07] text-[#fef3c7]">
      <AdvisoryBanner />
      <main>
        <MagnetSearch />
      </main>
    </div>
  );
}
