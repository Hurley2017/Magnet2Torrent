import { NextResponse } from 'next/server';

const RAW_INSTALLER_URL =
  'https://raw.githubusercontent.com/Hurley2017/Magnet2Torrent/main/install.ps1';

export const dynamic = 'force-static';

export function GET() {
  return NextResponse.redirect(RAW_INSTALLER_URL, 307);
}
