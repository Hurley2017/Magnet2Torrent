import { NextResponse } from 'next/server';
import { CATEGORIES, PROVIDERS } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      providers: PROVIDERS,
      categories: CATEGORIES,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
