import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';
import { CATEGORIES } from '@/lib/types';

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
