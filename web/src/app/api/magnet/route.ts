import { NextRequest, NextResponse } from 'next/server';
import { resolveMagnetLink } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      magnet?: string;
      desc?: string;
      title?: string;
    };

    if (body.magnet && body.magnet.startsWith('magnet:?')) {
      return NextResponse.json({ magnet: body.magnet });
    }

    if (!body.desc) {
      return NextResponse.json(
        { error: 'Missing torrent detail URL or magnet link.' },
        { status: 400 }
      );
    }

    const magnet = await resolveMagnetLink(body.desc, body.title || '');
    return NextResponse.json({ magnet });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not fetch magnet link';
    const isClientErr =
      message.includes('Invalid') ||
      message.includes('Unsupported') ||
      message.includes('allowlisted');
    return NextResponse.json(
      { error: message },
      { status: isClientErr ? 400 : 502 }
    );
  }
}
