import { NextRequest, NextResponse } from 'next/server';
import { searchAllProviders } from '@/lib/providers';
import { CATEGORIES, type CategoryKey } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = (searchParams.get('q') || '').trim();

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

  const rawCategory = searchParams.get('category') || 'All';
  const category: CategoryKey = VALID_CATEGORIES.has(rawCategory)
    ? (rawCategory as CategoryKey)
    : 'All';

  const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 50)) : 20;

  const providersParam = searchParams.get('providers');
  const enabledProviders = providersParam
    ? providersParam
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;

  const startedAt = Date.now();
  try {
    const { results, totalRawHits, providerStats } = await searchAllProviders(
      query,
      category,
      limit,
      enabledProviders
    );

    return NextResponse.json(
      {
        query,
        category,
        limit,
        totalRawHits,
        results,
        providerStats,
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
