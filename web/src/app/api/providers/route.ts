import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      providers: PROVIDERS,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
