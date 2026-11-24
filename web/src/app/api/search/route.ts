import { NextRequest, NextResponse } from 'next/server';
import { searchAllProviders } from '@/lib/providers';
import { prefetchMediaCandidates, resolveMatchedMedia } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get('q') || '').trim();

  if (!query) {
    return NextResponse.json(
      { error: 'Please enter a search query.' },
      { status: 400 }
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { error: 'Search query is too long (max 200 characters).' },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  try {
    const [searchOut, candidates] = await Promise.all([
      searchAllProviders(query),
      prefetchMediaCandidates(query),
    ]);

    const media = await resolveMatchedMedia(candidates, searchOut.results);

    return NextResponse.json(
      {
        query,
        totalRawHits: searchOut.totalRawHits,
        results: searchOut.results,
        providerStats: searchOut.providerStats,
        media,
        durationMs: Date.now() - startedAt,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
